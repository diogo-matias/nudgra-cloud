import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-14T16:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Operator",
      email: "operator@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: "Workspace",
      timezone: "UTC",
    });

    return { userId, workspaceId };
  });
}

async function createConnectSession(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  state: string,
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("instagramConnectSessions", {
      workspaceId: fixture.workspaceId,
      createdByUserId: fixture.userId,
      state,
      redirectUri: "https://app.example.com/dashboard/account",
      requestedScopes: [
        "instagram_business_basic",
        "instagram_business_manage_messages",
      ],
      status: "pending",
      expiresAt: BASE_TIME + 15 * 60 * 1000,
      errorMessage: null,
    });
  });
}

async function connectAccount(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  args: {
    state: string;
    externalId: string;
    username: string;
  },
) {
  await createConnectSession(t, fixture, args.state);

  return await t.mutation(internal.accounts.upsertConnectedAccount, {
    state: args.state,
    instagramAccountId: args.externalId,
    metaUserId: null,
    username: args.username,
    name: args.username,
    profilePictureUrl: null,
    accountType: "business",
    graphAccessToken: `token-${args.externalId}`,
    tokenExpiresAt: BASE_TIME + 60 * DAY_MS,
    scopes: [],
    webhookSubscriptionStatus: "active",
    status: "connected",
    lastError: null,
    graphApiVersion: "v23.0",
  });
}

async function seedThread(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    instagramAccountExternalId: string;
    suffix: string;
  },
) {
  return await t.run(async (ctx) => {
    const contactId = await ctx.db.insert("contacts", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      instagramUserId: `contact_${args.suffix}`,
      username: `user_${args.suffix}`,
      displayName: `User ${args.suffix}`,
      profilePictureUrl: null,
      profilePictureFetchedAt: BASE_TIME,
      firstInboundAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
    });
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      contactId,
      conversationKey: `${args.instagramAccountExternalId}:contact_${args.suffix}`,
      status: "active",
      startedAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastOutboundAt: null,
      lastMessagePreview: `Message for ${args.suffix}`,
      messagingWindowClosesAt: BASE_TIME + DAY_MS,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function seedThreadBatch(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    instagramAccountExternalId: string;
    count: number;
    suffixPrefix: string;
  },
) {
  await t.run(async (ctx) => {
    for (let index = 0; index < args.count; index += 1) {
      const suffix = `${args.suffixPrefix}-${index}`;
      const contactId = await ctx.db.insert("contacts", {
        workspaceId: args.workspaceId,
        instagramAccountId: args.instagramAccountId,
        instagramUserId: `contact_${suffix}`,
        username: `user_${suffix}`,
        displayName: `User ${suffix}`,
        profilePictureUrl: null,
        profilePictureFetchedAt: BASE_TIME + index,
        firstInboundAt: BASE_TIME + index,
        lastInboundAt: BASE_TIME + index,
        lastMessageAt: BASE_TIME + index,
      });

      await ctx.db.insert("conversations", {
        workspaceId: args.workspaceId,
        instagramAccountId: args.instagramAccountId,
        contactId,
        conversationKey: `${args.instagramAccountExternalId}:contact_${suffix}`,
        status: "active",
        startedAt: BASE_TIME + index,
        lastMessageAt: BASE_TIME + index,
        lastInboundAt: BASE_TIME + index,
        lastOutboundAt: null,
        lastMessagePreview: `Message for ${suffix}`,
        messagingWindowClosesAt: BASE_TIME + DAY_MS + index,
        lastAutomationRuleId: null,
      });
    }
  });
}

async function seedRule(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    createdByUserId: Id<"users">;
    name: string;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("automationRules", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      name: args.name,
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["guide"],
      replyText: `Reply from ${args.name}`,
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: args.createdByUserId,
      triggerCount: 0,
      lastTriggeredAt: null,
    });
  });
}

