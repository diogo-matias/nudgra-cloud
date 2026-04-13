import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  advanceRuleAutomationSession,
  startRuleAutomationSession,
} from "@/convex/automations/ruleFlow";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-01T12:00:00.000Z").getTime();
const FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;
const fetchMock = vi.fn<typeof fetch>();

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
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
      username: "nudgra",
      name: "Nudgra",
      profilePictureUrl: null,
      accountType: "business",
      status: "connected",
      graphAccessToken: "graph-token",
      tokenExpiresAt: null,
      scopes: [],
      webhookSubscriptionStatus: "active",
      lastWebhookAt: null,
      lastError: null,
      connectedAt: BASE_TIME,
      disconnectedAt: null,
      graphApiVersion: "v23.0",
    });

    return { userId, workspaceId, instagramAccountId };
  });
}

async function insertTag(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  label: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("tags", {
      workspaceId: fixture.workspaceId,
      label,
      color: "#0ea5e9",
    });
  });
}

async function insertSequence(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  name: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("sequenceDefinitions", {
      workspaceId: fixture.workspaceId,
      name,
      isActive: true,
      steps: [{ delayMinutes: 60, messageText: "Follow-up step" }],
    });
  });
}

async function insertRule(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  overrides: Partial<{
    name: string;
    triggerType: "keyword" | "story_reply";
    matchType: "contains" | "exact";
    keywords: string[];
    replyText: string;
    linkDmText: string;
    linkButtons: Array<{ label: string; url: string }>;
    followGateEnabled: boolean;
    followGateText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    followUpEnabled: boolean;
    followUpText: string;
    isActive: boolean;
    tagIds: Id<"tags">[];
    sequenceDefinitionId: Id<"sequenceDefinitions"> | null;
    triggerCount: number;
    lastTriggeredAt: number | null;
    lastModifiedAt: number | null;
  }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("automationRules", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      name: "Guide link",
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["link"],
      replyText: "Here's your link:",
      linkDmText: "Here's your link:",
      linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
      followGateEnabled: false,
      followGateText: "Follow us first",
      emailCollectionEnabled: false,
      emailCollectionText: "Drop your email",
      followUpEnabled: false,
      followUpText: "Checking in",
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: fixture.userId,
      triggerCount: 0,
      lastTriggeredAt: null,
      lastModifiedAt: BASE_TIME,
      ...overrides,
    });
  });
}

