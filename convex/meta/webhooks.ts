import { internal } from "../_generated/api";
import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { createSequenceEnrollment } from "../automations/sequences";
import {
  makeMessagePreview,
  matchesAutomationRule,
} from "../automations/shared";
import { advanceCommentAutomationSession } from "../automations/commentFlow";
import {
  advanceStoryAutomationSession,
  startStoryAutomationSession,
} from "../automations/storyFlow";
import { advanceFollowerAutomationSession } from "../automations/followerFlow";
import {
  advanceRuleAutomationSession,
  startRuleAutomationSession,
} from "../automations/ruleFlow";
import {
  matchesStoryAutomation,
  normalizeStoryReplyToken,
} from "../automations/storyShared";
import { Doc, Id } from "../_generated/dataModel";

type MessagingItem = {
  sender?: { id?: string; username?: string; name?: string };
  recipient?: { id?: string };
  timestamp?: number;
  time?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    reply_to?: unknown;
    quick_reply?: {
      payload?: string;
    };
    attachments?: Array<{
      type?: string;
      payload?: {
        url?: string;
      };
    }>;
  };
  postback?: {
    title?: string;
    payload?: string;
    mid?: string;
  };
};

type WebhookReceiptStatus =
  | "received"
  | "processed"
  | "ignored"
  | "invalid_json"
  | "unmatched_account";

const CONTACT_PROFILE_REFRESH_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;

function stringifyPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ error: "Could not serialize payload" });
  }
}

function getMessagingItems(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [] as Array<{
      instagramAccountExternalId: string;
      item: MessagingItem;
    }>;
  }

  const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];

  const items: Array<{
    instagramAccountExternalId: string;
    item: MessagingItem;
  }> = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const instagramAccountExternalId = String(
      (entry as { id?: string }).id ??
        (entry as { recipient?: { id?: string } }).recipient?.id ??
        "",
    );
    if (!instagramAccountExternalId) {
      continue;
    }

    const messaging = Array.isArray(
      (entry as { messaging?: unknown[] }).messaging,
    )
      ? (entry as { messaging: unknown[] }).messaging
      : [];

    for (const item of messaging) {
      if (!item || typeof item !== "object") {
        continue;
      }

      items.push({
        instagramAccountExternalId,
        item: item as MessagingItem,
      });
    }
  }

  return items;
}

function getWebhookExternalAccountId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
    ? (payload as { entry: unknown[] }).entry
    : [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const externalId = String(
      (entry as { id?: string }).id ??
        (entry as { recipient?: { id?: string } }).recipient?.id ??
        "",
    );

    if (externalId) {
      return externalId;
    }
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === "string" && current.trim().length > 0
    ? current.trim()
    : null;
}

function parseStoryReplyMetadata(args: {
  replyTo: unknown;
  rawText: string | null;
}) {
  const storyId =
    getNestedString(args.replyTo, ["story", "id"]) ??
    getNestedString(args.replyTo, ["story", "story_id"]) ??
    getNestedString(args.replyTo, ["story_id"]) ??
    getNestedString(args.replyTo, ["storyId"]) ??
    getNestedString(args.replyTo, ["id"]);
  const storyUrl =
    getNestedString(args.replyTo, ["story", "permalink"]) ??
    getNestedString(args.replyTo, ["story", "url"]) ??
    getNestedString(args.replyTo, ["permalink"]) ??
    getNestedString(args.replyTo, ["url"]);
  const replyToken = args.rawText
    ? normalizeStoryReplyToken(args.rawText)
    : null;

  return {
    storyId,
    storyUrl,
    replyToken: replyToken && replyToken.length > 0 ? replyToken : null,
  };
}

