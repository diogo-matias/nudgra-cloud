"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";

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

function parseMetaErrorMessage(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string };
    };
    return parsed.error?.message ?? responseText;
  } catch {
    return responseText;
  }
}

function isTransientFailure(status: number) {
  return status === 429 || status >= 500;
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

function buildMetaMessagePayload(
  fallbackText: string,
  requestPayload: string | null,
) {
  const parsed = parseStoredRequestPayload(requestPayload);

  if (parsed === null) {
    return {
      text: fallbackText,
    };
  }

  if (parsed.kind === "text") {
    return {
      text: parsed.text,
    };
  }

  if (parsed.kind === "quick_reply") {
    return {
      text: parsed.text,
      quick_replies: parsed.quickReplies,
    };
  }

  return {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: parsed.text,
        buttons: parsed.buttons,
      },
    },
  };
}

export const performQueuedDelivery = internalAction({
  args: { deliveryAttemptId: v.id("deliveryAttempts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.meta.send.getQueuedDeliveryContext,
      {
        deliveryAttemptId: args.deliveryAttemptId,
      },
    );

    if (
      context === null ||
      context.attempt.status !== "queued" ||
      context.account.status !== "connected" ||
      !context.account.graphAccessToken
    ) {
      return null;
    }

    const endpoint = new URL(
      `https://graph.instagram.com/${
        context.account.graphApiVersion || META_GRAPH_API_VERSION
      }/${context.account.instagramAccountId}/messages`,
    );
    endpoint.searchParams.set("access_token", context.account.graphAccessToken);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: {
          id: context.contact.instagramUserId,
        },
        message: buildMetaMessagePayload(
          context.attempt.messageText,
          context.attempt.requestPayload,
        ),
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const reason = parseMetaErrorMessage(responseText);

      if (
        isTransientFailure(response.status) &&
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
