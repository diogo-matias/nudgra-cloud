import { mutation, query } from "./_generated/server";
import { getCurrentWorkspace, requireCurrentUserId } from "./lib/auth";

const DEFAULT_TAGS = [
  { label: "new", color: "slate" },
  { label: "interested", color: "blue" },
  { label: "customer", color: "amber" },
];

const DEFAULT_SEQUENCE_STEPS = [
  {
    delayMinutes: 60,
    messageText:
      "Thanks again for reaching out. Reply here if you want the next step.",
  },
  {
    delayMinutes: 1440,
    messageText:
      "Following up in case you still want the details. I can send them here.",
  },
];

export const ensureCurrentWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireCurrentUserId(ctx);
    const existingWorkspace = await getCurrentWorkspace(ctx);
    if (existingWorkspace !== null) {
      return { workspaceId: existingWorkspace._id, created: false };
    }

    const user = await ctx.db.get(userId);
    const displayName =
      user?.name?.trim() ||
      (user?.email ? `${user.email.split("@")[0]}'s workspace` : "My workspace");

    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: displayName,
      timezone: "UTC",
    });

    for (const tag of DEFAULT_TAGS) {
      await ctx.db.insert("tags", {
        workspaceId,
        label: tag.label,
        color: tag.color,
      });
    }

    await ctx.db.insert("sequenceDefinitions", {
      workspaceId,
      name: "Warm follow-up",
      isActive: true,
      steps: DEFAULT_SEQUENCE_STEPS,
    });

    return { workspaceId, created: true };
  },
});

export const getCurrentWorkspaceSummary = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await getCurrentWorkspace(ctx);
    if (workspace === null) {
      return null;
    }

    return {
      id: workspace._id,
      name: workspace.name,
      timezone: workspace.timezone,
    };
  },
});
