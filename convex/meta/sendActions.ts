"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";

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

export const performQueuedDelivery = internalAction({
  args: { deliveryAttemptId: v.id("deliveryAttempts") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.meta.send.getQueuedDeliveryContext, {
      deliveryAttemptId: args.deliveryAttemptId,
    });

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
        message: {
          text: context.attempt.messageText,
        },
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const reason = parseMetaErrorMessage(responseText);

      if (isTransientFailure(response.status) && context.attempt.attemptNumber < 3) {
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
