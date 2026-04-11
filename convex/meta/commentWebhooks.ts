import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import {
  getCommentAutomationValidationIssues,
  matchesCommentAutomation,
  startCommentAutomationSession,
} from "../automations/commentFlow";

type CommentChange = {
  field?: string;
  value?: {
    id?: string;
    text?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string; media_product_type?: string };
    parent_id?: string;
    timestamp?: number;
  };
};

type CommentEntry = {
  id?: string;
  changes?: CommentChange[];
};

const processCommentItemArgs = {
  instagramAccountExternalId: v.string(),
  commentId: v.string(),
  commentText: v.union(v.string(), v.null()),
  commenterId: v.string(),
  commenterUsername: v.union(v.string(), v.null()),
  mediaId: v.string(),
  parentCommentId: v.union(v.string(), v.null()),
  timestamp: v.number(),
  allowRefresh: v.boolean(),
};

function getCommentItems(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];

  const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];

  const items: Array<{
    instagramAccountExternalId: string;
    commentId: string;
    commentText: string | null;
    commenterId: string;
    commenterUsername: string | null;
    mediaId: string;
    parentCommentId: string | null;
    timestamp: number;
  }> = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const instagramAccountExternalId = String((entry as CommentEntry).id ?? "");
    if (!instagramAccountExternalId) continue;

    const changes = Array.isArray((entry as CommentEntry).changes)
      ? (entry as CommentEntry).changes!
      : [];

    for (const change of changes) {
      if (change.field !== "comments" || !change.value) continue;

      const val = change.value;
      if (!val.id || !val.from?.id || !val.media?.id) continue;

      if (val.parent_id) continue;

      items.push({
        instagramAccountExternalId,
        commentId: val.id,
        commentText: val.text ?? null,
        commenterId: val.from.id,
        commenterUsername: val.from.username ?? null,
        mediaId: val.media.id,
        parentCommentId: val.parent_id ?? null,
        timestamp: val.timestamp ? val.timestamp * 1000 : Date.now(),
      });
    }
  }

  return items;
}

function parseMediaTimestamp(timestamp: string) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEarliestMediaAfterActivation(
  mediaItems: Doc<"instagramMedia">[],
  activationTime: number,
) {
  return mediaItems
    .map((item) => ({
      item,
      timestampMs: parseMediaTimestamp(item.timestamp),
    }))
    .filter(
      (
        entry,
      ): entry is {
        item: Doc<"instagramMedia">;
        timestampMs: number;
      } => entry.timestampMs !== null && entry.timestampMs > activationTime,
    )
    .sort((left, right) => left.timestampMs - right.timestampMs)[0]?.item;
}

export const ingestCommentWebhookPayload = internalAction({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    let payload: unknown;
    try {
      payload = JSON.parse(args.body);
    } catch {
      return { processed: 0, ignored: 1, reason: "Invalid JSON" };
    }

    const commentItems = getCommentItems(payload);
    if (commentItems.length === 0) {
      return { processed: 0, ignored: 0, reason: "No comment items found" };
    }

    let processed = 0;
    let ignored = 0;

    for (const item of commentItems) {
      let result = await ctx.runMutation(
        internal.meta.commentWebhooks.processCommentWebhookItem,
        {
          ...item,
          allowRefresh: true,
        },
      );

      if (result.status === "needs_refresh" && result.refreshContext !== null) {
        await ctx.runAction(
          internal.meta.media.fetchAccountMedia,
          result.refreshContext,
        );
        result = await ctx.runMutation(
          internal.meta.commentWebhooks.processCommentWebhookItem,
          {
            ...item,
            allowRefresh: false,
          },
        );
      }

      if (result.status === "processed") {
        processed += 1;
      } else {
        ignored += 1;
      }
    }

    return { processed, ignored };
  },
});

