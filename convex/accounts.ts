import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  getCurrentWorkspace,
  getSelectedWorkspaceInstagramAccount,
  getWorkspaceInstagramAccountByExternalId,
  getWorkspaceInstagramAccountById,
  getWorkspaceUserPreference,
  listWorkspaceInstagramAccounts,
  pickFallbackSelectedAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "./lib/auth";
import {
  computeNextRefreshAt,
  computeRefreshRetryDelayMs,
  isMetaAuthError,
  parseMetaApiError,
} from "./meta/authShared";
import { META_GRAPH_API_VERSION } from "./meta/config";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const connectionHealthStatusValidator = v.union(
  v.literal("connected"),
  v.literal("connection_error"),
);
const refreshReasonValidator = v.union(
  v.literal("scheduled"),
  v.literal("auth_error"),
  v.literal("manual_reconnect"),
);

type SerializedAccount = ReturnType<typeof serializeAccount>;

async function scheduleAccountRefresh(
  ctx: MutationCtx,
  accountId: Id<"instagramAccounts">,
  nextRefreshAt: number | null,
) {
  if (nextRefreshAt === null) {
    return;
  }

  await ctx.scheduler.runAfter(
    Math.max(nextRefreshAt - Date.now(), 0),
    internal.meta.tokenLifecycle.refreshAccountToken,
    {
      accountId,
      reason: "scheduled",
    },
  );
}

async function scheduleBlockedDeliveryReplay(
  ctx: MutationCtx,
  accountId: Id<"instagramAccounts">,
) {
  await ctx.scheduler.runAfter(0, internal.meta.send.replayBlockedDeliveries, {
    accountId,
  });
}

async function upsertWorkspaceUserPreference(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    selectedInstagramAccountId: Id<"instagramAccounts"> | null;
  },
) {
  const preference = await getWorkspaceUserPreference(
    ctx,
    args.workspaceId,
    args.userId,
  );

  if (preference === null) {
    await ctx.db.insert("workspaceUserPreferences", args);
    return;
  }

  await ctx.db.patch(preference._id, {
    selectedInstagramAccountId: args.selectedInstagramAccountId,
  });
}

async function syncWorkspaceSelectedAccountPreference(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    userId: Id<"users">;
    preferredAccountId: Id<"instagramAccounts"> | null;
  },
) {
  const accounts = await listWorkspaceInstagramAccounts(ctx, args.workspaceId);
  const selectedAccount = pickFallbackSelectedAccount(
    accounts,
    args.preferredAccountId,
  );

  await upsertWorkspaceUserPreference(ctx, {
    workspaceId: args.workspaceId,
    userId: args.userId,
    selectedInstagramAccountId: selectedAccount?._id ?? null,
  });

  return selectedAccount;
}

function serializeAccount(account: Doc<"instagramAccounts">) {
  return {
    id: account._id,
    instagramAccountId: account.instagramAccountId,
    username: account.username,
    name: account.name,
    profilePictureUrl: account.profilePictureUrl ?? null,
    accountType: account.accountType,
    status: account.status,
    reconnectRequired: account.reconnectRequired ?? false,
    lastRefreshAttemptAt: account.lastRefreshAttemptAt ?? null,
    lastTokenRefreshAt: account.lastTokenRefreshAt ?? null,
    nextRefreshAt: account.nextRefreshAt ?? null,
    refreshFailureCount: account.refreshFailureCount ?? 0,
    scopes: account.scopes,
    tokenExpiresAt: account.tokenExpiresAt,
    webhookSubscriptionStatus: account.webhookSubscriptionStatus,
    lastWebhookAt: account.lastWebhookAt,
    lastError: account.lastError,
    connectedAt: account.connectedAt,
    disconnectedAt: account.disconnectedAt,
    graphApiVersion: account.graphApiVersion,
  };
}

function filterAccountsBySearch<T extends SerializedAccount>(
  accounts: T[],
  search: string,
): T[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return accounts;
  }

  return accounts.filter((account) =>
    [account.username, account.name, account.instagramAccountId]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(normalizedSearch)),
  );
}

