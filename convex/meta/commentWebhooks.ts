import { internalMutation, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  matchesCommentAutomation,
  startCommentAutomationSession,
} from "../automations/commentFlow";

// ── Types ────────────────────────────────────────────────────────

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

// ── Parse comment webhook payload ────────────────────────────────

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

      // Skip replies to comments (we only want top-level comments)
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

// ── Main comment webhook handler ─────────────────────────────────

export const ingestCommentWebhookPayload = internalMutation({
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
      // Find the matching Instagram account
      const account = await ctx.db
        .query("instagramAccounts")
        .withIndex("by_instagram_account_id", (q) =>
          q.eq("instagramAccountId", item.instagramAccountExternalId),
        )
        .unique();

      if (!account) {
        ignored += 1;
        continue;
      }

      // Find active comment automations for this workspace
      const automations = await ctx.db
        .query("commentAutomations")
        .withIndex("by_workspace_id_and_status", (q) =>
          q.eq("workspaceId", account.workspaceId).eq("status", "live"),
        )
        .take(50);

      // Find the first matching automation
      const matchedAutomation = automations.find((automation) =>
        matchesCommentAutomation({
          automation,
          mediaId: item.mediaId,
          commentText: item.commentText,
        }),
      );

      if (!matchedAutomation) {
        ignored += 1;
        continue;
      }

      // Create or find the contact
      const existingContact = await ctx.db
        .query("contacts")
        .withIndex("by_instagram_account_id_and_instagram_user_id", (q) =>
          q
            .eq("instagramAccountId", account._id)
            .eq("instagramUserId", item.commenterId),
        )
        .unique();

      const now = Date.now();
      const contactId =
        existingContact?._id ??
        (await ctx.db.insert("contacts", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          instagramUserId: item.commenterId,
          username: item.commenterUsername,
          displayName: item.commenterUsername,
          profilePictureUrl: null,
          firstInboundAt: now,
          lastInboundAt: now,
          lastMessageAt: now,
        }));

      if (existingContact) {
        await ctx.db.patch(existingContact._id, {
          username: item.commenterUsername ?? existingContact.username,
          lastInboundAt: now,
          lastMessageAt: now,
        });
      }

      // Create or find the conversation
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
          conversationKey: `${account.instagramAccountId}:${item.commenterId}`,
          status: "active",
          startedAt: now,
          lastMessageAt: now,
          lastInboundAt: now,
          lastOutboundAt: null,
          lastMessagePreview: item.commentText
            ? item.commentText.length > 96
              ? `${item.commentText.slice(0, 93)}...`
              : item.commentText
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

      // Reply to the comment if enabled
      if (
        matchedAutomation.commentReplyEnabled &&
        matchedAutomation.commentReplyTexts.length > 0 &&
        account.graphAccessToken
      ) {
        const replyText =
          matchedAutomation.commentReplyTexts[
            Math.floor(
              Math.random() * matchedAutomation.commentReplyTexts.length,
            )
          ];

        await ctx.scheduler.runAfter(0, internal.meta.comments.replyToComment, {
          commentId: item.commentId,
          message: replyText,
          accessToken: account.graphAccessToken,
          graphApiVersion: account.graphApiVersion,
        });
      }

      // Start the DM flow
      await startCommentAutomationSession(ctx, matchedAutomation, {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        commentAutomationId: matchedAutomation._id,
        contactId,
        conversationId,
        commentId: item.commentId,
        mediaId: item.mediaId,
      });

      processed += 1;
    }

    return { processed, ignored };
  },
});
