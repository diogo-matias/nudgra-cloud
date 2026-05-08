import { mutation, query, MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import {
  getWorkspaceInstagramAccountById,
  requireConnectedInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "../lib/auth";
import { getFollowerAutomationValidationIssues } from "./followerFlow";
import {
  normalizeAbsoluteUrl,
  normalizeStoryLinkButtonsInput,
  storyLinkButtonValidator,
  type StoryLinkButton,
} from "./storyShared";

const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);

type LatestFollowerSession = Doc<"followerAutomationSessions"> | null;

function getSerializedLinkButtons(automation: Doc<"followerAutomations">) {
  if (automation.linkButtons && automation.linkButtons.length > 0) {
    return automation.linkButtons;
  }

  if (automation.linkUrl.trim().length > 0) {
    return [
      {
        label: automation.linkButtonText ?? "Open link",
        url: automation.linkUrl,
      },
    ];
  }

  return [];
}

function serializeLatestSession(session: LatestFollowerSession) {
  if (session === null) {
    return null;
  }

  return {
    id: session._id,
    currentStep: session.currentStep,
    collectedEmail: session.collectedEmail,
    outboundMessageCount: session.outboundMessageCount ?? 0,
    guardrailTrippedAt: session.guardrailTrippedAt ?? null,
    guardrailReason: session.guardrailReason ?? null,
    linkSentAt: session.linkSentAt ?? null,
    linkClickedAt: session.linkClickedAt ?? null,
    followUpScheduledAt: session.followUpScheduledAt ?? null,
    followUpSentAt: session.followUpSentAt ?? null,
    startedAt: session.startedAt,
    lastStepAt: session.lastStepAt,
  };
}

function serializeFollowerAutomation(
  automation: Doc<"followerAutomations">,
  tagsById: Map<Id<"tags">, Doc<"tags">>,
  sequencesById: Map<Id<"sequenceDefinitions">, Doc<"sequenceDefinitions">>,
  latestSession: LatestFollowerSession = null,
) {
  const linkButtons = getSerializedLinkButtons(automation);

  return {
    id: automation._id,
    name: automation.name,
    status: automation.status,
    welcomeDmText: automation.welcomeDmText,
    linkDmText: automation.linkDmText,
    linkUrl: automation.linkUrl,
    linkButtonText: automation.linkButtonText ?? "Open link",
    linkButtons,
    emailCollectionEnabled: automation.emailCollectionEnabled,
    emailCollectionText: automation.emailCollectionText,
    followUpEnabled: automation.followUpEnabled,
    followUpText: automation.followUpText,
    tags: automation.tagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is Doc<"tags"> => tag !== undefined)
      .map((tag) => ({ id: tag._id, label: tag.label, color: tag.color })),
    tagIds: automation.tagIds,
    sequence:
      automation.sequenceDefinitionId &&
      sequencesById.get(automation.sequenceDefinitionId) !== undefined
        ? {
            id: automation.sequenceDefinitionId,
            name: sequencesById.get(automation.sequenceDefinitionId)!.name,
            isActive:
              sequencesById.get(automation.sequenceDefinitionId)!.isActive,
            stepCount:
              sequencesById.get(automation.sequenceDefinitionId)!.steps.length,
          }
        : null,
    sequenceDefinitionId: automation.sequenceDefinitionId,
    guardrailTrippedAt: automation.guardrailTrippedAt ?? null,
    guardrailReason: automation.guardrailReason ?? null,
    guardrailSessionId: automation.guardrailSessionId ?? null,
    guardrailConversationId: automation.guardrailConversationId ?? null,
    validationIssues: getFollowerAutomationValidationIssues({
      ...automation,
      linkButtons,
    }),
    triggerCount: automation.triggerCount,
    lastTriggeredAt: automation.lastTriggeredAt,
    createdAt: automation._creationTime,
    lastModifiedAt: automation.lastModifiedAt ?? automation._creationTime,
    latestSession: serializeLatestSession(latestSession),
  };
}

function getPrimaryLink(linkButtons: StoryLinkButton[]) {
  return linkButtons[0] ?? null;
}

function getNormalizedLinkButtonsFromArgs(args: {
  linkButtons: StoryLinkButton[];
  linkUrl: string;
  linkButtonText: string;
}) {
  if (args.linkButtons.length > 0) {
    return normalizeStoryLinkButtonsInput(args.linkButtons);
  }

  if (args.linkUrl.trim().length > 0) {
    return normalizeStoryLinkButtonsInput([
      {
        label: args.linkButtonText,
        url: args.linkUrl,
      },
    ]);
  }

  return [];
}