async function seedConversation(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
) {
  return await t.run(async (ctx) => {
    const contactId = await ctx.db.insert("contacts", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      instagramUserId: `contact_${suffix}`,
      username: `user_${suffix}`,
      displayName: `User ${suffix}`,
      profilePictureUrl: null,
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
      lastMessagePreview: "Keyword DM",
      messagingWindowClosesAt: BASE_TIME + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function startSession(
  t: ReturnType<typeof convexTest>,
  ruleId: Id<"automationRules">,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
) {
  const { contactId, conversationId } = await seedConversation(t, fixture, suffix);

  return await t.run(async (ctx) => {
    const rule = await ctx.db.get(ruleId);
    if (!rule) {
      throw new Error("Rule not found.");
    }

    const sessionId = await startRuleAutomationSession(ctx as never, rule, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      automationRuleId: ruleId,
      contactId,
      conversationId,
      matchedAt: BASE_TIME,
    });

    if (sessionId === null) {
      throw new Error("Session was not created.");
    }

    return { sessionId, contactId, conversationId };
  });
}

async function listStoredContactEmails(
  t: ReturnType<typeof convexTest>,
  contactId: Id<"contacts">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("contactEmails")
      .withIndex("by_contact_id_and_last_collected_at", (q) =>
        q.eq("contactId", contactId),
      )
      .order("desc")
      .take(10);
  });
}

describe("keyword DM automation rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.SITE_URL = "https://app.example.com";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SITE_URL;
    vi.unstubAllGlobals();
  });

  it("serializes legacy rules with flow defaults", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const tagId = await insertTag(t, fixture, "lead");
    const sequenceId = await insertSequence(t, fixture, "Warm nurture");

    const legacyRuleId = await t.run(async (ctx) => {
      return await ctx.db.insert("automationRules", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        name: "Legacy rule",
        triggerType: "keyword",
        matchType: "contains",
        keywords: ["price"],
        replyText: "Legacy reply",
        isActive: true,
        tagIds: [tagId],
        sequenceDefinitionId: sequenceId,
        createdByUserId: fixture.userId,
        triggerCount: 0,
        lastTriggeredAt: null,
      });
    });

    const authT = t.withIdentity({ subject: fixture.userId });
    const serialized = await authT.query(api.automations.rules.getRuleById, {
      accountId: fixture.instagramAccountId,
      ruleId: legacyRuleId,
    });

    expect(serialized?.linkDmText).toBe("Legacy reply");
    expect(serialized?.linkButtons).toEqual([]);
    expect(serialized?.followGateEnabled).toBe(false);
    expect(serialized?.emailCollectionEnabled).toBe(false);
    expect(serialized?.followUpEnabled).toBe(false);
    expect(serialized?.tags.map((tag) => tag.label)).toEqual(["lead"]);
    expect(serialized?.sequence?.name).toBe("Warm nurture");
  });

  it("validates tracked-link follow-up requirements and preserves advanced settings through update", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const tagA = await insertTag(t, fixture, "lead");
    const tagB = await insertTag(t, fixture, "qualified");
    const sequenceA = await insertSequence(t, fixture, "Warm nurture");
    const sequenceB = await insertSequence(t, fixture, "Closer");
    const authT = t.withIdentity({ subject: fixture.userId });

    await expect(
      authT.mutation(api.automations.rules.createRule, {
        accountId: fixture.instagramAccountId,
        name: "Broken rule",
        triggerType: "keyword",
        matchType: "contains",
        keywords: ["link"],
        replyText: "Here's your link:",
        linkDmText: "Here's your link:",
        linkButtons: [],
        followGateEnabled: false,
        followGateText: "",
        emailCollectionEnabled: false,
        emailCollectionText: "",
        followUpEnabled: true,
        followUpText: "Checking in",
        isActive: true,
        tagIds: [],
        sequenceDefinitionId: null,
      }),
    ).rejects.toThrow("Follow-up requires at least one tracked link button.");

    const createResult = await authT.mutation(api.automations.rules.createRule, {
      accountId: fixture.instagramAccountId,
      name: "Pricing DM",
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["price"],
      replyText: "Here's your link:",
      linkDmText: "Here's your link:",
      linkButtons: [{ label: "Open", url: "https://example.com/pricing" }],
      followGateEnabled: false,
      followGateText: "",
      emailCollectionEnabled: false,
      emailCollectionText: "",
      followUpEnabled: false,
      followUpText: "",
      isActive: true,
      tagIds: [tagA],
      sequenceDefinitionId: sequenceA,
    });

    await authT.mutation(api.automations.rules.updateRule, {
      accountId: fixture.instagramAccountId,
      ruleId: createResult.ruleId,
      name: "Qualified pricing DM",
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["price", "pricing"],
      replyText: "Grab the pricing link",
      linkDmText: "Grab the pricing link",
      linkButtons: [{ label: "Pricing", url: "https://example.com/pricing" }],
      followGateEnabled: true,
      followGateText: "Follow us first",
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
      followUpEnabled: true,
      followUpText: "Need anything else?",
      isActive: true,
      tagIds: [tagB],
      sequenceDefinitionId: sequenceB,
    });

    const updated = await authT.query(api.automations.rules.getRuleById, {
      accountId: fixture.instagramAccountId,
      ruleId: createResult.ruleId,
    });

    expect(updated?.name).toBe("Qualified pricing DM");
    expect(updated?.triggerKeywordLabels).toEqual(["price", "pricing"]);
    expect(updated?.followGateEnabled).toBe(true);
    expect(updated?.emailCollectionEnabled).toBe(true);
    expect(updated?.followUpEnabled).toBe(true);
    expect(updated?.tags.map((tag) => tag.label)).toEqual(["qualified"]);
    expect(updated?.sequence?.name).toBe("Closer");
  });

  it("starts the correct first step for plain link, follow gate, and email collection flows", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const plainRuleId = await insertRule(t, fixture, {});
    const followRuleId = await insertRule(t, fixture, {
      followGateEnabled: true,
      followGateText: "Follow us first",
    });
    const emailRuleId = await insertRule(t, fixture, {
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
    });

    const plain = await startSession(t, plainRuleId, fixture, "plain");
    const follow = await startSession(t, followRuleId, fixture, "follow");
    const email = await startSession(t, emailRuleId, fixture, "email");

    const plainSession = await t.run((ctx) => ctx.db.get(plain.sessionId));
    const followSession = await t.run((ctx) => ctx.db.get(follow.sessionId));
    const emailSession = await t.run((ctx) => ctx.db.get(email.sessionId));

    expect(plainSession?.currentStep).toBe("completed");
    expect(plainSession?.linkSentAt).toBe(BASE_TIME);
    expect(followSession?.currentStep).toBe("awaiting_follow");
    expect(followSession?.linkSentAt ?? null).toBeNull();
    expect(emailSession?.currentStep).toBe("awaiting_email");
    expect(emailSession?.linkSentAt ?? null).toBeNull();
  });

  it("advances through follow verification and email capture before sending tracked links", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const ruleId = await insertRule(t, fixture, {
      followGateEnabled: true,
      followGateText: "Follow us first",
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
      followUpEnabled: true,
      followUpText: "Checking in",
    });

    const { sessionId, contactId } = await startSession(
      t,
      ruleId,
      fixture,
      "full",
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ is_user_follow_business: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(internal.automations.ruleFlow.processInboundRuleAutomationInteraction, {
      sessionId,
      hasMessage: false,
      text: null,
      postbackPayload: "rule_automation:follow_gate",
      quickReplyPayload: null,
      deliveryKey: "follow-delivery",
    });

    let session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_email");
    expect(session?.linkSentAt ?? null).toBeNull();

    await t.run(async (ctx) => {
      await advanceRuleAutomationSession(ctx as never, sessionId, {
        hasMessage: true,
        text: "user@example.com",
        postbackPayload: null,
        quickReplyPayload: null,
      });
    });

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("completed");
    expect(session?.collectedEmail).toBe("user@example.com");
    expect(session?.linkSentAt).toBe(BASE_TIME);
    expect(session?.followUpScheduledAt).toBe(BASE_TIME + FOLLOW_UP_DELAY_MS);

    const trackedLinks = await t.run((ctx) =>
      ctx.db.query("automationRuleTrackedLinks").collect(),
    );
    expect(trackedLinks).toHaveLength(1);
    expect(trackedLinks[0]?.destinationUrl).toBe("https://example.com/guide");

    const storedEmails = await listStoredContactEmails(t, contactId);
    expect(storedEmails).toHaveLength(1);
    expect(storedEmails[0]?.email).toBe("user@example.com");
    expect(storedEmails[0]?.automationKind).toBe("rule");
    expect(storedEmails[0]?.automationRuleId).toBe(ruleId);
  });

  it("suppresses clicked follow-ups and sends the uncaptured follow-up only once", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const ruleId = await insertRule(t, fixture, {
      followUpEnabled: true,
      followUpText: "Checking in",
    });

    const clicked = await startSession(t, ruleId, fixture, "clicked");
    const clickedTrackedLinks = await t.run((ctx) =>
      ctx.db.query("automationRuleTrackedLinks").collect(),
    );
    const clickedToken = clickedTrackedLinks[0]?.token;
    if (!clickedToken) {
      throw new Error("Expected tracked link token.");
    }

    await t.mutation(api.automations.ruleTracking.consumeTrackedLink, {
      token: clickedToken,
    });
    await t.mutation(internal.automations.ruleFlow.processScheduledFollowUp, {
      sessionId: clicked.sessionId,
    });

    const clickedSession = await t.run((ctx) => ctx.db.get(clicked.sessionId));
    expect(clickedSession?.followUpSentAt ?? null).toBeNull();

    const pending = await startSession(t, ruleId, fixture, "pending");
    await t.run(async (ctx) => {
      await ctx.db.patch(pending.sessionId, {
        followUpScheduledAt: BASE_TIME - 1,
      });
    });

    await t.mutation(internal.automations.ruleFlow.processScheduledFollowUp, {
      sessionId: pending.sessionId,
    });
    await t.mutation(internal.automations.ruleFlow.processScheduledFollowUp, {
      sessionId: pending.sessionId,
    });

    const pendingSession = await t.run((ctx) => ctx.db.get(pending.sessionId));
    expect(pendingSession?.followUpSentAt).toBe(BASE_TIME);

    const deliveryAttempts = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    const followUpAttempts = deliveryAttempts.filter(
      (attempt) =>
        attempt.automationRuleId === ruleId &&
        attempt.messageText === "Checking in",
    );
    expect(followUpAttempts).toHaveLength(1);
  });
});
