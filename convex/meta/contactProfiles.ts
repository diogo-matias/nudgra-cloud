import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";
import { isMetaAuthError, parseMetaApiError } from "./authShared";

type ContactProfileResponse = {
  name?: string | null;
  username?: string | null;
  profile_pic?: string | null;
  error?: {
    message?: string;
  };
};

async function fetchContactProfile(args: {
  graphApiVersion: string | null | undefined;
  instagramUserId: string;
  accessToken: string;
}) {
  const endpoint = new URL(
    `https://graph.instagram.com/${
      args.graphApiVersion || META_GRAPH_API_VERSION
    }/${args.instagramUserId}`,
  );
  endpoint.searchParams.set("fields", "name,username,profile_pic");
  endpoint.searchParams.set("access_token", args.accessToken);

  const response = await fetch(endpoint);
  const responseText = await response.text();
  if (!response.ok) {
    return {
      ok: false as const,
      error: parseMetaApiError(
        responseText,
        "Failed to fetch Instagram contact profile.",
      ),
    };
  }

  return {
    ok: true as const,
    payload: JSON.parse(responseText) as ContactProfileResponse,
  };
}

export const refreshContactProfile = internalAction({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const refreshContext = await ctx.runQuery(
      internal.contacts.getContactProfileRefreshContext,
      {
        contactId: args.contactId,
      },
    );

    if (refreshContext === null) {
      return null;
    }

    const fetchedAt = Date.now();
    let result = await fetchContactProfile({
      graphApiVersion: refreshContext.graphApiVersion,
      instagramUserId: refreshContext.instagramUserId,
      accessToken: refreshContext.graphAccessToken,
    });

    if (!result.ok && isMetaAuthError(result.error)) {
      const refreshResult: { tokenUsable: boolean } = await ctx.runAction(
        internal.meta.tokenLifecycle.refreshAccountToken,
        {
          accountId: refreshContext.accountId,
          reason: "auth_error",
        },
      );

      if (refreshResult.tokenUsable) {
        const retryContext = await ctx.runQuery(
          internal.contacts.getContactProfileRefreshContext,
          {
            contactId: args.contactId,
          },
        );

        if (retryContext !== null) {
          result = await fetchContactProfile({
            graphApiVersion: retryContext.graphApiVersion,
            instagramUserId: retryContext.instagramUserId,
            accessToken: retryContext.graphAccessToken,
          });
        }
      }
    }

    if (!result.ok) {
      const errorMessage = result.error.message;
      console.warn(
        `Instagram contact profile refresh failed for ${refreshContext.instagramUserId}: ${errorMessage}`,
      );
      await ctx.runMutation(
        internal.contacts.markContactProfileRefreshAttempt,
        {
          contactId: refreshContext.contactId,
          fetchedAt,
        },
      );
      return null;
    }

    await ctx.runMutation(internal.contacts.applyFetchedContactProfile, {
      contactId: refreshContext.contactId,
      username: result.payload.username ?? null,
      displayName: result.payload.name ?? null,
      profilePictureUrl: result.payload.profile_pic ?? null,
      fetchedAt,
    });

    return null;
  },
});
