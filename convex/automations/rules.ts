import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import {
  getWorkspaceInstagramAccount,
  requireConnectedInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
} from "../lib/auth";
import { normalizeKeywordList } from "./shared";

const nullableSequenceDefinitionId = v.union(v.id("sequenceDefinitions"), v.null());

function serializeRule(
  rule: Doc<"automationRules">,
  tagsById: Map<Id<"tags">, Doc<"tags">>,
  sequencesById: Map<Id<"sequenceDefinitions">, Doc<"sequenceDefinitions">>,
) {
  return {
    id: rule._id,
    name: rule.name,
    triggerType: rule.triggerType,
    matchType: rule.matchType,
    keywords: rule.keywords,
    replyText: rule.replyText,
    isActive: rule.isActive,
    triggerCount: rule.triggerCount,
    lastTriggeredAt: rule.lastTriggeredAt,
    tags: rule.tagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is Doc<"tags"> => tag !== undefined)
      .map((tag) => ({ id: tag._id, label: tag.label, color: tag.color })),
    sequence: rule.sequenceDefinitionId
      ? sequencesById.get(rule.sequenceDefinitionId) ?? null
      : null,
  };
}

export const listCurrentRules = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const rules = await ctx.db
      .query("automationRules")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(100);

    const tags = await ctx.db
      .query("tags")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(50);
    const sequences = await ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(25);

    const tagsById = new Map(tags.map((tag) => [tag._id, tag]));
    const sequencesById = new Map(sequences.map((sequence) => [sequence._id, sequence]));

    return rules.map((rule) => serializeRule(rule, tagsById, sequencesById));
  },
});

export const getRuleCreationOptions = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await getWorkspaceInstagramAccount(ctx, workspace._id);
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
  args: { ruleId: v.id("automationRules") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (rule === null || rule.workspaceId !== workspace._id) {
      return null;
    }

    const tags = await ctx.db
      .query("tags")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(50);
    const sequences = await ctx.db
      .query("sequenceDefinitions")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(25);

    return serializeRule(
      rule,
      new Map(tags.map((tag) => [tag._id, tag])),
      new Map(sequences.map((sequence) => [sequence._id, sequence])),
    );
  },
});

export const createRule = mutation({
  args: {
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("story_reply")),
    matchType: v.union(v.literal("contains"), v.literal("exact")),
    keywords: v.array(v.string()),
    replyText: v.string(),
    isActive: v.boolean(),
    tagIds: v.array(v.id("tags")),
    sequenceDefinitionId: nullableSequenceDefinitionId,
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireConnectedInstagramAccount(ctx, workspace._id);
    const userId = await requireCurrentUserId(ctx);

    const normalizedKeywords =
      args.triggerType === "keyword" ? normalizeKeywordList(args.keywords) : [];

    if (args.triggerType === "keyword" && normalizedKeywords.length === 0) {
      throw new Error("Keyword rules need at least one keyword.");
    }

    if (!args.replyText.trim()) {
      throw new Error("Reply text is required.");
    }

    for (const tagId of args.tagIds) {
      const tag = await ctx.db.get(tagId);
      if (tag === null || tag.workspaceId !== workspace._id) {
        throw new Error("A selected tag does not belong to this workspace.");
      }
    }

    if (args.sequenceDefinitionId !== null) {
      const sequence = await ctx.db.get(args.sequenceDefinitionId);
      if (sequence === null || sequence.workspaceId !== workspace._id) {
        throw new Error("The selected sequence does not belong to this workspace.");
      }
    }

    const ruleId = await ctx.db.insert("automationRules", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      name: args.name.trim(),
      triggerType: args.triggerType,
      matchType: args.matchType,
      keywords: normalizedKeywords,
      replyText: args.replyText.trim(),
      isActive: args.isActive,
      tagIds: [...new Set(args.tagIds)],
      sequenceDefinitionId: args.sequenceDefinitionId,
      createdByUserId: userId,
      triggerCount: 0,
      lastTriggeredAt: null,
    });

    return { ruleId };
  },
});

export const toggleRule = mutation({
  args: {
    ruleId: v.id("automationRules"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (rule === null || rule.workspaceId !== workspace._id) {
      throw new Error("Rule not found.");
    }

    await ctx.db.patch(rule._id, { isActive: args.isActive });
    return { ruleId: rule._id, isActive: args.isActive };
  },
});
