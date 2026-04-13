import { query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "./lib/auth";
import {
  loadContactMemberships,
  loadContactTags,
  loadConversationAutomationContext,
  loadWorkspaceAutomationMaps,
} from "./lib/readModels";

const inboxStatusFilterValidator = v.union(
  v.literal("all"),
  v.literal("active"),
  v.literal("window_closed"),
  v.literal("paused"),
);

function isUnread(args: {
  lastInboundAt: number | null;
  lastOutboundAt: number | null;
}) {
  return (
    args.lastInboundAt !== null &&
    (args.lastOutboundAt === null || args.lastInboundAt > args.lastOutboundAt)
  );
}

type StoredWebhookMessagingPayload = {
  message?: {
    text?: string;
    quick_reply?: {
      payload?: string;
    };
    attachments?: Array<{
      type?: string;
      payload?: {
        url?: string;
      };
    }>;
    reply_to?: unknown;
  };
  postback?: {
    title?: string;
    payload?: string;
  };
};

type StoredDeliveryRequestPayload =
  | {
      kind: "text";
      text?: string;
    }
  | {
      kind: "story_reply_reaction";
      emoji?: string;
      triggerMessageId?: string;
    }
  | {
      kind: "quick_reply";
      text?: string;
      quickReplies?: Array<{
        title?: string;
        payload?: string;
      }>;
    }
  | {
      kind: "button_template";
      text?: string;
      buttons?: Array<
        | {
            type?: "web_url";
            title?: string;
            url?: string;
          }
        | {
            type?: "postback";
            title?: string;
            payload?: string;
          }
      >;
    };

function parseWebhookPayload(
  payload: string,
): StoredWebhookMessagingPayload | null {
  try {
    return JSON.parse(payload) as StoredWebhookMessagingPayload;
  } catch {
    return null;
  }
}

function parseDeliveryRequestPayload(
  payload: string | null,
): StoredDeliveryRequestPayload | null {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as StoredDeliveryRequestPayload;
  } catch {
    return null;
  }
}

