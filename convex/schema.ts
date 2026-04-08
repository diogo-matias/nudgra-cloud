import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const nullableInstagramAccountId = v.union(v.id("instagramAccounts"), v.null());
const nullableWorkspaceId = v.union(v.id("workspaces"), v.null());
const nullableAutomationRuleId = v.union(v.id("automationRules"), v.null());
const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);
const nullableSequenceEnrollmentId = v.union(
  v.id("sequenceEnrollments"),
  v.null(),
);

const sequenceStepValidator = v.object({
  delayMinutes: v.number(),
  messageText: v.string(),
});

export default defineSchema({
  ...authTables,
  workspaces: defineTable({
    ownerUserId: v.id("users"),
    name: v.string(),
    timezone: v.string(),
  }).index("by_owner_user_id", ["ownerUserId"]),
  instagramConnectSessions: defineTable({
    workspaceId: v.id("workspaces"),
    createdByUserId: v.id("users"),
    state: v.string(),
    redirectUri: v.string(),
    requestedScopes: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    expiresAt: v.number(),
    errorMessage: nullableString,
  })
    .index("by_state", ["state"])
    .index("by_workspace_id", ["workspaceId"]),
  instagramAccounts: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.string(),
    metaUserId: nullableString,
    username: nullableString,
    name: nullableString,
    accountType: v.union(
      v.literal("business"),
      v.literal("creator"),
      v.literal("unknown"),
    ),
    status: v.union(
      v.literal("connected"),
      v.literal("connection_error"),
      v.literal("disconnected"),
    ),
    graphAccessToken: nullableString,
    tokenExpiresAt: nullableNumber,
    scopes: v.array(v.string()),
    webhookSubscriptionStatus: v.union(
      v.literal("active"),
      v.literal("failed"),
      v.literal("disabled"),
    ),
    lastWebhookAt: nullableNumber,
    lastError: nullableString,
    connectedAt: nullableNumber,
    disconnectedAt: nullableNumber,
    graphApiVersion: v.string(),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_status", ["status"]),
  contacts: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    instagramUserId: v.string(),
    username: nullableString,
    displayName: nullableString,
    profilePictureUrl: nullableString,
    firstInboundAt: v.number(),
    lastInboundAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_workspace_id_and_last_message_at", [
      "workspaceId",
      "lastMessageAt",
    ])
    .index("by_instagram_account_id_and_instagram_user_id", [
      "instagramAccountId",
      "instagramUserId",
    ])
    .index("by_workspace_id_and_username", ["workspaceId", "username"]),
  conversations: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
    conversationKey: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("window_closed"),
      v.literal("paused"),
    ),
    startedAt: v.number(),
    lastMessageAt: v.number(),
    lastInboundAt: nullableNumber,
    lastOutboundAt: nullableNumber,
    lastMessagePreview: nullableString,
    messagingWindowClosesAt: nullableNumber,
    lastAutomationRuleId: nullableAutomationRuleId,
  })
    .index("by_workspace_id_and_last_message_at", [
      "workspaceId",
      "lastMessageAt",
    ])
    .index("by_contact_id", ["contactId"])
    .index("by_instagram_account_id_and_contact_id", [
      "instagramAccountId",
      "contactId",
    ]),
  messages: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    conversationId: v.id("conversations"),
    contactId: v.id("contacts"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    source: v.union(
      v.literal("webhook"),
      v.literal("rule"),
      v.literal("sequence"),
    ),
    messageType: v.union(v.literal("text"), v.literal("story_reply")),
    text: nullableString,
    metaMessageId: nullableString,
    dedupeKey: v.string(),
    deliveryStatus: v.union(
      v.literal("received"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    eventTime: v.number(),
    webhookEventId: v.union(v.id("webhookEvents"), v.null()),
    automationRuleId: nullableAutomationRuleId,
    sequenceEnrollmentId: nullableSequenceEnrollmentId,
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_contact_id", ["contactId"])
    .index("by_meta_message_id", ["metaMessageId"])
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_workspace_id_and_event_time", ["workspaceId", "eventTime"]),
  automationRules: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("story_reply")),
    matchType: v.union(v.literal("contains"), v.literal("exact")),
    keywords: v.array(v.string()),
    replyText: v.string(),
    isActive: v.boolean(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    createdByUserId: v.id("users"),
    triggerCount: v.number(),
    lastTriggeredAt: nullableNumber,
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_is_active", ["workspaceId", "isActive"]),
  tags: defineTable({
    workspaceId: v.id("workspaces"),
    label: v.string(),
    color: v.string(),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_label", ["workspaceId", "label"]),
  contactTags: defineTable({
    workspaceId: v.id("workspaces"),
    contactId: v.id("contacts"),
    tagId: v.id("tags"),
    source: v.union(v.literal("rule"), v.literal("operator")),
    appliedAt: v.number(),
  })
    .index("by_contact_id_and_tag_id", ["contactId", "tagId"])
    .index("by_contact_id", ["contactId"]),
  webhookEvents: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    eventType: v.string(),
    deliveryKey: v.string(),
    payload: v.string(),
    receivedAt: v.number(),
    processedAt: nullableNumber,
    processingStatus: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    errorMessage: nullableString,
  })
    .index("by_delivery_key", ["deliveryKey"])
    .index("by_workspace_id_and_received_at", ["workspaceId", "receivedAt"])
    .index("by_instagram_account_id_and_received_at", [
      "instagramAccountId",
      "receivedAt",
    ]),
  webhookReceipts: defineTable({
    workspaceId: nullableWorkspaceId,
    instagramAccountId: nullableInstagramAccountId,
    instagramAccountExternalId: v.string(),
    sourceObject: nullableString,
    payload: v.string(),
    receivedAt: v.number(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("invalid_json"),
      v.literal("unmatched_account"),
    ),
    processedCount: v.number(),
    ignoredCount: v.number(),
    note: nullableString,
  })
    .index("by_received_at", ["receivedAt"])
    .index("by_instagram_account_external_id_and_received_at", [
      "instagramAccountExternalId",
      "receivedAt",
    ]),
  deliveryAttempts: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    conversationId: v.id("conversations"),
    contactId: v.id("contacts"),
    automationRuleId: nullableAutomationRuleId,
    sequenceEnrollmentId: nullableSequenceEnrollmentId,
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    reason: nullableString,
    requestPayload: nullableString,
    responsePayload: nullableString,
    policyWindowOpen: v.boolean(),
    attemptNumber: v.number(),
    eventTime: v.number(),
    messageText: v.string(),
    metaMessageId: nullableString,
  })
    .index("by_workspace_id_and_event_time", ["workspaceId", "eventTime"])
    .index("by_contact_id", ["contactId"])
    .index("by_status", ["status"]),
  sequenceDefinitions: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    isActive: v.boolean(),
    steps: v.array(sequenceStepValidator),
  }).index("by_workspace_id", ["workspaceId"]),
  sequenceEnrollments: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    sequenceDefinitionId: v.id("sequenceDefinitions"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("stopped"),
    ),
    currentStepIndex: v.number(),
    nextRunAt: nullableNumber,
    enrolledAt: v.number(),
    lastProcessedAt: nullableNumber,
    stopReason: nullableString,
  })
    .index("by_workspace_id_and_status", ["workspaceId", "status"])
    .index("by_next_run_at", ["nextRunAt"])
    .index("by_contact_id", ["contactId"]),

  // ── Comment-based automations ──────────────────────────────────

  commentAutomations: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    createdByUserId: v.id("users"),
    name: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("paused")),

    // Trigger: which posts to watch
    postScope: v.union(
      v.literal("specific"),
      v.literal("any"),
      v.literal("next"),
    ),
    selectedMediaIds: v.array(v.string()),

    // Comment filter
    commentFilter: v.union(v.literal("specific_words"), v.literal("any_word")),
    triggerKeywords: v.array(v.string()),

    // Comment reply (optional auto-reply under the post)
    commentReplyEnabled: v.boolean(),
    commentReplyTexts: v.array(v.string()),

    // DM flow — opening message
    openingDmEnabled: v.boolean(),
    openingDmText: v.string(),
    openingDmButtonText: v.string(),

    // DM flow — follow gate
    followGateEnabled: v.boolean(),
    followGateText: v.string(),

    // DM flow — email collection
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),

    // DM flow — final link delivery
    linkDmText: v.string(),
    linkUrl: v.string(),

    // DM flow — follow-up if they don't click
    followUpEnabled: v.boolean(),
    followUpText: v.string(),

    // Stats
    triggerCount: v.number(),
    lastTriggeredAt: nullableNumber,
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_status", ["workspaceId", "status"]),

  instagramMedia: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    mediaId: v.string(),
    mediaType: v.string(),
    thumbnailUrl: nullableString,
    mediaUrl: nullableString,
    caption: nullableString,
    timestamp: v.string(),
    permalink: nullableString,
    fetchedAt: v.number(),
  })
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_media_id", ["mediaId"]),

  commentAutomationSessions: defineTable({
    workspaceId: v.id("workspaces"),
    commentAutomationId: v.id("commentAutomations"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    instagramAccountId: v.id("instagramAccounts"),
    currentStep: v.union(
      v.literal("opening_dm_sent"),
      v.literal("awaiting_button_click"),
      v.literal("follow_gate_sent"),
      v.literal("awaiting_follow"),
      v.literal("email_requested"),
      v.literal("awaiting_email"),
      v.literal("link_sent"),
      v.literal("completed"),
    ),
    collectedEmail: nullableString,
    commentId: nullableString,
    mediaId: nullableString,
    startedAt: v.number(),
    lastStepAt: v.number(),
  })
    .index("by_comment_automation_id", ["commentAutomationId"])
    .index("by_contact_id_and_comment_automation_id", [
      "contactId",
      "commentAutomationId",
    ])
    .index("by_conversation_id", ["conversationId"]),
});
