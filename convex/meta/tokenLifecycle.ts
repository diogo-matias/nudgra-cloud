import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type {
  AccountTokenLifecycleContext,
  ParsedMetaApiError,
} from "./authShared";
import {
  buildReconnectRequiredMessage,
  buildRefreshRetryWarning,
  isMetaAuthError,
  parseMetaApiError,
} from "./authShared";

type RefreshTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type RefreshLongLivedTokenResult =
  | {
      ok: true;
      accessToken: string;
      tokenExpiresAt: number;
    }
  | {
      ok: false;
      error: ParsedMetaApiError;
    };

type RefreshAccountTokenResult = {
  refreshed: boolean;
  tokenUsable: boolean;
  state:
    | "disconnected"
    | "not_due"
    | "reconnect_required"
    | "expired"
    | "refreshed"
    | "retry_scheduled";
  tokenExpiresAt?: number;
  nextRefreshAt?: number | null;
};

async function refreshLongLivedToken(
  accessToken: string,
): Promise<RefreshLongLivedTokenResult> {
  const endpoint = new URL("https://graph.instagram.com/refresh_access_token");
  endpoint.searchParams.set("grant_type", "ig_refresh_token");
  endpoint.searchParams.set("access_token", accessToken);

  const response = await fetch(endpoint);
  const responseText = await response.text();

  if (!response.ok) {
    return {
      ok: false as const,
      error: parseMetaApiError(
        responseText,
        `Instagram token refresh failed with status ${response.status}.`,
      ),
    };
  }

  try {
    const parsed = JSON.parse(responseText) as RefreshTokenResponse;
    if (!parsed.access_token || typeof parsed.expires_in !== "number") {
      return {
        ok: false as const,
        error: parseMetaApiError(
          responseText,
          "Instagram did not return a refreshed long-lived token.",
        ),
      };
    }

    return {
      ok: true as const,
      accessToken: parsed.access_token,
      tokenExpiresAt: Date.now() + parsed.expires_in * 1000,
    };
  } catch {
    return {
      ok: false as const,
      error: parseMetaApiError(
        responseText,
        "Instagram returned an invalid token refresh response.",
      ),
    };
  }
}

export const refreshAccountToken = internalAction({
  args: {
    accountId: v.id("instagramAccounts"),
    reason: v.union(
      v.literal("scheduled"),
      v.literal("auth_error"),
      v.literal("manual_reconnect"),
    ),
  },
  returns: v.object({
    refreshed: v.boolean(),
    tokenUsable: v.boolean(),
    state: v.union(
      v.literal("disconnected"),
      v.literal("not_due"),
      v.literal("reconnect_required"),
      v.literal("expired"),
      v.literal("refreshed"),
      v.literal("retry_scheduled"),
    ),
    tokenExpiresAt: v.optional(v.number()),
    nextRefreshAt: v.optional(v.union(v.number(), v.null())),
  }),
  handler: async (ctx, args): Promise<RefreshAccountTokenResult> => {
    const account: AccountTokenLifecycleContext | null = await ctx.runQuery(
      internal.accounts.getAccountTokenLifecycleContext,
      {
        accountId: args.accountId,
      },
    );

    if (account === null || account.status === "disconnected") {
      return {
        refreshed: false,
        tokenUsable: false,
        state: "disconnected" as const,
      };
    }

    const now = Date.now();
    const tokenStillValid =
      account.tokenExpiresAt === null || account.tokenExpiresAt > now;

    if (
      args.reason === "scheduled" &&
      account.nextRefreshAt !== null &&
      account.nextRefreshAt > now + 60_000
    ) {
      return {
        refreshed: false,
        tokenUsable:
          account.status === "connected" &&
          account.graphAccessToken !== null &&
          !(account.reconnectRequired ?? false),
        state: "not_due" as const,
      };
    }

    await ctx.runMutation(internal.accounts.markAccountRefreshAttemptStarted, {
      accountId: account.id,
      attemptedAt: now,
    });

    if (account.graphAccessToken === null) {
      await ctx.runMutation(internal.accounts.markAccountReconnectRequired, {
        accountId: account.id,
        attemptedAt: now,
        lastError: buildReconnectRequiredMessage(
          "Instagram did not have a stored access token to refresh.",
        ),
        reason: args.reason,
      });

      return {
        refreshed: false,
        tokenUsable: false,
        state: "reconnect_required" as const,
      };
    }

    if (!tokenStillValid) {
      await ctx.runMutation(internal.accounts.markAccountReconnectRequired, {
        accountId: account.id,
        attemptedAt: now,
        lastError: buildReconnectRequiredMessage(
          "The long-lived Instagram token has already expired.",
        ),
        reason: args.reason,
      });

      return {
        refreshed: false,
        tokenUsable: false,
        state: "expired" as const,
      };
    }

    const refreshedToken = await refreshLongLivedToken(
      account.graphAccessToken,
    );
    if (refreshedToken.ok) {
      await ctx.runMutation(internal.accounts.applyTokenRefreshSuccess, {
        accountId: account.id,
        graphAccessToken: refreshedToken.accessToken,
        tokenExpiresAt: refreshedToken.tokenExpiresAt,
        refreshedAt: now,
      });

      return {
        refreshed: true,
        tokenUsable: true,
        state: "refreshed" as const,
        tokenExpiresAt: refreshedToken.tokenExpiresAt,
      };
    }

    if (
      args.reason !== "scheduled" ||
      isMetaAuthError(refreshedToken.error) ||
      !tokenStillValid
    ) {
      await ctx.runMutation(internal.accounts.markAccountReconnectRequired, {
        accountId: account.id,
        attemptedAt: now,
        lastError: buildReconnectRequiredMessage(refreshedToken.error.message),
        reason: args.reason,
      });

      return {
        refreshed: false,
        tokenUsable: false,
        state: "reconnect_required" as const,
      };
    }

    const retryState: {
      nextRefreshAt: number | null;
      refreshFailureCount: number;
    } | null = await ctx.runMutation(
      internal.accounts.scheduleTokenRefreshRetry,
      {
        accountId: account.id,
        attemptedAt: now,
        lastError: buildRefreshRetryWarning(refreshedToken.error.message),
      },
    );

    return {
      refreshed: false,
      tokenUsable: true,
      state: "retry_scheduled" as const,
      nextRefreshAt: retryState?.nextRefreshAt ?? null,
    };
  },
});
