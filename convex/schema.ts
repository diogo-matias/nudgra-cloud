import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const nullableInstagramAccountId = v.union(v.id("instagramAccounts"), v.null());
const nullableWorkspaceId = v.union(v.id("workspaces"), v.null());
const nullableAutomationRuleId = v.union(v.id("automationRules"), v.null());
const nullableCommentAutomationId = v.union(
  v.id("commentAutomations"),
  v.null(),
);
const nullableStoryAutomationId = v.union(v.id("storyAutomations"), v.null());
const nullableCommentAutomationSessionId = v.union(
  v.id("commentAutomationSessions"),
  v.null(),
);
const nullableStoryAutomationSessionId = v.union(
  v.id("storyAutomationSessions"),
  v.null(),
);
const nullableConversationId = v.union(v.id("conversations"), v.null());
const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);
const nullableContactEmailAutomationKind = v.union(
  v.literal("rule"),
  v.literal("comment_automation"),
  v.literal("story_automation"),
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
const linkButtonValidator = v.object({
  label: v.string(),
  url: v.string(),
});

export default defineSchema({
  ...authTables,
  workspaces: defineTable({
    ownerUserId: v.id("users"),
    name: v.string(),
    timezone: v.string(),
  }).index("by_owner_user_id", ["ownerUserId"]),
  workspaceUserPreferences: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    selectedInstagramAccountId: nullableInstagramAccountId,
  })
    .index("by_workspace_id_and_user_id", ["workspaceId", "userId"])
    .index("by_user_id", ["userId"]),
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
    profilePictureUrl: v.optional(nullableString),
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
    reconnectRequired: v.optional(v.boolean()),
    lastRefreshAttemptAt: v.optional(nullableNumber),
    lastTokenRefreshAt: v.optional(nullableNumber),
    nextRefreshAt: v.optional(nullableNumber),
    refreshFailureCount: v.optional(v.number()),
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
    .index("by_workspace_id_and_instagram_account_id", [
      "workspaceId",
      "instagramAccountId",
    ])
    .index("by_workspace_id_and_status", ["workspaceId", "status"])
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_status", ["status"]),
  contacts: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    instagramUserId: v.string(),
    username: nullableString,
    displayName: nullableString,
    profilePictureUrl: nullableString,
    profilePictureFetchedAt: v.optional(nullableNumber),
    firstInboundAt: v.number(),
    lastInboundAt: v.number(),
    lastMessageAt: v.number(),
  })
    .index("by_workspace_id_and_last_message_at", [
      "workspaceId",
      "lastMessageAt",
    ])
    .index("by_instagram_account_id_and_last_message_at", [
      "instagramAccountId",
      "lastMessageAt",
    ])
    .index("by_instagram_account_id_and_instagram_user_id", [
      "instagramAccountId",
      "instagramUserId",
    ])
    .index("by_workspace_id_and_username", ["workspaceId", "username"]),
  contactEmails: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    contactId: v.id("contacts"),
    email: v.string(),
    firstCollectedAt: v.number(),
    lastCollectedAt: v.number(),
    automationKind: nullableContactEmailAutomationKind,
    automationRuleId: nullableAutomationRuleId,
    commentAutomationId: nullableCommentAutomationId,
    storyAutomationId: nullableStoryAutomationId,
    conversationId: nullableConversationId,
  })
    .index("by_contact_id_and_last_collected_at", [
      "contactId",
      "lastCollectedAt",
    ])
    .index("by_contact_id_and_email", ["contactId", "email"]),
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
    historySyncedAt: v.optional(v.number()),
  })
    .index("by_workspace_id_and_last_message_at", [
      "workspaceId",
      "lastMessageAt",
    ])
    .index("by_instagram_account_id_and_last_message_at", [
      "instagramAccountId",
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
      v.literal("comment_automation"),
      v.literal("story_automation"),
      v.literal("sequence"),
    ),
    messageType: v.union(
      v.literal("text"),
      v.literal("story_reply"),
      v.literal("reaction"),
    ),
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
    storyAutomationId: v.optional(nullableStoryAutomationId),
    sequenceEnrollmentId: nullableSequenceEnrollmentId,
    triggerMessageId: v.optional(nullableString),
    storyReplyStoryId: v.optional(nullableString),
    storyReplyStoryUrl: v.optional(nullableString),
    storyReplyToken: v.optional(nullableString),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_conversation_id_and_event_time", ["conversationId", "eventTime"])
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
    // Deprecated compatibility mirror of the primary DM text.
    replyText: v.string(),
    linkDmText: v.optional(v.string()),
    linkButtons: v.optional(v.array(linkButtonValidator)),
    followGateEnabled: v.optional(v.boolean()),
    followGateText: v.optional(v.string()),
    emailCollectionEnabled: v.optional(v.boolean()),
    emailCollectionText: v.optional(v.string()),
    followUpEnabled: v.optional(v.boolean()),
    followUpText: v.optional(v.string()),
    isActive: v.boolean(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    createdByUserId: v.id("users"),
    triggerCount: v.number(),
    lastTriggeredAt: nullableNumber,
    lastModifiedAt: v.optional(nullableNumber),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_is_active", ["workspaceId", "isActive"])
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_instagram_account_id_and_is_active", [
      "instagramAccountId",
      "isActive",
    ]),
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
    source: v.union(
      v.literal("rule"),
      v.literal("operator"),
      v.literal("story_automation"),
    ),
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
    .index("by_instagram_account_id_and_received_at", [
      "instagramAccountId",
      "receivedAt",
    ])
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
    storyAutomationId: v.optional(nullableStoryAutomationId),
    sequenceEnrollmentId: nullableSequenceEnrollmentId,
    deliveryKind: v.optional(
      v.union(v.literal("response_dm"), v.literal("private_reply")),
    ),
    privateReplyCommentId: v.optional(nullableString),
    privateReplyExpiresAt: v.optional(nullableNumber),
    status: v.union(
      v.literal("queued"),
      v.literal("blocked_auth"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("skipped_expired"),
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
    triggerMessageId: v.optional(nullableString),
  })
    .index("by_workspace_id_and_event_time", ["workspaceId", "eventTime"])
    .index("by_conversation_id_and_event_time", ["conversationId", "eventTime"])
    .index("by_contact_id", ["contactId"])
    .index("by_status", ["status"])
    .index("by_instagram_account_id_and_event_time", [
      "instagramAccountId",
      "eventTime",
    ])
    .index("by_instagram_account_id_and_status_and_event_time", [
      "instagramAccountId",
      "status",
      "eventTime",
    ]),
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
    .index("by_instagram_account_id_and_status", [
      "instagramAccountId",
      "status",
    ])
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
    triggerKeywordLabels: v.optional(v.array(v.string())),

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
    linkButtonText: v.optional(v.string()),
    linkButtons: v.optional(v.array(linkButtonValidator)),

    // DM flow — follow-up if they don't click
    followUpEnabled: v.boolean(),
    followUpText: v.string(),

    nextPostActivatedAt: v.optional(nullableNumber),
    nextLockedMediaId: v.optional(nullableString),
    nextLockedAt: v.optional(nullableNumber),
    guardrailTrippedAt: v.optional(nullableNumber),
    guardrailReason: v.optional(nullableString),
    guardrailSessionId: v.optional(nullableCommentAutomationSessionId),
    guardrailConversationId: v.optional(nullableConversationId),

    // Stats
    triggerCount: v.number(),
    lastTriggeredAt: nullableNumber,
    lastModifiedAt: v.optional(nullableNumber),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_status", ["workspaceId", "status"])
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_instagram_account_id_and_status", [
      "instagramAccountId",
      "status",
    ]),

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
  instagramStories: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    storyId: v.string(),
    mediaType: v.string(),
    thumbnailUrl: nullableString,
    mediaUrl: nullableString,
    permalink: nullableString,
    timestamp: v.string(),
    expiresAt: v.number(),
    fetchedAt: v.number(),
  })
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_story_id", ["storyId"])
    .index("by_instagram_account_id_and_story_id", [
      "instagramAccountId",
      "storyId",
    ]),

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
      v.literal("guardrail_tripped"),
      v.literal("completed"),
    ),
    collectedEmail: nullableString,
    commentId: nullableString,
    mediaId: nullableString,
    startedAt: v.number(),
    lastStepAt: v.number(),
    outboundMessageCount: v.optional(v.number()),
    followGateInputMode: v.optional(
      v.union(v.literal("button"), v.literal("reply"), v.null()),
    ),
    lastInboundDeliveryKey: v.optional(nullableString),
    guardrailTrippedAt: v.optional(nullableNumber),
    guardrailReason: v.optional(nullableString),
    linkSentAt: v.optional(nullableNumber),
    linkClickedAt: v.optional(nullableNumber),
    followUpScheduledAt: v.optional(nullableNumber),
    followUpSentAt: v.optional(nullableNumber),
  })
    .index("by_comment_automation_id", ["commentAutomationId"])
    .index("by_contact_id_and_comment_automation_id", [
      "contactId",
      "commentAutomationId",
    ])
    .index("by_conversation_id", ["conversationId"])
    .index("by_workspace_id_and_last_step_at", ["workspaceId", "lastStepAt"])
    .index("by_instagram_account_id_and_last_step_at", [
      "instagramAccountId",
      "lastStepAt",
    ]),
  commentAutomationTrackedLinks: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    commentAutomationId: nullableCommentAutomationId,
    sessionId: v.id("commentAutomationSessions"),
    token: v.string(),
    destinationUrl: v.string(),
    label: v.string(),
    buttonIndex: v.number(),
    clickedAt: nullableNumber,
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_session_id", ["sessionId"]),
  storyAutomations: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    createdByUserId: v.id("users"),
    name: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("paused")),
    storyScope: v.union(v.literal("any"), v.literal("specific")),
    selectedStoryId: nullableString,
    selectedStoryMediaType: v.optional(nullableString),
    selectedStoryThumbnailUrl: v.optional(nullableString),
    selectedStoryMediaUrl: v.optional(nullableString),
    selectedStoryPermalink: v.optional(nullableString),
    selectedStoryTimestamp: v.optional(nullableString),
    replyFilter: v.union(
      v.literal("specific_words_or_reactions"),
      v.literal("any_word_or_reaction"),
    ),
    triggerTokens: v.array(v.string()),
    triggerTokenLabels: v.optional(v.array(v.string())),
    reactionEnabled: v.boolean(),
    followGateEnabled: v.boolean(),
    followGateText: v.string(),
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),
    linkDmText: v.string(),
    linkUrl: v.string(),
    linkButtonText: v.optional(v.string()),
    linkButtons: v.optional(v.array(linkButtonValidator)),
    followUpEnabled: v.boolean(),
    followUpText: v.string(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    selectedStoryExpiredAt: v.optional(nullableNumber),
    selectedStoryExpiredReason: v.optional(nullableString),
    guardrailTrippedAt: v.optional(nullableNumber),
    guardrailReason: v.optional(nullableString),
    guardrailSessionId: v.optional(nullableStoryAutomationSessionId),
    guardrailConversationId: v.optional(nullableConversationId),
    triggerCount: v.number(),
    lastTriggeredAt: nullableNumber,
    lastModifiedAt: v.optional(nullableNumber),
  })
    .index("by_workspace_id", ["workspaceId"])
    .index("by_workspace_id_and_status", ["workspaceId", "status"])
    .index("by_instagram_account_id", ["instagramAccountId"])
    .index("by_instagram_account_id_and_status", [
      "instagramAccountId",
      "status",
    ]),
  storyAutomationSessions: defineTable({
    workspaceId: v.id("workspaces"),
    storyAutomationId: v.id("storyAutomations"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    instagramAccountId: v.id("instagramAccounts"),
    currentStep: v.union(
      v.literal("follow_gate_sent"),
      v.literal("awaiting_follow"),
      v.literal("email_requested"),
      v.literal("awaiting_email"),
      v.literal("link_sent"),
      v.literal("guardrail_tripped"),
      v.literal("completed"),
    ),
    collectedEmail: nullableString,
    triggerMessageId: nullableString,
    storyId: nullableString,
    storyUrl: nullableString,
    storyToken: nullableString,
    startedAt: v.number(),
    lastStepAt: v.number(),
    outboundMessageCount: v.optional(v.number()),
    followGateInputMode: v.optional(
      v.union(v.literal("button"), v.literal("reply"), v.null()),
    ),
    lastInboundDeliveryKey: v.optional(nullableString),
    guardrailTrippedAt: v.optional(nullableNumber),
    guardrailReason: v.optional(nullableString),
    linkSentAt: v.optional(nullableNumber),
    linkClickedAt: v.optional(nullableNumber),
    followUpScheduledAt: v.optional(nullableNumber),
    followUpSentAt: v.optional(nullableNumber),
    reactionSentAt: v.optional(nullableNumber),
  })
    .index("by_story_automation_id", ["storyAutomationId"])
    .index("by_contact_id_and_story_automation_id", [
      "contactId",
      "storyAutomationId",
    ])
    .index("by_conversation_id", ["conversationId"])
    .index("by_workspace_id_and_last_step_at", ["workspaceId", "lastStepAt"])
    .index("by_instagram_account_id_and_last_step_at", [
      "instagramAccountId",
      "lastStepAt",
    ]),
  storyAutomationTrackedLinks: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    storyAutomationId: nullableStoryAutomationId,
    sessionId: v.id("storyAutomationSessions"),
    token: v.string(),
    destinationUrl: v.string(),
    label: v.string(),
    buttonIndex: v.number(),
    clickedAt: nullableNumber,
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_session_id", ["sessionId"]),
  automationRuleSessions: defineTable({
    workspaceId: v.id("workspaces"),
    automationRuleId: v.id("automationRules"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    instagramAccountId: v.id("instagramAccounts"),
    currentStep: v.union(
      v.literal("follow_gate_sent"),
      v.literal("awaiting_follow"),
      v.literal("email_requested"),
      v.literal("awaiting_email"),
      v.literal("link_sent"),
      v.literal("guardrail_tripped"),
      v.literal("completed"),
    ),
    collectedEmail: nullableString,
    startedAt: v.number(),
    lastStepAt: v.number(),
    outboundMessageCount: v.optional(v.number()),
    followGateInputMode: v.optional(
      v.union(v.literal("button"), v.literal("reply"), v.null()),
    ),
    lastInboundDeliveryKey: v.optional(nullableString),
    guardrailTrippedAt: v.optional(nullableNumber),
    guardrailReason: v.optional(nullableString),
    linkSentAt: v.optional(nullableNumber),
    linkClickedAt: v.optional(nullableNumber),
    followUpScheduledAt: v.optional(nullableNumber),
    followUpSentAt: v.optional(nullableNumber),
  })
    .index("by_automation_rule_id", ["automationRuleId"])
    .index("by_contact_id_and_automation_rule_id", [
      "contactId",
      "automationRuleId",
    ])
    .index("by_conversation_id", ["conversationId"])
    .index("by_workspace_id_and_last_step_at", ["workspaceId", "lastStepAt"])
    .index("by_instagram_account_id_and_last_step_at", [
      "instagramAccountId",
      "lastStepAt",
    ]),
  automationRuleTrackedLinks: defineTable({
    workspaceId: v.id("workspaces"),
    instagramAccountId: v.id("instagramAccounts"),
    automationRuleId: nullableAutomationRuleId,
    sessionId: v.id("automationRuleSessions"),
    token: v.string(),
    destinationUrl: v.string(),
    label: v.string(),
    buttonIndex: v.number(),
    clickedAt: nullableNumber,
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_session_id", ["sessionId"]),
  contactAutomationMemberships: defineTable({
    workspaceId: v.id("workspaces"),
    contactId: v.id("contacts"),
    conversationId: v.id("conversations"),
    automationKind: v.union(
      v.literal("rule"),
      v.literal("comment_automation"),
      v.literal("story_automation"),
      v.literal("sequence"),
    ),
    automationRuleId: nullableAutomationRuleId,
    commentAutomationId: nullableCommentAutomationId,
    storyAutomationId: v.optional(nullableStoryAutomationId),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    firstMatchedAt: v.number(),
    lastMatchedAt: v.number(),
  })
    .index("by_contact_id_and_last_matched_at", ["contactId", "lastMatchedAt"])
    .index("by_workspace_id_and_rule_id", ["workspaceId", "automationRuleId"])
    .index("by_workspace_id_and_comment_automation_id", [
      "workspaceId",
      "commentAutomationId",
    ])
    .index("by_workspace_id_and_story_automation_id", [
      "workspaceId",
      "storyAutomationId",
    ])
    .index("by_workspace_id_and_sequence_definition_id", [
      "workspaceId",
      "sequenceDefinitionId",
    ])
    .index("by_contact_and_kind_and_rule_and_comment_and_story_and_sequence", [
      "contactId",
      "automationKind",
      "automationRuleId",
      "commentAutomationId",
      "storyAutomationId",
      "sequenceDefinitionId",
    ]),
});
