import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { v } from "convex/values";
import {
  META_GRAPH_API_VERSION,
  META_REQUESTED_SCOPES,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  requireMetaEnv,
} from "./config";
import { isMetaAuthError, parseMetaApiError } from "./authShared";

type TokenExchangeResponse = {
  access_token?: string;
  user_id?: number | string;
  expires_in?: number;
};

type LongLivedTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type InstagramProfileResponse = {
  id?: string;
  user_id?: string | number;
  username?: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
};

type GraphApiErrorResponse = {
  error?: {
    message?: string;
  };
};

function getGraphApiErrorMessage(responseText: string, fallback: string) {
  if (!responseText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(responseText) as GraphApiErrorResponse;
    if (
      typeof parsed.error?.message === "string" &&
      parsed.error.message.trim()
    ) {
      return parsed.error.message.trim();
    }
  } catch {
    // Fall back to the raw response text below.
  }

  return responseText;
}

async function exchangeAuthorizationCode(args: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: args.appId,
    client_secret: args.appSecret,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
    code: args.code,
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || "Meta rejected the authorization code.");
  }

  const parsed = JSON.parse(responseText) as TokenExchangeResponse;
  if (!parsed.access_token) {
    throw new Error("Meta did not return an access token.");
  }

  return parsed;
}

async function exchangeForLongLivedToken(args: {
  appSecret: string;
  accessToken: string;
}) {
  const endpoint = new URL("https://graph.instagram.com/access_token");
  endpoint.searchParams.set("grant_type", "ig_exchange_token");
  endpoint.searchParams.set("client_secret", args.appSecret);
  endpoint.searchParams.set("access_token", args.accessToken);

  const response = await fetch(endpoint);
  if (!response.ok) {
    return null;
  }

  const parsed = (await response.json()) as LongLivedTokenResponse;
  return parsed.access_token ? parsed : null;
}

async function fetchInstagramProfile(accessToken: string) {
  const endpoint = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/me`,
  );
  endpoint.searchParams.set(
    "fields",
    "user_id,username,name,account_type,profile_picture_url",
  );
  endpoint.searchParams.set("access_token", accessToken);

  const response = await fetch(endpoint);
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      responseText || "Failed to fetch Instagram account profile.",
    );
  }

  const parsed = JSON.parse(responseText) as InstagramProfileResponse;
  const instagramAccountId = String(parsed.user_id ?? parsed.id ?? "");
  if (!instagramAccountId) {
    throw new Error("Meta did not return an Instagram account identifier.");
  }

  return {
    instagramAccountId,
    metaUserId:
      parsed.user_id !== undefined
        ? String(parsed.user_id)
        : (parsed.id ?? null),
    username: parsed.username ?? null,
    name: parsed.name ?? null,
    profilePictureUrl: parsed.profile_picture_url ?? null,
    accountType:
      parsed.account_type === "BUSINESS"
        ? "business"
        : parsed.account_type === "CREATOR"
          ? "creator"
          : "unknown",
  } as const;
}

async function subscribeInstagramAccount(args: {
  accessToken: string;
  instagramAccountId: string;
}) {
  const endpoint = new URL(
    `https://graph.instagram.com/${META_GRAPH_API_VERSION}/${args.instagramAccountId}/subscribed_apps`,
  );
  endpoint.searchParams.set("access_token", args.accessToken);
  endpoint.searchParams.set(
    "subscribed_fields",
    META_WEBHOOK_SUBSCRIBED_FIELDS.join(","),
  );

  const response = await fetch(endpoint, {
    method: "POST",
  });

  if (response.ok) {
    return { status: "active" as const, warning: null };
  }

  const responseText = await response.text();
  return {
    status: "failed" as const,
    warning: getGraphApiErrorMessage(
      responseText,
      "Webhook subscription failed.",
    ),
  };
}

export const refreshProfilePicture = action({
  args: {},
  handler: async (ctx) => {
    let account = await ctx.runQuery(
      internal.accounts.getConnectedAccountWithToken,
      {},
    );
    if (account === null || !account.graphAccessToken) {
      throw new Error("No connected Instagram account with a valid token.");
    }

    let profile: Awaited<ReturnType<typeof fetchInstagramProfile>>;
    try {
      profile = await fetchInstagramProfile(account.graphAccessToken);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh the Instagram profile.";
      const parsedError = parseMetaApiError(
        message,
        "Failed to refresh the Instagram profile.",
      );

      if (!isMetaAuthError(parsedError)) {
        throw error;
      }

      const refreshResult: { tokenUsable: boolean } = await ctx.runAction(
        internal.meta.tokenLifecycle.refreshAccountToken,
        {
          accountId: account.id,
          reason: "auth_error",
        },
      );

      if (!refreshResult.tokenUsable) {
        throw new Error(parsedError.message);
      }

      account = await ctx.runQuery(
        internal.accounts.getConnectedAccountWithToken,
        {},
      );
      if (account === null || !account.graphAccessToken) {
        throw new Error(parsedError.message);
      }

      profile = await fetchInstagramProfile(account.graphAccessToken);
    }

    await ctx.runMutation(internal.accounts.patchAccountProfile, {
      accountId: account.id,
      profilePictureUrl: profile.profilePictureUrl,
      username: profile.username,
      name: profile.name,
      accountType: profile.accountType,
    });

    return {
      profilePictureUrl: profile.profilePictureUrl,
      username: profile.username,
    };
  },
});

export const exchangeCodeForAccount = action({
  args: {
    code: v.string(),
    state: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(
      internal.accounts.getConnectSessionByState,
      {
        state: args.state,
      },
    );

    if (session === null || session.expiresAt < Date.now()) {
      throw new Error(
        "This Instagram connection session is invalid or expired.",
      );
    }

    const { appId, appSecret } = requireMetaEnv();

    try {
      const tokenExchange = await exchangeAuthorizationCode({
        appId,
        appSecret,
        code: args.code,
        redirectUri: args.redirectUri,
      });

      const longLived = await exchangeForLongLivedToken({
        appSecret,
        accessToken: tokenExchange.access_token!,
      });

      const graphAccessToken =
        longLived?.access_token ?? tokenExchange.access_token!;
      const tokenExpiresAt =
        typeof (longLived?.expires_in ?? tokenExchange.expires_in) === "number"
          ? Date.now() +
            (longLived?.expires_in ?? tokenExchange.expires_in!) * 1000
          : null;

      const profile = await fetchInstagramProfile(graphAccessToken);
      const subscription = await subscribeInstagramAccount({
        accessToken: graphAccessToken,
        instagramAccountId: profile.instagramAccountId,
      });

      await ctx.runMutation(internal.accounts.upsertConnectedAccount, {
        state: args.state,
        instagramAccountId: profile.instagramAccountId,
        metaUserId: profile.metaUserId,
        username: profile.username,
        name: profile.name,
        profilePictureUrl: profile.profilePictureUrl,
        accountType: profile.accountType,
        graphAccessToken,
        tokenExpiresAt,
        scopes: session.requestedScopes.length
          ? session.requestedScopes
          : META_REQUESTED_SCOPES,
        webhookSubscriptionStatus: subscription.status,
        status: "connected",
        lastError: subscription.warning,
        graphApiVersion: META_GRAPH_API_VERSION,
      });

      return {
        accountId: profile.instagramAccountId,
        username: profile.username,
        warning: subscription.warning,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Instagram account connection failed.";
      await ctx.runMutation(internal.accounts.markConnectSessionFailed, {
        state: args.state,
        errorMessage: message,
      });
      throw error;
    }
  },
});
