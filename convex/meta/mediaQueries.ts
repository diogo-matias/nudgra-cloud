import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  requireCurrentWorkspace,
  requireConnectedInstagramAccount,
  requireWorkspaceInstagramAccount,
} from "../lib/auth";

// ── Query: get cached media for the post picker ──────────────────

export const listCachedMedia = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireWorkspaceInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );

    if (!account) {
      return [];
    }

    const media = await ctx.db
      .query("instagramMedia")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", account._id),
      )
      .take(50);

    // Sort by timestamp descending (newest first)
    return media
      .sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      })
      .map((item) => ({
        id: item._id,
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        thumbnailUrl: item.thumbnailUrl,
        mediaUrl: item.mediaUrl,
        caption: item.caption,
        timestamp: item.timestamp,
        permalink: item.permalink,
      }));
  },
});

// ── Action: refresh media from Instagram ─────────────────────────

export const refreshMedia = action({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.meta.mediaQueries.getRefreshContext,
      { accountId: args.accountId },
    );

    if (!context) {
      throw new Error("No connected Instagram account found.");
    }

    await ctx.runAction(internal.meta.media.fetchAccountMedia, {
      accountId: context.accountDocId,
    });

    return { success: true };
  },
});

// ── Internal query for refresh context ───────────────────────────

export const getRefreshContext = internalQuery({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireConnectedInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );

    if (!account.graphAccessToken) {
      return null;
    }

    return {
      workspaceId: workspace._id,
      accountDocId: account._id,
    };
  },
});

// ── Internal mutation: upsert media batch ────────────────────────

export const upsertMediaBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    instagramAccountDocId: v.id("instagramAccounts"),
    items: v.array(
      v.object({
        mediaId: v.string(),
        mediaType: v.string(),
        thumbnailUrl: v.union(v.string(), v.null()),
        mediaUrl: v.union(v.string(), v.null()),
        caption: v.union(v.string(), v.null()),
        timestamp: v.string(),
        permalink: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const item of args.items) {
      const existing = await ctx.db
        .query("instagramMedia")
        .withIndex("by_media_id", (q) => q.eq("mediaId", item.mediaId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          mediaType: item.mediaType,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          timestamp: item.timestamp,
          permalink: item.permalink,
          fetchedAt: now,
        });
      } else {
        await ctx.db.insert("instagramMedia", {
          workspaceId: args.workspaceId,
          instagramAccountId: args.instagramAccountDocId,
          mediaId: item.mediaId,
          mediaType: item.mediaType,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          timestamp: item.timestamp,
          permalink: item.permalink,
          fetchedAt: now,
        });
      }
    }
  },
});
