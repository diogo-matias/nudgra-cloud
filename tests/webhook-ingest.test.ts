import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { startRuleAutomationSession } from "@/convex/automations/ruleFlow";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-12T09:00:00.000Z").getTime();
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
    token: string;
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
    graphAccessToken: args.token,
    tokenExpiresAt: BASE_TIME + 60 * DAY_MS,
    scopes: [],
    webhookSubscriptionStatus: "active",
    status: "connected",
    lastError: null,
    graphApiVersion: "v23.0",
  });
}

async function seedRule(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    createdByUserId: Id<"users">;
    keywords?: string[];
    emailCollectionEnabled?: boolean;
    emailCollectionText?: string;
    followUpEnabled?: boolean;
    followUpText?: string;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("automationRules", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      name: "Guide rule",
      triggerType: "keyword",
      matchType: "contains",
      keywords: args.keywords ?? ["guide"],
      replyText: "Here's your link:",
      linkDmText: "Here's your link:",
      linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
      followGateEnabled: false,
      followGateText: "Follow us first",
      emailCollectionEnabled: args.emailCollectionEnabled ?? false,
      emailCollectionText: args.emailCollectionText ?? "Drop your email",
      followUpEnabled: args.followUpEnabled ?? false,
      followUpText: args.followUpText ?? "Checking in",
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: args.createdByUserId,
      triggerCount: 0,
      lastTriggeredAt: null,
      lastModifiedAt: BASE_TIME,
    });
  });
}

