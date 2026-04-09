import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const consumeTrackedLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const trackedLink = await ctx.db
      .query("commentAutomationTrackedLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (trackedLink === null) {
      throw new Error("Tracked link not found.");
    }

    const now = Date.now();
    if (trackedLink.clickedAt === null) {
      await ctx.db.patch(trackedLink._id, { clickedAt: now });
    }

    const session = await ctx.db.get(trackedLink.sessionId);
    if (session !== null && (session.linkClickedAt ?? null) === null) {
      await ctx.db.patch(session._id, {
        linkClickedAt: now,
        lastStepAt: now,
      });
    }

    return { destinationUrl: trackedLink.destinationUrl };
  },
});