async function seedCommentAutomation(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    createdByUserId: Id<"users">;
    name: string;
    status?: "draft" | "live" | "paused";
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("commentAutomations", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      createdByUserId: args.createdByUserId,
      name: args.name,
      status: args.status ?? "live",
      postScope: "specific",
      selectedMediaIds: ["media_1"],
      commentFilter: "specific_words",
      triggerKeywords: ["guide"],
      triggerKeywordLabels: ["guide"],
      commentReplyEnabled: false,
      commentReplyTexts: [],
      openingDmEnabled: true,
      openingDmText: "Sending the guide.",
      openingDmButtonText: "Send me the guide",
      followGateEnabled: false,
      followGateText: "",
      emailCollectionEnabled: false,
      emailCollectionText: "",
      linkDmText: "Here is the guide.",
      linkUrl: "https://example.com/guide",
      linkButtonText: "Open guide",
      followUpEnabled: false,
      followUpText: "",
      triggerCount: 0,
      lastTriggeredAt: null,
      lastModifiedAt: BASE_TIME,
    });
  });
}

async function seedDeliveryAttempt(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    automationRuleId?: Id<"automationRules"> | null;
    status:
      | "queued"
      | "blocked_auth"
      | "sent"
      | "skipped"
      | "skipped_expired"
      | "failed";
    messageText: string;
    reason?: string | null;
    responsePayload?: string | null;
    eventTime?: number;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("deliveryAttempts", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      automationRuleId: args.automationRuleId ?? null,
      sequenceEnrollmentId: null,
      status: args.status,
      reason: args.reason ?? null,
      requestPayload: JSON.stringify({
        kind: "text",
        text: args.messageText,
      }),
      responsePayload: args.responsePayload ?? null,
      policyWindowOpen: true,
      attemptNumber: 1,
      eventTime: args.eventTime ?? BASE_TIME,
      messageText: args.messageText,
      metaMessageId: null,
    });
  });
}

