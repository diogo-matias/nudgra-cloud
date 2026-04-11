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

type CommentReplyActionResult = {
  success: boolean;
  replyId?: string | null;
  error?: string;
};

type SendReplyResult =
  | {
      ok: true;
      payload: string;
    }
  | {
      ok: false;
      error: ParsedMetaApiError;
    };

// ── Action: reply to a comment under a post ──────────────────────

export const replyToComment = internalAction({
  args: {
    accountId: v.id("instagramAccounts"),
    commentId: v.string(),
    message: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    replyId: v.optional(v.union(v.string(), v.null())),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<CommentReplyActionResult> => {
    const account: AccountTokenLifecycleContext | null = await ctx.runQuery(
      internal.accounts.getAccountTokenLifecycleContext,
      {
        accountId: args.accountId,
      },
    );

    if (account === null || account.graphAccessToken === null) {
      return {
        success: false,
        error:
          "No connected Instagram account is available for comment replies.",
      };
    }

    const sendReply = async (accessToken: string): Promise<SendReplyResult> => {
      const version: string = account.graphApiVersion || META_GRAPH_API_VERSION;
      const endpoint: URL = new URL(
        `https://graph.instagram.com/${version}/${args.commentId}/replies`,
      );
      endpoint.searchParams.set("access_token", accessToken);

      const response: Response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: args.message }),
      });

      const responseText: string = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          error: parseMetaApiError(
            responseText,
            `Failed to reply to comment ${args.commentId}.`,
          ),
        };
      }

      return {
        ok: true,
        payload: responseText,
      };
    };

    let result: SendReplyResult = await sendReply(account.graphAccessToken);
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
          result = await sendReply(refreshedAccount.graphAccessToken);
        }
      }
    }

    if (!result.ok) {
      console.error(
        `Failed to reply to comment ${args.commentId}: ${result.error.message}`,
      );
      return { success: false, error: result.error.message };
    }

    let replyId: string | null = null;
    try {
      const parsed = JSON.parse(result.payload) as { id?: string };
      replyId = parsed.id ?? null;
    } catch {
      // ignore
    }

    return { success: true, replyId };
  },
});
