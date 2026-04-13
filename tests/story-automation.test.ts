import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  advanceStoryAutomationSession,
  startStoryAutomationSession,
} from "@/convex/automations/storyFlow";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-01T12:00:00.000Z").getTime();
const FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;

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
      instagramAccountId: "ig_story_account",
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
      color: "#fb7185",
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
      steps: [{ delayMinutes: 60, messageText: "Sequence step" }],
    });
  });
}

async function insertStory(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  overrides: Partial<{
    storyId: string;
    mediaType: string;
    thumbnailUrl: string | null;
    mediaUrl: string | null;
    permalink: string | null;
    timestamp: string;
    expiresAt: number;
  }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("instagramStories", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      storyId: overrides.storyId ?? "story_1",
      mediaType: overrides.mediaType ?? "IMAGE",
      thumbnailUrl:
        overrides.thumbnailUrl ?? "https://example.com/story-thumb.jpg",
      mediaUrl: overrides.mediaUrl ?? "https://example.com/story.jpg",
      permalink:
        overrides.permalink ?? "https://instagram.com/stories/nudgra/story_1",
      timestamp: overrides.timestamp ?? new Date(BASE_TIME).toISOString(),
      expiresAt: overrides.expiresAt ?? BASE_TIME + 12 * 60 * 60 * 1000,
      fetchedAt: BASE_TIME,
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
      profilePictureFetchedAt: null,
    });
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      contactId,
      conversationKey: `ig_story_account:contact_${suffix}`,
      status: "active",
      startedAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastOutboundAt: null,
      lastMessagePreview: "Story reply",
      messagingWindowClosesAt: BASE_TIME + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
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

