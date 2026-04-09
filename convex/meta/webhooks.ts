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

      if (item.message?.is_echo) {
        ignored += 1;
        continue;
      }

      const messageTime = item.timestamp ?? item.time ?? Date.now();
      const isStoryReply = Boolean(item.message?.reply_to);
      const isPostback = Boolean(item.postback);
      const isQuickReply = Boolean(item.message?.quick_reply);
      const eventType = isPostback
        ? "postback"
        : isStoryReply
          ? "story_reply"
          : "message";
      const text =
        typeof item.message?.text === "string"
          ? item.message.text.trim()
          : typeof item.postback?.title === "string"
            ? item.postback.title.trim()
            : null;
      const metaMessageId = item.message?.mid ?? item.postback?.mid ?? null;
      const deliveryKey =
        metaMessageId ??
        `${instagramAccountExternalId}:${item.sender.id}:${messageTime}:${eventType}`;

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
            .eq("instagramUserId", item.sender!.id!),
        )
        .unique();

      const contactId =
        existingContact?._id ??
        (await ctx.db.insert("contacts", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          instagramUserId: item.sender.id,
          username: item.sender.username ?? null,
          displayName: item.sender.name ?? item.sender.username ?? null,
          profilePictureUrl: null,
          firstInboundAt: messageTime,
          lastInboundAt: messageTime,
          lastMessageAt: messageTime,
        }));

      if (existingContact) {
        await ctx.db.patch(existingContact._id, {
          username: item.sender.username ?? existingContact.username,
          displayName:
            item.sender.name ??
            item.sender.username ??
            existingContact.displayName,
          lastInboundAt: messageTime,
          lastMessageAt: messageTime,
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
          conversationKey: `${account.instagramAccountId}:${item.sender.id}`,
          status: "active",
          startedAt: messageTime,
          lastMessageAt: messageTime,
          lastInboundAt: messageTime,
          lastOutboundAt: null,
          lastMessagePreview: makeMessagePreview(text),
          messagingWindowClosesAt: messageTime + 24 * 60 * 60 * 1000,
          lastAutomationRuleId: null,
        }));

      if (existingConversation) {
        await ctx.db.patch(existingConversation._id, {
          status: "active",
          lastMessageAt: messageTime,
          lastInboundAt: messageTime,
          lastMessagePreview: makeMessagePreview(text),
          messagingWindowClosesAt: messageTime + 24 * 60 * 60 * 1000,
        });
      }

      const existingMessage = await ctx.db
        .query("messages")
        .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", deliveryKey))
        .unique();

      if (existingMessage === null) {
        await ctx.db.insert("messages", {
          workspaceId: account.workspaceId,
          instagramAccountId: account._id,
          conversationId,
          contactId,
          direction: "inbound",
          source: "webhook",
          messageType: isStoryReply ? "story_reply" : "text",
          text,
          metaMessageId,
          dedupeKey: deliveryKey,
          deliveryStatus: "received",
          eventTime: messageTime,
          webhookEventId,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
      }

      const activeRules = await ctx.db
        .query("automationRules")
        .withIndex("by_workspace_id_and_is_active", (q) =>
          q.eq("workspaceId", account.workspaceId).eq("isActive", true),
        )
        .take(50);

      const matchedRule =
        !isPostback && !isQuickReply
          ? activeRules.find((rule) =>
              matchesAutomationRule({
                triggerType: rule.triggerType,
                matchType: rule.matchType,
                keywords: rule.keywords,
                messageText: text,
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
      if (!matchedRule) {
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
            session.currentStep !== "link_sent",
        );

        if (activeSession) {
          await advanceCommentAutomationSession(ctx, activeSession._id, text);
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
