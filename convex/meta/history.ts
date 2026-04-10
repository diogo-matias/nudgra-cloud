import {
  action,
  ActionCtx,
  internalMutation,
  internalQuery,
  QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireCurrentWorkspace } from "../lib/auth";
import { makeMessagePreview } from "../automations/shared";
import { META_GRAPH_API_VERSION } from "./config";
import { isMetaAuthError, parseMetaApiError } from "./authShared";

const importedHistoryMessageValidator = v.object({
  metaMessageId: v.string(),
  direction: v.union(v.literal("inbound"), v.literal("outbound")),
  text: v.union(v.string(), v.null()),
  eventTime: v.number(),
});

function parseTimestamp(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function fetchMetaJsonWithRefresh(
  ctx: ActionCtx,
  args: {
    accountId: Id<"instagramAccounts">;
    path: string;
    graphApiVersion: string | null | undefined;
    accessToken: string;
    params?: Record<string, string>;
  },
) {
  const request = async (accessToken: string) => {
    const endpoint = new URL(
      `https://graph.instagram.com/${
        args.graphApiVersion || META_GRAPH_API_VERSION
      }/${args.path}`,
    );

    for (const [key, value] of Object.entries(args.params ?? {})) {
      endpoint.searchParams.set(key, value);
    }
    endpoint.searchParams.set("access_token", accessToken);

    const response = await fetch(endpoint);
    const responseText = await response.text();
    if (!response.ok) {
      return {
        ok: false as const,
        error: parseMetaApiError(
          responseText,
          `Meta request failed with status ${response.status}.`,
        ),
      };
    }

    try {
      return {
        ok: true as const,
        payload: JSON.parse(responseText) as Record<string, unknown>,
      };
    } catch {
      return {
        ok: false as const,
        error: parseMetaApiError(
          responseText,
          "Meta returned an invalid JSON payload.",
        ),
      };
    }
  };

  let result = await request(args.accessToken);
  if (!result.ok && isMetaAuthError(result.error)) {
    const refreshResult: { tokenUsable: boolean } = await ctx.runAction(
      internal.meta.tokenLifecycle.refreshAccountToken,
      {
        accountId: args.accountId,
        reason: "auth_error",
      },
    );

    if (refreshResult.tokenUsable) {
      const refreshedAccount = await ctx.runQuery(
        internal.accounts.getAccountTokenLifecycleContext,
        {
          accountId: args.accountId,
        },
      );
      if (refreshedAccount?.graphAccessToken) {
        result = await request(refreshedAccount.graphAccessToken);
      }
    }
  }

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.payload;
}

async function getConversationSyncContext(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
) {
  const workspace = await requireCurrentWorkspace(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (conversation === null || conversation.workspaceId !== workspace._id) {
    return null;
  }

  const account = await ctx.db.get(conversation.instagramAccountId);
  const contact = await ctx.db.get(conversation.contactId);
  if (
    account === null ||
    contact === null ||
    account.status !== "connected" ||
    !account.graphAccessToken
  ) {
    return null;
  }

  return {
    workspaceId: workspace._id,
    conversationId: conversation._id,
    instagramAccountDocId: account._id,
    instagramAccountExternalId: account.instagramAccountId,
    instagramUserId: contact.instagramUserId,
    accessToken: account.graphAccessToken,
    graphApiVersion: account.graphApiVersion,
    lastHistorySyncAt: conversation.historySyncedAt ?? null,
  };
}

export const getConversationHistorySyncContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await getConversationSyncContext(ctx, args.conversationId);
  },
});

