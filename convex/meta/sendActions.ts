"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";
import {
  canUseAccountToken,
  isMetaAuthError,
  isMetaOutsideAllowedWindowError,
  isMetaTransientError,
  parseMetaApiError,
} from "./authShared";
import {
  getDeliveryExpiredReason,
  getDeliveryKind,
  isDeliveryPolicyWindowOpen,
} from "./deliveryPolicy";

type ParsedQuickReply = {
  content_type: "text";
  title: string;
  payload: string;
};

type ParsedButton =
  | {
      type: "web_url";
      title: string;
      url: string;
    }
  | {
      type: "postback";
      title: string;
      payload: string;
    };

type ParsedMessageDescriptor =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "story_reply_reaction";
      emoji: string;
      triggerMessageId: string;
    }
  | {
      kind: "quick_reply";
      text: string;
      quickReplies: ParsedQuickReply[];
    }
  | {
      kind: "button_template";
      text: string;
      buttons: ParsedButton[];
    };

function parseRetryDelayMs(response: Response) {
  const retryAfterHeader = response.headers.get("retry-after");
  if (!retryAfterHeader) {
    return 30_000;
  }

  const retryAfterSeconds = Number(retryAfterHeader);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return 30_000;
  }

  return retryAfterSeconds * 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStoredRequestPayload(
  requestPayload: string | null,
): ParsedMessageDescriptor | null {
  if (requestPayload === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(requestPayload) as unknown;
    if (!isRecord(parsed) || typeof parsed.kind !== "string") {
      return null;
    }

    if (parsed.kind === "text" && typeof parsed.text === "string") {
      return {
        kind: "text",
        text: parsed.text,
      };
    }

    if (
      parsed.kind === "story_reply_reaction" &&
      typeof parsed.emoji === "string" &&
      typeof parsed.triggerMessageId === "string" &&
      parsed.emoji.trim().length > 0 &&
      parsed.triggerMessageId.trim().length > 0
    ) {
      return {
        kind: "story_reply_reaction",
        emoji: parsed.emoji,
        triggerMessageId: parsed.triggerMessageId,
      };
    }

    if (
      parsed.kind === "quick_reply" &&
      typeof parsed.text === "string" &&
      Array.isArray(parsed.quickReplies)
    ) {
      const quickReplies = parsed.quickReplies
        .filter(
          (reply): reply is ParsedQuickReply =>
            isRecord(reply) &&
            reply.content_type === "text" &&
            typeof reply.title === "string" &&
            typeof reply.payload === "string",
        )
        .slice(0, 13);

      if (quickReplies.length === 0) {
        return null;
      }

      return {
        kind: "quick_reply",
        text: parsed.text,
        quickReplies,
      };
    }

    if (
      parsed.kind === "button_template" &&
      typeof parsed.text === "string" &&
      Array.isArray(parsed.buttons)
    ) {
      const buttons = parsed.buttons
        .map((button) => {
          if (
            isRecord(button) &&
            button.type === "web_url" &&
            typeof button.title === "string" &&
            typeof button.url === "string"
          ) {
            return {
              type: "web_url" as const,
              title: button.title,
              url: button.url,
            };
          }

          if (
            isRecord(button) &&
            button.type === "postback" &&
            typeof button.title === "string" &&
            typeof button.payload === "string"
          ) {
            return {
              type: "postback" as const,
              title: button.title,
              payload: button.payload,
            };
          }

          return null;
        })
        .filter((button): button is ParsedButton => button !== null)
        .slice(0, 3);

      if (buttons.length === 0) {
        return null;
      }

      return {
        kind: "button_template",
        text: parsed.text,
        buttons,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function buildRecipient(args: {
  recipientId: string;
  deliveryKind: "response_dm" | "private_reply";
  privateReplyCommentId: string | null;
}) {
  if (args.deliveryKind === "private_reply") {
    if (!args.privateReplyCommentId) {
      throw new Error("Missing comment ID for private reply delivery.");
    }
    return {
      comment_id: args.privateReplyCommentId,
    };
  }

  return {
    id: args.recipientId,
  };
}

function buildMessageEnvelope(
  args: {
    recipientId: string;
    deliveryKind: "response_dm" | "private_reply";
    privateReplyCommentId: string | null;
  },
  message: Record<string, unknown>,
) {
  const recipient = buildRecipient(args);
  if (args.deliveryKind === "private_reply") {
    return { recipient, message };
  }

  return {
    messaging_type: "RESPONSE" as const,
    recipient,
    message,
  };
}

function buildMetaSendRequest(args: {
  recipientId: string;
  fallbackText: string;
  requestPayload: string | null;
  deliveryKind: "response_dm" | "private_reply";
  privateReplyCommentId: string | null;
}) {
  const parsed = parseStoredRequestPayload(args.requestPayload);

  if (parsed === null) {
    return buildMessageEnvelope(args, {
      text: args.fallbackText,
    });
  }

  if (parsed.kind === "story_reply_reaction") {
    if (args.deliveryKind === "private_reply") {
      return buildMessageEnvelope(args, {
        text: args.fallbackText,
      });
    }

    return {
      recipient: {
        id: args.recipientId,
      },
      sender_action: "react" as const,
      payload: {
        message_id: parsed.triggerMessageId,
        reaction: "love" as const,
      },
    };
  }

  if (parsed.kind === "text") {
    return buildMessageEnvelope(args, {
      text: parsed.text,
    });
  }

  if (parsed.kind === "quick_reply") {
    return buildMessageEnvelope(args, {
      text: parsed.text,
      quick_replies: parsed.quickReplies,
    });
  }

  return buildMessageEnvelope(args, {
    attachment: {
      type: "template" as const,
      payload: {
        template_type: "button" as const,
        text: parsed.text,
        buttons: parsed.buttons,
      },
    },
  });
}

function getAttemptPolicyReason(args: {
  attempt: {
    deliveryKind?: "response_dm" | "private_reply";
    privateReplyExpiresAt?: number | null;
  };
}) {
  return getDeliveryExpiredReason({
    deliveryKind: getDeliveryKind(args.attempt),
    privateReplyExpiresAt: args.attempt.privateReplyExpiresAt ?? null,
  });
}

function getUnavailableAttemptStatus(args: {
  account: {
    status: "connected" | "connection_error" | "disconnected";
  };
  attempt: {
    deliveryKind?: "response_dm" | "private_reply";
    privateReplyExpiresAt?: number | null;
  };
  conversation: {
    messagingWindowClosesAt: number | null;
  };
}) {
  const now = Date.now();
  const policyWindowOpen = isDeliveryPolicyWindowOpen({
    attempt: {
      deliveryKind: getDeliveryKind(args.attempt),
      privateReplyExpiresAt: args.attempt.privateReplyExpiresAt ?? null,
    },
    conversation: args.conversation,
    now,
  });

  if (!policyWindowOpen) {
    return {
      status: "skipped_expired" as const,
      reason: getAttemptPolicyReason({
        attempt: args.attempt,
      }),
    };
  }

  if (args.account.status === "disconnected") {
    return {
      status: "skipped" as const,
      reason:
        "Instagram account was disconnected before the delivery could be sent.",
    };
  }

  return {
    status: "blocked_auth" as const,
    reason: "Outbound sending is paused until Instagram token access recovers.",
  };
}

export const performQueuedDelivery = internalAction({
  args: { deliveryAttemptId: v.id("deliveryAttempts") },
  handler: async (ctx, args) => {
    let context = await ctx.runQuery(
      internal.meta.send.getQueuedDeliveryContext,
      {
        deliveryAttemptId: args.deliveryAttemptId,
      },
    );

    if (context === null || context.attempt.status !== "queued") {
      return null;
    }

    const tokenUsable = canUseAccountToken({
      status: context.account.status,
      graphAccessToken: context.account.graphAccessToken,
      reconnectRequired: context.account.reconnectRequired ?? false,
    });

    if (!tokenUsable) {
      const unavailable = getUnavailableAttemptStatus({
        account: context.account,
        attempt: context.attempt,
        conversation: context.conversation,
      });
      await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
        deliveryAttemptId: context.attempt._id,
        status: unavailable.status,
        reason: unavailable.reason,
        responsePayload: null,
        metaMessageId: null,
      });
      return null;
    }

    const tokenExpired =
      context.account.tokenExpiresAt !== null &&
      context.account.tokenExpiresAt <= Date.now();

    if (tokenExpired) {
      const refreshResult: {
        tokenUsable: boolean;
      } = await ctx.runAction(
        internal.meta.tokenLifecycle.refreshAccountToken,
        {
          accountId: context.account._id,
          reason: "scheduled",
        },
      );

      if (!refreshResult.tokenUsable) {
        await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
          deliveryAttemptId: context.attempt._id,
          status: "blocked_auth",
          reason:
            "Outbound sending is paused until Instagram token access recovers.",
          responsePayload: null,
          metaMessageId: null,
        });
        return null;
      }

      context = await ctx.runQuery(
        internal.meta.send.getQueuedDeliveryContext,
        {
          deliveryAttemptId: args.deliveryAttemptId,
        },
      );
      if (context === null || context.attempt.status !== "queued") {
        return null;
      }

      const refreshedTokenUsable = canUseAccountToken({
        status: context.account.status,
        graphAccessToken: context.account.graphAccessToken,
        reconnectRequired: context.account.reconnectRequired ?? false,
      });
      if (!refreshedTokenUsable) {
        const unavailable = getUnavailableAttemptStatus({
          account: context.account,
          attempt: context.attempt,
          conversation: context.conversation,
        });
        await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
          deliveryAttemptId: context.attempt._id,
          status: unavailable.status,
          reason: unavailable.reason,
          responsePayload: null,
          metaMessageId: null,
        });
        return null;
      }
    }

    const accessToken = context.account.graphAccessToken;
    if (accessToken === null) {
      await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
        deliveryAttemptId: context.attempt._id,
        status: "blocked_auth",
        reason:
          "Outbound sending is paused until Instagram token access recovers.",
        responsePayload: null,
        metaMessageId: null,
      });
      return null;
    }

    const endpoint = new URL(
      `https://graph.instagram.com/${
        context.account.graphApiVersion || META_GRAPH_API_VERSION
      }/${context.account.instagramAccountId}/messages`,
    );
    endpoint.searchParams.set("access_token", accessToken);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildMetaSendRequest({
          recipientId: context.contact.instagramUserId,
          fallbackText: context.attempt.messageText,
          requestPayload: context.attempt.requestPayload,
          deliveryKind: getDeliveryKind(context.attempt),
          privateReplyCommentId: context.attempt.privateReplyCommentId ?? null,
        }),
      ),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const parsedError = parseMetaApiError(
        responseText,
        `Meta rejected the delivery with status ${response.status}.`,
      );
      const reason = parsedError.message;

      if (isMetaAuthError(parsedError)) {
        const refreshResult: {
          tokenUsable: boolean;
        } = await ctx.runAction(
          internal.meta.tokenLifecycle.refreshAccountToken,
          {
            accountId: context.account._id,
            reason: "auth_error",
          },
        );

        if (refreshResult.tokenUsable && context.attempt.attemptNumber < 3) {
          await ctx.runMutation(internal.meta.send.rescheduleDeliveryAttempt, {
            deliveryAttemptId: context.attempt._id,
            delayMs: 0,
            reason: "Retrying delivery after token refresh.",
            responsePayload: responseText,
          });
          return null;
        }

        await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
          deliveryAttemptId: context.attempt._id,
          status: "blocked_auth",
          reason,
          responsePayload: responseText,
          metaMessageId: null,
        });
        return null;
      }

      if (isMetaOutsideAllowedWindowError(parsedError)) {
        await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
          deliveryAttemptId: context.attempt._id,
          status: "skipped_expired",
          reason,
          responsePayload: responseText,
          metaMessageId: null,
        });
        return null;
      }

      if (
        isMetaTransientError(response.status) &&
        context.attempt.attemptNumber < 3
      ) {
        await ctx.runMutation(internal.meta.send.rescheduleDeliveryAttempt, {
          deliveryAttemptId: context.attempt._id,
          delayMs: parseRetryDelayMs(response),
          reason,
          responsePayload: responseText,
        });
        return null;
      }

      await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
        deliveryAttemptId: context.attempt._id,
        status: "failed",
        reason,
        responsePayload: responseText,
        metaMessageId: null,
      });
      return null;
    }

    let metaMessageId: string | null = null;
    try {
      const parsed = JSON.parse(responseText) as {
        message_id?: string;
        id?: string;
      };
      metaMessageId = parsed.message_id ?? parsed.id ?? null;
    } catch {
      metaMessageId = null;
    }

    await ctx.runMutation(internal.meta.send.markDeliveryAttemptResult, {
      deliveryAttemptId: context.attempt._id,
      status: "sent",
      reason: null,
      responsePayload: responseText,
      metaMessageId,
    });

    return null;
  },
});
