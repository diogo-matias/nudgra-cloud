import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  requireConnectedInstagramAccount,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "../lib/auth";
import { STORY_EXPIRED_MESSAGE } from "../automations/storyShared";

export const listCachedStories = query({
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

    const now = Date.now();
    const stories = await ctx.db
      .query("instagramStories")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", account._id),
      )
      .take(100);

    return stories
      .filter((story) => story.expiresAt > now)
      .sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      })
      .map((story) => ({
        id: story._id,
        storyId: story.storyId,
        mediaType: story.mediaType,
        thumbnailUrl: story.thumbnailUrl,
        mediaUrl: story.mediaUrl,
        permalink: story.permalink,
        timestamp: story.timestamp,
        expiresAt: story.expiresAt,
      }));
  },
});

export const refreshStories = action({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.meta.storyQueries.getRefreshContext,
      { accountId: args.accountId },
    );

    if (!context) {
      throw new Error("No connected Instagram account found.");
    }

    await ctx.runAction(internal.meta.stories.fetchAccountStories, {
      accountId: context.accountDocId,
    });

    return { success: true };
  },
});

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

export const upsertStoryBatch = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    instagramAccountDocId: v.id("instagramAccounts"),
    items: v.array(
      v.object({
        storyId: v.string(),
        mediaType: v.string(),
        thumbnailUrl: v.union(v.string(), v.null()),
        mediaUrl: v.union(v.string(), v.null()),
        permalink: v.union(v.string(), v.null()),
        timestamp: v.string(),
        expiresAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingStories = await ctx.db
      .query("instagramStories")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.instagramAccountDocId),
      )
      .take(100);
    const existingByStoryId = new Map(
      existingStories.map((story) => [story.storyId, story]),
    );
    const incomingIds = new Set(args.items.map((item) => item.storyId));

    for (const item of args.items) {
      const existing = existingByStoryId.get(item.storyId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          mediaType: item.mediaType,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: item.mediaUrl,
          permalink: item.permalink,
          timestamp: item.timestamp,
          expiresAt: item.expiresAt,
          fetchedAt: now,
        });
      } else {
        await ctx.db.insert("instagramStories", {
          workspaceId: args.workspaceId,
          instagramAccountId: args.instagramAccountDocId,
          storyId: item.storyId,
          mediaType: item.mediaType,
          thumbnailUrl: item.thumbnailUrl,
          mediaUrl: item.mediaUrl,
          permalink: item.permalink,
          timestamp: item.timestamp,
          expiresAt: item.expiresAt,
          fetchedAt: now,
        });
      }
    }

    for (const story of existingStories) {
      if (!incomingIds.has(story.storyId) || story.expiresAt <= now) {
        await ctx.db.delete(story._id);
      }
    }

    const liveStoryIds = new Set(
      args.items
        .filter((item) => item.expiresAt > now)
        .map((item) => item.storyId),
    );
    const liveAutomations = await ctx.db
      .query("storyAutomations")
      .withIndex("by_instagram_account_id_and_status", (q) =>
        q.eq("instagramAccountId", args.instagramAccountDocId).eq("status", "live"),
      )
      .take(100);

    for (const automation of liveAutomations) {
      if (automation.storyScope !== "specific") {
        continue;
      }

      const selectedStoryId = automation.selectedStoryId?.trim() ?? "";
      if (!selectedStoryId || liveStoryIds.has(selectedStoryId)) {
        continue;
      }

      await ctx.db.patch(automation._id, {
        status: "paused",
        selectedStoryExpiredAt: now,
        selectedStoryExpiredReason: STORY_EXPIRED_MESSAGE,
        lastModifiedAt: now,
      });
    }
  },
});