export const processCommentWebhookItem = internalMutation({
  args: processCommentItemArgs,
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("instagramAccounts")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.instagramAccountExternalId),
      )
      .unique();

    if (!account) {
      return { status: "ignored" as const, refreshContext: null };
    }

    const automations = await ctx.db
      .query("commentAutomations")
      .withIndex("by_instagram_account_id_and_status", (q) =>
        q.eq("instagramAccountId", account._id).eq("status", "live"),
      )
      .take(50);

    if (automations.length === 0) {
      return { status: "ignored" as const, refreshContext: null };
    }

    let cachedMedia: Doc<"instagramMedia">[] | null = null;
    let shouldRefresh = false;
    const candidateAutomations: Array<
      Doc<"commentAutomations"> & { nextLockedMediaId: string | null }
    > = [];

    for (const automation of automations) {
      if (getCommentAutomationValidationIssues(automation).length > 0) {
        continue;
      }

      if (automation.postScope !== "next") {
        candidateAutomations.push({
          ...automation,
          nextLockedMediaId: automation.nextLockedMediaId ?? null,
        });
        continue;
      }

      const existingLock = automation.nextLockedMediaId ?? null;
      if (existingLock !== null) {
        candidateAutomations.push({
          ...automation,
          nextLockedMediaId: existingLock,
        });
        continue;
      }

      const activationTime = automation.nextPostActivatedAt ?? null;
      if (activationTime === null) {
        continue;
      }

      if (cachedMedia === null) {
        cachedMedia = await ctx.db
          .query("instagramMedia")
          .withIndex("by_instagram_account_id", (q) =>
            q.eq("instagramAccountId", account._id),
          )
          .take(100);
      }

      const lockedMedia = getEarliestMediaAfterActivation(
        cachedMedia,
        activationTime,
      );
      if (lockedMedia === undefined) {
        shouldRefresh = shouldRefresh || args.allowRefresh;
        continue;
      }

      const lockedAt = Date.now();
      await ctx.db.patch(automation._id, {
        nextLockedMediaId: lockedMedia.mediaId,
        nextLockedAt: lockedAt,
      });

      candidateAutomations.push({
        ...automation,
        nextLockedMediaId: lockedMedia.mediaId,
        nextLockedAt: lockedAt,
      });
    }

    const matchedAutomation = candidateAutomations.find((automation) =>
      matchesCommentAutomation({
        automation,
        mediaId: args.mediaId,
        commentText: args.commentText,
      }),
    );

    if (!matchedAutomation) {
      if (shouldRefresh && account.graphAccessToken) {
        return {
          status: "needs_refresh" as const,
          refreshContext: {
            accountId: account._id,
          },
        };
      }

      return { status: "ignored" as const, refreshContext: null };
    }

    const existingContact = await ctx.db
      .query("contacts")
      .withIndex("by_instagram_account_id_and_instagram_user_id", (q) =>
        q
          .eq("instagramAccountId", account._id)
          .eq("instagramUserId", args.commenterId),
      )
      .unique();

    const now = Date.now();
    const contactId =
      existingContact?._id ??
      (await ctx.db.insert("contacts", {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        instagramUserId: args.commenterId,
        username: args.commenterUsername,
        displayName: args.commenterUsername,
        profilePictureUrl: null,
        firstInboundAt: now,
        lastInboundAt: now,
        lastMessageAt: now,
      }));

    if (existingContact) {
      await ctx.db.patch(existingContact._id, {
        username: args.commenterUsername ?? existingContact.username,
        lastInboundAt: now,
        lastMessageAt: now,
      });
    }

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_instagram_account_id_and_contact_id", (q) =>
        q.eq("instagramAccountId", account._id).eq("contactId", contactId),
      )
      .unique();

    const conversationId =
      existingConversation?._id ??
      (await ctx.db.insert("conversations", {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        contactId,
        conversationKey: `${account.instagramAccountId}:${args.commenterId}`,
        status: "active",
        startedAt: now,
        lastMessageAt: now,
        lastInboundAt: now,
        lastOutboundAt: null,
        lastMessagePreview: args.commentText
          ? args.commentText.length > 96
            ? `${args.commentText.slice(0, 93)}...`
            : args.commentText
          : "Comment received",
        messagingWindowClosesAt: now + 24 * 60 * 60 * 1000,
        lastAutomationRuleId: null,
      }));

    if (existingConversation) {
      await ctx.db.patch(existingConversation._id, {
        status: "active",
        lastMessageAt: now,
        lastInboundAt: now,
        messagingWindowClosesAt: now + 24 * 60 * 60 * 1000,
      });
    }

    if (
      matchedAutomation.commentReplyEnabled &&
      matchedAutomation.commentReplyTexts.length > 0 &&
      account.graphAccessToken
    ) {
      const replyText =
        matchedAutomation.commentReplyTexts[
          Math.floor(Math.random() * matchedAutomation.commentReplyTexts.length)
        ];

      await ctx.scheduler.runAfter(0, internal.meta.comments.replyToComment, {
        accountId: account._id,
        commentId: args.commentId,
        message: replyText,
      });
    }

    await startCommentAutomationSession(ctx, matchedAutomation, {
      workspaceId: account.workspaceId,
      instagramAccountId: account._id,
      commentAutomationId: matchedAutomation._id,
      contactId,
      conversationId,
      commentId: args.commentId,
      mediaId: args.mediaId,
    });

    return { status: "processed" as const, refreshContext: null };
  },
});