function humanizeInteractionPayload(payload: string) {
  if (payload === "comment_automation:opening_dm") {
    return "Send me the link";
  }

  if (payload === "comment_automation:follow_gate") {
    return "Following";
  }

  return payload
    .split(/[:_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function describeAttachmentType(type: string | undefined) {
  switch (type) {
    case "image":
      return "Sent a photo";
    case "video":
      return "Sent a video";
    case "audio":
      return "Sent a voice message";
    case "file":
      return "Sent a file";
    case "story_share":
      return "Shared your story";
    case "fallback":
      return "Sent an attachment";
    default:
      return "Sent an attachment";
  }
}

function describeInboundInteraction(item: MessagingItem, rawText: string | null) {
  const postbackTitle = item.postback?.title?.trim() || null;
  const postbackPayload = item.postback?.payload?.trim() || null;
  const quickReplyPayload = item.message?.quick_reply?.payload?.trim() || null;
  const firstAttachmentType = item.message?.attachments?.[0]?.type;

  if (postbackTitle) {
    return postbackTitle;
  }

  if (postbackPayload) {
    return humanizeInteractionPayload(postbackPayload);
  }

  if (quickReplyPayload && rawText) {
    return rawText;
  }

  if (quickReplyPayload) {
    return humanizeInteractionPayload(quickReplyPayload);
  }

  if (firstAttachmentType) {
    return describeAttachmentType(firstAttachmentType);
  }

  return rawText;
}

function shouldRefreshContactProfile(
  contact:
    | {
        profilePictureUrl: string | null;
        profilePictureFetchedAt?: number | null;
      }
    | null,
  now: number,
) {
  if (contact === null) {
    return true;
  }

  if (
    contact.profilePictureFetchedAt === undefined ||
    contact.profilePictureFetchedAt === null
  ) {
    return true;
  }

  return now - contact.profilePictureFetchedAt > CONTACT_PROFILE_REFRESH_INTERVAL_MS;
}

type StoryReplyMetadata = ReturnType<typeof parseStoryReplyMetadata>;

type InboundInteraction = {
  hasMessage: boolean;
  text: string | null;
  postbackPayload: string | null;
  quickReplyPayload: string | null;
  deliveryKey: string;
};

type PersistedConversationContext = {
  contactId: Id<"contacts">;
  conversationId: Id<"conversations">;
  existingContact:
    | {
        profilePictureUrl: string | null;
        profilePictureFetchedAt?: number | null;
      }
    | null;
};

async function findInstagramAccountByExternalId(
  ctx: MutationCtx,
  instagramAccountExternalId: string,
) {
  return await ctx.db
    .query("instagramAccounts")
    .withIndex("by_instagram_account_id", (q) =>
      q.eq("instagramAccountId", instagramAccountExternalId),
    )
    .unique();
}

function buildInboundInteraction(args: {
  hasMessage: boolean;
  rawText: string | null;
  item: MessagingItem;
  deliveryKey: string;
}): InboundInteraction {
  return {
    hasMessage: args.hasMessage,
    text: args.rawText,
    postbackPayload:
      typeof args.item.postback?.payload === "string"
        ? args.item.postback.payload.trim()
        : null,
    quickReplyPayload:
      typeof args.item.message?.quick_reply?.payload === "string"
        ? args.item.message.quick_reply.payload.trim()
        : null,
    deliveryKey: args.deliveryKey,
  };
}

async function applyContactTagsIfMissing(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    contactId: Id<"contacts">;
    tagIds: Id<"tags">[];
    source: Doc<"contactTags">["source"];
    appliedAt: number;
  },
) {
  for (const tagId of args.tagIds) {
    const existingContactTag = await ctx.db
      .query("contactTags")
      .withIndex("by_contact_id_and_tag_id", (q) =>
        q.eq("contactId", args.contactId).eq("tagId", tagId),
      )
      .unique();

    if (existingContactTag !== null) {
      continue;
    }

    await ctx.db.insert("contactTags", {
      workspaceId: args.workspaceId,
      contactId: args.contactId,
      tagId,
      source: args.source,
      appliedAt: args.appliedAt,
    });
  }
}

async function upsertContactAndConversation(
  ctx: MutationCtx,
  args: {
    account: Doc<"instagramAccounts">;
    contactInstagramUserId: string;
    contactUsername: string | null;
    contactDisplayName: string | null;
    displayText: string | null;
    messageTime: number;
    isEcho: boolean;
  },
): Promise<PersistedConversationContext> {
  const existingContact = await ctx.db
    .query("contacts")
    .withIndex("by_instagram_account_id_and_instagram_user_id", (q) =>
      q
        .eq("instagramAccountId", args.account._id)
        .eq("instagramUserId", args.contactInstagramUserId),
    )
    .unique();

  const contactId =
    existingContact?._id ??
    (await ctx.db.insert("contacts", {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      instagramUserId: args.contactInstagramUserId,
      username: args.contactUsername,
      displayName: args.contactDisplayName,
      profilePictureUrl: null,
      firstInboundAt: args.messageTime,
      lastInboundAt: args.messageTime,
      lastMessageAt: args.messageTime,
      profilePictureFetchedAt: null,
    }));

  if (existingContact) {
    await ctx.db.patch(existingContact._id, {
      username: args.contactUsername ?? existingContact.username,
      displayName: args.contactDisplayName ?? existingContact.displayName,
      lastInboundAt: args.isEcho
        ? existingContact.lastInboundAt
        : Math.max(existingContact.lastInboundAt, args.messageTime),
      lastMessageAt: Math.max(existingContact.lastMessageAt, args.messageTime),
    });
  }

  const existingConversation = await ctx.db
    .query("conversations")
    .withIndex("by_instagram_account_id_and_contact_id", (q) =>
      q.eq("instagramAccountId", args.account._id).eq("contactId", contactId),
    )
    .unique();

  const conversationId =
    existingConversation?._id ??
    (await ctx.db.insert("conversations", {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      contactId,
      conversationKey: `${args.account.instagramAccountId}:${args.contactInstagramUserId}`,
      status: "active",
      startedAt: args.messageTime,
      lastMessageAt: args.messageTime,
      lastInboundAt: args.isEcho ? null : args.messageTime,
      lastOutboundAt: args.isEcho ? args.messageTime : null,
      lastMessagePreview: makeMessagePreview(args.displayText),
      messagingWindowClosesAt: args.isEcho
        ? null
        : args.messageTime + 24 * 60 * 60 * 1000,
      lastAutomationRuleId: null,
    }));

  if (existingConversation) {
    await ctx.db.patch(existingConversation._id, {
      status: "active",
      lastMessageAt: Math.max(existingConversation.lastMessageAt, args.messageTime),
      lastInboundAt: args.isEcho
        ? existingConversation.lastInboundAt
        : existingConversation.lastInboundAt === null
          ? args.messageTime
          : Math.max(existingConversation.lastInboundAt, args.messageTime),
      lastOutboundAt: args.isEcho
        ? existingConversation.lastOutboundAt === null
          ? args.messageTime
          : Math.max(existingConversation.lastOutboundAt, args.messageTime)
        : existingConversation.lastOutboundAt,
      lastMessagePreview:
        args.messageTime >= existingConversation.lastMessageAt
          ? makeMessagePreview(args.displayText)
          : existingConversation.lastMessagePreview,
      messagingWindowClosesAt: args.isEcho
        ? existingConversation.messagingWindowClosesAt
        : args.messageTime + 24 * 60 * 60 * 1000,
    });
  }

  return {
    contactId,
    conversationId,
    existingContact,
  };
}

async function ensureWebhookMessageRecorded(
  ctx: MutationCtx,
  args: {
    account: Doc<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    webhookEventId: Id<"webhookEvents">;
    deliveryKey: string;
    metaMessageId: string | null;
    direction: "inbound" | "outbound";
    displayText: string | null;
    messageTime: number;
    isEcho: boolean;
    isStoryReply: boolean;
    storyReplyMetadata: StoryReplyMetadata;
  },
) {
  const existingMessage =
    (args.metaMessageId === null
      ? null
      : await ctx.db
          .query("messages")
          .withIndex("by_meta_message_id", (q) =>
            q.eq("metaMessageId", args.metaMessageId),
          )
          .unique()) ??
    (await ctx.db
      .query("messages")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.deliveryKey))
      .unique());

  if (existingMessage !== null) {
    return;
  }

  await ctx.db.insert("messages", {
    workspaceId: args.account.workspaceId,
    instagramAccountId: args.account._id,
    conversationId: args.conversationId,
    contactId: args.contactId,
    direction: args.direction,
    source: "webhook",
    messageType: args.isStoryReply ? "story_reply" : "text",
    text: args.displayText,
    metaMessageId: args.metaMessageId,
    dedupeKey: args.deliveryKey,
    deliveryStatus: args.isEcho ? "sent" : "received",
    eventTime: args.messageTime,
    webhookEventId: args.webhookEventId,
    automationRuleId: null,
    storyAutomationId: null,
    sequenceEnrollmentId: null,
    storyReplyStoryId: args.storyReplyMetadata.storyId,
    storyReplyStoryUrl: args.storyReplyMetadata.storyUrl,
    storyReplyToken: args.storyReplyMetadata.replyToken,
  });
}

