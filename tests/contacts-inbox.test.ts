import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import component from "@convex-dev/migrations/test";
import { runToCompletion } from "@convex-dev/migrations";
import { api, components, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";
import { createSequenceEnrollment } from "@/convex/automations/sequences";
import { startCommentAutomationSession } from "@/convex/automations/commentFlow";

const BASE_TIME = new Date("2026-04-05T09:00:00.000Z").getTime();
const fetchMock = vi.fn<typeof fetch>();
process.env.SITE_URL = "https://app.example.com";

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

async function seedContact(
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
      messagingWindowClosesAt: BASE_TIME + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    });

    return { contactId, conversationId };
  });
}

async function seedRule(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  name: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("automationRules", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      name,
      triggerType: "keyword",
      matchType: "contains",
      keywords: ["guide"],
      replyText: "Here is the guide",
      isActive: true,
      tagIds: [],
      sequenceDefinitionId: null,
      createdByUserId: fixture.userId,
      triggerCount: 0,
      lastTriggeredAt: null,
    });
  });
}

async function seedSequenceDefinition(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
  name = "Nurture",
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("sequenceDefinitions", {
      workspaceId: fixture.workspaceId,
      name,
      isActive: true,
      steps: [{ delayMinutes: 30, messageText: "Follow up" }],
    });
  });
}

async function seedCommentAutomation(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedWorkspace>>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("commentAutomations", {
      workspaceId: fixture.workspaceId,
      instagramAccountId: fixture.instagramAccountId,
      createdByUserId: fixture.userId,
      name: "Comment CTA",
      status: "live",
      postScope: "any",
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
      nextPostActivatedAt: null,
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
}

async function countMemberships(
  t: ReturnType<typeof convexTest>,
  contactId: Id<"contacts">,
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("contactAutomationMemberships")
      .withIndex("by_contact_id_and_last_matched_at", (q) =>
        q.eq("contactId", contactId),
      )
      .collect();
  });
}

