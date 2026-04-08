"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { META_GRAPH_API_VERSION } from "./config";

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

// ── Action: reply to a comment under a post ──────────────────────

export const replyToComment = internalAction({
  args: {
    commentId: v.string(),
    message: v.string(),
    accessToken: v.string(),
    graphApiVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const version = args.graphApiVersion || META_GRAPH_API_VERSION;
    const endpoint = new URL(
      `https://graph.instagram.com/${version}/${args.commentId}/replies`,
    );
    endpoint.searchParams.set("access_token", args.accessToken);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: args.message }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const reason = parseMetaErrorMessage(responseText);
      console.error(`Failed to reply to comment ${args.commentId}: ${reason}`);
      return { success: false, error: reason };
    }

    let replyId: string | null = null;
    try {
      const parsed = JSON.parse(responseText) as { id?: string };
      replyId = parsed.id ?? null;
    } catch {
      // ignore
    }

    return { success: true, replyId };
  },
});
