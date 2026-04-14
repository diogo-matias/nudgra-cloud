import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import {
  getSelectedWorkspaceInstagramAccount,
  listWorkspaceInstagramAccounts,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "./lib/auth";
import { parseMetaApiError } from "./meta/authShared";

const DELIVERY_ISSUE_STATUSES = new Set<Doc<"deliveryAttempts">["status"]>([
  "failed",
  "blocked_auth",
  "skipped",
  "skipped_expired",
]);

type DashboardLogStatus = Doc<"deliveryAttempts">["status"] | "received";

function withReason(summary: string, reason: string | null | undefined) {
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    return summary;
  }

  return `${summary} ${trimmedReason.endsWith(".") ? trimmedReason : `${trimmedReason}.`}`;
}

function buildActivityLabel(args: {
  delivery?: Doc<"deliveryAttempts">;
  webhook?: Doc<"webhookEvents">;
  contactUsername?: string | null;
}) {
  if (args.delivery) {
    const subject = args.contactUsername ? `@${args.contactUsername}` : "contact";
    if (args.delivery.status === "sent") {
      return `Reply sent to ${subject}.`;
    }
    if (args.delivery.status === "queued") {
      return args.delivery.attemptNumber > 1
        ? `Retry ${args.delivery.attemptNumber} is queued for ${subject}.`
        : `Reply queued for ${subject}.`;
    }
    if (args.delivery.status === "blocked_auth") {
      return withReason(`Reply paused for ${subject}.`, args.delivery.reason);
    }
    if (args.delivery.status === "skipped") {
      return withReason(`Reply skipped for ${subject}.`, args.delivery.reason);
    }
    if (args.delivery.status === "skipped_expired") {
      return withReason(`Reply expired for ${subject}.`, args.delivery.reason);
    }
    return withReason(`Reply failed for ${subject}.`, args.delivery.reason);
  }

  if (args.webhook) {
    if (args.webhook.processingStatus === "failed") {
      return withReason(
        `Webhook processing failed (${args.webhook.eventType}).`,
        args.webhook.errorMessage,
      );
    }
    if (args.webhook.processingStatus === "processed") {
      return `Webhook processed (${args.webhook.eventType}).`;
    }
    if (args.webhook.processingStatus === "ignored") {
      return `Webhook ignored (${args.webhook.eventType}).`;
    }
    return `Webhook event received (${args.webhook.eventType}).`;
  }

  return "Automation event recorded.";
}

function buildWebhookReceiptLabel(receipt: Doc<"webhookReceipts">) {
  if (receipt.status === "invalid_json") {
    return withReason("Webhook delivery could not be parsed.", receipt.note);
  }

  if (receipt.status === "unmatched_account") {
    return withReason(
      "Webhook delivery did not match a connected Instagram account.",
      receipt.note,
    );
  }

  return receipt.note ?? "Raw webhook POST received for the Meta callback endpoint.";
}

