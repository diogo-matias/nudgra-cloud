import { internal } from "../_generated/api";
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getQueuedDeliveryContext = internalQuery({
  args: { deliveryAttemptId: v.id("deliveryAttempts") },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.deliveryAttemptId);
    if (attempt === null) {
      return null;
    }

    const account = await ctx.db.get(attempt.instagramAccountId);
    const contact = await ctx.db.get(attempt.contactId);
    const conversation = await ctx.db.get(attempt.conversationId);

    if (account === null || contact === null || conversation === null) {
      return null;
    }

    return { attempt, account, contact, conversation };
  },
});

export const markDeliveryAttemptResult = internalMutation({
  args: {
    deliveryAttemptId: v.id("deliveryAttempts"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    reason: v.union(v.string(), v.null()),
    responsePayload: v.union(v.string(), v.null()),
    metaMessageId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.deliveryAttemptId);
    if (attempt === null) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      status: args.status,
      reason: args.reason,
      responsePayload: args.responsePayload,
      metaMessageId: args.metaMessageId,
      eventTime: Date.now(),
    });

    if (args.status !== "sent") {
      return null;
    }

    await ctx.db.insert("messages", {
      workspaceId: attempt.workspaceId,
      instagramAccountId: attempt.instagramAccountId,
      conversationId: attempt.conversationId,
      contactId: attempt.contactId,
      direction: "outbound",
      source: attempt.sequenceEnrollmentId ? "sequence" : "rule",
      messageType: "text",
      text: attempt.messageText,
      metaMessageId: args.metaMessageId,
      dedupeKey: `delivery:${attempt._id}:${attempt.attemptNumber}`,
      deliveryStatus: "sent",
      eventTime: Date.now(),
      webhookEventId: null,
      automationRuleId: attempt.automationRuleId,
      sequenceEnrollmentId: attempt.sequenceEnrollmentId,
    });

    await ctx.db.patch(attempt.conversationId, {
      lastOutboundAt: Date.now(),
      lastMessageAt: Date.now(),
      lastMessagePreview: attempt.messageText,
      status: "active",
    });

    return null;
  },
});

export const rescheduleDeliveryAttempt = internalMutation({
  args: {
    deliveryAttemptId: v.id("deliveryAttempts"),
    delayMs: v.number(),
    reason: v.string(),
    responsePayload: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.deliveryAttemptId);
    if (attempt === null) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      status: "queued",
      reason: args.reason,
      responsePayload: args.responsePayload,
      attemptNumber: attempt.attemptNumber + 1,
      eventTime: Date.now(),
    });

    await ctx.scheduler.runAfter(
      args.delayMs,
      internal.meta.sendActions.performQueuedDelivery,
      {
        deliveryAttemptId: attempt._id,
      },
    );

    return null;
  },
});
