"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";
import type {
  AccountTokenLifecycleContext,
  ParsedMetaApiError,
} from "./authShared";
import { isMetaAuthError, parseMetaApiError } from "./authShared";

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

type FetchAccountMediaResult = {
  count: number;
};

type RequestMediaResult =
  | {
      ok: true;
      payload: InstagramMediaResponse;
    }
  | {
      ok: false;
      error: ParsedMetaApiError;
    };

// ── Action: fetch media from Instagram Graph API ─────────────────

export const fetchAccountMedia = internalAction({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  returns: v.object({
    count: v.number(),
  }),
  handler: async (ctx, args): Promise<FetchAccountMediaResult> => {
    const account: AccountTokenLifecycleContext | null = await ctx.runQuery(
      internal.accounts.getAccountTokenLifecycleContext,
      {
        accountId: args.accountId,
      },
    );

    if (account === null || account.graphAccessToken === null) {
      throw new Error("No connected Instagram account found.");
    }

    const requestMedia = async (
      accessToken: string,
    ): Promise<RequestMediaResult> => {
      const endpoint: URL = new URL(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${account.instagramAccountId}/media`,
      );
      endpoint.searchParams.set(
        "fields",
        "id,media_type,thumbnail_url,media_url,caption,timestamp,permalink",
      );
      endpoint.searchParams.set("limit", "30");
      endpoint.searchParams.set("access_token", accessToken);

      const response: Response = await fetch(endpoint);
      const responseText: string = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          error: parseMetaApiError(
            responseText,
            "Failed to fetch Instagram media.",
          ),
        };
      }

      return {
        ok: true,
        payload: JSON.parse(responseText) as InstagramMediaResponse,
      };
    };

    let result: RequestMediaResult = await requestMedia(
      account.graphAccessToken,
    );
    if (!result.ok && isMetaAuthError(result.error)) {
      const refreshResult: { tokenUsable: boolean } = await ctx.runAction(
        internal.meta.tokenLifecycle.refreshAccountToken,
        {
          accountId: account.id,
          reason: "auth_error",
        },
      );

      if (refreshResult.tokenUsable) {
        const refreshedAccount = await ctx.runQuery(
          internal.accounts.getAccountTokenLifecycleContext,
          {
            accountId: account.id,
          },
        );
        if (refreshedAccount?.graphAccessToken) {
          result = await requestMedia(refreshedAccount.graphAccessToken);
        }
      }
    }

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const parsed: InstagramMediaResponse = result.payload;
    const items: InstagramMediaItem[] = parsed.data ?? [];

    // Store media items in Convex
    await ctx.runMutation(internal.meta.mediaQueries.upsertMediaBatch, {
      workspaceId: account.workspaceId,
      instagramAccountDocId: account.id,
      items: items.map((item: InstagramMediaItem) => ({
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
