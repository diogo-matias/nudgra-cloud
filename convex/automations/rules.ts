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
import { getKeywordLabelList, normalizeKeywordList } from "./shared";
import {
  getAutomationRuleValidationIssues,
  getEffectiveRuleLinkDmText,
  normalizeRuleLinkButtonsInput,
  ruleLinkButtonValidator,
  type RuleLinkButton,
} from "./ruleShared";

const nullableSequenceDefinitionId = v.union(
  v.id("sequenceDefinitions"),
  v.null(),
);

type LatestRuleSession = Doc<"automationRuleSessions"> | null;

function getSerializedLinkButtons(rule: Doc<"automationRules">) {
  return rule.linkButtons ?? [];
}

function serializeLatestSession(session: LatestRuleSession) {
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

function serializeRule(
  rule: Doc<"automationRules">,
  tagsById: Map<Id<"tags">, Doc<"tags">>,
  sequencesById: Map<Id<"sequenceDefinitions">, Doc<"sequenceDefinitions">>,
  latestSession: LatestRuleSession = null,
) {
  const linkButtons = getSerializedLinkButtons(rule);
  const effectiveLinkDmText = getEffectiveRuleLinkDmText({
    replyText: rule.replyText,
    linkDmText: rule.linkDmText,
    hasLinkButtons: linkButtons.length > 0,
  });

  return {
    id: rule._id,
    name: rule.name,
    triggerType: rule.triggerType,
    matchType: rule.matchType,
    keywords: rule.keywords,
    triggerKeywordLabels: getKeywordLabelList(rule.keywords),
    replyText: rule.replyText,
    linkDmText: effectiveLinkDmText,
    linkButtons,
    followGateEnabled: rule.followGateEnabled ?? false,
    followGateText: rule.followGateText ?? "",
    emailCollectionEnabled: rule.emailCollectionEnabled ?? false,
    emailCollectionText: rule.emailCollectionText ?? "",
    followUpEnabled: rule.followUpEnabled ?? false,
    followUpText: rule.followUpText ?? "",
    validationIssues: getAutomationRuleValidationIssues({
      triggerType: rule.triggerType,
      keywords: rule.keywords,
      replyText: rule.replyText,
      linkDmText: rule.linkDmText,
      linkButtons,
      followUpEnabled: rule.followUpEnabled ?? false,
    }),
    isActive: rule.isActive,
    triggerCount: rule.triggerCount,
    lastTriggeredAt: rule.lastTriggeredAt,
    createdAt: rule._creationTime,
    lastModifiedAt: rule.lastModifiedAt ?? rule._creationTime,
    latestSession: serializeLatestSession(latestSession),
    tags: rule.tagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is Doc<"tags"> => tag !== undefined)
      .map((tag) => ({ id: tag._id, label: tag.label, color: tag.color })),
    sequence:
      rule.sequenceDefinitionId &&
      sequencesById.get(rule.sequenceDefinitionId) !== undefined
        ? {
            id: rule.sequenceDefinitionId,
            name: sequencesById.get(rule.sequenceDefinitionId)!.name,
            isActive: sequencesById.get(rule.sequenceDefinitionId)!.isActive,
            stepCount: sequencesById.get(rule.sequenceDefinitionId)!.steps.length,
          }
        : null,
  };
}

async function validateRuleRelations(
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

function normalizeRuleFlowInput(args: {
  triggerType: "keyword" | "story_reply";
  keywords: string[];
  replyText?: string;
  linkDmText?: string;
  linkButtons?: RuleLinkButton[];
  followGateEnabled?: boolean;
  followGateText?: string;
  emailCollectionEnabled?: boolean;
  emailCollectionText?: string;
  followUpEnabled?: boolean;
  followUpText?: string;
}) {
  const normalizedKeywords =
    args.triggerType === "keyword" ? normalizeKeywordList(args.keywords) : [];
  const normalizedLinkButtons = normalizeRuleLinkButtonsInput(
    args.linkButtons ?? [],
  );
  const effectiveLinkDmText = getEffectiveRuleLinkDmText({
    replyText: args.replyText,
    linkDmText: args.linkDmText,
    hasLinkButtons: normalizedLinkButtons.length > 0,
  });
  const validationIssues = getAutomationRuleValidationIssues({
    triggerType: args.triggerType,
    keywords: normalizedKeywords,
    replyText: args.replyText,
    linkDmText: args.linkDmText,
    linkButtons: normalizedLinkButtons,
    followUpEnabled: args.followUpEnabled ?? false,
  });

  if (validationIssues.length > 0) {
    throw new Error(validationIssues[0] ?? "Invalid automation configuration.");
  }

  return {
    normalizedKeywords,
    normalizedLinkButtons,
    effectiveLinkDmText,
    followGateEnabled: args.followGateEnabled ?? false,
    followGateText: args.followGateText?.trim() ?? "",
    emailCollectionEnabled: args.emailCollectionEnabled ?? false,
    emailCollectionText: args.emailCollectionText?.trim() ?? "",
    followUpEnabled: args.followUpEnabled ?? false,
    followUpText: args.followUpText?.trim() ?? "",
  };
}

async function loadRuleDecorators(ctx: QueryCtx) {
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

export const listCurrentRules = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } = await loadRuleDecorators(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const rules = await ctx.db
      .query("automationRules")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .take(100);

    return rules.map((rule) => serializeRule(rule, tagsById, sequencesById));
  },
});

