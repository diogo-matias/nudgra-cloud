import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { getWorkspaceInstagramAccount, requireCurrentWorkspace } from "./lib/auth";

function buildActivityLabel(args: {
  delivery?: Doc<"deliveryAttempts">;
  webhook?: Doc<"webhookEvents">;
  contactUsername?: string | null;
  ruleName?: string | null;
}) {
  if (args.delivery) {
    const subject = args.contactUsername ? `@${args.contactUsername}` : "contact";
    if (args.delivery.status === "sent") {
      return `Reply sent to ${subject}.`;
    }
    if (args.delivery.status === "skipped") {
      return `Reply skipped for ${subject}.`;
    }
    return `Reply failed for ${subject}.`;
  }

  if (args.webhook) {
    return `Webhook event received (${args.webhook.eventType}).`;
  }

  return "Automation event recorded.";
}

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccount(ctx, workspace._id);
    const rules = await ctx.db
      .query("automationRules")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(100);
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_workspace_id_and_last_message_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(100);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace_id_and_last_message_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(100);
    const recentDeliveries = await ctx.db
      .query("deliveryAttempts")
      .withIndex("by_workspace_id_and_event_time", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(12);
    const failureThreshold = Date.now() - 24 * 60 * 60 * 1000;
    const failuresToday = recentDeliveries.filter(
      (delivery) =>
        delivery.status === "failed" && delivery.eventTime >= failureThreshold,
    ).length;

    const recentWebhooks = await ctx.db
      .query("webhookEvents")
      .withIndex("by_workspace_id_and_received_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(6);

    const recentActivity: Array<{
      id: string;
      time: number;
      label: string;
      kind: string;
    }> = [];
    for (const delivery of recentDeliveries) {
      const contact = await ctx.db.get(delivery.contactId);
      const rule = delivery.automationRuleId
        ? await ctx.db.get(delivery.automationRuleId)
        : null;
      recentActivity.push({
        id: `delivery:${delivery._id}`,
        time: delivery.eventTime,
        label: buildActivityLabel({
          delivery,
          contactUsername: contact?.username ?? null,
          ruleName: rule?.name ?? null,
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
      account,
      stats: {
        activeRules: rules.filter((rule) => rule.isActive).length,
        contacts: contacts.length,
        conversations: conversations.length,
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
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const deliveries = await ctx.db
      .query("deliveryAttempts")
      .withIndex("by_workspace_id_and_event_time", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(50);
    const webhooks = await ctx.db
      .query("webhookEvents")
      .withIndex("by_workspace_id_and_received_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(50);
    const webhookReceipts = await ctx.db
      .query("webhookReceipts")
      .withIndex("by_received_at")
      .order("desc")
      .take(50);
    const commentSessions = await ctx.db
      .query("commentAutomationSessions")
      .withIndex("by_workspace_id_and_last_step_at", (q) =>
        q.eq("workspaceId", workspace._id),
      )
      .order("desc")
      .take(50);

    const entries: Array<{
      id: string;
      time: number;
      type: string;
      status: string;
      contact: string | null;
      rule: string | null;
      details: string;
    }> = [];
    for (const delivery of deliveries) {
      const contact = await ctx.db.get(delivery.contactId);
      const rule = delivery.automationRuleId
        ? await ctx.db.get(delivery.automationRuleId)
        : null;
      entries.push({
        id: `delivery:${delivery._id}`,
        time: delivery.eventTime,
        type: delivery.sequenceEnrollmentId ? "sequence_step" : "keyword_match",
        status: delivery.status,
        contact: contact?.username ?? null,
        rule: rule?.name ?? null,
        details: buildActivityLabel({
          delivery,
          contactUsername: contact?.username ?? null,
          ruleName: rule?.name ?? null,
        }),
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
        details:
          receipt.note ??
          "Raw webhook POST received for the Meta callback endpoint.",
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
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", conversation._id))
      .take(200);
    const contactTags = await ctx.db
      .query("contactTags")
      .withIndex("by_contact_id", (q) => q.eq("contactId", conversation.contactId))
      .take(20);
    const tags = await Promise.all(contactTags.map((contactTag) => ctx.db.get(contactTag.tagId)));
    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_contact_id", (q) => q.eq("contactId", conversation.contactId))
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

    const orderedMessages = [...messages].sort((a, b) => a.eventTime - b.eventTime);

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
