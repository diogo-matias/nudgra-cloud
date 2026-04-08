"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";

// ── Types ────────────────────────────────────────────────────────

type InstagramMediaItem = {
  id: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
};

type InstagramMediaResponse = {
  data?: InstagramMediaItem[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
  error?: { message?: string };
};

// ── Action: fetch media from Instagram Graph API ─────────────────

export const fetchAccountMedia = internalAction({
  args: {
    instagramAccountId: v.string(),
    accessToken: v.string(),
    workspaceId: v.id("workspaces"),
    instagramAccountDocId: v.id("instagramAccounts"),
  },
  handler: async (ctx, args) => {
    const endpoint = new URL(
      `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${args.instagramAccountId}/media`,
    );
    endpoint.searchParams.set(
      "fields",
      "id,media_type,thumbnail_url,media_url,caption,timestamp,permalink",
    );
    endpoint.searchParams.set("limit", "30");
    endpoint.searchParams.set("access_token", args.accessToken);

    const response = await fetch(endpoint);
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = "Failed to fetch Instagram media.";
      try {
        const parsed = JSON.parse(responseText) as InstagramMediaResponse;
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(errorMessage);
    }

    const parsed = JSON.parse(responseText) as InstagramMediaResponse;
    const items = parsed.data ?? [];

    // Store media items in Convex
    await ctx.runMutation(internal.meta.mediaQueries.upsertMediaBatch, {
      workspaceId: args.workspaceId,
      instagramAccountDocId: args.instagramAccountDocId,
      items: items.map((item) => ({
        mediaId: item.id,
        mediaType: item.media_type ?? "IMAGE",
        thumbnailUrl: item.thumbnail_url ?? null,
        mediaUrl: item.media_url ?? null,
        caption: item.caption ?? null,
        timestamp: item.timestamp ?? new Date().toISOString(),
        permalink: item.permalink ?? null,
      })),
    });

    return { count: items.length };
  },
});
