import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getDeliveryAttemptAutomationType } from "../automations/guardrails";
import {
  getDeliveryExpiredReason,
  getDeliveryKind,
  isDeliveryPolicyWindowOpen,
  shouldCloseConversationWindow,
} from "./deliveryPolicy";

function parseStoredAttemptPayload(payload: string | null) {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as
      | {
          kind?: "text" | "quick_reply" | "button_template";
        }
      | {
          kind?: "story_reply_reaction";
          triggerMessageId?: string;
        };
  } catch {
    return null;
  }
}

function buildDeliverySource(
  attempt: Pick<
    Doc<"deliveryAttempts">,
    | "automationRuleId"
    | "storyAutomationId"
    | "followerAutomationId"
    | "sequenceEnrollmentId"
  >,
) {
  switch (getDeliveryAttemptAutomationType(attempt)) {
    case "comment_automation":
      return "comment_automation" as const;
    case "story_automation":
      return "story_automation" as const;
    case "follower_automation":
      return "follower_automation" as const;
    case "sequence":
      return "sequence" as const;
    case "rule":
    default:
      return "rule" as const;
  }
}

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
    status: v.union(
      v.literal("sent"),
      v.literal("failed"),
      v.literal("blocked_auth"),
      v.literal("skipped"),
      v.literal("skipped_expired"),
    ),
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

    if (args.status === "skipped_expired") {
      if (shouldCloseConversationWindow(attempt)) {
        await ctx.db.patch(attempt.conversationId, {
          status: "window_closed",
        });
      }
      return null;
    }

    if (args.status !== "sent") {
      return null;
    }

    const parsedPayload = parseStoredAttemptPayload(attempt.requestPayload);
    const messageType =
      parsedPayload?.kind === "story_reply_reaction" ? "reaction" : "text";
    const triggerMessageId =
      parsedPayload?.kind === "story_reply_reaction"
        ? (parsedPayload.triggerMessageId ?? null)
        : null;
    const source = buildDeliverySource(attempt);

    await ctx.db.insert("messages", {
      workspaceId: attempt.workspaceId,
      instagramAccountId: attempt.instagramAccountId,
      conversationId: attempt.conversationId,
      contactId: attempt.contactId,
      direction: "outbound",
      source,
      messageType,
      text: attempt.messageText,
      metaMessageId: args.metaMessageId,
      dedupeKey: `delivery:${attempt._id}:${attempt.attemptNumber}`,
      deliveryStatus: "sent",
      eventTime: Date.now(),
      webhookEventId: null,
      automationRuleId: attempt.automationRuleId,
      storyAutomationId: attempt.storyAutomationId ?? null,
      followerAutomationId: attempt.followerAutomationId ?? null,
      sequenceEnrollmentId: attempt.sequenceEnrollmentId,
      triggerMessageId,
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

export const requeueBlockedDeliveryAttempt = internalMutation({
  args: {
    deliveryAttemptId: v.id("deliveryAttempts"),
    reason: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.deliveryAttemptId);
    if (attempt === null) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      status: "queued",
      reason: args.reason,
      responsePayload: null,
      attemptNumber: attempt.attemptNumber + 1,
      eventTime: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.meta.sendActions.performQueuedDelivery,
      {
        deliveryAttemptId: attempt._id,
      },
    );

    return null;
  },
});

export const replayBlockedDeliveries = internalMutation({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (
      account === null ||
      account.status !== "connected" ||
      account.reconnectRequired === true ||
      account.graphAccessToken === null
    ) {
      return { requeued: 0, expired: 0, remaining: 0 };
    }

    const blockedAttempts = await ctx.db
      .query("deliveryAttempts")
      .withIndex("by_instagram_account_id_and_status_and_event_time", (q) =>
        q.eq("instagramAccountId", args.accountId).eq("status", "blocked_auth"),
      )
      .take(50);

    let requeued = 0;
    let expired = 0;

    for (const attempt of blockedAttempts) {
      const conversation = await ctx.db.get(attempt.conversationId);
      const now = Date.now();
      const policyWindowOpen = isDeliveryPolicyWindowOpen({
        attempt: {
          deliveryKind: getDeliveryKind(attempt),
          privateReplyExpiresAt: attempt.privateReplyExpiresAt ?? null,
        },
        conversation,
        now,
      });

      if (!policyWindowOpen) {
        await ctx.db.patch(attempt._id, {
          status: "skipped_expired",
          reason: getDeliveryExpiredReason({
            deliveryKind: getDeliveryKind(attempt),
            privateReplyExpiresAt: attempt.privateReplyExpiresAt ?? null,
          }),
          eventTime: now,
        });
        if (conversation !== null && shouldCloseConversationWindow(attempt)) {
          await ctx.db.patch(conversation._id, {
            status: "window_closed",
          });
        }
        expired += 1;
        continue;
      }

      await ctx.db.patch(attempt._id, {
        status: "queued",
        reason: "Token recovered. Retrying delivery.",
        responsePayload: null,
        attemptNumber: attempt.attemptNumber + 1,
        eventTime: now,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.meta.sendActions.performQueuedDelivery,
        {
          deliveryAttemptId: attempt._id,
        },
      );
      requeued += 1;
    }

    const remaining = await ctx.db
      .query("deliveryAttempts")
      .withIndex("by_instagram_account_id_and_status_and_event_time", (q) =>
        q.eq("instagramAccountId", args.accountId).eq("status", "blocked_auth"),
      )
      .take(1);

    if (blockedAttempts.length === 50 && remaining.length > 0) {
      await ctx.scheduler.runAfter(
        5_000,
        internal.meta.send.replayBlockedDeliveries,
        {
          accountId: args.accountId,
        },
      );
    }

    return {
      requeued,
      expired,
      remaining: remaining.length,
    };
  },
});

export const terminalizePendingDeliveriesForAccount = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    let updated = 0;

    for (const status of ["queued", "blocked_auth"] as const) {
      const attempts = await ctx.db
        .query("deliveryAttempts")
        .withIndex("by_instagram_account_id_and_status_and_event_time", (q) =>
          q.eq("instagramAccountId", args.accountId).eq("status", status),
        )
        .take(50);

      for (const attempt of attempts) {
        await ctx.db.patch(attempt._id, {
          status: "skipped",
          reason: args.reason,
          eventTime: Date.now(),
        });
        updated += 1;
      }

      if (attempts.length === 50) {
        await ctx.scheduler.runAfter(
          0,
          internal.meta.send.terminalizePendingDeliveriesForAccount,
          args,
        );
      }
    }

    return { updated };
  },
});