export const importConversationHistory = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    syncedAt: v.number(),
    messages: v.array(importedHistoryMessageValidator),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation === null) {
      return { insertedCount: 0, updatedCount: 0 };
    }

    const contact = await ctx.db.get(conversation.contactId);
    if (contact === null) {
      return { insertedCount: 0, updatedCount: 0 };
    }

    let insertedCount = 0;
    let updatedCount = 0;

    let earliestEventTime = conversation.startedAt;
    let latestEventTime = conversation.lastMessageAt;
    let latestPreviewText = conversation.lastMessagePreview;
    let latestInboundAt = conversation.lastInboundAt;
    let latestOutboundAt = conversation.lastOutboundAt;
    let earliestInboundAt = contact.firstInboundAt;
    let contactLastInboundAt = contact.lastInboundAt;
    let contactLastMessageAt = contact.lastMessageAt;

    const sortedMessages = [...args.messages].sort(
      (left, right) => left.eventTime - right.eventTime,
    );

    for (const importedMessage of sortedMessages) {
      const existingMessage = await ctx.db
        .query("messages")
        .withIndex("by_meta_message_id", (q) =>
          q.eq("metaMessageId", importedMessage.metaMessageId),
        )
        .unique();

      if (existingMessage === null) {
        await ctx.db.insert("messages", {
          workspaceId: conversation.workspaceId,
          instagramAccountId: conversation.instagramAccountId,
          conversationId: conversation._id,
          contactId: conversation.contactId,
          direction: importedMessage.direction,
          source: "webhook",
          messageType: "text",
          text: importedMessage.text,
          metaMessageId: importedMessage.metaMessageId,
          dedupeKey: `history:${importedMessage.metaMessageId}`,
          deliveryStatus:
            importedMessage.direction === "outbound" ? "sent" : "received",
          eventTime: importedMessage.eventTime,
          webhookEventId: null,
          automationRuleId: null,
          sequenceEnrollmentId: null,
        });
        insertedCount += 1;
      } else if (
        existingMessage.text === null &&
        importedMessage.text !== null
      ) {
        await ctx.db.patch(existingMessage._id, {
          text: importedMessage.text,
        });
        updatedCount += 1;
      }

      earliestEventTime = Math.min(
        earliestEventTime,
        importedMessage.eventTime,
      );
      contactLastMessageAt = Math.max(
        contactLastMessageAt,
        importedMessage.eventTime,
      );

      if (importedMessage.eventTime >= latestEventTime) {
        latestEventTime = importedMessage.eventTime;
        latestPreviewText = makeMessagePreview(importedMessage.text);
      }

      if (importedMessage.direction === "inbound") {
        earliestInboundAt = Math.min(
          earliestInboundAt,
          importedMessage.eventTime,
        );
        contactLastInboundAt = Math.max(
          contactLastInboundAt,
          importedMessage.eventTime,
        );
        latestInboundAt =
          latestInboundAt === null
            ? importedMessage.eventTime
            : Math.max(latestInboundAt, importedMessage.eventTime);
      } else {
        latestOutboundAt =
          latestOutboundAt === null
            ? importedMessage.eventTime
            : Math.max(latestOutboundAt, importedMessage.eventTime);
      }
    }

    await ctx.db.patch(conversation._id, {
      startedAt: earliestEventTime,
      lastMessageAt: latestEventTime,
      lastInboundAt: latestInboundAt,
      lastOutboundAt: latestOutboundAt,
      lastMessagePreview: latestPreviewText,
      messagingWindowClosesAt:
        latestInboundAt === null
          ? conversation.messagingWindowClosesAt
          : latestInboundAt + 24 * 60 * 60 * 1000,
      historySyncedAt: args.syncedAt,
    });

    await ctx.db.patch(contact._id, {
      firstInboundAt: earliestInboundAt,
      lastInboundAt: contactLastInboundAt,
      lastMessageAt: contactLastMessageAt,
    });

    return { insertedCount, updatedCount };
  },
});

