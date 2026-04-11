import { internal } from "../_generated/api";
import { internalMutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { createSequenceEnrollment } from "../automations/sequences";
import {
  makeMessagePreview,
  matchesAutomationRule,
} from "../automations/shared";
import { advanceCommentAutomationSession } from "../automations/commentFlow";
import { queueAutomatedTextReply } from "./sendHelpers";
import { Id } from "../_generated/dataModel";

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
          : await ctx.db
              .query("instagramAccounts")
              .withIndex("by_instagram_account_id", (q) =>
                q.eq("instagramAccountId", externalAccountId),
              )
              .unique();

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
      const account = await ctx.db
        .query("instagramAccounts")
        .withIndex("by_instagram_account_id", (q) =>
          q.eq("instagramAccountId", instagramAccountExternalId),
        )
        .unique();

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

      const existingContact = await ctx.db
        .query("contacts")
        .withIndex("by_instagram_account_id_and_instagram_user_id", (q) =>
          q
            .eq("instagramAccountId", account._id)
            .eq("instagramUserId", contactInstagramUserId),
        )
        .unique();

      const contactId =
        existingContact?._id ??
        (await ctx.db.insert("contacts", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          instagramUserId: contactInstagramUserId,
          username: contactUsername,
          displayName: contactDisplayName,
          profilePictureUrl: null,
          firstInboundAt: messageTime,
          lastInboundAt: messageTime,
          lastMessageAt: messageTime,
          profilePictureFetchedAt: null,
        }));

      if (existingContact) {
        await ctx.db.patch(existingContact._id, {
          username: contactUsername ?? existingContact.username,
          displayName: contactDisplayName ?? existingContact.displayName,
          lastInboundAt: isEcho
            ? existingContact.lastInboundAt
            : Math.max(existingContact.lastInboundAt, messageTime),
          lastMessageAt: Math.max(existingContact.lastMessageAt, messageTime),
        });
      }

      const existingConversation = await ctx.db
        .query("conversations")
        .withIndex("by_instagram_account_id_and_contact_id", (q) =>
          q.eq("instagramAccountId", account._id).eq("contactId", contactId),
        )
        .unique();

      const conversationId =
        existingConversation?._id ??
        (await ctx.db.insert("conversations", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          contactId,
          conversationKey: `${account.instagramAccountId}:${contactInstagramUserId}`,
          status: "active",
          startedAt: messageTime,
          lastMessageAt: messageTime,
          lastInboundAt: isEcho ? null : messageTime,
          lastOutboundAt: isEcho ? messageTime : null,
          lastMessagePreview: makeMessagePreview(displayText),
          messagingWindowClosesAt: isEcho
            ? null
            : messageTime + 24 * 60 * 60 * 1000,
          lastAutomationRuleId: null,
        }));

      if (existingConversation) {
        await ctx.db.patch(existingConversation._id, {
          status: "active",
          lastMessageAt: Math.max(existingConversation.lastMessageAt, messageTime),
          lastInboundAt: isEcho
            ? existingConversation.lastInboundAt
            : existingConversation.lastInboundAt === null
              ? messageTime
              : Math.max(existingConversation.lastInboundAt, messageTime),
          lastOutboundAt: isEcho
            ? existingConversation.lastOutboundAt === null
              ? messageTime
              : Math.max(existingConversation.lastOutboundAt, messageTime)
            : existingConversation.lastOutboundAt,
          lastMessagePreview:
            messageTime >= existingConversation.lastMessageAt
              ? makeMessagePreview(displayText)
              : existingConversation.lastMessagePreview,
          messagingWindowClosesAt: isEcho
            ? existingConversation.messagingWindowClosesAt
            : messageTime + 24 * 60 * 60 * 1000,
        });
      }

      if (shouldRefreshContactProfile(existingContact, messageTime)) {
        await ctx.scheduler.runAfter(
          0,
          internal.meta.contactProfiles.refreshContactProfile,
          {
            contactId,
          },
        );
      }

      const existingMessage =
        (metaMessageId === null
          ? null
          : await ctx.db
              .query("messages")
              .withIndex("by_meta_message_id", (q) =>
                q.eq("metaMessageId", metaMessageId),
              )
              .unique()) ??
        (await ctx.db
          .query("messages")
          .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", deliveryKey))
          .unique());

      if (existingMessage === null) {
        await ctx.db.insert("messages", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          conversationId,
          contactId,
          direction,
          source: "webhook",
          messageType: isStoryReply ? "story_reply" : "text",
          text: displayText,
          metaMessageId,
          dedupeKey: deliveryKey,
          deliveryStatus: isEcho ? "sent" : "received",
          eventTime: messageTime,
          webhookEventId,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
      }

      const activeRules = await ctx.db
        .query("automationRules")
        .withIndex("by_instagram_account_id_and_is_active", (q) =>
          q.eq("instagramAccountId", account._id).eq("isActive", true),
        )
        .take(50);

      const matchedRule =
        !isEcho && !isPostback && !isQuickReply
          ? activeRules.find((rule) =>
              matchesAutomationRule({
                triggerType: rule.triggerType,
                matchType: rule.matchType,
                keywords: rule.keywords,
                messageText: rawText,
                isStoryReply,
              }),
            )
          : undefined;

      if (matchedRule) {
        await ctx.db.patch(matchedRule._id, {
          triggerCount: matchedRule.triggerCount + 1,
          lastTriggeredAt: messageTime,
        });

        await ctx.db.patch(conversationId, {
          lastAutomationRuleId: matchedRule._id,
        });

        await ctx.runMutation(
          internal.contacts.upsertContactAutomationMembership,
          {
            workspaceId: account.workspaceId,
            contactId,
            conversationId,
            automationKind: "rule",
            automationRuleId: matchedRule._id,
            commentAutomationId: null,
            sequenceDefinitionId: null,
            matchedAt: messageTime,
          },
        );

        for (const tagId of matchedRule.tagIds) {
          const existingContactTag = await ctx.db
            .query("contactTags")
            .withIndex("by_contact_id_and_tag_id", (q) =>
              q.eq("contactId", contactId).eq("tagId", tagId),
            )
            .unique();

          if (existingContactTag === null) {
            await ctx.db.insert("contactTags", {
              workspaceId: account.workspaceId,
              contactId,
              tagId,
              source: "rule",
              appliedAt: messageTime,
            });
          }
        }

        if (matchedRule.replyText.trim()) {
          await queueAutomatedTextReply(ctx, {
            workspaceId: account.workspaceId,
            instagramAccountId: account._id,
            conversationId,
            contactId,
            messageText: matchedRule.replyText.trim(),
            automationRuleId: matchedRule._id,
            sequenceEnrollmentId: null,
          });
        }

        if (matchedRule.sequenceDefinitionId !== null) {
          await createSequenceEnrollment(ctx, {
            workspaceId: account.workspaceId,
            instagramAccountId: account._id,
            contactId,
            conversationId,
            sequenceDefinitionId: matchedRule.sequenceDefinitionId,
          });
        }
      }

      // Check for active comment automation sessions and advance them
      if (!matchedRule && !isEcho) {
        const recentSessions = await ctx.db
          .query("commentAutomationSessions")
          .withIndex("by_conversation_id", (q) =>
            q.eq("conversationId", conversationId),
          )
          .order("desc")
          .take(10);
        const activeSession = recentSessions.find(
          (session) =>
            session.currentStep !== "completed" &&
            session.currentStep !== "link_sent" &&
            session.currentStep !== "guardrail_tripped",
        );

        if (activeSession) {
          const inboundInteraction = {
            hasMessage,
            text: rawText,
            postbackPayload:
              typeof item.postback?.payload === "string"
                ? item.postback.payload.trim()
                : null,
            quickReplyPayload:
              typeof item.message?.quick_reply?.payload === "string"
                ? item.message.quick_reply.payload.trim()
                : null,
            deliveryKey,
          };
          const sessionAutomation = await ctx.db.get(
            activeSession.commentAutomationId,
          );

          if (sessionAutomation?.followGateEnabled) {
            await ctx.scheduler.runAfter(
              0,
              internal.automations.commentFlow.processInboundCommentAutomationInteraction,
              {
                sessionId: activeSession._id,
                ...inboundInteraction,
              },
            );
          } else {
            await advanceCommentAutomationSession(
              ctx,
              activeSession._id,
              {
                hasMessage: inboundInteraction.hasMessage,
                text: inboundInteraction.text,
                postbackPayload: inboundInteraction.postbackPayload,
                quickReplyPayload: inboundInteraction.quickReplyPayload,
              },
            );
          }
        }
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