describe("dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scopes overview stats and recent activity to the selected instagram account", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const first = await connectAccount(t, fixture, {
      state: "dashboard-first",
      externalId: "ig_dashboard_a",
      username: "account_a",
    });
    const second = await connectAccount(t, fixture, {
      state: "dashboard-second",
      externalId: "ig_dashboard_b",
      username: "account_b",
    });

    await authT.mutation(api.accounts.selectAccount, {
      accountId: first.accountId,
    });

    const firstThread = await seedThread(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      instagramAccountExternalId: "ig_dashboard_a",
      suffix: "first",
    });
    const secondThread = await seedThread(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      instagramAccountExternalId: "ig_dashboard_b",
      suffix: "second",
    });

    const firstRuleId = await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      createdByUserId: fixture.userId,
      name: "First account rule",
    });
    await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      createdByUserId: fixture.userId,
      name: "Second account rule",
    });
    await seedCommentAutomation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      createdByUserId: fixture.userId,
      name: "First account comment automation",
    });
    await seedCommentAutomation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      createdByUserId: fixture.userId,
      name: "Second account comment automation",
      status: "paused",
    });

    await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      contactId: firstThread.contactId,
      conversationId: firstThread.conversationId,
      automationRuleId: firstRuleId,
      status: "failed",
      messageText: "Reply for the first account",
      reason: "Meta rejected the message for the first account.",
      responsePayload: JSON.stringify({
        error: {
          message: "Meta rejected the message for the first account.",
          code: 10,
          error_subcode: 2534015,
          type: "OAuthException",
        },
      }),
      eventTime: BASE_TIME + 1_000,
    });
    await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      contactId: secondThread.contactId,
      conversationId: secondThread.conversationId,
      status: "failed",
      messageText: "Reply for the second account",
      reason: "Meta rejected the message for the second account.",
      responsePayload: JSON.stringify({
        error: {
          message: "Meta rejected the message for the second account.",
          code: 10,
          error_subcode: 2534015,
          type: "OAuthException",
        },
      }),
      eventTime: BASE_TIME + 2_000,
    });

    const overview = await authT.query(api.dashboard.getOverview, {});

    expect(overview.selectedAccount?.id).toBe(first.accountId);
    expect(overview.stats).toEqual({
      activeAutomations: 2,
      contacts: 1,
      conversations: 1,
      failuresToday: 1,
    });
    expect(overview.recentActivity).toHaveLength(1);
    expect(overview.recentActivity[0]).toMatchObject({
      kind: "failed",
    });
    expect(overview.recentActivity[0]?.label).toContain("@user_first");
    expect(overview.recentActivity[0]?.label).toContain("first account");
  });

  it("counts live automations in overview even when no keyword rules exist", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const connected = await connectAccount(t, fixture, {
      state: "dashboard-comment-only",
      externalId: "ig_dashboard_comment_only",
      username: "comment_only",
    });

    await authT.mutation(api.accounts.selectAccount, {
      accountId: connected.accountId,
    });

    await seedThread(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      instagramAccountExternalId: "ig_dashboard_comment_only",
      suffix: "comment-only",
    });

    await seedCommentAutomation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      createdByUserId: fixture.userId,
      name: "Comment automation one",
    });
    await seedCommentAutomation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      createdByUserId: fixture.userId,
      name: "Comment automation two",
    });

    const overview = await authT.query(api.dashboard.getOverview, {});

    expect(overview.stats.activeAutomations).toBe(2);
  });

  it("reports overview contact and conversation totals beyond the first 100 rows", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const connected = await connectAccount(t, fixture, {
      state: "dashboard-over-100",
      externalId: "ig_dashboard_over_100",
      username: "over_100",
    });

    await authT.mutation(api.accounts.selectAccount, {
      accountId: connected.accountId,
    });

    await seedThreadBatch(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      instagramAccountExternalId: "ig_dashboard_over_100",
      count: 105,
      suffixPrefix: "over-100",
    });

    const overview = await authT.query(api.dashboard.getOverview, {});
    const account = overview.accounts.find(
      (row) => row.id === connected.accountId,
    );

    expect(overview.stats.contacts).toBe(105);
    expect(overview.stats.conversations).toBe(105);
    expect(account?.contacts).toBe(105);
    expect(account?.conversations).toBe(105);
  });

  it("includes Meta diagnostics for failed delivery logs", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const connected = await connectAccount(t, fixture, {
      state: "dashboard-log-account",
      externalId: "ig_dashboard_logs",
      username: "account_logs",
    });
    const thread = await seedThread(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      instagramAccountExternalId: "ig_dashboard_logs",
      suffix: "failure",
    });

    await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      contactId: thread.contactId,
      conversationId: thread.conversationId,
      status: "failed",
      messageText: "This message cannot be sent",
      reason: "(#10) Application does not have permission for this action",
      responsePayload: JSON.stringify({
        error: {
          message: "(#10) Application does not have permission for this action",
          code: 10,
          error_subcode: 2534015,
          type: "OAuthException",
        },
      }),
      eventTime: BASE_TIME + 5_000,
    });

    const logs = await authT.query(api.dashboard.listLogs, {
      accountId: connected.accountId,
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: "failed",
      contact: "user_failure",
      attemptNumber: 1,
      metaError: {
        code: 10,
        subcode: 2534015,
        type: "OAuthException",
      },
    });
    expect(logs[0]?.details).toContain("permission");
    expect(logs[0]?.rawPayload).toContain('"error_subcode":2534015');
  });

  it("keeps issue delivery attempts visible when newer deliveries fill the recent log window", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const connected = await connectAccount(t, fixture, {
      state: "dashboard-log-window",
      externalId: "ig_dashboard_log_window",
      username: "account_log_window",
    });
    const thread = await seedThread(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      instagramAccountExternalId: "ig_dashboard_log_window",
      suffix: "window",
    });

    await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: connected.accountId,
      contactId: thread.contactId,
      conversationId: thread.conversationId,
      status: "failed",
      messageText: "This older failure should stay inspectable",
      reason: "Meta rejected the message.",
      eventTime: BASE_TIME,
    });

    for (let index = 1; index <= 55; index += 1) {
      await seedDeliveryAttempt(t, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: connected.accountId,
        contactId: thread.contactId,
        conversationId: thread.conversationId,
        status: "sent",
        messageText: `Successful reply ${index}`,
        eventTime: BASE_TIME + index,
      });
    }

    const logs = await authT.query(api.dashboard.listLogs, {
      accountId: connected.accountId,
    });

    expect(logs.some((log) => log.status === "failed")).toBe(true);
    expect(logs.find((log) => log.status === "failed")?.details).toContain(
      "Meta rejected the message.",
    );
  });
});
