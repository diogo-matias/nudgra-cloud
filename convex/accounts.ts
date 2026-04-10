import {
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
  getWorkspaceInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
} from "./lib/auth";
import {
  computeNextRefreshAt,
  computeRefreshRetryDelayMs,
} from "./meta/authShared";

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
  };
}

export const getCurrentAccountStatus = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await getCurrentWorkspace(ctx);
    if (workspace === null) {
      return {
        workspace: null,
        account: null,
        isMetaConfigured: Boolean(
          process.env.META_APP_ID &&
          process.env.META_APP_SECRET &&
          process.env.META_VERIFY_TOKEN,
        ),
      };
    }

    const account = await getWorkspaceInstagramAccount(ctx, workspace._id);

    return {
      workspace: {
        id: workspace._id,
        name: workspace.name,
      },
      account:
        account && account.status !== "disconnected"
          ? serializeAccount(account)
          : null,
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

export const disconnectCurrentAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccount(ctx, workspace._id);
    if (account === null) {
      return { disconnected: false };
    }

    await ctx.db.patch(account._id, {
      status: "disconnected",
      graphAccessToken: null,
      webhookSubscriptionStatus: "disabled",
      reconnectRequired: false,
      lastRefreshAttemptAt: null,
      nextRefreshAt: null,
      refreshFailureCount: 0,
      lastError: null,
      disconnectedAt: Date.now(),
    });

    await ctx.runMutation(
      internal.meta.send.terminalizePendingDeliveriesForAccount,
      {
        accountId: account._id,
        reason:
          "Instagram account was disconnected before the delivery could be sent.",
      },
    );

    const activeEnrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_workspace_id_and_status", (q) =>
        q.eq("workspaceId", workspace._id).eq("status", "active"),
      )
      .take(100);

    for (const enrollment of activeEnrollments) {
      await ctx.db.patch(enrollment._id, {
        status: "stopped",
        stopReason: "Instagram account disconnected",
      });
    }

    return { disconnected: true };
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

    const disconnectedAt = Date.now();

    await ctx.db.patch(account._id, {
      status: "disconnected",
      graphAccessToken: null,
      webhookSubscriptionStatus: "disabled",
      reconnectRequired: false,
      lastRefreshAttemptAt: null,
      nextRefreshAt: null,
      refreshFailureCount: 0,
      disconnectedAt,
      lastError: args.reason ?? "Emergency disconnect triggered from CLI.",
    });

    await ctx.runMutation(
      internal.meta.send.terminalizePendingDeliveriesForAccount,
      {
        accountId: account._id,
        reason:
          args.reason ??
          "Instagram account was disconnected before the delivery could be sent.",
      },
    );

    const activeEnrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_workspace_id_and_status", (q) =>
        q.eq("workspaceId", account.workspaceId).eq("status", "active"),
      )
      .take(100);

    for (const enrollment of activeEnrollments) {
      await ctx.db.patch(enrollment._id, {
        status: "stopped",
        stopReason: args.reason ?? "Instagram account disconnected",
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

    await scheduleAccountRefresh(ctx, account._id, nextRefreshAt);
    await scheduleBlockedDeliveryReplay(ctx, account._id);

    return { reconnected: true, connectedAt };
  },
});

export const getConnectSessionByState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instagramConnectSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
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

    const existingAccount = await ctx.db
      .query("instagramAccounts")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", session.workspaceId),
      )
      .unique();

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

    if (args.status !== "disconnected") {
      await scheduleAccountRefresh(ctx, accountId, nextRefreshAt);
      await scheduleBlockedDeliveryReplay(ctx, accountId);
    }

    return { accountId };
  },
});

export const getConnectedAccountWithToken = internalQuery({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccount(ctx, workspace._id);
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