async function validateFollowerRelations(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    tagIds: Id<"tags">[];
    sequenceDefinitionId: Id<"sequenceDefinitions"> | null;
  },
) {
  for (const tagId of args.tagIds) {
    const tag = await ctx.db.get(tagId);
    if (tag === null || tag.workspaceId !== args.workspaceId) {
      throw new Error("A selected tag does not belong to this workspace.");
    }
  }

  if (args.sequenceDefinitionId !== null) {
    const sequence = await ctx.db.get(args.sequenceDefinitionId);
    if (sequence === null || sequence.workspaceId !== args.workspaceId) {
      throw new Error("The selected sequence does not belong to this workspace.");
    }
  }
}

function normalizeFollowerAutomationInput(args: {
  welcomeDmText: string;
  linkDmText: string;
  linkButtons: StoryLinkButton[];
  linkUrl: string;
  linkButtonText: string;
  followUpEnabled: boolean;
}) {
  const normalizedLinkButtons = getNormalizedLinkButtonsFromArgs(args);
  const primaryLink = getPrimaryLink(normalizedLinkButtons);
  const validationIssues = getFollowerAutomationValidationIssues({
    welcomeDmText: args.welcomeDmText,
    linkDmText: args.linkDmText,
    linkButtons: normalizedLinkButtons,
    linkUrl: primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
    linkButtonText:
      primaryLink?.label || args.linkButtonText.trim() || "Open link",
    followUpEnabled: args.followUpEnabled,
  });

  if (validationIssues.length > 0) {
    throw new Error(validationIssues[0] ?? "Invalid automation configuration.");
  }

  return {
    normalizedLinkButtons,
    primaryLink,
  };
}

function isTerminalFollowerSession(
  step: Doc<"followerAutomationSessions">["currentStep"],
) {
  return (
    step === "completed" ||
    step === "link_sent" ||
    step === "guardrail_tripped"
  );
}

async function closeActiveFollowerSessions(
  ctx: MutationCtx,
  automationId: Doc<"followerAutomations">["_id"],
  now: number,
) {
  const sessions = await ctx.db
    .query("followerAutomationSessions")
    .withIndex("by_follower_automation_id", (q) =>
      q.eq("followerAutomationId", automationId),
    )
    .take(10_000);

  await Promise.all(
    sessions.map(async (session) => {
      if (isTerminalFollowerSession(session.currentStep)) {
        return;
      }

      await ctx.db.patch(session._id, {
        currentStep: "completed",
        lastStepAt: now,
      });
    }),
  );
}

async function loadFollowerDecorators(ctx: QueryCtx) {
  const workspace = await requireCurrentWorkspace(ctx);
  const [tags, sequences] = await Promise.all([
    ctx.db
      .query("tags")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(50),
    ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(25),
  ]);

  return {
    workspace,
    tagsById: new Map(tags.map((tag) => [tag._id, tag])),
    sequencesById: new Map(
      sequences.map((sequence) => [sequence._id, sequence]),
    ),
  };
}

export const listFollowerAutomations = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } =
      await loadFollowerDecorators(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automations = await ctx.db
      .query("followerAutomations")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .take(50);

    return Promise.all(
      automations.map(async (automation) => {
        const sessions = await ctx.db
          .query("followerAutomationSessions")
          .withIndex("by_follower_automation_id", (q) =>
            q.eq("followerAutomationId", automation._id),
          )
          .take(10000);

        return {
          ...serializeFollowerAutomation(automation, tagsById, sequencesById),
          totalSessions: sessions.length,
          buttonClickCount: sessions.filter(
            (session) => (session.linkClickedAt ?? null) !== null,
          ).length,
        };
      }),
    );
  },
});

export const getFollowerAutomationCreationOptions = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccountById(
      ctx,
      workspace._id,
      args.accountId,
    );
    const [tags, sequences] = await Promise.all([
      ctx.db
        .query("tags")
        .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
        .take(50),
      ctx.db
        .query("sequenceDefinitions")
        .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
        .take(25),
    ]);

    return {
      hasConnectedAccount: account !== null && account.status !== "disconnected",
      tags: tags.map((tag) => ({
        id: tag._id,
        label: tag.label,
        color: tag.color,
      })),
      sequences: sequences.map((sequence) => ({
        id: sequence._id,
        name: sequence.name,
        isActive: sequence.isActive,
        stepCount: sequence.steps.length,
      })),
    };
  },
});

export const getFollowerAutomationById = query({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("followerAutomations"),
  },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } =
      await loadFollowerDecorators(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automation = await ctx.db.get(args.automationId);
    if (
      automation === null ||
      automation.workspaceId !== workspace._id ||
      automation.instagramAccountId !== args.accountId
    ) {
      return null;
    }

    const latestSession =
      (
        await ctx.db
          .query("followerAutomationSessions")
          .withIndex("by_follower_automation_id", (q) =>
            q.eq("followerAutomationId", automation._id),
          )
          .order("desc")
          .take(1)
      )[0] ?? null;

    return serializeFollowerAutomation(
      automation,
      tagsById,
      sequencesById,
      latestSession,
    );
  },
});

