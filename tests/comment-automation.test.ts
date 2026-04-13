import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  advanceCommentAutomationSession,
  startCommentAutomationSession,
} from "@/convex/automations/commentFlow";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-01T12:00:00.000Z").getTime();
const fetchMock = vi.fn<typeof fetch>();

function buildCreateArgs(overrides: Partial<{
  name: string;
  postScope: "specific" | "any" | "next";
  selectedMediaIds: string[];
  commentFilter: "specific_words" | "any_word";
  triggerKeywords: string[];
  triggerKeywordLabels: string[];
  commentReplyEnabled: boolean;
  commentReplyTexts: string[];
  openingDmEnabled: boolean;
  openingDmText: string;
  openingDmButtonText: string;
  followGateEnabled: boolean;
  followGateText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: Array<{ label: string; url: string }>;
  linkUrl: string;
  linkButtonText: string;
  followUpEnabled: boolean;
  followUpText: string;
  goLive: boolean;
}> = {}) {
  return {
    name: "Guide link",
    postScope: "any" as const,
    selectedMediaIds: [],
    commentFilter: "any_word" as const,
    triggerKeywords: [],
    triggerKeywordLabels: [],
    commentReplyEnabled: false,
    commentReplyTexts: [],
    openingDmEnabled: true,
    openingDmText: "Hey! Tap below to get the link.",
    openingDmButtonText: "Send me the link",
    followGateEnabled: false,
    followGateText: "Follow us first",
    emailCollectionEnabled: false,
    emailCollectionText: "Drop your email",
    linkDmText: "Here's your link:",
    linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
    linkUrl: "https://example.com/guide",
    linkButtonText: "Open",
    followUpEnabled: false,
    followUpText: "Checking in",
    goLive: false,
    ...overrides,
  };
}

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
      username: "brainrotshorts",
      name: "Brainrot Shorts",
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

