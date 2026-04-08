import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  getCurrentWorkspace,
  getWorkspaceInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
} from "./lib/auth";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

function serializeAccount(account: Doc<"instagramAccounts">) {
  return {
    id: account._id,
    instagramAccountId: account.instagramAccountId,
    username: account.username,
    name: account.name,
    accountType: account.accountType,
    status: account.status,
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
      disconnectedAt: Date.now(),
    });

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
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", session.workspaceId))
      .unique();

    const patch = {
      workspaceId: session.workspaceId,
      instagramAccountId: args.instagramAccountId,
      metaUserId: args.metaUserId,
      username: args.username,
      name: args.name,
      accountType: args.accountType,
      status: args.status,
      graphAccessToken: args.graphAccessToken,
      tokenExpiresAt: args.tokenExpiresAt,
      scopes: args.scopes,
      webhookSubscriptionStatus: args.webhookSubscriptionStatus,
      lastWebhookAt: null,
      lastError: args.lastError,
      connectedAt: Date.now(),
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

    return { accountId };
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
