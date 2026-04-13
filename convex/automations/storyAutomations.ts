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
import {
  getEffectiveStoryLinkDmText,
  getStoryAutomationValidationIssues as getSharedStoryAutomationValidationIssues,
  getStoryTokenEntries,
  normalizeAbsoluteUrl,
  normalizeStoryLinkButtonsInput,
  STORY_EXPIRED_MESSAGE,
  storyLinkButtonValidator,
  type StoryLinkButton,
} from "./storyShared";

const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);

type LatestStorySession = Doc<"storyAutomationSessions"> | null;

function getSerializedLinkButtons(automation: Doc<"storyAutomations">) {
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

function getValidationIssues(args: {
  storyScope: "any" | "specific";
  selectedStoryId: string | null;
  selectedStoryExpiredAt?: number | null;
  replyFilter:
    | "specific_words_or_reactions"
    | "any_word_or_reaction";
  triggerTokens: string[];
  linkDmText: string;
  linkButtons: StoryLinkButton[];
  followUpEnabled: boolean;
}) {
  return getSharedStoryAutomationValidationIssues({
    storyScope: args.storyScope,
    selectedStoryId: args.selectedStoryId,
    selectedStoryExpiredAt: args.selectedStoryExpiredAt ?? null,
    replyFilter: args.replyFilter,
    triggerTokens: args.triggerTokens,
    linkDmText: args.linkDmText,
    linkButtons: args.linkButtons,
    followUpEnabled: args.followUpEnabled,
  });
}

function serializeLatestSession(session: LatestStorySession) {
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
    reactionSentAt: session.reactionSentAt ?? null,
    startedAt: session.startedAt,
    lastStepAt: session.lastStepAt,
  };
}