describe("contacts and inbox read models", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("updates one membership row per automation kind on live writes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "alpha",
    );
    const ruleId = await seedRule(t, fixture, "DM keyword");
    const sequenceDefinitionId = await seedSequenceDefinition(t, fixture);
    const commentAutomationId = await seedCommentAutomation(t, fixture);

    await t.run(async (ctx) => {
      await ctx.runMutation(
        internal.contacts.upsertContactAutomationMembership,
        {
          workspaceId: fixture.workspaceId,
          contactId,
          conversationId,
          automationKind: "rule",
          automationRuleId: ruleId,
          commentAutomationId: null,
          sequenceDefinitionId: null,
          matchedAt: BASE_TIME,
        },
      );
    });

    vi.setSystemTime(BASE_TIME + 60_000);

    await t.run(async (ctx) => {
      await createSequenceEnrollment(ctx as never, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        contactId,
        conversationId,
        sequenceDefinitionId,
      });
    });

    vi.setSystemTime(BASE_TIME + 120_000);

    await t.run(async (ctx) => {
      const automation = await ctx.db.get(commentAutomationId);
      if (!automation) {
        throw new Error("Automation missing");
      }
      await startCommentAutomationSession(ctx as never, automation, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        commentAutomationId,
        contactId,
        conversationId,
        commentId: "comment_1",
        mediaId: "media_1",
      });
    });

    vi.setSystemTime(BASE_TIME + 180_000);

    await t.run(async (ctx) => {
      await ctx.runMutation(
        internal.contacts.upsertContactAutomationMembership,
        {
          workspaceId: fixture.workspaceId,
          contactId,
          conversationId,
          automationKind: "rule",
          automationRuleId: ruleId,
          commentAutomationId: null,
          sequenceDefinitionId: null,
          matchedAt: BASE_TIME + 180_000,
        },
      );
    });

    const memberships = await countMemberships(t, contactId);
    expect(memberships).toHaveLength(3);

    const ruleMembership = memberships.find(
      (membership) => membership.automationKind === "rule",
    );
    expect(ruleMembership?.firstMatchedAt).toBe(BASE_TIME);
    expect(ruleMembership?.lastMatchedAt).toBe(BASE_TIME + 180_000);
  });

  it("backfills historical memberships through the migrations component without duplicates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    const t = convexTest({ schema, modules });
    component.register(t);

    const fixture = await seedWorkspace(t);
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "backfill",
    );
    const ruleId = await seedRule(t, fixture, "Keyword backfill");
    const sequenceDefinitionId = await seedSequenceDefinition(
      t,
      fixture,
      "Warm sequence",
    );
    const commentAutomationId = await seedCommentAutomation(t, fixture);

    await t.run(async (ctx) => {
      await ctx.db.insert("deliveryAttempts", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        automationRuleId: ruleId,
        sequenceEnrollmentId: null,
        status: "sent",
        reason: null,
        requestPayload: null,
        responsePayload: null,
        policyWindowOpen: true,
        attemptNumber: 1,
        eventTime: BASE_TIME,
        messageText: "Rule reply",
        metaMessageId: null,
      });
      await ctx.db.insert("sequenceEnrollments", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        contactId,
        conversationId,
        sequenceDefinitionId,
        status: "active",
        currentStepIndex: 0,
        nextRunAt: BASE_TIME + 300_000,
        enrolledAt: BASE_TIME + 60_000,
        lastProcessedAt: null,
        stopReason: null,
      });
      await ctx.db.insert("commentAutomationSessions", {
        workspaceId: fixture.workspaceId,
        commentAutomationId,
        contactId,
        conversationId,
        instagramAccountId: fixture.instagramAccountId,
        currentStep: "completed",
        collectedEmail: null,
        commentId: "comment_backfill",
        mediaId: "media_backfill",
        startedAt: BASE_TIME + 120_000,
        lastStepAt: BASE_TIME + 120_000,
        outboundMessageCount: 1,
        followGateInputMode: null,
        lastInboundDeliveryKey: null,
        guardrailTrippedAt: null,
        guardrailReason: null,
        linkSentAt: BASE_TIME + 120_000,
        linkClickedAt: null,
        followUpScheduledAt: null,
        followUpSentAt: null,
      });
    });

    await t.run(async (ctx) => {
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillRuleMemberships,
      );
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillSequenceMemberships,
      );
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillCommentAutomationMemberships,
      );
    });

    await t.run(async (ctx) => {
      await runToCompletion(
        ctx,
        components.migrations,
        internal.migrations.backfillRuleMemberships,
      );
    });

    const memberships = await countMemberships(t, contactId);
    expect(memberships).toHaveLength(3);
  });

  it("filters contacts by automation and exposes opt-in timestamps in contact detail", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const first = await seedContact(t, fixture, "first");
    const second = await seedContact(t, fixture, "second");
    const ruleId = await seedRule(t, fixture, "Filter rule");
    const sequenceDefinitionId = await seedSequenceDefinition(
      t,
      fixture,
      "Filter sequence",
    );

    await t.run(async (ctx) => {
      await ctx.runMutation(
        internal.contacts.upsertContactAutomationMembership,
        {
          workspaceId: fixture.workspaceId,
          contactId: first.contactId,
          conversationId: first.conversationId,
          automationKind: "rule",
          automationRuleId: ruleId,
          commentAutomationId: null,
          sequenceDefinitionId: null,
          matchedAt: BASE_TIME,
        },
      );
      await ctx.runMutation(
        internal.contacts.upsertContactAutomationMembership,
        {
          workspaceId: fixture.workspaceId,
          contactId: second.contactId,
          conversationId: second.conversationId,
          automationKind: "sequence",
          automationRuleId: null,
          commentAutomationId: null,
          sequenceDefinitionId,
          matchedAt: BASE_TIME + 60_000,
        },
      );
    });

    const filteredContacts = await authT.query(api.contacts.listContacts, {
      accountId: fixture.instagramAccountId,
      automationFilter: {
        kind: "rule",
        automationRuleId: ruleId,
      },
    });
    expect(filteredContacts).toHaveLength(1);
    expect(filteredContacts[0]?.id).toBe(first.contactId);

    const detail = await authT.query(api.contacts.getContactDetail, {
      accountId: fixture.instagramAccountId,
      contactId: first.contactId,
    });
    expect(detail?.automations[0]?.firstMatchedAt).toBe(BASE_TIME);
    expect(detail?.automations[0]?.lastMatchedAt).toBe(BASE_TIME);
  });

  it("applies inbox automation precedence: active comment session, then sequence, then rule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const ruleId = await seedRule(t, fixture, "Rule precedence");
    const sequenceDefinitionId = await seedSequenceDefinition(
      t,
      fixture,
      "Sequence precedence",
    );
    const commentAutomationId = await seedCommentAutomation(t, fixture);

    const first = await seedContact(t, fixture, "comment");
    const second = await seedContact(t, fixture, "sequence");
    const third = await seedContact(t, fixture, "rule");

    await t.run(async (ctx) => {
      await ctx.db.patch(first.conversationId, {
        lastAutomationRuleId: ruleId,
      });
      await ctx.db.patch(second.conversationId, {
        lastAutomationRuleId: ruleId,
      });
      await ctx.db.patch(third.conversationId, {
        lastAutomationRuleId: ruleId,
      });

      await ctx.db.insert("commentAutomationSessions", {
        workspaceId: fixture.workspaceId,
        commentAutomationId,
        contactId: first.contactId,
        conversationId: first.conversationId,
        instagramAccountId: fixture.instagramAccountId,
        currentStep: "awaiting_email",
        collectedEmail: null,
        commentId: "comment_precedence",
        mediaId: "media_precedence",
        startedAt: BASE_TIME,
        lastStepAt: BASE_TIME,
        outboundMessageCount: 1,
        followGateInputMode: null,
        lastInboundDeliveryKey: null,
        guardrailTrippedAt: null,
        guardrailReason: null,
        linkSentAt: null,
        linkClickedAt: null,
        followUpScheduledAt: null,
        followUpSentAt: null,
      });

      await createSequenceEnrollment(ctx as never, {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        contactId: second.contactId,
        conversationId: second.conversationId,
        sequenceDefinitionId,
      });
    });

    const inbox = await authT.query(api.inbox.listInbox, {
      accountId: fixture.instagramAccountId,
      unreadOnly: false,
      statusFilter: "all",
      search: "",
    });

    const commentRow = inbox.find((row) => row.id === first.conversationId);
    const sequenceRow = inbox.find((row) => row.id === second.conversationId);
    const ruleRow = inbox.find((row) => row.id === third.conversationId);

    expect(commentRow?.latestAutomationContext?.kind).toBe(
      "comment_automation",
    );
    expect(sequenceRow?.latestAutomationContext?.kind).toBe("sequence");
    expect(ruleRow?.latestAutomationContext?.kind).toBe("rule");
  });

  it("shows button clicks as the actual selected action in conversation detail", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "event",
    );

    await t.run(async (ctx) => {
      const webhookEventId = await ctx.db.insert("webhookEvents", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        eventType: "postback",
        deliveryKey: "delivery:event:1",
        payload: JSON.stringify({
          sender: { id: "contact_event" },
          recipient: { id: "ig_account_1" },
          postback: {
            payload: "comment_automation:follow_gate",
          },
        }),
        receivedAt: BASE_TIME,
        processedAt: BASE_TIME,
        processingStatus: "processed",
        errorMessage: null,
      });

      await ctx.db.insert("messages", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        direction: "inbound",
        source: "webhook",
        messageType: "text",
        text: null,
        metaMessageId: null,
        dedupeKey: "delivery:event:1",
        deliveryStatus: "received",
        eventTime: BASE_TIME,
        webhookEventId,
        automationRuleId: null,
        sequenceEnrollmentId: null,
      });
    });

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(detail?.messages.at(-1)?.displayText).toBe("Following");
    expect(detail?.messages.at(-1)?.eventLabel).toBe("button click");
  });

  it("returns structured outbound button templates for inbox rendering", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "buttons",
    );

    await t.run(async (ctx) => {
      const deliveryAttemptId = await ctx.db.insert("deliveryAttempts", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        automationRuleId: null,
        sequenceEnrollmentId: null,
        status: "sent",
        reason: null,
        requestPayload: JSON.stringify({
          kind: "button_template",
          text: "Right after you follow me, I will send the link.",
          buttons: [
            {
              type: "postback",
              title: "Following",
              payload: "comment_automation:follow_gate",
            },
          ],
        }),
        responsePayload: null,
        policyWindowOpen: true,
        attemptNumber: 1,
        eventTime: BASE_TIME,
        messageText: "Right after you follow me, I will send the link.",
        metaMessageId: null,
      });

      await ctx.db.insert("messages", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        direction: "outbound",
        source: "rule",
        messageType: "text",
        text: "Right after you follow me, I will send the link.",
        metaMessageId: null,
        dedupeKey: `delivery:${deliveryAttemptId}:1`,
        deliveryStatus: "sent",
        eventTime: BASE_TIME,
        webhookEventId: null,
        automationRuleId: null,
        sequenceEnrollmentId: null,
      });
    });

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(detail?.messages.at(-1)?.richContent?.kind).toBe("button_template");
    expect(detail?.messages.at(-1)?.richContent?.actions).toEqual([
      {
        kind: "postback",
        label: "Following",
        url: null,
      },
    ]);
  });

  it("renders attachment-only inbound webhooks with a concrete label", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "attachment",
    );

    await t.run(async (ctx) => {
      const webhookEventId = await ctx.db.insert("webhookEvents", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        eventType: "message",
        deliveryKey: "delivery:attachment:1",
        payload: JSON.stringify({
          sender: { id: "contact_attachment" },
          recipient: { id: "ig_account_1" },
          message: {
            attachments: [{ type: "image" }],
          },
        }),
        receivedAt: BASE_TIME,
        processedAt: BASE_TIME,
        processingStatus: "processed",
        errorMessage: null,
      });

      await ctx.db.insert("messages", {
        workspaceId: fixture.workspaceId,
        instagramAccountId: fixture.instagramAccountId,
        conversationId,
        contactId,
        direction: "inbound",
        source: "webhook",
        messageType: "text",
        text: null,
        metaMessageId: null,
        dedupeKey: "delivery:attachment:1",
        deliveryStatus: "received",
        eventTime: BASE_TIME,
        webhookEventId,
        automationRuleId: null,
        sequenceEnrollmentId: null,
      });
    });

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(detail?.messages.at(-1)?.displayText).toBe("Sent a photo");
    expect(detail?.messages.at(-1)?.eventLabel).toBe("attachment");
  });

  it("stores manual Instagram app replies from echo webhooks without duplicating automation sends", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { conversationId } = await seedContact(t, fixture, "echo");

    await t.mutation(internal.meta.webhooks.ingestWebhookPayload, {
      body: JSON.stringify({
        entry: [
          {
            id: "ig_account_1",
            messaging: [
              {
                sender: { id: "ig_account_1" },
                recipient: { id: "contact_echo" },
                timestamp: BASE_TIME + 60_000,
                message: {
                  mid: "echo_mid_1",
                  text: "Manual reply from Instagram app",
                  is_echo: true,
                },
              },
            ],
          },
        ],
      }),
    });

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(detail?.messages.at(-1)?.direction).toBe("outbound");
    expect(detail?.messages.at(-1)?.displayText).toBe(
      "Manual reply from Instagram app",
    );
  });

  it("imports recent Instagram conversation history from Meta when the inbox opens a thread", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { conversationId } = await seedContact(t, fixture, "history");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "remote_conversation_1" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: {
              data: [
                { id: "msg_3", created_time: BASE_TIME + 120_000 },
                { id: "msg_2", created_time: BASE_TIME + 60_000 },
                { id: "msg_1", created_time: BASE_TIME },
              ],
            },
            id: "remote_conversation_1",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_3",
            created_time: new Date(BASE_TIME + 120_000).toISOString(),
            from: { id: "ig_account_1" },
            message: "Here's your link",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_2",
            created_time: new Date(BASE_TIME + 60_000).toISOString(),
            from: { id: "contact_history" },
            message: "Send me the link",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "msg_1",
            created_time: new Date(BASE_TIME).toISOString(),
            from: { id: "ig_account_1" },
            message: "Please send your email",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const syncResult = await authT.action(
      api.meta.history.syncConversationHistory,
      {
        conversationId,
        force: true,
      },
    );

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(syncResult.importedCount).toBe(3);
    expect(detail?.messages.map((message) => message.displayText)).toEqual([
      "Please send your email",
      "Send me the link",
      "Here's your link",
    ]);
    expect(detail?.messages.map((message) => message.direction)).toEqual([
      "outbound",
      "inbound",
      "outbound",
    ]);
  });

  it("refreshes contact profiles through the Instagram messaging host", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const { contactId } = await seedContact(t, fixture, "profile");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          username: "fresh_profile",
          name: "Fresh Profile",
          profile_pic: "https://lookaside.instagram.test/avatar.jpg",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await t.action(internal.meta.contactProfiles.refreshContactProfile, {
      contactId,
    });

    const fetchInput = fetchMock.mock.calls[0]?.[0];
    const requestUrl = new URL(
      typeof fetchInput === "string"
        ? fetchInput
        : fetchInput instanceof URL
          ? fetchInput.toString()
          : fetchInput.url,
    );
    expect(requestUrl.origin).toBe("https://graph.instagram.com");
    expect(requestUrl.searchParams.get("fields")).toBe(
      "name,username,profile_pic",
    );
    expect(requestUrl.searchParams.get("access_token")).toBe("graph-token");

    const refreshedContact = await t.run((ctx) => ctx.db.get(contactId));
    expect(refreshedContact?.username).toBe("fresh_profile");
    expect(refreshedContact?.displayName).toBe("Fresh Profile");
    expect(refreshedContact?.profilePictureUrl).toBe(
      "https://lookaside.instagram.test/avatar.jpg",
    );
    expect(refreshedContact?.profilePictureFetchedAt).not.toBeNull();
  });

  it("marks the account as needing attention when Meta rejects the token", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const { contactId } = await seedContact(t, fixture, "invalid-token");

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

    await t.action(internal.meta.contactProfiles.refreshContactProfile, {
      contactId,
    });

    const account = await t.run((ctx) =>
      ctx.db.get(fixture.instagramAccountId),
    );
    expect(account?.status).toBe("connection_error");
    expect(account?.lastError).toContain("Dashboard > Account");

    const contact = await t.run((ctx) => ctx.db.get(contactId));
    expect(contact?.profilePictureFetchedAt).not.toBeNull();
  });

  it("returns the most recent 200 conversation messages by event time", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });
    const { contactId, conversationId } = await seedContact(
      t,
      fixture,
      "recent-window",
    );

    await t.run(async (ctx) => {
      for (let index = 0; index < 205; index += 1) {
        await ctx.db.insert("messages", {
          workspaceId: fixture.workspaceId,
          instagramAccountId: fixture.instagramAccountId,
          conversationId,
          contactId,
          direction: "inbound",
          source: "webhook",
          messageType: "text",
          text: `Live ${index}`,
          metaMessageId: `live_${index}`,
          dedupeKey: `live:${index}`,
          deliveryStatus: "received",
          eventTime: BASE_TIME + index * 1_000,
          webhookEventId: null,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
      }

      for (let index = 0; index < 5; index += 1) {
        await ctx.db.insert("messages", {
          workspaceId: fixture.workspaceId,
          instagramAccountId: fixture.instagramAccountId,
          conversationId,
          contactId,
          direction: "inbound",
          source: "webhook",
          messageType: "text",
          text: `History ${index}`,
          metaMessageId: `history_${index}`,
          dedupeKey: `history:${index}`,
          deliveryStatus: "received",
          eventTime: BASE_TIME - (5 - index) * 1_000,
          webhookEventId: null,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
      }
    });

    const detail = await authT.query(api.inbox.getConversationDetail, {
      accountId: fixture.instagramAccountId,
      conversationId,
    });

    expect(detail?.messages).toHaveLength(200);
    expect(detail?.messages[0]?.displayText).toBe("Live 5");
    expect(detail?.messages.at(-1)?.displayText).toBe("Live 204");
    expect(
      detail?.messages.some((message) =>
        message.displayText.startsWith("History"),
      ),
    ).toBe(false);
  });
});