export const createFollowerAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    name: v.string(),
    welcomeDmText: v.string(),
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),
    linkDmText: v.string(),
    linkButtons: v.array(storyLinkButtonValidator),
    linkUrl: v.string(),
    linkButtonText: v.string(),
    followUpEnabled: v.boolean(),
    followUpText: v.string(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
    goLive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireConnectedInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );
    const userId = await requireCurrentUserId(ctx);

    if (!args.name.trim()) {
      throw new Error("Automation name is required.");
    }

    await validateFollowerRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    const normalized = normalizeFollowerAutomationInput(args);
    const now = Date.now();
    const status: Doc<"followerAutomations">["status"] = args.goLive
      ? "live"
      : "draft";

    const automationId = await ctx.db.insert("followerAutomations", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      createdByUserId: userId,
      name: args.name.trim(),
      status,
      welcomeDmText: args.welcomeDmText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: args.linkDmText.trim(),
      linkUrl: normalized.primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        normalized.primaryLink?.label ||
        args.linkButtonText.trim() ||
        "Open link",
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      guardrailTrippedAt: null,
      guardrailReason: null,
      guardrailSessionId: null,
      guardrailConversationId: null,
      triggerCount: 0,
      lastTriggeredAt: null,
      lastModifiedAt: now,
    });

    return { automationId };
  },
});

export const updateFollowerAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("followerAutomations"),
    name: v.string(),
    welcomeDmText: v.string(),
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),
    linkDmText: v.string(),
    linkButtons: v.array(storyLinkButtonValidator),
    linkUrl: v.string(),
    linkButtonText: v.string(),
    followUpEnabled: v.boolean(),
    followUpText: v.string(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automation = await ctx.db.get(args.automationId);
    if (
      automation === null ||
      automation.workspaceId !== workspace._id ||
      automation.instagramAccountId !== args.accountId
    ) {
      throw new Error("Automation not found.");
    }

    if (!args.name.trim()) {
      throw new Error("Automation name is required.");
    }

    await validateFollowerRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    const normalized = normalizeFollowerAutomationInput(args);

    await ctx.db.patch(automation._id, {
      name: args.name.trim(),
      welcomeDmText: args.welcomeDmText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: args.linkDmText.trim(),
      linkUrl: normalized.primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        normalized.primaryLink?.label ||
        args.linkButtonText.trim() ||
        "Open link",
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      guardrailTrippedAt: automation.status === "live" ? null : automation.guardrailTrippedAt ?? null,
      guardrailReason: automation.status === "live" ? null : automation.guardrailReason ?? null,
      guardrailSessionId: automation.status === "live" ? null : automation.guardrailSessionId ?? null,
      guardrailConversationId:
        automation.status === "live" ? null : automation.guardrailConversationId ?? null,
      lastModifiedAt: Date.now(),
    });

    return { automationId: automation._id };
  },
});

export const toggleFollowerAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("followerAutomations"),
    status: v.union(v.literal("live"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automation = await ctx.db.get(args.automationId);
    if (
      automation === null ||
      automation.workspaceId !== workspace._id ||
      automation.instagramAccountId !== args.accountId
    ) {
      throw new Error("Automation not found.");
    }

    if (args.status === "live") {
      const issues = getFollowerAutomationValidationIssues({
        ...automation,
        linkButtons: getSerializedLinkButtons(automation),
      });
      if (issues.length > 0) {
        throw new Error(issues[0] ?? "Automation must be fixed before going live.");
      }
    }

    await ctx.db.patch(automation._id, {
      status: args.status,
      guardrailTrippedAt:
        args.status === "live" ? null : (automation.guardrailTrippedAt ?? null),
      guardrailReason:
        args.status === "live" ? null : (automation.guardrailReason ?? null),
      guardrailSessionId:
        args.status === "live" ? null : (automation.guardrailSessionId ?? null),
      guardrailConversationId:
        args.status === "live"
          ? null
          : (automation.guardrailConversationId ?? null),
      lastModifiedAt: Date.now(),
    });

    return { automationId: automation._id, status: args.status };
  },
});

export const deleteFollowerAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("followerAutomations"),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automation = await ctx.db.get(args.automationId);
    if (
      automation === null ||
      automation.workspaceId !== workspace._id ||
      automation.instagramAccountId !== args.accountId
    ) {
      throw new Error("Automation not found.");
    }

    const now = Date.now();
    await closeActiveFollowerSessions(ctx, automation._id, now);
    await ctx.db.delete(automation._id);

    return { automationId: args.automationId };
  },
});