function serializeStoryAutomation(
  automation: Doc<"storyAutomations">,
  tagsById: Map<Id<"tags">, Doc<"tags">>,
  sequencesById: Map<Id<"sequenceDefinitions">, Doc<"sequenceDefinitions">>,
  latestSession: LatestStorySession = null,
) {
  const linkButtons = getSerializedLinkButtons(automation);
  const triggerTokenLabels =
    automation.triggerTokenLabels && automation.triggerTokenLabels.length > 0
      ? automation.triggerTokenLabels
      : automation.triggerTokens;

  return {
    id: automation._id,
    name: automation.name,
    status: automation.status,
    storyScope: automation.storyScope,
    selectedStoryId: automation.selectedStoryId,
    selectedStory: automation.selectedStoryId
      ? {
          id: automation.selectedStoryId,
          mediaType: automation.selectedStoryMediaType ?? null,
          thumbnailUrl: automation.selectedStoryThumbnailUrl ?? null,
          mediaUrl: automation.selectedStoryMediaUrl ?? null,
          permalink: automation.selectedStoryPermalink ?? null,
          timestamp: automation.selectedStoryTimestamp ?? null,
        }
      : null,
    replyFilter: automation.replyFilter,
    triggerTokens: automation.triggerTokens,
    triggerTokenLabels,
    reactionEnabled: automation.reactionEnabled,
    followGateEnabled: automation.followGateEnabled,
    followGateText: automation.followGateText,
    emailCollectionEnabled: automation.emailCollectionEnabled,
    emailCollectionText: automation.emailCollectionText,
    linkDmText: automation.linkDmText,
    linkUrl: automation.linkUrl,
    linkButtonText: automation.linkButtonText ?? "Open link",
    linkButtons,
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
    selectedStoryExpiredAt: automation.selectedStoryExpiredAt ?? null,
    selectedStoryExpiredReason: automation.selectedStoryExpiredReason ?? null,
    guardrailTrippedAt: automation.guardrailTrippedAt ?? null,
    guardrailReason: automation.guardrailReason ?? null,
    guardrailSessionId: automation.guardrailSessionId ?? null,
    guardrailConversationId: automation.guardrailConversationId ?? null,
    validationIssues: getValidationIssues({
      storyScope: automation.storyScope,
      selectedStoryId: automation.selectedStoryId,
      selectedStoryExpiredAt: automation.selectedStoryExpiredAt ?? null,
      replyFilter: automation.replyFilter,
      triggerTokens: automation.triggerTokens,
      linkDmText: automation.linkDmText,
      linkButtons,
      followUpEnabled: automation.followUpEnabled,
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

async function validateStoryRelations(
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

async function resolveSelectedStoryState(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    instagramAccountId: Id<"instagramAccounts">;
    storyScope: "any" | "specific";
    selectedStoryId: string;
    existingAutomation?: Doc<"storyAutomations"> | null;
  },
) {
  if (args.storyScope === "any") {
    return {
      selectedStoryId: null,
      selectedStoryMediaType: null,
      selectedStoryThumbnailUrl: null,
      selectedStoryMediaUrl: null,
      selectedStoryPermalink: null,
      selectedStoryTimestamp: null,
      selectedStoryExpiredAt: null,
      selectedStoryExpiredReason: null,
    };
  }

  const selectedStoryId = args.selectedStoryId.trim();
  if (!selectedStoryId) {
    throw new Error("Select a specific story.");
  }

  const cachedStory = await ctx.db
    .query("instagramStories")
    .withIndex("by_instagram_account_id_and_story_id", (q) =>
      q.eq("instagramAccountId", args.instagramAccountId).eq("storyId", selectedStoryId),
    )
    .unique();

  const now = Date.now();
  if (cachedStory !== null && cachedStory.workspaceId === args.workspaceId) {
    return {
      selectedStoryId: cachedStory.storyId,
      selectedStoryMediaType: cachedStory.mediaType,
      selectedStoryThumbnailUrl: cachedStory.thumbnailUrl ?? null,
      selectedStoryMediaUrl: cachedStory.mediaUrl ?? null,
      selectedStoryPermalink: cachedStory.permalink ?? null,
      selectedStoryTimestamp: cachedStory.timestamp,
      selectedStoryExpiredAt: cachedStory.expiresAt <= now ? now : null,
      selectedStoryExpiredReason:
        cachedStory.expiresAt <= now ? STORY_EXPIRED_MESSAGE : null,
    };
  }

  if (args.existingAutomation?.selectedStoryId === selectedStoryId) {
    return {
      selectedStoryId,
      selectedStoryMediaType: args.existingAutomation.selectedStoryMediaType ?? null,
      selectedStoryThumbnailUrl:
        args.existingAutomation.selectedStoryThumbnailUrl ?? null,
      selectedStoryMediaUrl: args.existingAutomation.selectedStoryMediaUrl ?? null,
      selectedStoryPermalink:
        args.existingAutomation.selectedStoryPermalink ?? null,
      selectedStoryTimestamp:
        args.existingAutomation.selectedStoryTimestamp ?? null,
      selectedStoryExpiredAt:
        args.existingAutomation.selectedStoryExpiredAt ?? now,
      selectedStoryExpiredReason:
        args.existingAutomation.selectedStoryExpiredReason ??
        STORY_EXPIRED_MESSAGE,
    };
  }

  throw new Error(STORY_EXPIRED_MESSAGE);
}

function normalizeStoryAutomationInput(args: {
  replyFilter: "specific_words_or_reactions" | "any_word_or_reaction";
  triggerTokens: string[];
  triggerTokenLabels?: string[];
  linkDmText: string;
  linkButtons: StoryLinkButton[];
  linkUrl: string;
  linkButtonText: string;
  storyScope: "any" | "specific";
  selectedStoryId: string;
  selectedStoryExpiredAt?: number | null;
  followUpEnabled: boolean;
}) {
  const tokenEntries =
    args.replyFilter === "specific_words_or_reactions"
      ? getStoryTokenEntries(args.triggerTokenLabels ?? args.triggerTokens)
      : [];
  const normalizedLinkButtons = getNormalizedLinkButtonsFromArgs(args);
  const primaryLink = getPrimaryLink(normalizedLinkButtons);
  const effectiveLinkDmText = getEffectiveStoryLinkDmText({
    linkDmText: args.linkDmText,
    hasLinkButtons: normalizedLinkButtons.length > 0,
  });

  const validationIssues = getValidationIssues({
    storyScope: args.storyScope,
    selectedStoryId: args.selectedStoryId,
    selectedStoryExpiredAt: args.selectedStoryExpiredAt ?? null,
    replyFilter: args.replyFilter,
    triggerTokens: tokenEntries.map((entry) => entry.normalized),
    linkDmText: effectiveLinkDmText,
    linkButtons: normalizedLinkButtons,
    followUpEnabled: args.followUpEnabled,
  });

  if (validationIssues.length > 0) {
    throw new Error(validationIssues[0] ?? "Invalid automation configuration.");
  }

  return {
    triggerTokens: tokenEntries.map((entry) => entry.normalized),
    triggerTokenLabels: tokenEntries.map((entry) => entry.label),
    normalizedLinkButtons,
    primaryLink,
    effectiveLinkDmText,
  };
}

async function loadStoryDecorators(ctx: QueryCtx) {
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

export const listStoryAutomations = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } = await loadStoryDecorators(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);

    const automations = await ctx.db
      .query("storyAutomations")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .take(50);

    return Promise.all(
      automations.map(async (automation) => {
        const sessions = await ctx.db
          .query("storyAutomationSessions")
          .withIndex("by_story_automation_id", (q) =>
            q.eq("storyAutomationId", automation._id),
          )
          .take(10000);

        return {
          ...serializeStoryAutomation(
            automation,
            tagsById,
            sequencesById,
          ),
          totalSessions: sessions.length,
          buttonClickCount: sessions.filter(
            (session) => (session.linkClickedAt ?? null) !== null,
          ).length,
        };
      }),
    );
  },
});

export const getStoryAutomationCreationOptions = query({
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

export const getStoryAutomationById = query({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("storyAutomations"),
  },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } = await loadStoryDecorators(ctx);
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
          .query("storyAutomationSessions")
          .withIndex("by_story_automation_id", (q) =>
            q.eq("storyAutomationId", automation._id),
          )
          .order("desc")
          .take(1)
      )[0] ?? null;

    return serializeStoryAutomation(
      automation,
      tagsById,
      sequencesById,
      latestSession,
    );
  },
});