async function disconnectInstagramAccount(
  ctx: MutationCtx,
  account: Doc<"instagramAccounts">,
  reason: string,
) {
  const disconnectedAt = Date.now();

  await ctx.db.patch(account._id, {
    status: "disconnected",
    graphAccessToken: null,
    webhookSubscriptionStatus: "disabled",
    reconnectRequired: false,
    lastRefreshAttemptAt: null,
    nextRefreshAt: null,
    refreshFailureCount: 0,
    lastError: reason,
    disconnectedAt,
  });

  await ctx.runMutation(
    internal.meta.send.terminalizePendingDeliveriesForAccount,
    {
      accountId: account._id,
      reason,
    },
  );

  const activeEnrollments = await ctx.db
    .query("sequenceEnrollments")
    .withIndex("by_instagram_account_id_and_status", (q) =>
      q.eq("instagramAccountId", account._id).eq("status", "active"),
    )
    .take(100);

  for (const enrollment of activeEnrollments) {
    await ctx.db.patch(enrollment._id, {
      status: "stopped",
      stopReason: "Instagram account disconnected",
    });
  }

  return disconnectedAt;
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

  const parsed = JSON.parse(responseText) as {
    id?: string;
    user_id?: string | number;
    username?: string;
    name?: string;
    account_type?: string;
    profile_picture_url?: string;
  };
  const instagramAccountId = String(parsed.user_id ?? parsed.id ?? "");
  if (!instagramAccountId) {
    throw new Error("Meta did not return an Instagram account identifier.");
  }

  return {
    instagramAccountId,
    username: parsed.username ?? null,
    name: parsed.name ?? null,
    profilePictureUrl: parsed.profile_picture_url ?? null,
    accountType:
      parsed.account_type === "BUSINESS"
        ? ("business" as const)
        : parsed.account_type === "CREATOR"
          ? ("creator" as const)
          : ("unknown" as const),
  };
}

export const listWorkspaceAccounts = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    const [workspace, userId] = await Promise.all([
      requireCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);
    const [accounts, preference] = await Promise.all([
      listWorkspaceInstagramAccounts(ctx, workspace._id),
      getWorkspaceUserPreference(ctx, workspace._id, userId),
    ]);
    const selectedAccount = pickFallbackSelectedAccount(
      accounts,
      preference?.selectedInstagramAccountId ?? null,
    );

    return {
      selectedAccountId: selectedAccount?._id ?? null,
      accounts: filterAccountsBySearch(
        accounts.map((account) => ({
          ...serializeAccount(account),
          isSelected: selectedAccount?._id === account._id,
        })),
        args.search,
      ),
    };
  },
});

export const getSelectedAccountContext = query({
  args: {},
  handler: async (ctx) => {
    const [workspace, userId] = await Promise.all([
      getCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);

    if (workspace === null) {
      return {
        workspace: null,
        selectedAccount: null,
        accounts: [] as Array<SerializedAccount & { isSelected: boolean }>,
        totalAccounts: 0,
        connectedAccounts: 0,
        isMetaConfigured: Boolean(
          process.env.META_APP_ID &&
            process.env.META_APP_SECRET &&
            process.env.META_VERIFY_TOKEN,
        ),
      };
    }

    const [accounts, preference] = await Promise.all([
      listWorkspaceInstagramAccounts(ctx, workspace._id),
      getWorkspaceUserPreference(ctx, workspace._id, userId),
    ]);
    const selectedAccount = pickFallbackSelectedAccount(
      accounts,
      preference?.selectedInstagramAccountId ?? null,
    );

    return {
      workspace: {
        id: workspace._id,
        name: workspace.name,
      },
      selectedAccount:
        selectedAccount === null ? null : serializeAccount(selectedAccount),
      accounts: accounts.map((account) => ({
        ...serializeAccount(account),
        isSelected: selectedAccount?._id === account._id,
      })),
      totalAccounts: accounts.length,
      connectedAccounts: accounts.filter(
        (account) => account.status !== "disconnected",
      ).length,
      isMetaConfigured: Boolean(
        process.env.META_APP_ID &&
          process.env.META_APP_SECRET &&
          process.env.META_VERIFY_TOKEN,
      ),
    };
  },
});

export const getCurrentAccountStatus = query({
  args: {},
  handler: async (ctx) => {
    const [workspace, userId] = await Promise.all([
      getCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);

    if (workspace === null) {
      return {
        workspace: null,
        account: null,
        accounts: [] as Array<SerializedAccount & { isSelected: boolean }>,
        totalAccounts: 0,
        connectedAccounts: 0,
        isMetaConfigured: Boolean(
          process.env.META_APP_ID &&
            process.env.META_APP_SECRET &&
            process.env.META_VERIFY_TOKEN,
        ),
      };
    }

    const [accounts, preference] = await Promise.all([
      listWorkspaceInstagramAccounts(ctx, workspace._id),
      getWorkspaceUserPreference(ctx, workspace._id, userId),
    ]);
    const selectedAccount = pickFallbackSelectedAccount(
      accounts,
      preference?.selectedInstagramAccountId ?? null,
    );

    return {
      workspace: {
        id: workspace._id,
        name: workspace.name,
      },
      account:
        selectedAccount === null ? null : serializeAccount(selectedAccount),
      accounts: accounts.map((account) => ({
        ...serializeAccount(account),
        isSelected: selectedAccount?._id === account._id,
      })),
      totalAccounts: accounts.length,
      connectedAccounts: accounts.filter(
        (account) => account.status !== "disconnected",
      ).length,
      isMetaConfigured: Boolean(
        process.env.META_APP_ID &&
          process.env.META_APP_SECRET &&
          process.env.META_VERIFY_TOKEN,
      ),
    };
  },
});

export const createConnectSession = mutation({
  args: {
    state: v.string(),
    redirectUri: v.string(),
    requestedScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const workspace = await requireCurrentWorkspace(ctx);

    await ctx.db.insert("instagramConnectSessions", {
      workspaceId: workspace._id,
      createdByUserId: userId,
      state: args.state,
      redirectUri: args.redirectUri,
      requestedScopes: args.requestedScopes,
      status: "pending",
      expiresAt: Date.now() + 1000 * 60 * 15,
      errorMessage: null,
    });

    return { state: args.state, workspaceId: workspace._id };
  },
});

export const selectAccount = mutation({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const [workspace, userId] = await Promise.all([
      requireCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);
    const account = await requireWorkspaceInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );

    if (account.status === "disconnected") {
      throw new Error("Reconnect this Instagram account before selecting it.");
    }

    await upsertWorkspaceUserPreference(ctx, {
      workspaceId: workspace._id,
      userId,
      selectedInstagramAccountId: account._id,
    });

    return { accountId: account._id };
  },
});

export const disconnectAccount = mutation({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const [workspace, userId] = await Promise.all([
      requireCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);
    const account = await requireWorkspaceInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );

    const reason =
      "Instagram account was disconnected before the delivery could be sent.";
    await disconnectInstagramAccount(ctx, account, reason);

    const selectedAccount = await syncWorkspaceSelectedAccountPreference(ctx, {
      workspaceId: workspace._id,
      userId,
      preferredAccountId: null,
    });

    return {
      disconnected: true,
      selectedAccountId: selectedAccount?._id ?? null,
    };
  },
});

