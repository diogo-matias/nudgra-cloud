import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-01T12:00:00.000Z").getTime();
const FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;

function buildCreateArgs(
  overrides: Partial<{
    name: string;
    welcomeDmText: string;
    emailCollectionEnabled: boolean;
    emailCollectionText: string;
    linkDmText: string;
    linkButtons: Array<{ label: string; url: string }>;
    linkUrl: string;
    linkButtonText: string;
    followUpEnabled: boolean;
    followUpText: string;
    tagIds: Id<"tags">[];
    sequenceDefinitionId: Id<"sequenceDefinitions"> | null;
    goLive: boolean;
  }> = {},
) {
  return {
    name: "Follower welcome",
    welcomeDmText: "Thanks for following. Want the guide?",
    emailCollectionEnabled: false,
    emailCollectionText: "Drop your email",
    linkDmText: "Here is the link:",
    linkButtons: [{ label: "Open", url: "https://example.com/guide" }],
    linkUrl: "",
    linkButtonText: "Open",
    followUpEnabled: false,
    followUpText: "Still interested?",
    tagIds: [],
    sequenceDefinitionId: null,
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
      instagramAccountId: "ig_follower_account",
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
      color: "#22c55e",
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

describe("follower automations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SITE_URL;
  });

  it("creates, lists, blocks live toggles, validates, and deletes follower automations", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const tagId = await insertTag(t, fixture, "new follower");
    const sequenceId = await insertSequence(t, fixture, "Follower nurture");
    const authT = t.withIdentity({ subject: fixture.userId });

    const options = await authT.query(
      api.automations.followerAutomations.getFollowerAutomationCreationOptions,
      { accountId: fixture.instagramAccountId },
    );
    expect(options.tags.map((tag) => tag.label)).toEqual(["new follower"]);
    expect(options.sequences.map((sequence) => sequence.name)).toEqual([
      "Follower nurture",
    ]);
    expect(options.isRealtimeTriggerSupported).toBe(false);
    expect(options.unsupportedReason).toContain("new-follower webhook");

    await expect(
      authT.mutation(
        api.automations.followerAutomations.createFollowerAutomation,
        {
          ...buildCreateArgs({
            welcomeDmText: "Thanks for following",
            linkButtons: [],
            linkUrl: "",
            linkDmText: "",
            followUpEnabled: true,
            goLive: false,
          }),
          accountId: fixture.instagramAccountId,
        },
      ),
    ).rejects.toThrow("Follow-up requires at least one tracked link button.");

    await expect(
      authT.mutation(
        api.automations.followerAutomations.createFollowerAutomation,
        {
          ...buildCreateArgs({
            goLive: true,
          }),
          accountId: fixture.instagramAccountId,
        },
      ),
    ).rejects.toThrow("new-follower webhook");

    const createResult = await authT.mutation(
      api.automations.followerAutomations.createFollowerAutomation,
      {
        ...buildCreateArgs({
          tagIds: [tagId],
          sequenceDefinitionId: sequenceId,
          followUpEnabled: true,
          goLive: false,
        }),
        accountId: fixture.instagramAccountId,
      },
    );

    let automation = await authT.query(
      api.automations.followerAutomations.getFollowerAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );
    expect(automation?.status).toBe("draft");
    expect(automation?.canGoLive).toBe(false);
    expect(automation?.unsupportedReason).toContain("new-follower webhook");
    expect(automation?.validationIssues).toEqual([]);
    expect(automation?.tags.map((tag) => tag.label)).toEqual(["new follower"]);
    expect(automation?.sequence?.name).toBe("Follower nurture");

    const updateArgs = buildCreateArgs({
      name: "Follower welcome edited",
      tagIds: [tagId],
      sequenceDefinitionId: sequenceId,
      followUpEnabled: true,
    });
    delete (updateArgs as Partial<typeof updateArgs>).goLive;

    await authT.mutation(
      api.automations.followerAutomations.updateFollowerAutomation,
      {
        ...updateArgs,
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );
    await expect(
      authT.mutation(
        api.automations.followerAutomations.toggleFollowerAutomation,
        {
          accountId: fixture.instagramAccountId,
          automationId: createResult.automationId,
          status: "live",
        },
      ),
    ).rejects.toThrow("new-follower webhook");

    automation = await authT.query(
      api.automations.followerAutomations.getFollowerAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );
    expect(automation?.name).toBe("Follower welcome edited");
    expect(automation?.status).toBe("draft");

    const listed = await authT.query(
      api.automations.followerAutomations.listFollowerAutomations,
      { accountId: fixture.instagramAccountId },
    );
    expect(listed.map((item) => item.id)).toEqual([createResult.automationId]);

    await authT.mutation(
      api.automations.followerAutomations.toggleFollowerAutomation,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
        status: "paused",
      },
    );
    await authT.mutation(
      api.automations.followerAutomations.deleteFollowerAutomation,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );

    const deletedAutomation = await authT.query(
      api.automations.followerAutomations.getFollowerAutomationById,
      {
        accountId: fixture.instagramAccountId,
        automationId: createResult.automationId,
      },
    );
    expect(deletedAutomation).toBeNull();
  });

  it("ingests a synthetic follower event, dedupes it, queues DMs, and tracks clicks", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const tagId = await insertTag(t, fixture, "fresh follower");
    const sequenceId = await insertSequence(t, fixture, "Fresh follower flow");
    const authT = t.withIdentity({ subject: fixture.userId });

    const createResult = await authT.mutation(
      api.automations.followerAutomations.createFollowerAutomation,
      {
        ...buildCreateArgs({
          tagIds: [tagId],
          sequenceDefinitionId: sequenceId,
          followUpEnabled: true,
          goLive: false,
        }),
        accountId: fixture.instagramAccountId,
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.patch(createResult.automationId, { status: "live" });
    });

    const firstResult = await t.mutation(
      internal.meta.followerWebhooks.processFollowerEvent,
      {
        instagramAccountExternalId: "ig_follower_account",
        followerUserId: "follower_1",
        followerUsername: "newfan",
        followerDisplayName: "New Fan",
        followerProfilePictureUrl: "https://example.com/avatar.jpg",
        eventKey: "event_follow_1",
        timestamp: BASE_TIME,
      },
    );
    expect(firstResult).toEqual({ processed: 1, ignored: 0 });

    const duplicateResult = await t.mutation(
      internal.meta.followerWebhooks.processFollowerEvent,
      {
        instagramAccountExternalId: "ig_follower_account",
        followerUserId: "follower_1",
        followerUsername: "newfan",
        followerDisplayName: "New Fan",
        followerProfilePictureUrl: "https://example.com/avatar.jpg",
        eventKey: "event_follow_1",
        timestamp: BASE_TIME,
      },
    );
    expect(duplicateResult).toEqual({ processed: 0, ignored: 1 });

    const stored = await t.run(async (ctx) => {
      const contacts = await ctx.db.query("contacts").collect();
      const conversations = await ctx.db.query("conversations").collect();
      const sessions = await ctx.db
        .query("followerAutomationSessions")
        .collect();
      const attempts = await ctx.db.query("deliveryAttempts").collect();
      const trackedLinks = await ctx.db
        .query("followerAutomationTrackedLinks")
        .collect();
      const contactTags = await ctx.db.query("contactTags").collect();
      const memberships = await ctx.db
        .query("contactAutomationMemberships")
        .collect();
      const sequenceEnrollments = await ctx.db
        .query("sequenceEnrollments")
        .collect();
      const webhookEvents = await ctx.db.query("webhookEvents").collect();

      const followerMemberships = memberships.filter(
        (membership) => membership.automationKind === "follower_automation",
      );

      return {
        contacts,
        conversations,
        sessions,
        attempts,
        trackedLinks,
        contactTags,
        memberships: followerMemberships,
        sequenceEnrollments,
        webhookEvents,
      };
    });

    expect(stored.contacts).toHaveLength(1);
    expect(stored.contacts[0]?.instagramUserId).toBe("follower_1");
    expect(stored.contacts[0]?.username).toBe("newfan");
    expect(stored.conversations).toHaveLength(1);
    expect(stored.conversations[0]?.conversationKey).toBe(
      "ig_follower_account:follower_1",
    );

    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0]?.followerAutomationId).toBe(
      createResult.automationId,
    );
    expect(stored.sessions[0]?.followerEventKey).toBe("event_follow_1");
    expect(stored.sessions[0]?.currentStep).toBe("completed");
    expect(stored.sessions[0]?.outboundMessageCount).toBe(2);
    expect(stored.sessions[0]?.linkSentAt).toBe(BASE_TIME);
    expect(stored.sessions[0]?.followUpScheduledAt).toBe(
      BASE_TIME + FOLLOW_UP_DELAY_MS,
    );

    expect(stored.attempts).toHaveLength(2);
    expect(stored.attempts.map((attempt) => attempt.status)).toEqual([
      "queued",
      "queued",
    ]);
    expect(
      stored.attempts.every(
        (attempt) => attempt.followerAutomationId === createResult.automationId,
      ),
    ).toBe(true);

    expect(stored.trackedLinks).toHaveLength(1);
    expect(stored.trackedLinks[0]?.destinationUrl).toBe(
      "https://example.com/guide",
    );
    expect(stored.contactTags).toHaveLength(1);
    expect(stored.contactTags[0]?.source).toBe("follower_automation");
    expect(stored.memberships).toHaveLength(1);
    expect(stored.memberships[0]?.automationKind).toBe("follower_automation");
    expect(stored.sequenceEnrollments).toHaveLength(1);
    expect(stored.webhookEvents).toHaveLength(1);
    expect(stored.webhookEvents[0]?.deliveryKey).toBe("event_follow_1");
    expect(stored.webhookEvents[0]?.processingStatus).toBe("processed");

    const clickResult = await t.mutation(
      api.automations.followerTracking.consumeTrackedLink,
      {
        token: stored.trackedLinks[0]!.token,
      },
    );
    expect(clickResult.destinationUrl).toBe("https://example.com/guide");

    const clickedSession = await t.run((ctx) =>
      ctx.db.get(stored.sessions[0]!._id),
    );
    expect(clickedSession?.linkClickedAt).toBe(BASE_TIME);
  });
});
