import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "@/convex/_generated/api";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";
import { queueAutomatedStoryReaction } from "@/convex/meta/sendHelpers";

const BASE_TIME = new Date("2026-04-12T10:00:00.000Z").getTime();
const fetchMock = vi.fn<typeof fetch>();

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
    const instagramAccountId = await ctx.db.insert("instagramAccounts", {
      workspaceId,
      instagramAccountId: "ig_story_account",
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
    const contactId = await ctx.db.insert("contacts", {
      workspaceId,
      instagramAccountId,
      instagramUserId: "contact_story",
      username: "story_user",
      displayName: "Story User",
      profilePictureUrl: null,
      profilePictureFetchedAt: null,
      firstInboundAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
    });
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId,
      instagramAccountId,
      contactId,
      conversationKey: "ig_story_account:contact_story",
      status: "active",
      startedAt: BASE_TIME,
      lastMessageAt: BASE_TIME,
      lastInboundAt: BASE_TIME,
      lastOutboundAt: null,
      lastMessagePreview: "Story reply",
      messagingWindowClosesAt: BASE_TIME + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    });

    return { workspaceId, instagramAccountId, contactId, conversationId };
  });
}

describe("meta send actions", () => {
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

  it("sends story reply reactions through Meta's reaction payload", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);

    await t.run(async (ctx) => {
      await queueAutomatedStoryReaction(ctx as never, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId: fixture.conversationId,
        contactId: fixture.contactId,
        automationRuleId: null,
        storyAutomationId: null,
        sequenceEnrollmentId: null,
        messageText: "Reacted with ❤️",
        emoji: "❤️",
        triggerMessageId: "mid.story.reply",
      });
    });

    const deliveryAttempt = await t.run(async (ctx) => {
      return await ctx.db.query("deliveryAttempts").unique();
    });

    if (!deliveryAttempt) {
      throw new Error("Expected queued delivery attempt.");
    }

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await t.action(internal.meta.sendActions.performQueuedDelivery, {
      deliveryAttemptId: deliveryAttempt._id,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0];
    const init = request?.[1];
    const rawBody =
      typeof init?.body === "string" ? init.body : JSON.stringify(init?.body);
    const parsedBody = JSON.parse(rawBody);

    expect(parsedBody).toEqual({
      recipient: { id: "contact_story" },
      sender_action: "react",
      payload: {
        message_id: "mid.story.reply",
        reaction: "love",
      },
    });

    const updatedAttempt = await t.run((ctx) =>
      ctx.db.get(deliveryAttempt._id),
    );
    expect(updatedAttempt?.status).toBe("sent");

    const storedMessages = await t.run((ctx) =>
      ctx.db.query("messages").collect(),
    );
    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0]).toMatchObject({
      direction: "outbound",
      messageType: "reaction",
      text: "Reacted with ❤️",
      triggerMessageId: "mid.story.reply",
    });
  });
});