export const disconnectCurrentAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const [workspace, userId] = await Promise.all([
      requireCurrentWorkspace(ctx),
      requireCurrentUserId(ctx),
    ]);
    const selectedAccount = await getSelectedWorkspaceInstagramAccount(
      ctx,
      workspace._id,
    );
    if (selectedAccount === null) {
      return { disconnected: false, selectedAccountId: null };
    }

    const reason =
      "Instagram account was disconnected before the delivery could be sent.";
    await disconnectInstagramAccount(ctx, selectedAccount, reason);

    const fallbackAccount = await syncWorkspaceSelectedAccountPreference(ctx, {
      workspaceId: workspace._id,
      userId,
      preferredAccountId: null,
    });

    return {
      disconnected: true,
      selectedAccountId: fallbackAccount?._id ?? null,
    };
  },
});

export const refreshAccountProfile = action({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    let account = await ctx.runQuery(
      internal.accounts.getOwnedAccountWithToken,
      {
        accountId: args.accountId,
      },
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
        internal.accounts.getOwnedAccountWithToken,
        {
          accountId: args.accountId,
        },
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

export const emergencyDisconnectAccount = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null) {
      return { disconnected: false };
    }

    const reason =
      args.reason ??
      "Instagram account was disconnected before the delivery could be sent.";
    const disconnectedAt = await disconnectInstagramAccount(ctx, account, reason);
    const workspace = await ctx.db.get(account.workspaceId);

    if (workspace !== null) {
      await syncWorkspaceSelectedAccountPreference(ctx, {
        workspaceId: account.workspaceId,
        userId: workspace.ownerUserId,
        preferredAccountId: null,
      });
    }

    return { disconnected: true, disconnectedAt };
  },
});

export const emergencyReconnectAccount = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    graphAccessToken: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null) {
      return { reconnected: false };
    }

    const connectedAt = Date.now();
    const nextRefreshAt = computeNextRefreshAt(
      account.tokenExpiresAt ?? null,
      connectedAt,
    );

    await ctx.db.patch(account._id, {
      status: "connected",
      graphAccessToken: args.graphAccessToken,
      webhookSubscriptionStatus: "active",
      reconnectRequired: false,
      lastRefreshAttemptAt: null,
      lastTokenRefreshAt: connectedAt,
      nextRefreshAt,
      refreshFailureCount: 0,
      disconnectedAt: null,
      connectedAt,
      lastError: args.reason ?? null,
    });

    const workspace = await ctx.db.get(account.workspaceId);
    if (workspace !== null) {
      await upsertWorkspaceUserPreference(ctx, {
        workspaceId: account.workspaceId,
        userId: workspace.ownerUserId,
        selectedInstagramAccountId: account._id,
      });
    }

    await scheduleAccountRefresh(ctx, account._id, nextRefreshAt);
    await scheduleBlockedDeliveryReplay(ctx, account._id);

    return { reconnected: true, connectedAt };
  },
});