describe("story automations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SITE_URL;
  });

  it("creates and serializes a specific-story automation with tags and a sequence", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    await insertStory(t, fixture);
    const tagId = await insertTag(t, fixture, "story lead");
    const sequenceId = await insertSequence(t, fixture, "Story nurture");
    const authT = t.withIdentity({ subject: fixture.userId });

    const createResult = await authT.mutation(
      api.automations.storyAutomations.createStoryAutomation,
      {
        accountId: fixture.instagramAccountId,
        name: "Story lead link",
        storyScope: "specific",
        selectedStoryId: "story_1",
        replyFilter: "specific_words_or_reactions",
        triggerTokens: ["link", "🔥"],
        triggerTokenLabels: ["Link", "🔥"],
        reactionEnabled: true,
        followGateEnabled: true,
        followGateText: "Follow first",
        emailCollectionEnabled: true,
        emailCollectionText: "Drop your email",
        linkDmText: "Here you go",
        linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
        linkUrl: "https://example.com/guide",
        linkButtonText: "Open",
        followUpEnabled: true,
        followUpText: "Need anything else?",
        tagIds: [tagId],
        sequenceDefinitionId: sequenceId,
        goLive: true,
      },
    );

    const automation = await authT.query(
      api.automations.storyAutomations.getStoryAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );

    expect(automation?.status).toBe("live");
    expect(automation?.storyScope).toBe("specific");
    expect(automation?.selectedStory?.id).toBe("story_1");
    expect(automation?.triggerTokenLabels).toEqual(["Link", "🔥"]);
    expect(automation?.reactionEnabled).toBe(true);
    expect(automation?.followGateEnabled).toBe(true);
    expect(automation?.emailCollectionEnabled).toBe(true);
    expect(automation?.followUpEnabled).toBe(true);
    expect(automation?.tags.map((tag) => tag.label)).toEqual(["story lead"]);
    expect(automation?.sequence?.name).toBe("Story nurture");
  });

  it("runs the reaction, email capture, tracked link, and follow-up scheduling flow", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    await insertStory(t, fixture);
    const authT = t.withIdentity({ subject: fixture.userId });

    const createResult = await authT.mutation(
      api.automations.storyAutomations.createStoryAutomation,
      {
        accountId: fixture.instagramAccountId,
        name: "Story DM",
        storyScope: "specific",
        selectedStoryId: "story_1",
        replyFilter: "specific_words_or_reactions",
        triggerTokens: ["link"],
        triggerTokenLabels: ["Link"],
        reactionEnabled: true,
        followGateEnabled: false,
        followGateText: "",
        emailCollectionEnabled: true,
        emailCollectionText: "Drop your email",
        linkDmText: "Here's the guide",
        linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
        linkUrl: "https://example.com/guide",
        linkButtonText: "Open",
        followUpEnabled: true,
        followUpText: "Need anything else?",
        tagIds: [],
        sequenceDefinitionId: null,
        goLive: true,
      },
    );

    const { contactId, conversationId } = await seedConversation(t, fixture, "story");

    const sessionId = await t.run(async (ctx) => {
      const automation = await ctx.db.get(createResult.automationId);
      if (!automation) {
        throw new Error("Automation not found.");
      }

      return await startStoryAutomationSession(ctx as never, automation, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        storyAutomationId: createResult.automationId,
        contactId,
        conversationId,
        matchedAt: BASE_TIME,
        triggerMessageId: "mid.story.reply",
        storyId: "story_1",
        storyUrl: "https://instagram.com/stories/nudgra/story_1",
        storyToken: "link",
      });
    });

    if (!sessionId) {
      throw new Error("Expected story session to be created.");
    }

    let session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("awaiting_email");
    expect(session?.reactionSentAt).toBe(BASE_TIME);

    const deliveryAttempts = await t.run((ctx) =>
      ctx.db.query("deliveryAttempts").collect(),
    );
    expect(
      deliveryAttempts.some((attempt) =>
        attempt.requestPayload?.includes("story_reply_reaction"),
      ),
    ).toBe(true);

    await t.run(async (ctx) => {
      await advanceStoryAutomationSession(ctx as never, sessionId, {
        hasMessage: true,
        text: "person@example.com",
        postbackPayload: null,
        quickReplyPayload: null,
      });
    });

    session = await t.run((ctx) => ctx.db.get(sessionId));
    expect(session?.currentStep).toBe("completed");
    expect(session?.collectedEmail).toBe("person@example.com");
    expect(session?.linkSentAt).toBe(BASE_TIME);
    expect(session?.followUpScheduledAt).toBe(BASE_TIME + FOLLOW_UP_DELAY_MS);

    const trackedLinks = await t.run((ctx) =>
      ctx.db.query("storyAutomationTrackedLinks").collect(),
    );
    expect(trackedLinks).toHaveLength(1);
    expect(trackedLinks[0]?.destinationUrl).toBe("https://example.com/guide");

    const storedEmails = await listStoredContactEmails(t, contactId);
    expect(storedEmails).toHaveLength(1);
    expect(storedEmails[0]?.email).toBe("person@example.com");
    expect(storedEmails[0]?.automationKind).toBe("story_automation");
    expect(storedEmails[0]?.storyAutomationId).toBe(createResult.automationId);
  });

  it("auto-pauses live specific-story automations when the selected story expires", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    await insertStory(t, fixture);
    const authT = t.withIdentity({ subject: fixture.userId });

    const createResult = await authT.mutation(
      api.automations.storyAutomations.createStoryAutomation,
      {
        accountId: fixture.instagramAccountId,
        name: "Expiring story",
        storyScope: "specific",
        selectedStoryId: "story_1",
        replyFilter: "any_word_or_reaction",
        triggerTokens: [],
        triggerTokenLabels: [],
        reactionEnabled: false,
        followGateEnabled: false,
        followGateText: "",
        emailCollectionEnabled: false,
        emailCollectionText: "",
        linkDmText: "Here's the guide",
        linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
        linkUrl: "https://example.com/guide",
        linkButtonText: "Open",
        followUpEnabled: false,
        followUpText: "",
        tagIds: [],
        sequenceDefinitionId: null,
        goLive: true,
      },
    );

    await t.mutation(internal.meta.storyQueries.upsertStoryBatch, {
      workspaceId: fixture.workspaceId,
      instagramAccountDocId: fixture.instagramAccountId,
      items: [],
    });

    const automation = await authT.query(
      api.automations.storyAutomations.getStoryAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );

    expect(automation?.status).toBe("paused");
    expect(automation?.selectedStoryExpiredAt).toBe(BASE_TIME);
    expect(automation?.validationIssues).toContain(
      "The selected story is no longer live. Pick a new story before going live again.",
    );
  });
});