export const getRuleCreationOptions = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccountById(
      ctx,
      workspace._id,
      args.accountId,
    );
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(50);
    const sequences = await ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(25);

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

export const getRuleById = query({
  args: {
    accountId: v.id("instagramAccounts"),
    ruleId: v.id("automationRules"),
  },
  handler: async (ctx, args) => {
    const { workspace, tagsById, sequencesById } = await loadRuleDecorators(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const rule = await ctx.db.get(args.ruleId);
    if (
      rule === null ||
      rule.workspaceId !== workspace._id ||
      rule.instagramAccountId !== args.accountId
    ) {
      return null;
    }

    const latestSession =
      (
        await ctx.db
          .query("automationRuleSessions")
          .withIndex("by_automation_rule_id", (q) =>
            q.eq("automationRuleId", rule._id),
          )
          .order("desc")
          .take(1)
      )[0] ?? null;

    return serializeRule(rule, tagsById, sequencesById, latestSession);
  },
});

export const createRule = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("story_reply")),
    matchType: v.union(v.literal("contains"), v.literal("exact")),
    keywords: v.array(v.string()),
    replyText: v.optional(v.string()),
    linkDmText: v.optional(v.string()),
    linkButtons: v.optional(v.array(ruleLinkButtonValidator)),
    followGateEnabled: v.optional(v.boolean()),
    followGateText: v.optional(v.string()),
    emailCollectionEnabled: v.optional(v.boolean()),
    emailCollectionText: v.optional(v.string()),
    followUpEnabled: v.optional(v.boolean()),
    followUpText: v.optional(v.string()),
    isActive: v.boolean(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireConnectedInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );
    const userId = await requireCurrentUserId(ctx);

    const normalized = normalizeRuleFlowInput(args);
    await validateRuleRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: args.tagIds,
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    const now = Date.now();
    const ruleId = await ctx.db.insert("automationRules", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      name: args.name.trim(),
      triggerType: args.triggerType,
      matchType: args.matchType,
      keywords: normalized.normalizedKeywords,
      replyText: normalized.effectiveLinkDmText,
      linkDmText: normalized.effectiveLinkDmText,
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followGateEnabled: normalized.followGateEnabled,
      followGateText: normalized.followGateText,
      emailCollectionEnabled: normalized.emailCollectionEnabled,
      emailCollectionText: normalized.emailCollectionText,
      followUpEnabled: normalized.followUpEnabled,
      followUpText: normalized.followUpText,
      isActive: args.isActive,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      createdByUserId: userId,
      triggerCount: 0,
      lastTriggeredAt: null,
      lastModifiedAt: now,
    });

    return { ruleId };
  },
});

export const updateRule = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    ruleId: v.id("automationRules"),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("story_reply")),
    matchType: v.union(v.literal("contains"), v.literal("exact")),
    keywords: v.array(v.string()),
    replyText: v.optional(v.string()),
    linkDmText: v.optional(v.string()),
    linkButtons: v.optional(v.array(ruleLinkButtonValidator)),
    followGateEnabled: v.optional(v.boolean()),
    followGateText: v.optional(v.string()),
    emailCollectionEnabled: v.optional(v.boolean()),
    emailCollectionText: v.optional(v.string()),
    followUpEnabled: v.optional(v.boolean()),
    followUpText: v.optional(v.string()),
    isActive: v.boolean(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const rule = await ctx.db.get(args.ruleId);
    if (
      rule === null ||
      rule.workspaceId !== workspace._id ||
      rule.instagramAccountId !== args.accountId
    ) {
      throw new Error("Rule not found.");
    }

    const normalized = normalizeRuleFlowInput(args);
    await validateRuleRelations(ctx, {
      workspaceId: workspace._id,
      tagIds: args.tagIds,
      sequenceDefinitionId: args.sequenceDefinitionId,
    });

    await ctx.db.patch(rule._id, {
      name: args.name.trim(),
      triggerType: args.triggerType,
      matchType: args.matchType,
      keywords: normalized.normalizedKeywords,
      replyText: normalized.effectiveLinkDmText,
      linkDmText: normalized.effectiveLinkDmText,
      linkButtons:
        normalized.normalizedLinkButtons.length > 0
          ? normalized.normalizedLinkButtons
          : undefined,
      followGateEnabled: normalized.followGateEnabled,
      followGateText: normalized.followGateText,
      emailCollectionEnabled: normalized.emailCollectionEnabled,
      emailCollectionText: normalized.emailCollectionText,
      followUpEnabled: normalized.followUpEnabled,
      followUpText: normalized.followUpText,
      isActive: args.isActive,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      lastModifiedAt: Date.now(),
    });

    return { ruleId: rule._id };
  },
});

export const toggleRule = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    ruleId: v.id("automationRules"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const rule = await ctx.db.get(args.ruleId);
    if (
      rule === null ||
      rule.workspaceId !== workspace._id ||
      rule.instagramAccountId !== args.accountId
    ) {
      throw new Error("Rule not found.");
    }

    await ctx.db.patch(rule._id, {
      isActive: args.isActive,
      lastModifiedAt: Date.now(),
    });
    return { ruleId: rule._id, isActive: args.isActive };
  },
});