function buildMetaErrorDiagnostic(
  responsePayload: string | null,
  fallbackMessage: string | null,
) {
  const payload = responsePayload?.trim();
  if (!payload) {
    return null;
  }

  const parsed = parseMetaApiError(
    payload,
    fallbackMessage ?? "Meta rejected the delivery.",
  );
  if (parsed.code === null && parsed.subcode === null && parsed.type === null) {
    return null;
  }

  return {
    code: parsed.code,
    subcode: parsed.subcode,
    type: parsed.type,
  };
}

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const [selectedAccount, accounts, rules, contacts, conversations] =
      await Promise.all([
        getSelectedWorkspaceInstagramAccount(ctx, workspace._id),
        listWorkspaceInstagramAccounts(ctx, workspace._id),
        ctx.db
          .query("automationRules")
          .withIndex("by_workspace_id", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .take(100),
        ctx.db
          .query("contacts")
          .withIndex("by_workspace_id_and_last_message_at", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .order("desc")
          .take(100),
        ctx.db
          .query("conversations")
          .withIndex("by_workspace_id_and_last_message_at", (q) =>
            q.eq("workspaceId", workspace._id),
          )
          .order("desc")
          .take(100),
      ]);

    const scopedRules =
      selectedAccount === null
        ? []
        : rules.filter((rule) => rule.instagramAccountId === selectedAccount._id);
    const scopedContacts =
      selectedAccount === null
        ? []
        : contacts.filter(
            (contact) => contact.instagramAccountId === selectedAccount._id,
          );
    const scopedConversations =
      selectedAccount === null
        ? []
        : conversations.filter(
            (conversation) =>
              conversation.instagramAccountId === selectedAccount._id,
          );

    const failureThreshold = Date.now() - 24 * 60 * 60 * 1000;
    let recentDeliveries: Doc<"deliveryAttempts">[] = [];
    let recentWebhooks: Doc<"webhookEvents">[] = [];
    let deliveriesToday: Doc<"deliveryAttempts">[] = [];

    if (selectedAccount !== null) {
      [recentDeliveries, recentWebhooks, deliveriesToday] = await Promise.all([
        ctx.db
          .query("deliveryAttempts")
          .withIndex("by_instagram_account_id_and_event_time", (q) =>
            q.eq("instagramAccountId", selectedAccount._id),
          )
          .order("desc")
          .take(12),
        ctx.db
          .query("webhookEvents")
          .withIndex("by_instagram_account_id_and_received_at", (q) =>
            q.eq("instagramAccountId", selectedAccount._id),
          )
          .order("desc")
          .take(6),
        ctx.db
          .query("deliveryAttempts")
          .withIndex("by_instagram_account_id_and_event_time", (q) =>
            q
              .eq("instagramAccountId", selectedAccount._id)
              .gte("eventTime", failureThreshold),
          )
          .order("desc")
          .take(100),
      ]);
    }

    const failuresToday = deliveriesToday.filter((delivery) =>
      DELIVERY_ISSUE_STATUSES.has(delivery.status),
    ).length;

    const recentActivity: Array<{
      id: string;
      time: number;
      label: string;
      kind: string;
    }> = [];
    for (const delivery of recentDeliveries) {
      const contact = await ctx.db.get(delivery.contactId);
      recentActivity.push({
        id: `delivery:${delivery._id}`,
        time: delivery.eventTime,
        label: buildActivityLabel({
          delivery,
          contactUsername: contact?.username ?? null,
        }),
        kind: delivery.status,
      });
    }

    for (const webhook of recentWebhooks) {
      recentActivity.push({
        id: `webhook:${webhook._id}`,
        time: webhook.receivedAt,
        label: buildActivityLabel({ webhook }),
        kind: webhook.processingStatus,
      });
    }

    recentActivity.sort((a, b) => b.time - a.time);

    return {
      selectedAccount:
        selectedAccount === null
          ? null
          : {
              id: selectedAccount._id,
              instagramAccountId: selectedAccount.instagramAccountId,
              username: selectedAccount.username,
              name: selectedAccount.name,
              profilePictureUrl: selectedAccount.profilePictureUrl ?? null,
              status: selectedAccount.status,
              reconnectRequired: selectedAccount.reconnectRequired ?? false,
            },
      accounts: accounts.map((account) => ({
        id: account._id,
        instagramAccountId: account.instagramAccountId,
        username: account.username,
        name: account.name,
        profilePictureUrl: account.profilePictureUrl ?? null,
        status: account.status,
        reconnectRequired: account.reconnectRequired ?? false,
        lastWebhookAt: account.lastWebhookAt,
        lastError: account.lastError,
        activeRules: rules.filter(
          (rule) =>
            rule.instagramAccountId === account._id && rule.isActive,
        ).length,
        contacts: contacts.filter(
          (contact) => contact.instagramAccountId === account._id,
        ).length,
        conversations: conversations.filter(
          (conversation) => conversation.instagramAccountId === account._id,
        ).length,
      })),
      stats: {
        activeRules: scopedRules.filter((rule) => rule.isActive).length,
        contacts: scopedContacts.length,
        conversations: scopedConversations.length,
        failuresToday,
      },
      recentActivity: recentActivity.slice(0, 6),
    };
  },
});

export const listContacts = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_workspace_id_and_last_message_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(100);

    return await Promise.all(
      contacts.map(async (contact) => {
        const contactTags = await ctx.db
          .query("contactTags")
          .withIndex("by_contact_id", (q) => q.eq("contactId", contact._id))
          .take(20);
        const tagDocs = await Promise.all(
          contactTags.map((contactTag) => ctx.db.get(contactTag.tagId)),
        );
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_contact_id", (q) => q.eq("contactId", contact._id))
          .take(200);

        return {
          id: contact._id,
          username: contact.username,
          displayName: contact.displayName,
          firstInboundAt: contact.firstInboundAt,
          lastInboundAt: contact.lastInboundAt,
          lastMessageAt: contact.lastMessageAt,
          messageCount: messages.length,
          tags: tagDocs
            .filter((tag): tag is Doc<"tags"> => tag !== null)
            .map((tag) => ({
              id: tag._id,
              label: tag.label,
              color: tag.color,
            })),
        };
      }),
    );
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace_id_and_last_message_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(100);

    return await Promise.all(
      conversations.map(async (conversation) => {
        const contact = await ctx.db.get(conversation.contactId);
        const rule = conversation.lastAutomationRuleId
          ? await ctx.db.get(conversation.lastAutomationRuleId)
          : null;

        return {
          id: conversation._id,
          status: conversation.status,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          unread:
            conversation.lastInboundAt !== null &&
            (conversation.lastOutboundAt === null ||
              conversation.lastInboundAt > conversation.lastOutboundAt),
          contact: {
            username: contact?.username ?? null,
            displayName: contact?.displayName ?? null,
          },
          ruleName: rule?.name ?? null,
        };
      }),
    );
  },
});

