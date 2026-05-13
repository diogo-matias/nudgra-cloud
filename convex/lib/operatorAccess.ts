import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

type DbCtx = QueryCtx | MutationCtx;

export const OPERATOR_ACCESS_DENIED_MESSAGE =
  "This Google account is not allowed to access this Nudgra deployment.";

export function normalizeOperatorEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAllowedOperatorEmails() {
  return new Set(
    (process.env.NUDGRA_ALLOWED_EMAILS ?? "")
      .split(",")
      .map(normalizeOperatorEmail)
      .filter((email) => email.length > 0),
  );
}

export function isOperatorEmailAllowed(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAllowedOperatorEmails().has(normalizeOperatorEmail(email));
}

export async function getOperatorAccessForUserId(
  ctx: DbCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  const email = typeof user?.email === "string" ? user.email : null;

  return {
    allowed: isOperatorEmailAllowed(email),
    email,
  };
}

export async function requireAllowedOperatorUserId(
  ctx: DbCtx,
  userId: Id<"users">,
) {
  const access = await getOperatorAccessForUserId(ctx, userId);
  if (!access.allowed) {
    throw new Error(OPERATOR_ACCESS_DENIED_MESSAGE);
  }
}