export const getConnectSessionByState = internalQuery({
  args: { state: v.string(), redirectUri: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const workspace = await requireCurrentWorkspace(ctx);
    const session = await ctx.db
      .query("instagramConnectSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();

    if (
      session === null ||
      session.createdByUserId !== userId ||
      session.workspaceId !== workspace._id ||
      session.status !== "pending" ||
      session.expiresAt < Date.now() ||
      session.redirectUri !== args.redirectUri
    ) {
      return null;
    }

    return session;
  },
});

export const upsertConnectedAccount = internalMutation({
  args: {
    state: v.string(),
    instagramAccountId: v.string(),
    metaUserId: nullableString,
    username: nullableString,
    name: nullableString,
    profilePictureUrl: nullableString,
    accountType: v.union(
      v.literal("business"),
      v.literal("creator"),
      v.literal("unknown"),
    ),
    graphAccessToken: v.string(),
    tokenExpiresAt: nullableNumber,
    scopes: v.array(v.string()),
    webhookSubscriptionStatus: v.union(
      v.literal("active"),
      v.literal("failed"),
      v.literal("disabled"),
    ),
    status: v.union(
      v.literal("connected"),
      v.literal("connection_error"),
      v.literal("disconnected"),
    ),
    lastError: nullableString,
    graphApiVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("instagramConnectSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();

    if (session === null) {
      throw new Error("Connection session not found.");
    }
    if (session.status !== "pending" || session.expiresAt < Date.now()) {
      throw new Error("Connection session is not pending.");
    }

    const existingAccount = await getWorkspaceInstagramAccountByExternalId(
      ctx,
      session.workspaceId,
      args.instagramAccountId,
    );

    const connectedAt = Date.now();
    const nextRefreshAt = computeNextRefreshAt(
      args.tokenExpiresAt,
      connectedAt,
    );
    const patch = {
      workspaceId: session.workspaceId,
      instagramAccountId: args.instagramAccountId,
      metaUserId: args.metaUserId,
      username: args.username,
      name: args.name,
      profilePictureUrl: args.profilePictureUrl,
      accountType: args.accountType,
      status: args.status,
      graphAccessToken: args.graphAccessToken,
      tokenExpiresAt: args.tokenExpiresAt,
      scopes: args.scopes,
      webhookSubscriptionStatus: args.webhookSubscriptionStatus,
      lastWebhookAt: null,
      lastError: args.lastError,
      reconnectRequired: false,
      lastRefreshAttemptAt: null,
      lastTokenRefreshAt: connectedAt,
      nextRefreshAt,
      refreshFailureCount: 0,
      connectedAt,
      disconnectedAt: null,
      graphApiVersion: args.graphApiVersion,
    };

    let accountId: Id<"instagramAccounts">;

    if (existingAccount === null) {
      accountId = await ctx.db.insert("instagramAccounts", patch);
    } else {
      await ctx.db.patch(existingAccount._id, patch);
      accountId = existingAccount._id;
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      errorMessage: args.lastError,
    });

    await upsertWorkspaceUserPreference(ctx, {
      workspaceId: session.workspaceId,
      userId: session.createdByUserId,
      selectedInstagramAccountId:
        args.status === "disconnected" ? null : accountId,
    });

    if (args.status !== "disconnected") {
      await scheduleAccountRefresh(ctx, accountId, nextRefreshAt);
      await scheduleBlockedDeliveryReplay(ctx, accountId);
    }

    return { accountId };
  },
});

export const getOwnedAccountWithToken = internalQuery({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccountById(
      ctx,
      workspace._id,
      args.accountId,
    );
    if (account === null || account.status === "disconnected") {
      return null;
    }
    return {
      id: account._id,
      instagramAccountId: account.instagramAccountId,
      graphAccessToken: account.graphAccessToken,
      status: account.status,
      reconnectRequired: account.reconnectRequired ?? false,
      graphApiVersion: account.graphApiVersion,
    };
  },
});