async function continueActiveAutomationSessions(
  ctx: MutationCtx,
  args: {
    conversationId: Id<"conversations">;
    isEcho: boolean;
    inboundInteraction: InboundInteraction;
  },
) {
  if (args.isEcho) {
    return false;
  }

  const activeFollowerSession = (
    await ctx.db
      .query("followerAutomationSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(10)
  ).find(
    (session) =>
      session.currentStep !== "completed" &&
      session.currentStep !== "link_sent" &&
      session.currentStep !== "guardrail_tripped",
  );

  if (activeFollowerSession) {
    await advanceFollowerAutomationSession(ctx, activeFollowerSession._id, {
      text: args.inboundInteraction.text,
    });
    return true;
  }

  const activeStorySession = (
    await ctx.db
      .query("storyAutomationSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(10)
  ).find(
    (session) =>
      session.currentStep !== "completed" &&
      session.currentStep !== "link_sent" &&
      session.currentStep !== "guardrail_tripped",
  );

  if (activeStorySession) {
    const sessionAutomation = await ctx.db.get(activeStorySession.storyAutomationId);

    if (sessionAutomation?.followGateEnabled) {
      await ctx.scheduler.runAfter(
        0,
        internal.automations.storyFlow.processInboundStoryAutomationInteraction,
        {
          sessionId: activeStorySession._id,
          ...args.inboundInteraction,
        },
      );
    } else {
      await advanceStoryAutomationSession(ctx, activeStorySession._id, {
        hasMessage: args.inboundInteraction.hasMessage,
        text: args.inboundInteraction.text,
        postbackPayload: args.inboundInteraction.postbackPayload,
        quickReplyPayload: args.inboundInteraction.quickReplyPayload,
      });
    }

    return true;
  }

  const activeRuleSession = (
    await ctx.db
      .query("automationRuleSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(10)
  ).find(
    (session) =>
      session.currentStep !== "completed" &&
      session.currentStep !== "link_sent" &&
      session.currentStep !== "guardrail_tripped",
  );

  if (activeRuleSession) {
    const sessionRule = await ctx.db.get(activeRuleSession.automationRuleId);

    if (sessionRule?.followGateEnabled) {
      await ctx.scheduler.runAfter(
        0,
        internal.automations.ruleFlow.processInboundRuleAutomationInteraction,
        {
          sessionId: activeRuleSession._id,
          ...args.inboundInteraction,
        },
      );
    } else {
      await advanceRuleAutomationSession(ctx, activeRuleSession._id, {
        hasMessage: args.inboundInteraction.hasMessage,
        text: args.inboundInteraction.text,
        postbackPayload: args.inboundInteraction.postbackPayload,
        quickReplyPayload: args.inboundInteraction.quickReplyPayload,
      });
    }

    return true;
  }

  const activeCommentSession = (
    await ctx.db
      .query("commentAutomationSessions")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(10)
  ).find(
    (session) =>
      session.currentStep !== "completed" &&
      session.currentStep !== "link_sent" &&
      session.currentStep !== "guardrail_tripped",
  );

  if (!activeCommentSession) {
    return false;
  }

  const sessionAutomation = await ctx.db.get(activeCommentSession.commentAutomationId);

  if (sessionAutomation?.followGateEnabled) {
    await ctx.scheduler.runAfter(
      0,
      internal.automations.commentFlow.processInboundCommentAutomationInteraction,
      {
        sessionId: activeCommentSession._id,
        ...args.inboundInteraction,
      },
    );
  } else {
    await advanceCommentAutomationSession(ctx, activeCommentSession._id, {
      hasMessage: args.inboundInteraction.hasMessage,
      text: args.inboundInteraction.text,
      postbackPayload: args.inboundInteraction.postbackPayload,
      quickReplyPayload: args.inboundInteraction.quickReplyPayload,
    });
  }

  return true;
}

async function matchAndStartStoryAutomation(
  ctx: MutationCtx,
  args: {
    account: Doc<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    messageTime: number;
    metaMessageId: string | null;
    isEcho: boolean;
    isPostback: boolean;
    isQuickReply: boolean;
    isStoryReply: boolean;
    storyReplyMetadata: StoryReplyMetadata;
  },
) {
  const liveStoryAutomations =
    !args.isEcho && !args.isPostback && !args.isQuickReply && args.isStoryReply
      ? await ctx.db
          .query("storyAutomations")
          .withIndex("by_instagram_account_id_and_status", (q) =>
            q.eq("instagramAccountId", args.account._id).eq("status", "live"),
          )
          .take(50)
      : [];

  const matchedStoryAutomation = liveStoryAutomations.find((automation) =>
    matchesStoryAutomation({
      automation,
      storyId: args.storyReplyMetadata.storyId,
      storyUrl: args.storyReplyMetadata.storyUrl,
      replyToken: args.storyReplyMetadata.replyToken,
    }),
  );

  if (!matchedStoryAutomation) {
    return null;
  }

  await applyContactTagsIfMissing(ctx, {
    workspaceId: args.account.workspaceId,
    contactId: args.contactId,
    tagIds: matchedStoryAutomation.tagIds,
    source: "story_automation",
    appliedAt: args.messageTime,
  });

  await startStoryAutomationSession(ctx, matchedStoryAutomation, {
    workspaceId: args.account.workspaceId,
    instagramAccountId: args.account._id,
    storyAutomationId: matchedStoryAutomation._id,
    contactId: args.contactId,
    conversationId: args.conversationId,
    matchedAt: args.messageTime,
    triggerMessageId: args.metaMessageId,
    storyId: args.storyReplyMetadata.storyId,
    storyUrl: args.storyReplyMetadata.storyUrl,
    storyToken: args.storyReplyMetadata.replyToken,
  });

  if (matchedStoryAutomation.sequenceDefinitionId !== null) {
    await createSequenceEnrollment(ctx, {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      contactId: args.contactId,
      conversationId: args.conversationId,
      sequenceDefinitionId: matchedStoryAutomation.sequenceDefinitionId,
    });
  }

  return matchedStoryAutomation;
}

async function matchAndStartRuleAutomation(
  ctx: MutationCtx,
  args: {
    account: Doc<"instagramAccounts">;
    contactId: Id<"contacts">;
    conversationId: Id<"conversations">;
    messageTime: number;
    rawText: string | null;
    isEcho: boolean;
    isPostback: boolean;
    isQuickReply: boolean;
    isStoryReply: boolean;
  },
) {
  const activeRules =
    !args.isEcho && !args.isPostback && !args.isQuickReply
      ? await ctx.db
          .query("automationRules")
          .withIndex("by_instagram_account_id_and_is_active", (q) =>
            q.eq("instagramAccountId", args.account._id).eq("isActive", true),
          )
          .take(50)
      : [];

  const matchedLegacyStoryReplyRule =
    !args.isEcho && !args.isPostback && !args.isQuickReply && args.isStoryReply
      ? activeRules
          .filter((rule) => rule.triggerType === "story_reply")
          .find((rule) =>
            matchesAutomationRule({
              triggerType: rule.triggerType,
              matchType: rule.matchType,
              keywords: rule.keywords,
              messageText: args.rawText,
              isStoryReply: args.isStoryReply,
            }),
          )
      : undefined;

  const matchedKeywordRule =
    !args.isEcho && !args.isPostback && !args.isQuickReply
      ? activeRules
          .filter((rule) => rule.triggerType === "keyword")
          .find((rule) =>
            matchesAutomationRule({
              triggerType: rule.triggerType,
              matchType: rule.matchType,
              keywords: rule.keywords,
              messageText: args.rawText,
              isStoryReply: args.isStoryReply,
            }),
          )
      : undefined;

  const matchedRule = matchedLegacyStoryReplyRule ?? matchedKeywordRule;

  if (!matchedRule) {
    return null;
  }

  await ctx.db.patch(args.conversationId, {
    lastAutomationRuleId: matchedRule._id,
  });

  await applyContactTagsIfMissing(ctx, {
    workspaceId: args.account.workspaceId,
    contactId: args.contactId,
    tagIds: matchedRule.tagIds,
    source: "rule",
    appliedAt: args.messageTime,
  });

  await startRuleAutomationSession(ctx, matchedRule, {
    workspaceId: args.account.workspaceId,
    instagramAccountId: args.account._id,
    automationRuleId: matchedRule._id,
    contactId: args.contactId,
    conversationId: args.conversationId,
    matchedAt: args.messageTime,
  });

  if (matchedRule.sequenceDefinitionId !== null) {
    await createSequenceEnrollment(ctx, {
      workspaceId: args.account.workspaceId,
      instagramAccountId: args.account._id,
      contactId: args.contactId,
      conversationId: args.conversationId,
      sequenceDefinitionId: matchedRule.sequenceDefinitionId,
    });
  }

  return matchedRule;
}

async function finalizeWebhookReceipt(
  ctx: MutationCtx,
  args: {
    receiptId: Id<"webhookReceipts">;
    status: WebhookReceiptStatus;
    processedCount: number;
    ignoredCount: number;
    note: string | null;
    workspaceId: Id<"workspaces"> | null;
    instagramAccountId: Id<"instagramAccounts"> | null;
    instagramAccountExternalId: string;
    sourceObject: string | null;
  },
) {
  await ctx.db.patch(args.receiptId, {
    status: args.status,
    processedCount: args.processedCount,
    ignoredCount: args.ignoredCount,
    note: args.note,
    workspaceId: args.workspaceId,
    instagramAccountId: args.instagramAccountId,
    instagramAccountExternalId: args.instagramAccountExternalId,
    sourceObject: args.sourceObject,
  });
}

export const ingestWebhookPayload = internalMutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const receivedAt = Date.now();
    const receiptId = await ctx.db.insert("webhookReceipts", {
      workspaceId: null,
      instagramAccountId: null,
      instagramAccountExternalId: "",
      sourceObject: null,
      payload: args.body,
      receivedAt,
      status: "received",
      processedCount: 0,
      ignoredCount: 0,
      note: null,
    });

    let payload: unknown;
    try {
      payload = JSON.parse(args.body);
    } catch {
      await finalizeWebhookReceipt(ctx, {
        receiptId,
        status: "invalid_json",
        processedCount: 0,
        ignoredCount: 1,
        note: "Webhook POST body was not valid JSON.",
        workspaceId: null,
        instagramAccountId: null,
        instagramAccountExternalId: "",
        sourceObject: null,
      });
      return { processed: 0, ignored: 1 };
    }

    const sourceObject =
      typeof (payload as { object?: unknown }).object === "string"
        ? (payload as { object: string }).object
        : null;
    const externalAccountId = getWebhookExternalAccountId(payload);
    const messagingItems = getMessagingItems(payload);
    let processed = 0;
    let ignored = 0;
    let matchedAccountId: Id<"instagramAccounts"> | null = null;
    let matchedWorkspaceId: Id<"workspaces"> | null = null;

    if (messagingItems.length === 0) {
      const matchedAccount =
        externalAccountId === ""
          ? null
          : await findInstagramAccountByExternalId(ctx, externalAccountId);

      await finalizeWebhookReceipt(ctx, {
        receiptId,
        status: matchedAccount ? "ignored" : "unmatched_account",
        processedCount: 0,
        ignoredCount: 1,
        note: matchedAccount
          ? "Raw webhook received, but no messaging items matched the current parser."
          : externalAccountId
            ? `Raw webhook received for Instagram account ${externalAccountId}, but it did not match the connected account.`
            : "Raw webhook received, but no Instagram account identifier could be extracted.",
        workspaceId: matchedAccount?.workspaceId ?? null,
        instagramAccountId: matchedAccount?._id ?? null,
        instagramAccountExternalId: externalAccountId,
        sourceObject,
      });
      return { processed: 0, ignored: 1 };
    }

    for (const { instagramAccountExternalId, item } of messagingItems) {
      const account = await findInstagramAccountByExternalId(
        ctx,
        instagramAccountExternalId,
      );

      if (account === null) {
        ignored += 1;
        continue;
      }

      matchedAccountId = matchedAccountId ?? account._id;
      matchedWorkspaceId = matchedWorkspaceId ?? account.workspaceId;

      await ctx.db.patch(account._id, { lastWebhookAt: Date.now() });

      if (!item.sender?.id || !item.recipient?.id) {
        ignored += 1;
        continue;
      }

      const messageTime = item.timestamp ?? item.time ?? Date.now();
      const hasMessage = Boolean(item.message);
      const isStoryReply = Boolean(item.message?.reply_to);
      const isPostback = Boolean(item.postback);
      const isQuickReply = Boolean(item.message?.quick_reply);
      const isEcho = Boolean(item.message?.is_echo);
      const direction = isEcho ? "outbound" : "inbound";
      const contactInstagramUserId = isEcho ? item.recipient.id : item.sender.id;
      const contactUsername = isEcho ? null : item.sender.username ?? null;
      const contactDisplayName =
        isEcho ? null : item.sender.name ?? item.sender.username ?? null;
      if (!hasMessage && !isPostback) {
        ignored += 1;
        continue;
      }

      const eventType = isPostback
        ? "postback"
        : isStoryReply
          ? "story_reply"
          : "message";
      const rawText =
        typeof item.message?.text === "string"
          ? item.message.text.trim()
          : typeof item.postback?.title === "string"
            ? item.postback.title.trim()
            : null;
      const storyReplyMetadata = isStoryReply
        ? parseStoryReplyMetadata({
            replyTo: item.message?.reply_to,
            rawText,
          })
        : {
            storyId: null,
            storyUrl: null,
            replyToken: null,
          };
      const displayText = describeInboundInteraction(item, rawText);
      const metaMessageId = item.message?.mid ?? item.postback?.mid ?? null;
      const deliveryKey =
        metaMessageId ??
        `${instagramAccountExternalId}:${contactInstagramUserId}:${messageTime}:${eventType}:${direction}`;

      const existingEvent = await ctx.db
        .query("webhookEvents")
        .withIndex("by_delivery_key", (q) => q.eq("deliveryKey", deliveryKey))
        .unique();
      if (existingEvent !== null) {
        ignored += 1;
        continue;
      }

      const webhookEventId = await ctx.db.insert("webhookEvents", {
        workspaceId: account.workspaceId,
        instagramAccountId: account._id,
        eventType,
        deliveryKey,
        payload: stringifyPayload(item),
        receivedAt: messageTime,
        processedAt: null,
        processingStatus: "received",
        errorMessage: null,
      });

      const { contactId, conversationId, existingContact } =
        await upsertContactAndConversation(ctx, {
          account,
          contactInstagramUserId,
          contactUsername,
          contactDisplayName,
          displayText,
          messageTime,
          isEcho,
        });

      if (shouldRefreshContactProfile(existingContact, messageTime)) {
        await ctx.scheduler.runAfter(
          0,
          internal.meta.contactProfiles.refreshContactProfile,
          {
            contactId,
          },
        );
      }

      await ensureWebhookMessageRecorded(ctx, {
        account,
        contactId,
        conversationId,
        webhookEventId,
        deliveryKey,
        metaMessageId,
        direction,
        displayText,
        messageTime,
        isEcho,
        isStoryReply,
        storyReplyMetadata,
      });

      const inboundInteraction = buildInboundInteraction({
        hasMessage,
        rawText,
        item,
        deliveryKey,
      });

      const handledByActiveSession = await continueActiveAutomationSessions(ctx, {
        conversationId,
        isEcho,
        inboundInteraction,
      });

      const matchedStoryAutomation = handledByActiveSession
        ? null
        : await matchAndStartStoryAutomation(ctx, {
            account,
            contactId,
            conversationId,
            messageTime,
            metaMessageId,
            isEcho,
            isPostback,
            isQuickReply,
            isStoryReply,
            storyReplyMetadata,
          });

      if (!handledByActiveSession && matchedStoryAutomation === null) {
        await matchAndStartRuleAutomation(ctx, {
          account,
          contactId,
          conversationId,
          messageTime,
          rawText,
          isEcho,
          isPostback,
          isQuickReply,
          isStoryReply,
        });
      }

      await ctx.db.patch(webhookEventId, {
        processedAt: Date.now(),
        processingStatus: "processed",
      });

      processed += 1;
    }

    await finalizeWebhookReceipt(ctx, {
      receiptId,
      status:
        processed > 0
          ? "processed"
          : matchedAccountId !== null
            ? "ignored"
            : "unmatched_account",
      processedCount: processed,
      ignoredCount: ignored,
      note:
        processed > 0
          ? `Raw webhook received and processed ${processed} messaging item${processed === 1 ? "" : "s"}.`
          : matchedAccountId !== null
            ? "Raw webhook received for the connected account, but no messaging items were processed."
            : externalAccountId
              ? `Raw webhook received for Instagram account ${externalAccountId}, but it did not match the connected account.`
              : "Raw webhook received, but no connected Instagram account could be matched.",
      workspaceId: matchedWorkspaceId,
      instagramAccountId: matchedAccountId,
      instagramAccountExternalId:
        externalAccountId ||
        messagingItems[0]?.instagramAccountExternalId ||
        "",
      sourceObject,
    });

    return { processed, ignored };
  },
});
