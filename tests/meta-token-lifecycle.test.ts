import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";
import { queueAutomatedTextReply } from "@/convex/meta/sendHelpers";

const BASE_TIME = new Date("2026-04-10T10:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
const fetchMock = vi.fn<typeof fetch>();

async function seedWorkspace(
  t: ReturnType<typeof convexTest>,
  accountOverrides: Partial<{
    status: "connected" | "connection_error" | "disconnected";
    graphAccessToken: string | null;
    tokenExpiresAt: number | null;
    reconnectRequired: boolean;
    lastRefreshAttemptAt: number | null;
    lastTokenRefreshAt: number | null;
    nextRefreshAt: number | null;
    refreshFailureCount: number;
    lastError: string | null;
  }> = {},
) {
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
    const instagramAccountId = await ctx.db.insert("instagramAccounts", {
      workspaceId,
      instagramAccountId: "ig_account_1",
      metaUserId: null,
      username: "brainrotshorts",
      name: "Brainrot Shorts",
      profilePictureUrl: null,
      accountType: "business",
      status: "connected",
      graphAccessToken: "graph-token",
      tokenExpiresAt: BASE_TIME + 30 * DAY_MS,
      reconnectRequired: false,
      lastRefreshAttemptAt: null,
      lastTokenRefreshAt: BASE_TIME,
      nextRefreshAt: BASE_TIME - 1,
      refreshFailureCount: 0,
      scopes: [],
      webhookSubscriptionStatus: "active",
      lastWebhookAt: null,
      lastError: null,
      connectedAt: BASE_TIME,
      disconnectedAt: null,
      graphApiVersion: "v23.0",
      ...accountOverrides,
    });

    return { userId, workspaceId, instagramAccountId };
  });
}