export const syncConversationHistory = action({
  args: {
    conversationId: v.id("conversations"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const syncContext: Awaited<
      ReturnType<typeof getConversationSyncContext>
    > | null = await ctx.runQuery(
      internal.meta.history.getConversationHistorySyncContext,
      {
        conversationId: args.conversationId,
      },
    );

    if (syncContext === null) {
      return {
        importedCount: 0,
        updatedCount: 0,
        skipped: true,
        reason: "Conversation is unavailable for history sync.",
      };
    }

    if (
      !args.force &&
      syncContext.lastHistorySyncAt !== null &&
      Date.now() - syncContext.lastHistorySyncAt < 5 * 60 * 1000
    ) {
      return {
        importedCount: 0,
        updatedCount: 0,
        skipped: true,
        reason: "Conversation history was synced recently.",
      };
    }

    const conversationsResponse = await fetchMetaJsonWithRefresh(ctx, {
      accountId: syncContext.instagramAccountDocId,
      path: `${syncContext.instagramAccountExternalId}/conversations`,
      graphApiVersion: syncContext.graphApiVersion,
      accessToken: syncContext.accessToken,
      params: {
        platform: "instagram",
        user_id: syncContext.instagramUserId,
      },
    });

    const remoteConversationId =
      Array.isArray(conversationsResponse.data) &&
      conversationsResponse.data[0] &&
      typeof conversationsResponse.data[0] === "object" &&
      conversationsResponse.data[0] !== null &&
      typeof (conversationsResponse.data[0] as { id?: unknown }).id === "string"
        ? (conversationsResponse.data[0] as { id: string }).id
        : null;

    if (remoteConversationId === null) {
      await ctx.runMutation(internal.meta.history.importConversationHistory, {
        conversationId: args.conversationId,
        syncedAt: Date.now(),
        messages: [],
      });
      return {
        importedCount: 0,
        updatedCount: 0,
        skipped: false,
        reason: "No remote conversation was returned by Meta.",
      };
    }

    const remoteMessagesResponse = await fetchMetaJsonWithRefresh(ctx, {
      accountId: syncContext.instagramAccountDocId,
      path: remoteConversationId,
      graphApiVersion: syncContext.graphApiVersion,
      accessToken: syncContext.accessToken,
      params: {
        fields: "messages",
      },
    });

    const remoteMessageRefs =
      remoteMessagesResponse.messages &&
      typeof remoteMessagesResponse.messages === "object" &&
      Array.isArray(
        (remoteMessagesResponse.messages as { data?: unknown[] }).data,
      )
        ? (remoteMessagesResponse.messages as { data: unknown[] }).data
        : [];

    const candidateMessageIds = remoteMessageRefs
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const messageId =
          typeof (item as { id?: unknown }).id === "string"
            ? (item as { id: string }).id
            : null;
        const createdAt = parseTimestamp(
          typeof (item as { created_time?: unknown }).created_time ===
            "string" ||
            typeof (item as { created_time?: unknown }).created_time ===
              "number"
            ? ((item as { created_time?: string | number }).created_time ??
                null)
            : null,
        );

        if (messageId === null) {
          return null;
        }

        return {
          messageId,
          createdAt: createdAt ?? 0,
        };
      })
      .filter(
        (
          item,
        ): item is {
          messageId: string;
          createdAt: number;
        } => item !== null,
      )
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 20);

    const importedMessages = (
      await Promise.all(
        candidateMessageIds.map(async ({ messageId }) => {
          const remoteMessage = await fetchMetaJsonWithRefresh(ctx, {
            accountId: syncContext.instagramAccountDocId,
            path: messageId,
            graphApiVersion: syncContext.graphApiVersion,
            accessToken: syncContext.accessToken,
            params: {
              fields: "id,created_time,from,to,message",
            },
          });

          const metaMessageId =
            typeof remoteMessage.id === "string" ? remoteMessage.id : null;
          const eventTime = parseTimestamp(
            typeof remoteMessage.created_time === "string" ||
              typeof remoteMessage.created_time === "number"
              ? (remoteMessage.created_time as string | number)
              : null,
          );

          if (metaMessageId === null || eventTime === null) {
            return null;
          }

          const senderId =
            remoteMessage.from &&
            typeof remoteMessage.from === "object" &&
            typeof (remoteMessage.from as { id?: unknown }).id === "string"
              ? (remoteMessage.from as { id: string }).id
              : null;
          const rawText =
            typeof remoteMessage.message === "string"
              ? remoteMessage.message.trim()
              : null;

          return {
            metaMessageId,
            direction:
              senderId === syncContext.instagramAccountExternalId
                ? ("outbound" as const)
                : ("inbound" as const),
            text: rawText && rawText.length > 0 ? rawText : null,
            eventTime,
          };
        }),
      )
    ).filter(
      (
        message,
      ): message is {
        metaMessageId: string;
        direction: "inbound" | "outbound";
        text: string | null;
        eventTime: number;
      } => message !== null,
    );

    const importResult: {
      insertedCount: number;
      updatedCount: number;
    } = await ctx.runMutation(internal.meta.history.importConversationHistory, {
      conversationId: args.conversationId,
      syncedAt: Date.now(),
      messages: importedMessages,
    });

    return {
      importedCount: importResult.insertedCount,
      updatedCount: importResult.updatedCount,
      skipped: false,
      reason: null,
    };
  },
});
