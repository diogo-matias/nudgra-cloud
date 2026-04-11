import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-08T14:00:00.000Z").getTime();
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

async function listWorkspaceAccounts(
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("instagramAccounts")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  });
}

async function getWorkspacePreference(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("workspaceUserPreferences")
      .withIndex("by_workspace_id_and_user_id", (q) =>
        q.eq("workspaceId", fixture.workspaceId).eq("userId", fixture.userId),
      )
      .unique();
  });
}

async function seedContactConversation(
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
      lastMessagePreview: "Hello there",
      messagingWindowClosesAt: BASE_TIME + DAY_MS,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function seedDeliveryAttempt(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    status: "queued" | "blocked_auth";
    messageText: string;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("deliveryAttempts", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      automationRuleId: null,
      sequenceEnrollmentId: null,
      status: args.status,
      reason: null,
      requestPayload: JSON.stringify({ kind: "text", text: args.messageText }),
      responsePayload: null,
      policyWindowOpen: true,
      attemptNumber: 1,
      eventTime: BASE_TIME,
      messageText: args.messageText,
      metaMessageId: null,
    });
  });
}

async function seedSequenceDefinition(
  t: ReturnType<typeof convexTest>,
  workspaceId: Id<"workspaces">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("sequenceDefinitions", {
      workspaceId,
      name: "Isolation sequence",
      isActive: true,
      steps: [{ delayMinutes: 30, messageText: "Follow up" }],
    });
  });
}

async function seedSequenceEnrollment(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    sequenceDefinitionId: Id<"sequenceDefinitions">;
  },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("sequenceEnrollments", {
      workspaceId: args.workspaceId,
      instagramAccountId: args.instagramAccountId,
      contactId: args.contactId,
      conversationId: args.conversationId,
      sequenceDefinitionId: args.sequenceDefinitionId,
      status: "active",
      currentStepIndex: 0,
      nextRunAt: BASE_TIME + 30 * 60 * 1000,
      enrolledAt: BASE_TIME,
      lastProcessedAt: null,
      stopReason: null,
    });
  });
}

async function seedRule(
  t: ReturnType<typeof convexTest>,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    createdByUserId: Id<"users">;
    name: string;
    replyText: string;
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
      replyText: args.replyText,
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: args.createdByUserId,
      triggerCount: 0,
      lastTriggeredAt: null,
    });
  });
}