export const getAccountTokenLifecycleContext = internalQuery({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null) {
      return null;
    }

    return {
      id: account._id,
      workspaceId: account.workspaceId,
      instagramAccountId: account.instagramAccountId,
      status: account.status,
      graphAccessToken: account.graphAccessToken,
      tokenExpiresAt: account.tokenExpiresAt,
      reconnectRequired: account.reconnectRequired ?? false,
      lastRefreshAttemptAt: account.lastRefreshAttemptAt ?? null,
      lastTokenRefreshAt: account.lastTokenRefreshAt ?? null,
      nextRefreshAt: account.nextRefreshAt ?? null,
      refreshFailureCount: account.refreshFailureCount ?? 0,
      graphApiVersion: account.graphApiVersion,
      lastError: account.lastError,
    };
  },
});

export const patchAccountProfile = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    profilePictureUrl: nullableString,
    username: v.optional(nullableString),
    name: v.optional(nullableString),
    accountType: v.optional(
      v.union(
        v.literal("business"),
        v.literal("creator"),
        v.literal("unknown"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | null> = {
      profilePictureUrl: args.profilePictureUrl,
    };
    if (args.username !== undefined) {
      patch.username = args.username;
    }
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    await ctx.db.patch(args.accountId, {
      ...patch,
      ...(args.accountType !== undefined
        ? { accountType: args.accountType }
        : {}),
    });
  },
});

export const markAccountRefreshAttemptStarted = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    attemptedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null || account.status === "disconnected") {
      return null;
    }

    await ctx.db.patch(account._id, {
      lastRefreshAttemptAt: args.attemptedAt,
    });

    return null;
  },
});

export const applyTokenRefreshSuccess = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    graphAccessToken: v.string(),
    tokenExpiresAt: nullableNumber,
    refreshedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null || account.status === "disconnected") {
      return null;
    }

    const nextRefreshAt = computeNextRefreshAt(
      args.tokenExpiresAt,
      args.refreshedAt,
    );

    await ctx.db.patch(account._id, {
      status: "connected",
      graphAccessToken: args.graphAccessToken,
      tokenExpiresAt: args.tokenExpiresAt,
      reconnectRequired: false,
      lastRefreshAttemptAt: args.refreshedAt,
      lastTokenRefreshAt: args.refreshedAt,
      nextRefreshAt,
      refreshFailureCount: 0,
      lastError: null,
      disconnectedAt: null,
    });

    await scheduleAccountRefresh(ctx, account._id, nextRefreshAt);
    await scheduleBlockedDeliveryReplay(ctx, account._id);

    return {
      nextRefreshAt,
    };
  },
});

export const scheduleTokenRefreshRetry = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    attemptedAt: v.number(),
    lastError: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null || account.status === "disconnected") {
      return null;
    }

    const refreshFailureCount = (account.refreshFailureCount ?? 0) + 1;
    const delayMs = computeRefreshRetryDelayMs(refreshFailureCount);
    const nextRefreshAt = args.attemptedAt + delayMs;

    await ctx.db.patch(account._id, {
      status: "connected",
      reconnectRequired: false,
      lastRefreshAttemptAt: args.attemptedAt,
      nextRefreshAt,
      refreshFailureCount,
      lastError: args.lastError,
    });

    await ctx.scheduler.runAfter(
      delayMs,
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: account._id,
        reason: "scheduled",
      },
    );

    return {
      nextRefreshAt,
      refreshFailureCount,
    };
  },
});

export const markAccountReconnectRequired = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    attemptedAt: v.number(),
    lastError: v.string(),
    reason: refreshReasonValidator,
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null || account.status === "disconnected") {
      return null;
    }

    await ctx.db.patch(account._id, {
      status: "connection_error",
      reconnectRequired: true,
      lastRefreshAttemptAt: args.attemptedAt,
      nextRefreshAt: null,
      refreshFailureCount: Math.max((account.refreshFailureCount ?? 0) + 1, 1),
      lastError: args.lastError,
    });

    return {
      reason: args.reason,
    };
  },
});

export const updateAccountConnectionHealth = internalMutation({
  args: {
    accountId: v.id("instagramAccounts"),
    status: v.optional(connectionHealthStatusValidator),
    lastError: v.optional(nullableString),
    reconnectRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (account === null) {
      return null;
    }

    await ctx.db.patch(account._id, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.lastError !== undefined ? { lastError: args.lastError } : {}),
      ...(args.reconnectRequired !== undefined
        ? { reconnectRequired: args.reconnectRequired }
        : {}),
    });

    return null;
  },
});

export const markConnectSessionFailed = internalMutation({
  args: {
    state: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("instagramConnectSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();

    if (session === null) {
      return null;
    }

    await ctx.db.patch(session._id, {
      status: "failed",
      errorMessage: args.errorMessage,
    });

    return null;
  },
});