async function insertAutomation(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  overrides: Partial<{
    name: string;
    status: "draft" | "live" | "paused";
    postScope: "specific" | "any" | "next";
    selectedMediaIds: string[];
    commentFilter: "specific_words" | "any_word";
    triggerKeywords: string[];
    commentReplyEnabled: boolean;
    commentReplyTexts: string[];
    openingDmEnabled: boolean;
    openingDmText: string;
    openingDmButtonText: string;
    followGateEnabled: boolean;
    followGateText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    linkDmText: string;
    linkUrl: string;
    linkButtonText: string;
    linkButtons: Array<{ label: string; url: string }>;
    followUpEnabled: boolean;
    followUpText: string;
    nextPostActivatedAt: number | null;
    nextLockedMediaId: string | null;
    nextLockedAt: number | null;
    triggerCount: number;
    lastTriggeredAt: number | null;
  }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("commentAutomations", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      createdByUserId: fixture.userId,
      name: "Guide link",
      status: "live",
      postScope: "any",
      selectedMediaIds: [],
      commentFilter: "any_word",
      triggerKeywords: [],
      commentReplyEnabled: false,
      commentReplyTexts: [],
      openingDmEnabled: true,
      openingDmText: "Hey! Tap below to get the link.",
      openingDmButtonText: "Send me the link",
      followGateEnabled: false,
      followGateText: "Follow us first",
      emailCollectionEnabled: false,
      emailCollectionText: "Drop your email",
      linkDmText: "Here's your link:",
      linkUrl: "https://example.com/guide",
      linkButtonText: "Open",
      linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
      followUpEnabled: false,
      followUpText: "Checking in",
      nextPostActivatedAt: null,
      nextLockedMediaId: null,
      nextLockedAt: null,
      triggerCount: 0,
      lastTriggeredAt: null,
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
      lastMessagePreview: "Comment received",
      messagingWindowClosesAt: BASE_TIME + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function startSession(
  t: ReturnType<typeof convexTest>,
  automationId: Id<"commentAutomations">,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  suffix: string,
) {
  const { contactId, conversationId } = await seedConversation(t, fixture, suffix);

  return await t.run(async (ctx) => {
    const automation = await ctx.db.get(automationId);
    if (!automation) {
      throw new Error("Automation not found.");
    }

    const sessionId = await startCommentAutomationSession(ctx as never, automation, {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      commentAutomationId: automationId,
      contactId,
      conversationId,
      commentId: `comment_${suffix}`,
      mediaId: `media_${suffix}`,
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

describe("comment automation reliability", () => {
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

  it("allows follow gate configs and resets next-post state when going live", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const followGateDraft = await authT.mutation(
      api.automations.commentAutomations.createCommentAutomation,
      {
        accountId: fixture.instagramAccountId,
        ...buildCreateArgs({
        followGateEnabled: true,
        goLive: false,
        }),
      },
    );
    const storedFollowGateDraft = await t.run((ctx) =>
      ctx.db.get(followGateDraft.automationId),
    );
    expect(storedFollowGateDraft?.followGateEnabled).toBe(true);

    const created = await authT.mutation(
      api.automations.commentAutomations.createCommentAutomation,
      {
        accountId: fixture.instagramAccountId,
        ...buildCreateArgs({
        postScope: "any",
        goLive: true,
        }),
      },
    );

    await authT.mutation(api.automations.commentAutomations.updateCommentAutomation, {
      accountId: fixture.instagramAccountId,
      automationId: created.automationId,
      ...(() => {
        const createArgs = buildCreateArgs({
          postScope: "next",
          goLive: true,
        });
        return {
          name: createArgs.name,
          postScope: createArgs.postScope,
          selectedMediaIds: createArgs.selectedMediaIds,
          commentFilter: createArgs.commentFilter,
          triggerKeywords: createArgs.triggerKeywords,
          commentReplyEnabled: createArgs.commentReplyEnabled,
          commentReplyTexts: createArgs.commentReplyTexts,
          openingDmEnabled: createArgs.openingDmEnabled,
          openingDmText: createArgs.openingDmText,
          openingDmButtonText: createArgs.openingDmButtonText,
          followGateEnabled: createArgs.followGateEnabled,
          followGateText: createArgs.followGateText,
          emailCollectionEnabled: createArgs.emailCollectionEnabled,
          emailCollectionText: createArgs.emailCollectionText,
          linkDmText: createArgs.linkDmText,
          linkButtons: createArgs.linkButtons,
          linkUrl: createArgs.linkUrl,
          linkButtonText: createArgs.linkButtonText,
          followUpEnabled: createArgs.followUpEnabled,
          followUpText: createArgs.followUpText,
        };
      })(),
    });

    const afterUpdate = await t.run((ctx) => ctx.db.get(created.automationId));
    expect(afterUpdate?.nextPostActivatedAt).toBe(BASE_TIME);
    expect(afterUpdate?.nextLockedMediaId ?? null).toBeNull();
    expect(afterUpdate?.nextLockedAt ?? null).toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.patch(created.automationId, {
        nextLockedMediaId: "media_locked",
        nextLockedAt: BASE_TIME,
      });
    });

    await authT.mutation(api.automations.commentAutomations.toggleCommentAutomation, {
      accountId: fixture.instagramAccountId,
      automationId: created.automationId,
      status: "paused",
    });

    vi.setSystemTime(BASE_TIME + 5_000);

    await authT.mutation(api.automations.commentAutomations.toggleCommentAutomation, {
      accountId: fixture.instagramAccountId,
      automationId: created.automationId,
      status: "live",
    });

    const afterToggle = await t.run((ctx) => ctx.db.get(created.automationId));
    expect(afterToggle?.nextPostActivatedAt).toBe(BASE_TIME + 5_000);
    expect(afterToggle?.nextLockedMediaId ?? null).toBeNull();
    expect(afterToggle?.nextLockedAt ?? null).toBeNull();
  });

  it("stores display keyword labels separately from normalized matcher keywords", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    const created = await authT.mutation(
      api.automations.commentAutomations.createCommentAutomation,
      {
        accountId: fixture.instagramAccountId,
        ...buildCreateArgs({
        commentFilter: "specific_words",
        triggerKeywords: ["email", "link"],
        triggerKeywordLabels: ["Email", "Link"],
        }),
      },
    );

    const storedAutomation = await t.run((ctx) => ctx.db.get(created.automationId));
    expect(storedAutomation?.triggerKeywords).toEqual(["email", "link"]);
    expect(storedAutomation?.triggerKeywordLabels).toEqual(["Email", "Link"]);

    const serializedAutomation = await authT.query(
      api.automations.commentAutomations.getCommentAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: created.automationId,
      },
    );
    expect(serializedAutomation?.triggerKeywords).toEqual(["email", "link"]);
    expect(serializedAutomation?.triggerKeywordLabels).toEqual([
      "Email",
      "Link",
    ]);
  });

  it("verifies follow status before unlocking the link", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const automationId = await insertAutomation(t, fixture, {
      followGateEnabled: true,
      followGateText: "Follow us first",
      emailCollectionEnabled: false,
      followUpEnabled: false,
    });

    const { sessionId } = await startSession(t, automationId, fixture, "follow");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ is_user_follow_business: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId,
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:opening_dm",
        quickReplyPayload: null,
        deliveryKey: "opening-delivery",
      },
    );

    let session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_follow");
    expect(session?.linkSentAt ?? null).toBeNull();

    const trackedLinksWhileBlocked = await t.run((ctx) =>
      ctx.db.query("commentAutomationTrackedLinks").collect(),
    );
    expect(trackedLinksWhileBlocked).toHaveLength(0);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ is_user_follow_business: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId,
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:follow_gate",
        quickReplyPayload: null,
        deliveryKey: "follow-delivery",
      },
    );

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("completed");
    expect(session?.linkSentAt).toBe(BASE_TIME);

    const trackedLinks = await t.run((ctx) =>
      ctx.db.query("commentAutomationTrackedLinks").collect(),
    );
    expect(trackedLinks).toHaveLength(1);
  });

  it("requires the opening DM postback and a valid email before sending tracked links", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const automationId = await insertAutomation(t, fixture, {
      openingDmEnabled: true,
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
      followUpEnabled: true,
      followUpText: "Checking in",
    });

    const { sessionId, contactId } = await startSession(
      t,
      automationId,
      fixture,
      "alpha",
    );

    let session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_button_click");

    await t.run(async (ctx) => {
      await advanceCommentAutomationSession(ctx as never, sessionId, {
        hasMessage: true,
        text: "hello",
        postbackPayload: null,
        quickReplyPayload: null,
      });
    });

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_button_click");

    await t.run(async (ctx) => {
      await advanceCommentAutomationSession(ctx as never, sessionId, {
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:opening_dm",
        quickReplyPayload: null,
      });
    });

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_email");

    await t.run(async (ctx) => {
      await advanceCommentAutomationSession(ctx as never, sessionId, {
        hasMessage: true,
        text: "not-an-email",
        postbackPayload: null,
        quickReplyPayload: null,
      });
    });

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_email");
    expect(session?.collectedEmail ?? null).toBeNull();

    const trackedLinksAfterInvalid = await t.run((ctx) =>
      ctx.db.query("commentAutomationTrackedLinks").collect(),
    );
    expect(trackedLinksAfterInvalid).toHaveLength(0);

    await t.run(async (ctx) => {
      await advanceCommentAutomationSession(ctx as never, sessionId, {
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
    expect(session?.followUpScheduledAt).toBe(BASE_TIME + 6 * 60 * 60 * 1000);

    const trackedLinks = await t.run((ctx) =>
      ctx.db.query("commentAutomationTrackedLinks").collect(),
    );
    expect(trackedLinks).toHaveLength(1);
    expect(trackedLinks[0]?.destinationUrl).toBe("https://example.com/guide");

    const storedEmails = await listStoredContactEmails(t, contactId);
    expect(storedEmails).toHaveLength(1);
    expect(storedEmails[0]?.email).toBe("user@example.com");
    expect(storedEmails[0]?.automationKind).toBe("comment_automation");
    expect(storedEmails[0]?.commentAutomationId).toBe(automationId);
  });

  it("ignores non-interactive webhook items and duplicate follow-gate deliveries", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const automationId = await insertAutomation(t, fixture, {
      followGateEnabled: true,
      followGateText: "Follow us first",
      emailCollectionEnabled: false,
      followUpEnabled: false,
    });

    const { sessionId, conversationId } = await startSession(
      t,
      automationId,
      fixture,
      "loop",
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ is_user_follow_business: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId,
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:opening_dm",
        quickReplyPayload: null,
        deliveryKey: "opening-loop",
      },
    );

    const attemptsBeforeNoise = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(attemptsBeforeNoise).toHaveLength(2);

    const deliveryPayload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          messaging: [
            {
              sender: { id: "contact_loop", username: "user_loop" },
              recipient: { id: "ig_account_1" },
              timestamp: BASE_TIME + 1_000,
              delivery: {
                mids: ["mid_delivery"],
                watermark: BASE_TIME + 1_000,
              },
            },
          ],
        },
      ],
    });

    const webhookResult = await t.mutation(
      internal.meta.webhooks.ingestWebhookPayload,
      {
        body: deliveryPayload,
      },
    );
    expect(webhookResult).toEqual({ processed: 0, ignored: 1 });

    const attemptsAfterNoise = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(attemptsAfterNoise).toHaveLength(2);

    const conversation = await t.run((ctx) => ctx.db.get(conversationId));
    expect(conversation?.lastMessageAt).toBe(BASE_TIME);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ is_user_follow_business: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId,
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:follow_gate",
        quickReplyPayload: null,
        deliveryKey: "follow-duplicate",
      },
    );

    const attemptsAfterFollowClick = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(attemptsAfterFollowClick).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await t.action(
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId,
        hasMessage: false,
        text: null,
        postbackPayload: "comment_automation:follow_gate",
        quickReplyPayload: null,
        deliveryKey: "follow-duplicate",
      },
    );

    const attemptsAfterDuplicate = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(attemptsAfterDuplicate).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("locks next-post automations to the first post published after activation", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const activationTime = BASE_TIME;
    const automationId = await insertAutomation(t, fixture, {
      status: "live",
      postScope: "next",
      nextPostActivatedAt: activationTime,
      openingDmEnabled: false,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("instagramMedia", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        mediaId: "media_old",
        mediaType: "IMAGE",
        thumbnailUrl: null,
        mediaUrl: "https://example.com/old.jpg",
        caption: "Old post",
        timestamp: new Date(activationTime - 60_000).toISOString(),
        permalink: null,
        fetchedAt: BASE_TIME,
      });
      await ctx.db.insert("instagramMedia", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        mediaId: "media_new",
        mediaType: "IMAGE",
        thumbnailUrl: null,
        mediaUrl: "https://example.com/new.jpg",
        caption: "New post",
        timestamp: new Date(activationTime + 60_000).toISOString(),
        permalink: null,
        fetchedAt: BASE_TIME,
      });
    });

    const ignored = await t.mutation(internal.meta.commentWebhooks.processCommentWebhookItem, {
      instagramAccountExternalId: "ig_account_1",
      commentId: "comment_old",
      commentText: "link",
      commenterId: "commenter_1",
      commenterUsername: "commenter",
      mediaId: "media_old",
      parentCommentId: null,
      timestamp: BASE_TIME,
      allowRefresh: false,
    });

    expect(ignored.status).toBe("ignored");

    const lockedAutomation = await t.run((ctx) => ctx.db.get(automationId));
    expect(lockedAutomation?.nextLockedMediaId).toBe("media_new");

    const processed = await t.mutation(internal.meta.commentWebhooks.processCommentWebhookItem, {
      instagramAccountExternalId: "ig_account_1",
      commentId: "comment_new",
      commentText: "link",
      commenterId: "commenter_1",
      commenterUsername: "commenter",
      mediaId: "media_new",
      parentCommentId: null,
      timestamp: BASE_TIME,
      allowRefresh: false,
    });

    expect(processed.status).toBe("processed");

    const stableLock = await t.run((ctx) => ctx.db.get(automationId));
    expect(stableLock?.nextLockedMediaId).toBe("media_new");
  });

  it("tracks clicks and only sends follow-ups when the session is still eligible", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const automationId = await insertAutomation(t, fixture, {
      openingDmEnabled: false,
      emailCollectionEnabled: false,
      followUpEnabled: true,
      followUpText: "Checking in",
    });

    const first = await startSession(t, automationId, fixture, "click");
    const firstTrackedLink = await t.run(async (ctx) => {
      return await ctx.db
        .query("commentAutomationTrackedLinks")
        .withIndex("by_session_id", (q) => q.eq("sessionId", first.sessionId))
        .unique();
    });

    expect(firstTrackedLink?.token).toBeTruthy();

    const clickResult = await t.mutation(
      api.automations.commentTracking.consumeTrackedLink,
      { token: firstTrackedLink!.token },
    );
    expect(clickResult.destinationUrl).toBe("https://example.com/guide");

    const repeatClick = await t.mutation(
      api.automations.commentTracking.consumeTrackedLink,
      { token: firstTrackedLink!.token },
    );
    expect(repeatClick.destinationUrl).toBe("https://example.com/guide");

    let firstSession = await t.run((ctx) => ctx.db.get(first.sessionId));
    expect(firstSession?.linkClickedAt).toBe(BASE_TIME);

    await t.mutation(internal.automations.commentFlow.processScheduledFollowUp, {
      sessionId: first.sessionId,
    });

    firstSession = await t.run((ctx) => ctx.db.get(first.sessionId));
    expect(firstSession?.followUpSentAt ?? null).toBeNull();

    const second = await startSession(t, automationId, fixture, "followup");
    await t.run(async (ctx) => {
      await ctx.db.patch(second.sessionId, {
        followUpScheduledAt: BASE_TIME - 1,
      });
    });

    await t.mutation(internal.automations.commentFlow.processScheduledFollowUp, {
      sessionId: second.sessionId,
    });

    const secondSession = await t.run((ctx) => ctx.db.get(second.sessionId));
    expect(secondSession?.followUpSentAt).toBe(BASE_TIME);

    const third = await startSession(t, automationId, fixture, "expired");
    await t.run(async (ctx) => {
      await ctx.db.patch(third.sessionId, {
        followUpScheduledAt: BASE_TIME - 1,
      });
      await ctx.db.patch(third.conversationId, {
        messagingWindowClosesAt: BASE_TIME - 1,
      });
    });

    await t.mutation(internal.automations.commentFlow.processScheduledFollowUp, {
      sessionId: third.sessionId,
    });

    const thirdSession = await t.run((ctx) => ctx.db.get(third.sessionId));
    const expiredConversation = await t.run((ctx) => ctx.db.get(third.conversationId));
    expect(thirdSession?.followUpSentAt ?? null).toBeNull();
    expect(expiredConversation?.status).toBe("window_closed");
  });

  it("auto-pauses the automation when the outbound safety guardrail is exceeded", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const automationId = await insertAutomation(t, fixture, {
      openingDmEnabled: false,
      followGateEnabled: false,
      emailCollectionEnabled: true,
      emailCollectionText: "Drop your email",
      followUpEnabled: false,
    });

    const { sessionId } = await startSession(t, automationId, fixture, "guardrail");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await t.run(async (ctx) => {
        await advanceCommentAutomationSession(ctx as never, sessionId, {
          hasMessage: true,
          text: "still not an email",
          postbackPayload: null,
          quickReplyPayload: null,
        });
      });
    }

    const session = await t.run((ctx) => ctx.db.get(sessionId));
    const automation = await t.run((ctx) => ctx.db.get(automationId));
    expect(session?.currentStep).toBe("guardrail_tripped");
    expect(session?.outboundMessageCount).toBe(8);
    expect(session?.guardrailReason).toContain("Safety guardrail paused");
    expect(automation?.status).toBe("paused");
    expect(automation?.guardrailReason).toContain("Safety guardrail paused");

    const deliveries = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(deliveries).toHaveLength(8);

    const logs = await authT.query(api.dashboard.listLogs, {
      accountId: fixture.instagramAccountId,
    });
    expect(logs.some((entry) => entry.type === "comment_guardrail")).toBe(true);
  });
});