async function seedConversation(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    instagramAccountExternalId: string;
    instagramUserId: string;
    username: string;
  },
) {
  return await t.run(async (ctx) => {
    const contactId = await ctx.db.insert("contacts", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      instagramUserId: args.instagramUserId,
      username: args.username,
      displayName: args.username,
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
      conversationKey: `${args.instagramAccountExternalId}:${args.instagramUserId}`,
      status: "active",
      startedAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastOutboundAt: null,
      lastMessagePreview: "Hello there",
      messagingWindowClosesAt: BASE_TIME + DAY_MS,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

describe("webhook ingestion orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SITE_URL;
  });

  it("marks webhook payloads for unknown instagram accounts as unmatched", async () => {
    const t = convexTest({ schema, modules });

    const result = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: "ig_missing",
            messaging: [
              {
                sender: { id: "contact_missing", username: "missing_user" },
                recipient: { id: "ig_missing" },
                timestamp: BASE_TIME,
                message: {
                  mid: "mid_missing",
                  text: "guide",
                },
              },
            ],
          },
        ],
      }),
    });

    expect(result).toEqual({ processed: 0, ignored: 1 });

    const receipts = await t.run((ctx) =>
      ctx.db.query("webhookReceipts").order("desc").take(5),
    );
    expect(receipts[0]?.status).toBe("unmatched_account");
  });

  it("starts a new rule automation session for a matching keyword message", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const account = await connectAccount(t, fixture, {
      state: "connect-new-session",
      externalId: "ig_account_1",
      username: "nudgra",
      token: "graph-token",
    });
    const ruleId = await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: account.accountId,
      createdByUserId: fixture.userId,
    });

    const result = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: "ig_account_1",
            messaging: [
              {
                sender: { id: "contact_new", username: "contact_new" },
                recipient: { id: "ig_account_1" },
                timestamp: BASE_TIME + 1_000,
                message: {
                  mid: "mid_new_session",
                  text: "guide please",
                },
              },
            ],
          },
        ],
      }),
    });

    expect(result).toEqual({ processed: 1, ignored: 0 });

    const sessions = await t.run((ctx) =>
      ctx.db.query("automationRuleSessions").collect(),
    );
    const storedRule = await t.run((ctx) => ctx.db.get(ruleId));
    const deliveries = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.automationRuleId).toBe(ruleId);
    expect(storedRule?.triggerCount).toBe(1);
    expect(deliveries).toHaveLength(1);
  });

  it("deduplicates duplicate webhook deliveries by delivery key", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    await connectAccount(t, fixture, {
      state: "connect-dedupe",
      externalId: "ig_account_1",
      username: "nudgra",
      token: "graph-token",
    });
    await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: (
        await t.run((ctx) =>
          ctx.db
            .query("instagramAccounts")
            .withIndex("by_instagram_account_id", (q) =>
              q.eq("instagramAccountId", "ig_account_1"),
            )
            .unique(),
        )
      )!._id,
      createdByUserId: fixture.userId,
    });

    const payload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          messaging: [
            {
              sender: { id: "contact_dup", username: "contact_dup" },
              recipient: { id: "ig_account_1" },
              timestamp: BASE_TIME + 1_000,
              message: {
                mid: "mid_duplicate",
                text: "guide",
              },
            },
          ],
        },
      ],
    });

    const first = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: payload,
    });
    const second = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: payload,
    });

    expect(first).toEqual({ processed: 1, ignored: 0 });
    expect(second).toEqual({ processed: 0, ignored: 1 });

    const webhookEvents = await t.run((ctx) =>
      ctx.db.query("webhookEvents").collect(),
    );
    const messages = await t.run((ctx) => ctx.db.query("messages").collect());
    const sessions = await t.run((ctx) =>
      ctx.db.query("automationRuleSessions").collect(),
    );

    expect(webhookEvents).toHaveLength(1);
    expect(messages).toHaveLength(1);
    expect(sessions).toHaveLength(1);
  });

  it("continues an active rule session instead of starting a second one", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const account = await connectAccount(t, fixture, {
      state: "connect-active-session",
      externalId: "ig_account_1",
      username: "nudgra",
      token: "graph-token",
    });
    const ruleId = await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: account.accountId,
      createdByUserId: fixture.userId,
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
      followUpEnabled: true,
      followUpText: "Checking in",
    });
    const { contactId, conversationId } = await seedConversation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: account.accountId,
      instagramAccountExternalId: "ig_account_1",
      instagramUserId: "contact_active",
      username: "contact_active",
    });

    const sessionId = await t.run(async (ctx) => {
      const rule = await ctx.db.get(ruleId);
      if (!rule) {
        throw new Error("Rule not found.");
      }

      const startedSessionId = await startRuleAutomationSession(ctx as never, rule, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: account.accountId,
        automationRuleId: ruleId,
        contactId,
        conversationId,
        matchedAt: BASE_TIME,
      });

      if (startedSessionId === null) {
        throw new Error("Expected rule session to start.");
      }

      return startedSessionId;
    });

    vi.setSystemTime(BASE_TIME + 1_000);

    const result = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: JSON.stringify({
        object: "instagram",
        entry: [
          {
            id: "ig_account_1",
            messaging: [
              {
                sender: { id: "contact_active", username: "contact_active" },
                recipient: { id: "ig_account_1" },
                timestamp: BASE_TIME + 1_000,
                message: {
                  mid: "mid_active_email",
                  text: "USER@Example.com",
                },
              },
            ],
          },
        ],
      }),
    });

    expect(result).toEqual({ processed: 1, ignored: 0 });

    const session = await t.run((ctx) => ctx.db.get(sessionId));
    const sessions = await t.run((ctx) =>
      ctx.db.query("automationRuleSessions").collect(),
    );
    const storedEmails = await t.run((ctx) =>
      ctx.db
        .query("contactEmails")
        .withIndex("by_contact_id_and_last_collected_at", (q) =>
          q.eq("contactId", contactId),
        )
        .order("desc")
        .take(5),
    );
    const trackedLinks = await t.run((ctx) =>
      ctx.db.query("automationRuleTrackedLinks").collect(),
    );

    expect(sessions).toHaveLength(1);
    expect(session?.currentStep).toBe("completed");
    expect(session?.collectedEmail).toBe("user@example.com");
    expect(session?.linkSentAt).toBe(BASE_TIME + 1_000);
    expect(session?.followUpScheduledAt).toBe(
      BASE_TIME + 1_000 + 6 * 60 * 60 * 1000,
    );
    expect(storedEmails).toHaveLength(1);
    expect(storedEmails[0]?.email).toBe("user@example.com");
    expect(trackedLinks).toHaveLength(1);
  });
});
