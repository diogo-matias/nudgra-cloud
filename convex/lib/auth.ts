import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = QueryCtx | MutationCtx;

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

export async function getWorkspaceInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"instagramAccounts"> | null> {
  return await ctx.db
    .query("instagramAccounts")
    .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}

export async function requireConnectedInstagramAccount(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
): Promise<Doc<"instagramAccounts">> {
  const account = await getWorkspaceInstagramAccount(ctx, workspaceId);
  if (account === null || account.status === "disconnected") {
    throw new Error("Connect an Instagram professional account first.");
  }
  return account;
}
