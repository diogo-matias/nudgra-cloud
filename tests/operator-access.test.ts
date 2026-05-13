import { describe, expect, it, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const DEFAULT_ALLOWED_EMAIL = "operator@example.com";
const DEFAULT_ALLOWED_EMAILS = "operator@example.com,test@example.com";

async function seedUser(
  t: ReturnType<typeof convexTest>,
  args: { email: string; name?: string },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: args.name ?? "Operator",
      email: args.email,
    });
  });
}

async function seedWorkspaceWithRule(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
) {
  return await t.run(async (ctx) => {
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: "Workspace",
      timezone: "UTC",
    });
    const accountId = await ctx.db.insert("instagramAccounts", {
      workspaceId,
      instagramAccountId: "ig_operator_access",
      metaUserId: null,
      username: "operator",
      name: "Operator",
      profilePictureUrl: null,
      accountType: "business",
      status: "connected",
      graphAccessToken: "token",
      tokenExpiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
      scopes: [],
      webhookSubscriptionStatus: "active",
      lastWebhookAt: null,
      lastError: null,
      connectedAt: Date.now(),
      disconnectedAt: null,
      graphApiVersion: "v23.0",
    });
    const ruleId = await ctx.db.insert("automationRules", {
      workspaceId,
      instagramAccountId: accountId,
      name: "Operator access rule",
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["guide"],
      replyText: "Here is the guide.",
      linkDmText: "Here is the guide.",
      linkButtons: [],
      followGateEnabled: false,
      followGateText: "",
      emailCollectionEnabled: false,
      emailCollectionText: "",
      followUpEnabled: false,
      followUpText: "",
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: userId,
      triggerCount: 0,
      lastTriggeredAt: null,
    });

    return { workspaceId, accountId, ruleId };
  });
}

describe("operator access allowlist", () => {
  afterEach(() => {
    process.env.NUDGRA_ALLOWED_EMAILS = DEFAULT_ALLOWED_EMAILS;
  });

  it("allows an allowlisted Google email to create and read the current workspace", async () => {
    process.env.NUDGRA_ALLOWED_EMAILS = "operator@example.com, backup@example.com";
    const t = convexTest({ schema, modules });
    const userId = await seedUser(t, { email: DEFAULT_ALLOWED_EMAIL });
    const authT = t.withIdentity({ subject: userId });

    const result = await authT.mutation(api.workspaces.ensureCurrentWorkspace, {});
    const summary = await authT.query(api.workspaces.getCurrentWorkspaceSummary, {});

    expect(result.created).toBe(true);
    expect(summary).toMatchObject({
      id: result.workspaceId,
      name: "Operator",
      timezone: "UTC",
    });
  });

  it("rejects a signed-in Google account that is not in the allowlist", async () => {
    process.env.NUDGRA_ALLOWED_EMAILS = DEFAULT_ALLOWED_EMAIL;
    const t = convexTest({ schema, modules });
    const userId = await seedUser(t, { email: "intruder@example.com" });
    const authT = t.withIdentity({ subject: userId });

    await expect(
      authT.mutation(api.workspaces.ensureCurrentWorkspace, {}),
    ).rejects.toThrow("not allowed");

    const access = await authT.query(api.workspaces.getOperatorAccessStatus, {});
    expect(access).toEqual({
      isAuthenticated: true,
      isAllowed: false,
      email: "intruder@example.com",
    });
  });

  it("blocks existing unauthorized sessions from reading, mutating, and deleting workspace resources", async () => {
    process.env.NUDGRA_ALLOWED_EMAILS = DEFAULT_ALLOWED_EMAIL;
    const t = convexTest({ schema, modules });
    const userId = await seedUser(t, { email: "former-operator@example.com" });
    const fixture = await seedWorkspaceWithRule(t, userId);
    const authT = t.withIdentity({ subject: userId });

    await expect(
      authT.query(api.workspaces.getCurrentWorkspaceSummary, {}),
    ).rejects.toThrow("not allowed");
    await expect(
      authT.mutation(api.workspaces.ensureCurrentWorkspace, {}),
    ).rejects.toThrow("not allowed");
    await expect(
      authT.mutation(api.automations.rules.deleteRule, {
        accountId: fixture.accountId,
        ruleId: fixture.ruleId,
      }),
    ).rejects.toThrow("not allowed");

    const storedRule = await t.run((ctx) => ctx.db.get(fixture.ruleId));
    expect(storedRule).not.toBeNull();
  });

  it("fails closed when the allowlist is empty or missing", async () => {
    const t = convexTest({ schema, modules });
    const userId = await seedUser(t, { email: DEFAULT_ALLOWED_EMAIL });
    const authT = t.withIdentity({ subject: userId });

    process.env.NUDGRA_ALLOWED_EMAILS = "";
    await expect(
      authT.mutation(api.workspaces.ensureCurrentWorkspace, {}),
    ).rejects.toThrow("not allowed");

    delete process.env.NUDGRA_ALLOWED_EMAILS;
    await expect(
      authT.mutation(api.workspaces.ensureCurrentWorkspace, {}),
    ).rejects.toThrow("not allowed");
  });
});
