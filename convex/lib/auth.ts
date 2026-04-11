import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = QueryCtx | MutationCtx;

function compareWorkspaceAccounts(
  left: Doc<"instagramAccounts">,
  right: Doc<"instagramAccounts">,
) {
  const rank = (account: Doc<"instagramAccounts">) => {
    if (account.status === "connected") {
      return 0;
    }
    if (account.status === "connection_error") {
      return 1;
    }
    return 2;
  };

  const statusOrder = rank(left) - rank(right);
  if (statusOrder !== 0) {
    return statusOrder;
  }

  return (right.connectedAt ?? right._creationTime) - (left.connectedAt ?? left._creationTime);
}

export function sortWorkspaceAccounts(accounts: Doc<"instagramAccounts">[]) {
  return [...accounts].sort(compareWorkspaceAccounts);
}

export function pickFallbackSelectedAccount(
  accounts: Doc<"instagramAccounts">[],
  preferredAccountId: Id<"instagramAccounts"> | null,
) {
  const sortedAccounts = sortWorkspaceAccounts(accounts);
  if (preferredAccountId !== null) {
    const preferredAccount =
      sortedAccounts.find((account) => account._id === preferredAccountId) ?? null;
    if (preferredAccount !== null && preferredAccount.status !== "disconnected") {
      return preferredAccount;
    }
  }

  return (
    sortedAccounts.find((account) => account.status !== "disconnected") ?? null
  );
}

export async function requireCurrentUserId(ctx: DbCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("You must be signed in to access this workspace.");
  }
  return userId;
}

export async function getCurrentWorkspace(
  ctx: DbCtx,
): Promise<Doc<"workspaces"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db
    .query("workspaces")
    .withIndex("by_owner_user_id", (q) => q.eq("ownerUserId", userId))
    .unique();
}

export async function requireCurrentWorkspace(
  ctx: DbCtx,
): Promise<Doc<"workspaces">> {
  const workspace = await getCurrentWorkspace(ctx);
  if (workspace === null) {
    throw new Error("No workspace exists for the current user yet.");
  }
  return workspace;
}

export async function getWorkspaceUserPreference(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
): Promise<Doc<"workspaceUserPreferences"> | null> {
  return await ctx.db
    .query("workspaceUserPreferences")
    .withIndex("by_workspace_id_and_user_id", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .unique();
}

export async function listWorkspaceInstagramAccounts(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  limit = 100,
) {
  const accounts = await ctx.db
    .query("instagramAccounts")
    .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
    .take(limit);

  return sortWorkspaceAccounts(accounts);
}

export async function getWorkspaceInstagramAccountById(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"instagramAccounts">,
) {
  const account = await ctx.db.get(accountId);
  if (account === null || account.workspaceId !== workspaceId) {
    return null;
  }
  return account;
}

export async function requireWorkspaceInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"instagramAccounts">,
) {
  const account = await getWorkspaceInstagramAccountById(
    ctx,
    workspaceId,
    accountId,
  );
  if (account === null) {
    throw new Error("Instagram account not found in this workspace.");
  }
  return account;
}

export async function getWorkspaceInstagramAccountByExternalId(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  instagramAccountId: string,
) {
  return await ctx.db
    .query("instagramAccounts")
    .withIndex("by_workspace_id_and_instagram_account_id", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("instagramAccountId", instagramAccountId),
    )
    .unique();
}

export async function getSelectedWorkspaceInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }

  const [preference, accounts] = await Promise.all([
    getWorkspaceUserPreference(ctx, workspaceId, userId),
    listWorkspaceInstagramAccounts(ctx, workspaceId),
  ]);

  return pickFallbackSelectedAccount(
    accounts,
    preference?.selectedInstagramAccountId ?? null,
  );
}

export async function requireSelectedInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
) {
  const account = await getSelectedWorkspaceInstagramAccount(ctx, workspaceId);
  if (account === null) {
    throw new Error("Connect an Instagram professional account first.");
  }
  return account;
}

export async function requireConnectedInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"instagramAccounts">,
) {
  const account = await requireWorkspaceInstagramAccount(ctx, workspaceId, accountId);
  if (account.status === "disconnected") {
    throw new Error("Reconnect this Instagram account before continuing.");
  }
  return account;
}