describe("multi-account isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores multiple connected accounts without overwriting earlier accounts and auto-selects the newest connection", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const first = await connectAccount(t, fixture, {
      state: "connect-first",
      externalId: "ig_account_a",
      username: "firstaccount",
      token: "token-a",
    });
    const second = await connectAccount(t, fixture, {
      state: "connect-second",
      externalId: "ig_account_b",
      username: "secondaccount",
      token: "token-b",
    });

    const accounts = await listWorkspaceAccounts(t, fixture.workspaceId);
    expect(accounts).toHaveLength(2);

    const firstAccount = accounts.find(
      (account) => account.instagramAccountId === "ig_account_a",
    );
    const secondAccount = accounts.find(
      (account) => account.instagramAccountId === "ig_account_b",
    );
    expect(firstAccount?._id).toBe(first.accountId);
    expect(firstAccount?.graphAccessToken).toBe("token-a");
    expect(secondAccount?._id).toBe(second.accountId);
    expect(secondAccount?.graphAccessToken).toBe("token-b");

    const preference = await getWorkspacePreference(t, fixture);
    expect(preference?.selectedInstagramAccountId).toBe(second.accountId);

    const context = await authT.query(api.accounts.getSelectedAccountContext, {});
    expect(context.selectedAccount?.id).toBe(second.accountId);
    expect(context.totalAccounts).toBe(2);
  });

  it("reconnects the matching account instead of overwriting a different account", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const first = await connectAccount(t, fixture, {
      state: "connect-a",
      externalId: "ig_account_a",
      username: "account_a",
      token: "token-a-1",
    });
    const second = await connectAccount(t, fixture, {
      state: "connect-b",
      externalId: "ig_account_b",
      username: "account_b",
      token: "token-b-1",
    });
    const reconnected = await connectAccount(t, fixture, {
      state: "reconnect-a",
      externalId: "ig_account_a",
      username: "account_a_renamed",
      token: "token-a-2",
    });

    expect(reconnected.accountId).toBe(first.accountId);

    const accounts = await listWorkspaceAccounts(t, fixture.workspaceId);
    expect(accounts).toHaveLength(2);

    const firstAccount = accounts.find(
      (account) => account._id === first.accountId,
    );
    const secondAccount = accounts.find(
      (account) => account._id === second.accountId,
    );
    expect(firstAccount?.username).toBe("account_a_renamed");
    expect(firstAccount?.graphAccessToken).toBe("token-a-2");
    expect(secondAccount?.username).toBe("account_b");
    expect(secondAccount?.graphAccessToken).toBe("token-b-1");

    const context = await authT.query(api.accounts.getSelectedAccountContext, {});
    expect(context.selectedAccount?.id).toBe(first.accountId);
  });

  it("disconnects only the target account's deliveries and enrollments and falls back to another connected account", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const first = await connectAccount(t, fixture, {
      state: "connect-disconnect-a",
      externalId: "ig_account_a",
      username: "account_a",
      token: "token-a",
    });
    const second = await connectAccount(t, fixture, {
      state: "connect-disconnect-b",
      externalId: "ig_account_b",
      username: "account_b",
      token: "token-b",
    });

    await authT.mutation(api.accounts.selectAccount, {
      accountId: first.accountId,
    });

    const firstThread = await seedContactConversation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      instagramAccountExternalId: "ig_account_a",
      suffix: "first",
    });
    const secondThread = await seedContactConversation(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      instagramAccountExternalId: "ig_account_b",
      suffix: "second",
    });
    const sequenceDefinitionId = await seedSequenceDefinition(
      t,
      fixture.workspaceId,
    );

    const firstQueuedAttemptId = await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      contactId: firstThread.contactId,
      conversationId: firstThread.conversationId,
      status: "queued",
      messageText: "Queue first account",
    });
    const firstBlockedAttemptId = await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      contactId: firstThread.contactId,
      conversationId: firstThread.conversationId,
      status: "blocked_auth",
      messageText: "Blocked first account",
    });
    const secondQueuedAttemptId = await seedDeliveryAttempt(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      contactId: secondThread.contactId,
      conversationId: secondThread.conversationId,
      status: "queued",
      messageText: "Queue second account",
    });

    const firstEnrollmentId = await seedSequenceEnrollment(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      contactId: firstThread.contactId,
      conversationId: firstThread.conversationId,
      sequenceDefinitionId,
    });
    const secondEnrollmentId = await seedSequenceEnrollment(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      contactId: secondThread.contactId,
      conversationId: secondThread.conversationId,
      sequenceDefinitionId,
    });

    const disconnectResult = await authT.mutation(api.accounts.disconnectAccount, {
      accountId: first.accountId,
    });
    expect(disconnectResult).toEqual({
      disconnected: true,
      selectedAccountId: second.accountId,
    });

    const firstAccount = await t.run((ctx) => ctx.db.get(first.accountId));
    const secondAccount = await t.run((ctx) => ctx.db.get(second.accountId));
    const firstQueuedAttempt = await t.run((ctx) =>
      ctx.db.get(firstQueuedAttemptId),
    );
    const firstBlockedAttempt = await t.run((ctx) =>
      ctx.db.get(firstBlockedAttemptId),
    );
    const secondQueuedAttempt = await t.run((ctx) =>
      ctx.db.get(secondQueuedAttemptId),
    );
    const firstEnrollment = await t.run((ctx) => ctx.db.get(firstEnrollmentId));
    const secondEnrollment = await t.run((ctx) =>
      ctx.db.get(secondEnrollmentId),
    );

    expect(firstAccount?.status).toBe("disconnected");
    expect(secondAccount?.status).toBe("connected");
    expect(firstQueuedAttempt?.status).toBe("skipped");
    expect(firstBlockedAttempt?.status).toBe("skipped");
    expect(secondQueuedAttempt?.status).toBe("queued");
    expect(firstEnrollment?.status).toBe("stopped");
    expect(secondEnrollment?.status).toBe("active");

    const context = await authT.query(api.accounts.getSelectedAccountContext, {});
    expect(context.selectedAccount?.id).toBe(second.accountId);
  });

  it("routes message webhooks only through automations that belong to the matching instagram account", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);

    const first = await connectAccount(t, fixture, {
      state: "connect-webhook-a",
      externalId: "ig_account_a",
      username: "account_a",
      token: "token-a",
    });
    const second = await connectAccount(t, fixture, {
      state: "connect-webhook-b",
      externalId: "ig_account_b",
      username: "account_b",
      token: "token-b",
    });

    const ruleA = await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: first.accountId,
      createdByUserId: fixture.userId,
      name: "Rule A",
      replyText: "Reply from A",
    });
    const ruleB = await seedRule(t, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: second.accountId,
      createdByUserId: fixture.userId,
      name: "Rule B",
      replyText: "Reply from B",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("contacts", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: first.accountId,
        instagramUserId: "contact_scope",
        username: "contact_scope",
        displayName: "Contact Scope",
        profilePictureUrl: null,
        profilePictureFetchedAt: BASE_TIME,
        firstInboundAt: BASE_TIME,
        lastInboundAt: BASE_TIME,
        lastMessageAt: BASE_TIME,
      });
    });

    const result = await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: JSON.stringify({
        entry: [
          {
            id: "ig_account_a",
            messaging: [
              {
                sender: { id: "contact_scope", username: "contact_scope" },
                recipient: { id: "ig_account_a" },
                timestamp: BASE_TIME + 1_000,
                message: {
                  mid: "mid_scope_1",
                  text: "guide",
                },
              },
            ],
          },
        ],
      }),
    });

    expect(result).toEqual({ processed: 1, ignored: 0 });

    const storedRuleA = await t.run((ctx) => ctx.db.get(ruleA));
    const storedRuleB = await t.run((ctx) => ctx.db.get(ruleB));
    const deliveries = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );

    expect(storedRuleA?.triggerCount).toBe(1);
    expect(storedRuleB?.triggerCount).toBe(0);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.instagramAccountId).toBe(first.accountId);
    expect(deliveries[0]?.automationRuleId).toBe(ruleA);
  });

  it("does not lock a next-post comment automation to media owned by another instagram account", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);

    const first = await connectAccount(t, fixture, {
      state: "connect-comment-a",
      externalId: "ig_account_a",
      username: "account_a",
      token: "token-a",
    });
    const second = await connectAccount(t, fixture, {
      state: "connect-comment-b",
      externalId: "ig_account_b",
      username: "account_b",
      token: "token-b",
    });

    const automationId = await t.run(async (ctx) => {
      return await ctx.db.insert("commentAutomations", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: first.accountId,
        createdByUserId: fixture.userId,
        name: "Next post isolation",
        status: "live",
        postScope: "next",
        selectedMediaIds: [],
        commentFilter: "any_word",
        triggerKeywords: [],
        triggerKeywordLabels: [],
        commentReplyEnabled: false,
        commentReplyTexts: [],
        openingDmEnabled: false,
        openingDmText: "",
        openingDmButtonText: "Send me the link",
        followGateEnabled: false,
        followGateText: "",
        emailCollectionEnabled: false,
        emailCollectionText: "",
        linkDmText: "Open this",
        linkUrl: "https://example.com/guide",
        linkButtonText: "Open",
        linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
        followUpEnabled: false,
        followUpText: "",
        nextPostActivatedAt: BASE_TIME,
        nextLockedMediaId: null,
        nextLockedAt: null,
        guardrailTrippedAt: null,
        guardrailReason: null,
        guardrailSessionId: null,
        guardrailConversationId: null,
        triggerCount: 0,
        lastTriggeredAt: null,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("instagramMedia", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: second.accountId,
        mediaId: "media_b_only",
        mediaType: "IMAGE",
        thumbnailUrl: null,
        mediaUrl: "https://example.com/media-b.jpg",
        caption: "Other account post",
        timestamp: new Date(BASE_TIME + 60_000).toISOString(),
        permalink: null,
        fetchedAt: BASE_TIME,
      });
    });

    const result = await t.mutation(
      internal.meta.commentWebhooks.processCommentWebhookItem,
      {
        instagramAccountExternalId: "ig_account_a",
        commentId: "comment_scope",
        commentText: "link",
        commenterId: "commenter_scope",
        commenterUsername: "commenter_scope",
        mediaId: "media_b_only",
        parentCommentId: null,
        timestamp: BASE_TIME + 90_000,
        allowRefresh: false,
      },
    );

    expect(result.status).toBe("ignored");

    const automation = await t.run((ctx) => ctx.db.get(automationId));
    expect(automation?.nextLockedMediaId ?? null).toBeNull();
  });
});
