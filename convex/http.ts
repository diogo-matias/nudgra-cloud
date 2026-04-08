import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { requireMetaEnv } from "./meta/config";

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
    const body = await request.text();
    await ctx.runMutation(internal.meta.webhooks.ingestWebhookPayload, { body });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
