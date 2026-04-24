import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { getDeliveryAttemptAutomationType } from "./automations/guardrails";
import {
  getSelectedWorkspaceInstagramAccount,
  listWorkspaceInstagramAccounts,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "./lib/auth";
import { parseMetaApiError } from "./meta/authShared";
import { getDeliveryKind } from "./meta/deliveryPolicy";

const DELIVERY_ISSUE_STATUSES = new Set<Doc<"deliveryAttempts">["status"]>([
  "failed",
  "blocked_auth",
  "skipped",
  "skipped_expired",
]);

type DashboardLogStatus = Doc<"deliveryAttempts">["status"] | "received";

async function summarizeByInstagramAccount<
  T extends { instagramAccountId: Doc<"instagramAccounts">["_id"] },
>(items: AsyncIterable<T>) {
  const counts = new Map<Doc<"instagramAccounts">["_id"], number>();
  let total = 0;

  for await (const item of items) {
    total += 1;
    counts.set(
      item.instagramAccountId,
      (counts.get(item.instagramAccountId) ?? 0) + 1,
    );
  }

  return { counts, total };
}

async function countMatching<T>(
  items: AsyncIterable<T>,
  predicate: (item: T) => boolean,
) {
  let total = 0;

  for await (const item of items) {
    if (predicate(item)) {
      total += 1;
    }
  }

  return total;
}

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
    const activityLabel =
      getDeliveryKind(args.delivery) === "private_reply"
        ? "Private reply"
        : "Reply";
    if (args.delivery.status === "sent") {
      return `${activityLabel} sent to ${subject}.`;
    }
    if (args.delivery.status === "queued") {
      return args.delivery.attemptNumber > 1
        ? `Retry ${args.delivery.attemptNumber} is queued for ${subject}.`
        : `${activityLabel} queued for ${subject}.`;
    }
    if (args.delivery.status === "blocked_auth") {
      return withReason(`${activityLabel} paused for ${subject}.`, args.delivery.reason);
    }
    if (args.delivery.status === "skipped") {
      return withReason(`${activityLabel} skipped for ${subject}.`, args.delivery.reason);
    }
    if (args.delivery.status === "skipped_expired") {
      return withReason(`${activityLabel} expired for ${subject}.`, args.delivery.reason);
    }
    return withReason(`${activityLabel} failed for ${subject}.`, args.delivery.reason);
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
    const [selectedAccount, accounts] = await Promise.all([
      getSelectedWorkspaceInstagramAccount(ctx, workspace._id),
      listWorkspaceInstagramAccounts(ctx, workspace._id),
    ]);

    const selectedAccountId = selectedAccount?._id ?? null;

    const failureThreshold = Date.now() - 24 * 60 * 60 * 1000;
    const [
      workspaceActiveRuleSummary,
      workspaceLiveCommentAutomationSummary,
      workspaceLiveStoryAutomationSummary,
      workspaceContactSummary,
      workspaceConversationSummary,
      recentDeliveries,
      recentWebhooks,
      deliveriesToday,
    ] = await Promise.all([
      summarizeByInstagramAccount(
        ctx.db
          .query("automationRules")
          .withIndex("by_workspace_id_and_is_active", (q) =>
            q.eq("workspaceId", workspace._id).eq("isActive", true),
          ),
      ),
      summarizeByInstagramAccount(
        ctx.db
          .query("commentAutomations")
          .withIndex("by_workspace_id_and_status", (q) =>
            q.eq("workspaceId", workspace._id).eq("status", "live"),
          ),
      ),
      summarizeByInstagramAccount(
        ctx.db
          .query("storyAutomations")
          .withIndex("by_workspace_id_and_status", (q) =>
            q.eq("workspaceId", workspace._id).eq("status", "live"),
          ),
      ),
      summarizeByInstagramAccount(
        ctx.db
          .query("contacts")
          .withIndex("by_workspace_id_and_last_message_at", (q) =>
            q.eq("workspaceId", workspace._id),
          ),
      ),
      summarizeByInstagramAccount(
        ctx.db
          .query("conversations")
          .withIndex("by_workspace_id_and_last_message_at", (q) =>
            q.eq("workspaceId", workspace._id),
          ),
      ),
      selectedAccountId === null
        ? Promise.resolve([])
        : ctx.db
            .query("deliveryAttempts")
            .withIndex("by_instagram_account_id_and_event_time", (q) =>
              q.eq("instagramAccountId", selectedAccountId),
            )
            .order("desc")
            .take(12),
      selectedAccountId === null
        ? Promise.resolve([])
        : ctx.db
            .query("webhookEvents")
            .withIndex("by_instagram_account_id_and_received_at", (q) =>
              q.eq("instagramAccountId", selectedAccountId),
            )
            .order("desc")
            .take(6),
      selectedAccountId === null
        ? Promise.resolve(0)
        : countMatching(
            ctx.db
              .query("deliveryAttempts")
              .withIndex("by_instagram_account_id_and_event_time", (q) =>
                q
                  .eq("instagramAccountId", selectedAccountId)
                  .gte("eventTime", failureThreshold),
              ),
            (delivery) => DELIVERY_ISSUE_STATUSES.has(delivery.status),
          ),
    ]);

    const activeRulesByAccount = workspaceActiveRuleSummary.counts;
    const liveCommentAutomationsByAccount =
      workspaceLiveCommentAutomationSummary.counts;
    const liveStoryAutomationsByAccount =
      workspaceLiveStoryAutomationSummary.counts;
    const contactsByAccount = workspaceContactSummary.counts;
    const conversationsByAccount = workspaceConversationSummary.counts;

    const failuresToday = deliveriesToday;
    const scopedActiveAutomations =
      selectedAccountId === null
        ? 0
        : (activeRulesByAccount.get(selectedAccountId) ?? 0) +
          (liveCommentAutomationsByAccount.get(selectedAccountId) ?? 0) +
          (liveStoryAutomationsByAccount.get(selectedAccountId) ?? 0);
    const scopedContacts =
      selectedAccountId === null
        ? 0
        : (contactsByAccount.get(selectedAccountId) ?? 0);
    const scopedConversations =
      selectedAccountId === null
        ? 0
        : (conversationsByAccount.get(selectedAccountId) ?? 0);

    const recentActivity: Array<{
      id: string;
      time: number;
      label: string;
      kind: string;
    }> = [];
    const deliveryContacts = await Promise.all(
      recentDeliveries.map((delivery) => ctx.db.get(delivery.contactId)),
    );

    for (const [index, delivery] of recentDeliveries.entries()) {
      const contact = deliveryContacts[index];
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
        activeAutomations:
          (activeRulesByAccount.get(account._id) ?? 0) +
          (liveCommentAutomationsByAccount.get(account._id) ?? 0) +
          (liveStoryAutomationsByAccount.get(account._id) ?? 0),
        contacts: contactsByAccount.get(account._id) ?? 0,
        conversations: conversationsByAccount.get(account._id) ?? 0,
      })),
      stats: {
        activeAutomations: scopedActiveAutomations,
        contacts: scopedContacts,
        conversations: scopedConversations,
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
        type:
          getDeliveryKind(delivery) === "private_reply"
            ? "private_reply"
            : (() => {
                const automationType = getDeliveryAttemptAutomationType(delivery);
                if (automationType === "sequence") {
                  return "sequence_step";
                }
                if (automationType === "comment_automation") {
                  return "comment_automation";
                }
                if (automationType === "story_automation") {
                  return "story_automation";
                }
                return "keyword_match";
              })(),
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
