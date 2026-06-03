import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { requireMetaEnv } from "./meta/config";
import { verifyMetaWebhookSignature } from "./meta/webhookSignature";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/meta/webhooks",
  method: "GET",
  handler: httpAction(async (_, request) => {
    const { verifyToken } = requireMetaEnv();
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Invalid verification request", { status: 403 });
  }),
});

http.route({
  path: "/meta/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { appSecret } = requireMetaEnv();
    const body = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    const signatureValid = await verifyMetaWebhookSignature({
      body,
      appSecret,
      signatureHeader,
    });
    if (!signatureValid) {
      return new Response("Invalid webhook signature", { status: 403 });
    }

    // Route based on webhook object type
    let isCommentWebhook = false;
    let isFollowerWebhook = false;
    try {
      const payload = JSON.parse(body);
      const entries = Array.isArray(payload?.entry) ? payload.entry : [];
      for (const entry of entries) {
        if (Array.isArray(entry?.changes)) {
          for (const change of entry.changes) {
            if (change?.field === "comments") {
              isCommentWebhook = true;
              break;
            }
            if (
              change?.field === "followers" ||
              change?.field === "follower" ||
              change?.field === "follow"
            ) {
              isFollowerWebhook = true;
              break;
            }
          }
        }
        if (isCommentWebhook || isFollowerWebhook) break;
      }
    } catch {
      // If JSON parsing fails, fall through to message handler
    }

    if (isFollowerWebhook) {
      await ctx.runMutation(internal.meta.followerWebhooks.ingestFollowerWebhookPayload, {
        body,
      });
    } else if (isCommentWebhook) {
      await ctx.runAction(internal.meta.commentWebhooks.ingestCommentWebhookPayload, {
        body,
      });
    } else {
      await ctx.runMutation(internal.meta.webhooks.ingestWebhookPayload, {
        body,
      });
    }

    return new Response("ok", { status: 200 });
  }),
});

export default http;