function parseDeliveryAttemptIdFromDedupeKey(dedupeKey: string) {
  const match = /^delivery:([^:]+):\d+$/.exec(dedupeKey);
  return (match?.[1] as Id<"deliveryAttempts"> | undefined) ?? null;
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

function describeAttachmentInteraction(
  parsedWebhookPayload: StoredWebhookMessagingPayload | null,
) {
  const attachments = parsedWebhookPayload?.message?.attachments ?? [];
  if (attachments.length === 0) {
    return null;
  }

  return describeAttachmentType(attachments[0]?.type);
}

function humanizePayload(payload: string) {
  if (payload === "comment_automation:opening_dm") {
    return "Send me the link";
  }

  if (payload === "comment_automation:follow_gate") {
    return "Following";
  }

  if (payload === "story_automation:follow_gate") {
    return "I'm following";
  }

  return payload
    .split(/[:_]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function stripInteractionPrefix(
  text: string,
  prefix: "Clicked button:" | "Tapped quick reply:",
) {
  if (!text.startsWith(prefix)) {
    return text;
  }

  const normalized = text.slice(prefix.length).trim();
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function serializeRichContent(
  message: Doc<"messages">,
  deliveryAttempt: Doc<"deliveryAttempts"> | null,
) {
  if (message.direction !== "outbound" || deliveryAttempt === null) {
    return null;
  }

  const descriptor = parseDeliveryRequestPayload(deliveryAttempt.requestPayload);
  if (descriptor === null) {
    return null;
  }

  if (descriptor.kind === "text") {
    return null;
  }

  if (descriptor.kind === "story_reply_reaction") {
    return null;
  }

  if (descriptor.kind === "quick_reply") {
    return {
      kind: "quick_reply" as const,
      bodyText: descriptor.text?.trim() || message.text?.trim() || "",
      actions: (descriptor.quickReplies ?? [])
        .map((reply) => reply.title?.trim() || "")
        .filter((title) => title.length > 0)
        .map((title) => ({
          kind: "quick_reply" as const,
          label: title,
          url: null,
        })),
    };
  }

  return {
    kind: "button_template" as const,
    bodyText: descriptor.text?.trim() || message.text?.trim() || "",
    actions: (descriptor.buttons ?? [])
      .map((button) => {
        const label = button.title?.trim() || "";
        if (!label) {
          return null;
        }

        return {
          kind: button.type === "web_url" ? ("web_url" as const) : ("postback" as const),
          label,
          url:
            button.type === "web_url"
              ? (button.url?.trim() || null)
              : null,
        };
      })
      .filter(
        (
          action,
        ): action is {
          kind: "web_url" | "postback";
          label: string;
          url: string | null;
        } => action !== null,
      ),
  };
}

function describeConversationMessage(
  message: Doc<"messages">,
  webhookEvent: Doc<"webhookEvents"> | null,
  deliveryAttempt: Doc<"deliveryAttempts"> | null,
) {
  const parsedWebhookPayload =
    webhookEvent === null ? null : parseWebhookPayload(webhookEvent.payload);
  const storedText = message.text?.trim() || null;
  const parsedText = parsedWebhookPayload?.message?.text?.trim() || null;
  const parsedPostbackTitle = parsedWebhookPayload?.postback?.title?.trim() || null;
  const parsedPostbackPayload =
    parsedWebhookPayload?.postback?.payload?.trim() || null;
  const parsedQuickReplyPayload =
    parsedWebhookPayload?.message?.quick_reply?.payload?.trim() || null;
  const attachmentLabel = describeAttachmentInteraction(parsedWebhookPayload);
  const isStoryReply =
    parsedWebhookPayload !== null && parsedWebhookPayload.message?.reply_to !== undefined;
  const text = storedText || parsedText;
  const richContent = serializeRichContent(message, deliveryAttempt);

  if (message.direction === "outbound") {
    const eventLabel =
      message.source === "sequence"
        ? "sequence"
        : message.source === "story_automation"
          ? "story automation"
          : "rule";

    return {
      displayText:
        message.messageType === "reaction"
          ? text || "Reacted to story reply"
          : richContent?.bodyText || text || "Automation message sent",
      eventLabel,
      richContent,
    };
  }

  if (parsedPostbackTitle) {
    return {
      displayText: parsedPostbackTitle,
      eventLabel: "button click",
      richContent: null,
    };
  }

  if (storedText?.startsWith("Clicked button:")) {
    return {
      displayText: stripInteractionPrefix(storedText, "Clicked button:"),
      eventLabel: "button click",
      richContent: null,
    };
  }

  if (storedText?.startsWith("Tapped quick reply:")) {
    return {
      displayText: stripInteractionPrefix(storedText, "Tapped quick reply:"),
      eventLabel: "quick reply",
      richContent: null,
    };
  }

  if (parsedPostbackPayload) {
    return {
      displayText: humanizePayload(parsedPostbackPayload),
      eventLabel: "button click",
      richContent: null,
    };
  }

  if (parsedQuickReplyPayload && text) {
    return {
      displayText: text,
      eventLabel: "quick reply",
      richContent: null,
    };
  }

  if (parsedQuickReplyPayload) {
    return {
      displayText: humanizePayload(parsedQuickReplyPayload),
      eventLabel: "quick reply",
      richContent: null,
    };
  }

  if (text) {
    return {
      displayText: text,
      eventLabel: message.messageType === "story_reply" ? "story reply" : "message",
      richContent: null,
    };
  }

  if (attachmentLabel) {
    return {
      displayText: attachmentLabel,
      eventLabel: isStoryReply ? "story reply" : "attachment",
      richContent: null,
    };
  }

  if (message.messageType === "story_reply") {
    return {
      displayText: "Replied to your story",
      eventLabel: "story reply",
      richContent: null,
    };
  }

  return {
    displayText: "Instagram interaction",
    eventLabel: "Instagram action",
    richContent: null,
  };
}

export const listInbox = query({
  args: {
    accountId: v.id("instagramAccounts"),
    unreadOnly: v.boolean(),
    statusFilter: inboxStatusFilterValidator,
    search: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const maps = await loadWorkspaceAutomationMaps(ctx, workspace._id);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_instagram_account_id_and_last_message_at", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .order("desc")
      .take(100);

    const rows = await Promise.all(
      conversations.map(async (conversation) => {
        const contact = await ctx.db.get(conversation.contactId);
        const unread = isUnread({
          lastInboundAt: conversation.lastInboundAt,
          lastOutboundAt: conversation.lastOutboundAt,
        });

        return {
          id: conversation._id,
          status: conversation.status,
          lastMessageAt: conversation.lastMessageAt,
          lastMessagePreview: conversation.lastMessagePreview,
          messagingWindowClosesAt: conversation.messagingWindowClosesAt,
          unread,
          contact: {
            id: conversation.contactId,
            username: contact?.username ?? null,
            displayName: contact?.displayName ?? null,
            profilePictureUrl: contact?.profilePictureUrl ?? null,
          },
          latestAutomationContext: await loadConversationAutomationContext(
            ctx,
            conversation,
            maps,
          ),
        };
      }),
    );

    const normalizedSearch = args.search.trim().toLowerCase();

    return rows.filter((row) => {
      if (args.unreadOnly && !row.unread) {
        return false;
      }

      if (args.statusFilter !== "all" && row.status !== args.statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [row.contact.displayName, row.contact.username, row.lastMessagePreview]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  },
});

export const getConversationDetail = query({
  args: {
    accountId: v.id("instagramAccounts"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const conversation = await ctx.db.get(args.conversationId);
    if (
      conversation === null ||
      conversation.workspaceId !== workspace._id ||
      conversation.instagramAccountId !== args.accountId
    ) {
      return null;
    }

    const maps = await loadWorkspaceAutomationMaps(ctx, workspace._id);
    const contact = await ctx.db.get(conversation.contactId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_id_and_event_time", (q) =>
        q.eq("conversationId", conversation._id),
      )
      .order("desc")
      .take(200);
    const webhookEventIds = [
      ...new Set(
        messages
          .map((message) => message.webhookEventId)
          .filter(
            (webhookEventId): webhookEventId is Id<"webhookEvents"> =>
              webhookEventId !== null,
          ),
      ),
    ];
    const deliveryAttemptIds = [
      ...new Set(
        messages
          .map((message) => parseDeliveryAttemptIdFromDedupeKey(message.dedupeKey))
          .filter(
            (deliveryAttemptId): deliveryAttemptId is Id<"deliveryAttempts"> =>
              deliveryAttemptId !== null,
          ),
      ),
    ];
    const [tags, memberships, sequenceEnrollments, latestAutomationContext] =
      await Promise.all([
        loadContactTags(ctx, conversation.contactId),
        loadContactMemberships(ctx, conversation.contactId, maps),
        ctx.db
          .query("sequenceEnrollments")
          .withIndex("by_contact_id", (q) => q.eq("contactId", conversation.contactId))
          .take(20),
        loadConversationAutomationContext(ctx, conversation, maps),
      ]);
    const webhookEvents = await Promise.all(
      webhookEventIds.map((webhookEventId) => ctx.db.get(webhookEventId)),
    );
    const deliveryAttempts = await Promise.all(
      deliveryAttemptIds.map((deliveryAttemptId) => ctx.db.get(deliveryAttemptId)),
    );
    const webhookEventsById = new Map(
      webhookEvents
        .filter((event): event is NonNullable<typeof event> => event !== null)
        .map((event) => [event._id, event]),
    );
    const deliveryAttemptsById = new Map(
      deliveryAttempts
        .filter(
          (attempt): attempt is NonNullable<typeof attempt> => attempt !== null,
        )
        .map((attempt) => [attempt._id, attempt]),
    );

    return {
      id: conversation._id,
      status: conversation.status,
      startedAt: conversation.startedAt,
      lastMessageAt: conversation.lastMessageAt,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      messagingWindowClosesAt: conversation.messagingWindowClosesAt,
      unread: isUnread({
        lastInboundAt: conversation.lastInboundAt,
        lastOutboundAt: conversation.lastOutboundAt,
      }),
      contact: {
        id: conversation.contactId,
        username: contact?.username ?? null,
        displayName: contact?.displayName ?? null,
        profilePictureUrl: contact?.profilePictureUrl ?? null,
        tags,
      },
      latestAutomationContext,
      automationHistory: memberships,
      sequenceEnrollments: sequenceEnrollments
        .filter((enrollment) => enrollment.conversationId === conversation._id)
        .sort((a, b) => b.enrolledAt - a.enrolledAt)
        .map((enrollment) => ({
          id: enrollment._id,
          name:
            maps.sequencesById.get(enrollment.sequenceDefinitionId)?.name ??
            "Sequence",
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          nextRunAt: enrollment.nextRunAt,
          currentStepIndex: enrollment.currentStepIndex,
        })),
      messages: [...messages]
        .sort((a, b) => a.eventTime - b.eventTime)
        .map((message) => {
          const deliveryAttemptId = parseDeliveryAttemptIdFromDedupeKey(
            message.dedupeKey,
          );
          const description = describeConversationMessage(
            message,
            message.webhookEventId === null
              ? null
              : webhookEventsById.get(message.webhookEventId) ?? null,
            deliveryAttemptId === null
              ? null
              : deliveryAttemptsById.get(deliveryAttemptId) ?? null,
          );

          return {
            id: message._id,
            direction: message.direction,
            source: message.source,
            text: message.text,
            displayText: description.displayText,
            eventLabel: description.eventLabel,
            richContent: description.richContent,
            eventTime: message.eventTime,
            deliveryStatus: message.deliveryStatus,
            messageType: message.messageType,
          };
        }),
    };
  },
});
