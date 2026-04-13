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

type InstagramStoryItem = {
  id: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
};

type InstagramStoriesResponse = {
  data?: InstagramStoryItem[];
  error?: { message?: string };
};

type FetchAccountStoriesResult = {
  count: number;
};

type RequestStoriesResult =
  | {
      ok: true;
      payload: InstagramStoriesResponse;
    }
  | {
      ok: false;
      error: ParsedMetaApiError;
    };

export const fetchAccountStories = internalAction({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  returns: v.object({
    count: v.number(),
  }),
  handler: async (ctx, args): Promise<FetchAccountStoriesResult> => {
    const account: AccountTokenLifecycleContext | null = await ctx.runQuery(
      internal.accounts.getAccountTokenLifecycleContext,
      {
        accountId: args.accountId,
      },
    );

    if (account === null || account.graphAccessToken === null) {
      throw new Error("No connected Instagram account found.");
    }

    const requestStories = async (
      accessToken: string,
    ): Promise<RequestStoriesResult> => {
      const endpoint = new URL(
        `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${account.instagramAccountId}/stories`,
      );
      endpoint.searchParams.set(
        "fields",
        "id,media_type,thumbnail_url,media_url,permalink,timestamp",
      );
      endpoint.searchParams.set("limit", "30");
      endpoint.searchParams.set("access_token", accessToken);

      const response = await fetch(endpoint);
      const responseText = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          error: parseMetaApiError(
            responseText,
            "Failed to fetch Instagram stories.",
          ),
        };
      }

      return {
        ok: true,
        payload: JSON.parse(responseText) as InstagramStoriesResponse,
      };
    };

    let result = await requestStories(account.graphAccessToken);
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
          result = await requestStories(refreshedAccount.graphAccessToken);
        }
      }
    }

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    const parsed = result.payload;
    const items: InstagramStoryItem[] = parsed.data ?? [];
    const now = Date.now();

    await ctx.runMutation(internal.meta.storyQueries.upsertStoryBatch, {
      workspaceId: account.workspaceId,
      instagramAccountDocId: account.id,
      items: items.map((item) => {
        const timestamp = item.timestamp ?? new Date().toISOString();
        const createdAt = new Date(timestamp).getTime();
        const expiresAt = Number.isFinite(createdAt)
          ? createdAt + 24 * 60 * 60 * 1000
          : now + 24 * 60 * 60 * 1000;

        return {
          storyId: item.id,
          mediaType: item.media_type ?? "IMAGE",
          thumbnailUrl: item.thumbnail_url ?? null,
          mediaUrl: item.media_url ?? null,
          permalink: item.permalink ?? null,
          timestamp,
          expiresAt,
        };
      }),
    });

    return { count: items.length };
  },
});