export const createStoryAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    name: v.string(),
    storyScope: v.union(v.literal("any"), v.literal("specific")),
    selectedStoryId: v.string(),
    replyFilter: v.union(
      v.literal("specific_words_or_reactions"),
      v.literal("any_word_or_reaction"),
    ),
    triggerTokens: v.array(v.string()),
    triggerTokenLabels: v.optional(v.array(v.string())),
    reactionEnabled: v.boolean(),
    followGateEnabled: v.boolean(),
    followGateText: v.string(),
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

    await validateStoryRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    const selectedStoryState = await resolveSelectedStoryState(ctx, {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      storyScope: args.storyScope,
      selectedStoryId: args.selectedStoryId,
    });

    const normalized = normalizeStoryAutomationInput({
      replyFilter: args.replyFilter,
      triggerTokens: args.triggerTokens,
      triggerTokenLabels: args.triggerTokenLabels,
      linkDmText: args.linkDmText,
      linkButtons: args.linkButtons,
      linkUrl: args.linkUrl,
      linkButtonText: args.linkButtonText,
      storyScope: args.storyScope,
      selectedStoryId: selectedStoryState.selectedStoryId ?? "",
      selectedStoryExpiredAt: selectedStoryState.selectedStoryExpiredAt,
      followUpEnabled: args.followUpEnabled,
    });

    const now = Date.now();
    const status: Doc<"storyAutomations">["status"] = args.goLive
      ? "live"
      : "draft";

    if (status === "live") {
      const liveIssues = getValidationIssues({
        storyScope: args.storyScope,
        selectedStoryId: selectedStoryState.selectedStoryId,
        selectedStoryExpiredAt: selectedStoryState.selectedStoryExpiredAt,
        replyFilter: args.replyFilter,
        triggerTokens: normalized.triggerTokens,
        followUpEnabled: args.followUpEnabled,
        linkButtons: normalized.normalizedLinkButtons,
        linkDmText: normalized.effectiveLinkDmText,
      });

      if (liveIssues.length > 0) {
        throw new Error(liveIssues[0] ?? "Automation must be fixed before going live.");
      }
    }

    const automationId = await ctx.db.insert("storyAutomations", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      createdByUserId: userId,
      name: args.name.trim(),
      status,
      storyScope: args.storyScope,
      selectedStoryId: selectedStoryState.selectedStoryId,
      selectedStoryMediaType: selectedStoryState.selectedStoryMediaType,
      selectedStoryThumbnailUrl: selectedStoryState.selectedStoryThumbnailUrl,
      selectedStoryMediaUrl: selectedStoryState.selectedStoryMediaUrl,
      selectedStoryPermalink: selectedStoryState.selectedStoryPermalink,
      selectedStoryTimestamp: selectedStoryState.selectedStoryTimestamp,
      replyFilter: args.replyFilter,
      triggerTokens: normalized.triggerTokens,
      triggerTokenLabels: normalized.triggerTokenLabels,
      reactionEnabled: args.reactionEnabled,
      followGateEnabled: args.followGateEnabled,
      followGateText: args.followGateText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: normalized.effectiveLinkDmText,
      linkUrl: normalized.primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        normalized.primaryLink?.label || args.linkButtonText.trim() || "Open link",
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      selectedStoryExpiredAt: selectedStoryState.selectedStoryExpiredAt,
      selectedStoryExpiredReason: selectedStoryState.selectedStoryExpiredReason,
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

export const updateStoryAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("storyAutomations"),
    name: v.string(),
    storyScope: v.union(v.literal("any"), v.literal("specific")),
    selectedStoryId: v.string(),
    replyFilter: v.union(
      v.literal("specific_words_or_reactions"),
      v.literal("any_word_or_reaction"),
    ),
    triggerTokens: v.array(v.string()),
    triggerTokenLabels: v.optional(v.array(v.string())),
    reactionEnabled: v.boolean(),
    followGateEnabled: v.boolean(),
    followGateText: v.string(),
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

    await validateStoryRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    const selectedStoryState = await resolveSelectedStoryState(ctx, {
      workspaceId: workspace._id,
      instagramAccountId: automation.instagramAccountId,
      storyScope: args.storyScope,
      selectedStoryId: args.selectedStoryId,
      existingAutomation: automation,
    });

    const normalized = normalizeStoryAutomationInput({
      replyFilter: args.replyFilter,
      triggerTokens: args.triggerTokens,
      triggerTokenLabels: args.triggerTokenLabels,
      linkDmText: args.linkDmText,
      linkButtons: args.linkButtons,
      linkUrl: args.linkUrl,
      linkButtonText: args.linkButtonText,
      storyScope: args.storyScope,
      selectedStoryId: selectedStoryState.selectedStoryId ?? "",
      selectedStoryExpiredAt: selectedStoryState.selectedStoryExpiredAt,
      followUpEnabled: args.followUpEnabled,
    });

    await ctx.db.patch(automation._id, {
      name: args.name.trim(),
      storyScope: args.storyScope,
      selectedStoryId: selectedStoryState.selectedStoryId,
      selectedStoryMediaType: selectedStoryState.selectedStoryMediaType,
      selectedStoryThumbnailUrl: selectedStoryState.selectedStoryThumbnailUrl,
      selectedStoryMediaUrl: selectedStoryState.selectedStoryMediaUrl,
      selectedStoryPermalink: selectedStoryState.selectedStoryPermalink,
      selectedStoryTimestamp: selectedStoryState.selectedStoryTimestamp,
      replyFilter: args.replyFilter,
      triggerTokens: normalized.triggerTokens,
      triggerTokenLabels: normalized.triggerTokenLabels,
      reactionEnabled: args.reactionEnabled,
      followGateEnabled: args.followGateEnabled,
      followGateText: args.followGateText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: normalized.effectiveLinkDmText,
      linkUrl: normalized.primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        normalized.primaryLink?.label || args.linkButtonText.trim() || "Open link",
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      selectedStoryExpiredAt: selectedStoryState.selectedStoryExpiredAt,
      selectedStoryExpiredReason: selectedStoryState.selectedStoryExpiredReason,
      lastModifiedAt: Date.now(),
    });

    return { automationId: automation._id };
  },
});

export const toggleStoryAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("storyAutomations"),
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
      const issues = getValidationIssues({
        storyScope: automation.storyScope,
        selectedStoryId: automation.selectedStoryId,
        selectedStoryExpiredAt: automation.selectedStoryExpiredAt ?? null,
        replyFilter: automation.replyFilter,
        triggerTokens: automation.triggerTokens,
        linkDmText: automation.linkDmText,
        linkButtons: getSerializedLinkButtons(automation),
        followUpEnabled: automation.followUpEnabled,
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