async function seedConversation(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
  messagingWindowClosesAt = BASE_TIME + DAY_MS,
) {
  return await t.run(async (ctx) => {
    const contactId = await ctx.db.insert("contacts", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      instagramUserId: `contact_${suffix}`,
      username: `user_${suffix}`,
      displayName: `User ${suffix}`,
      profilePictureUrl: null,
      profilePictureFetchedAt: null,
      firstInboundAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
    });
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      contactId,
      conversationKey: `ig_account_1:contact_${suffix}`,
      status: "active",
      startedAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastOutboundAt: null,
      lastMessagePreview: "Hello there",
      messagingWindowClosesAt,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function seedDeliveryAttempt(
  t: ReturnType<typeof convexTest>,
  args: {
    fixture: Awaited<ReturnType<typeof seedWorkspace>>;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    status:
      | "queued"
      | "blocked_auth"
      | "sent"
      | "failed"
      | "skipped"
      | "skipped_expired";
    messageText: string;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("deliveryAttempts", {
      workspaceId: args.fixture.workspaceId,
      instagramAccountId: args.fixture.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      automationRuleId: null,
      sequenceEnrollmentId: null,
      status: args.status,
      reason: null,
      requestPayload: JSON.stringify({
        kind: "text",
        text: args.messageText,
      }),
      responsePayload: null,
      policyWindowOpen: true,
      attemptNumber: 1,
      eventTime: BASE_TIME,
      messageText: args.messageText,
      metaMessageId: null,
    });
  });
}

describe("meta token lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queues outbound automation messages as blocked_auth while auth is unavailable", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t, {
      status: "connection_error",
      reconnectRequired: true,
    });
    const { contactId, conversationId } = await seedConversation(
      t,
      fixture,
      "blocked",
    );

    await t.run(async (ctx) => {
      await queueAutomatedTextReply(ctx as never, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        automationRuleId: null,
        sequenceEnrollmentId: null,
        messageText: "Still queued for later",
      });
    });

    const attempts = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe("blocked_auth");
    expect(attempts[0]?.reason).toContain(
      "paused until Instagram token access",
    );
  });

  it("replays blocked deliveries after recovery and expires stale ones", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const openConversation = await seedConversation(t, fixture, "open");
    const expiredConversation = await seedConversation(
      t,
      fixture,
      "expired",
      BASE_TIME - 1,
    );

    const openAttemptId = await seedDeliveryAttempt(t, {
      fixture,
      contactId: openConversation.contactId,
      conversationId: openConversation.conversationId,
      status: "blocked_auth",
      messageText: "Retry me",
    });
    const expiredAttemptId = await seedDeliveryAttempt(t, {
      fixture,
      contactId: expiredConversation.contactId,
      conversationId: expiredConversation.conversationId,
      status: "blocked_auth",
      messageText: "Too late",
    });

    const replayResult = await t.mutation(
      internal.meta.send.replayBlockedDeliveries,
      {
        accountId: fixture.instagramAccountId,
      },
    );

    expect(replayResult).toEqual({
      requeued: 1,
      expired: 1,
      remaining: 0,
    });

    const openAttempt = await t.run((ctx) => ctx.db.get(openAttemptId));
    const staleAttempt = await t.run((ctx) => ctx.db.get(expiredAttemptId));
    const staleConversation = await t.run((ctx) =>
      ctx.db.get(expiredConversation.conversationId),
    );

    expect(openAttempt?.status).toBe("queued");
    expect(openAttempt?.attemptNumber).toBe(2);
    expect(openAttempt?.reason).toBe("Token recovered. Retrying delivery.");

    expect(staleAttempt?.status).toBe("skipped_expired");
    expect(staleAttempt?.reason).toContain("24-hour messaging window expired");
    expect(staleConversation?.status).toBe("window_closed");
  });

  it("terminalizes queued and blocked deliveries when the account is disconnected", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const firstConversation = await seedConversation(t, fixture, "queued");
    const secondConversation = await seedConversation(t, fixture, "blocked");

    const queuedAttemptId = await seedDeliveryAttempt(t, {
      fixture,
      contactId: firstConversation.contactId,
      conversationId: firstConversation.conversationId,
      status: "queued",
      messageText: "Queued first",
    });
    const blockedAttemptId = await seedDeliveryAttempt(t, {
      fixture,
      contactId: secondConversation.contactId,
      conversationId: secondConversation.conversationId,
      status: "blocked_auth",
      messageText: "Blocked second",
    });

    const disconnectResult = await authT.mutation(
      api.accounts.disconnectCurrentAccount,
      {},
    );

    expect(disconnectResult).toEqual({ disconnected: true });

    const account = await t.run((ctx) =>
      ctx.db.get(fixture.instagramAccountId),
    );
    const queuedAttempt = await t.run((ctx) => ctx.db.get(queuedAttemptId));
    const blockedAttempt = await t.run((ctx) => ctx.db.get(blockedAttemptId));

    expect(account?.status).toBe("disconnected");
    expect(account?.graphAccessToken).toBeNull();
    expect(account?.nextRefreshAt ?? null).toBeNull();
    expect(account?.reconnectRequired ?? false).toBe(false);

    expect(queuedAttempt?.status).toBe("skipped");
    expect(blockedAttempt?.status).toBe("skipped");
    expect(queuedAttempt?.reason).toContain("disconnected");
    expect(blockedAttempt?.reason).toContain("disconnected");
  });

  it("keeps outbound sending enabled when scheduled refresh fails transiently", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t, {
      tokenExpiresAt: BASE_TIME + 14 * DAY_MS,
      nextRefreshAt: BASE_TIME - 1,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: "Temporary Instagram outage",
          },
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await t.action(
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: fixture.instagramAccountId,
        reason: "scheduled",
      },
    );

    expect(result).toMatchObject({
      refreshed: false,
      tokenUsable: true,
      state: "retry_scheduled",
      nextRefreshAt: BASE_TIME + 15 * 60 * 1000,
    });

    const account = await t.run((ctx) =>
      ctx.db.get(fixture.instagramAccountId),
    );
    expect(account?.status).toBe("connected");
    expect(account?.reconnectRequired ?? false).toBe(false);
    expect(account?.refreshFailureCount).toBe(1);
    expect(account?.lastRefreshAttemptAt).toBe(BASE_TIME);
    expect(account?.nextRefreshAt).toBe(BASE_TIME + 15 * 60 * 1000);
    expect(account?.lastError).toContain("retry automatically");
  });

  it("marks reconnect required when Meta rejects token refresh", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t, {
      tokenExpiresAt: BASE_TIME + 14 * DAY_MS,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            message: "Invalid OAuth access token - Cannot parse access token",
            code: 190,
          },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await t.action(
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: fixture.instagramAccountId,
        reason: "auth_error",
      },
    );

    expect(result).toMatchObject({
      refreshed: false,
      tokenUsable: false,
      state: "reconnect_required",
    });

    const account = await t.run((ctx) =>
      ctx.db.get(fixture.instagramAccountId),
    );
    expect(account?.status).toBe("connection_error");
    expect(account?.reconnectRequired).toBe(true);
    expect(account?.nextRefreshAt ?? null).toBeNull();
    expect(account?.refreshFailureCount).toBe(1);
    expect(account?.lastError).toContain("Dashboard > Account");
  });

  it("stores the refreshed token and clears retry state after a successful refresh", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t, {
      tokenExpiresAt: BASE_TIME + 10 * DAY_MS,
      nextRefreshAt: BASE_TIME - 1,
      refreshFailureCount: 2,
      lastError: "Temporary refresh failure",
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "graph-token-2",
          expires_in: 60 * 24 * 60 * 60,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await t.action(
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: fixture.instagramAccountId,
        reason: "scheduled",
      },
    );

    expect(result).toMatchObject({
      refreshed: true,
      tokenUsable: true,
      state: "refreshed",
      tokenExpiresAt: BASE_TIME + 60 * DAY_MS,
    });

    const account = await t.run((ctx) =>
      ctx.db.get(fixture.instagramAccountId),
    );
    expect(account?.status).toBe("connected");
    expect(account?.graphAccessToken).toBe("graph-token-2");
    expect(account?.reconnectRequired ?? false).toBe(false);
    expect(account?.refreshFailureCount).toBe(0);
    expect(account?.lastError).toBeNull();
    expect(account?.lastTokenRefreshAt).toBe(BASE_TIME);
    expect(account?.nextRefreshAt).toBe(BASE_TIME + 53 * DAY_MS);
  });
});