export const listLogs = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const deliveries = await ctx.db
      .query("deliveryAttempts")
      .withIndex("by_instagram_account_id_and_event_time", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .order("desc")
      .take(50);
    const webhooks = await ctx.db
      .query("webhookEvents")
      .withIndex("by_instagram_account_id_and_received_at", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .order("desc")
      .take(50);
    const webhookReceipts = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_instagram_account_id_and_received_at", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .order("desc")
      .take(50);
    const commentSessions = await ctx.db
      .query("commentAutomationSessions")
      .withIndex("by_instagram_account_id_and_last_step_at", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .order("desc")
      .take(50);

    const entries: Array<{
      id: string;
      time: number;
      type: string;
      status: DashboardLogStatus;
      contact: string | null;
      rule: string | null;
      details: string;
      attemptNumber: number | null;
      metaError: {
        code: number | null;
        subcode: number | null;
        type: string | null;
      } | null;
      rawPayload: string | null;
    }> = [];
    for (const delivery of deliveries) {
      const contact = await ctx.db.get(delivery.contactId);
      const rule = delivery.automationRuleId
        ? await ctx.db.get(delivery.automationRuleId)
        : null;
      const details = buildActivityLabel({
        delivery,
        contactUsername: contact?.username ?? null,
      });
      entries.push({
        id: `delivery:${delivery._id}`,
        time: delivery.eventTime,
        type: delivery.sequenceEnrollmentId ? "sequence_step" : "keyword_match",
        status: delivery.status,
        contact: contact?.username ?? null,
        rule: rule?.name ?? null,
        details,
        attemptNumber: delivery.attemptNumber,
        metaError: buildMetaErrorDiagnostic(
          delivery.responsePayload,
          delivery.reason,
        ),
        rawPayload:
          delivery.status === "failed" || delivery.status === "blocked_auth"
            ? delivery.responsePayload
            : null,
      });
    }

    for (const webhook of webhooks) {
      entries.push({
        id: `webhook:${webhook._id}`,
        time: webhook.receivedAt,
        type: "webhook",
        status: webhook.processingStatus === "failed" ? "failed" : "received",
        contact: null,
        rule: null,
        details: buildActivityLabel({ webhook }),
        attemptNumber: null,
        metaError: null,
        rawPayload: null,
      });
    }

    for (const receipt of webhookReceipts) {
      entries.push({
        id: `webhook-receipt:${receipt._id}`,
        time: receipt.receivedAt,
        type: "webhook_delivery",
        status:
          receipt.status === "invalid_json" ||
          receipt.status === "unmatched_account"
            ? "failed"
            : "received",
        contact: null,
        rule: null,
        details: buildWebhookReceiptLabel(receipt),
        attemptNumber: null,
        metaError: null,
        rawPayload: null,
      });
    }

    for (const session of commentSessions) {
      if ((session.guardrailTrippedAt ?? null) === null) {
        continue;
      }

      const contact = await ctx.db.get(session.contactId);
      const automation = await ctx.db.get(session.commentAutomationId);
      entries.push({
        id: `comment-guardrail:${session._id}`,
        time: session.guardrailTrippedAt ?? session.lastStepAt,
        type: "comment_guardrail",
        status: "failed",
        contact: contact?.username ?? null,
        rule: automation?.name ?? null,
        details:
          session.guardrailReason ??
          "Safety guardrail paused a comment automation session.",
        attemptNumber: null,
        metaError: null,
        rawPayload: null,
      });
    }

    entries.sort((a, b) => b.time - a.time);
    return entries.slice(0, 100);
  },
});

export const getConversationDetail = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation === null || conversation.workspaceId !== workspace._id) {
      return null;
    }

    const contact = await ctx.db.get(conversation.contactId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_id_and_event_time", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(200);
    const contactTags = await ctx.db
      .query("contactTags")
      .withIndex("by_contact_id", (q) =>
        q.eq("contactId", conversation.contactId),
      )
      .take(20);
    const tags = await Promise.all(
      contactTags.map((contactTag) => ctx.db.get(contactTag.tagId)),
    );
    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_contact_id", (q) =>
        q.eq("contactId", conversation.contactId),
      )
      .take(20);
    const enrollmentSummaries = await Promise.all(
      enrollments.map(async (enrollment) => {
        const definition = await ctx.db.get(enrollment.sequenceDefinitionId);
        return {
          id: enrollment._id,
          name: definition?.name ?? "Sequence",
          status: enrollment.status,
          nextRunAt: enrollment.nextRunAt,
          currentStepIndex: enrollment.currentStepIndex,
        };
      }),
    );

    const orderedMessages = [...messages].sort(
      (a, b) => a.eventTime - b.eventTime,
    );

    return {
      id: conversation._id,
      status: conversation.status,
      messagingWindowClosesAt: conversation.messagingWindowClosesAt,
      contact: {
        username: contact?.username ?? null,
        displayName: contact?.displayName ?? null,
        tags: tags
          .filter((tag): tag is Doc<"tags"> => tag !== null)
          .map((tag) => ({
            id: tag._id,
            label: tag.label,
            color: tag.color,
          })),
      },
      sequences: enrollmentSummaries,
      messages: orderedMessages.map((message) => ({
        id: message._id,
        direction: message.direction,
        source: message.source,
        text: message.text,
        eventTime: message.eventTime,
        deliveryStatus: message.deliveryStatus,
      })),
    };
  },
});
