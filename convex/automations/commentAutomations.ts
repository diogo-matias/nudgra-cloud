import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import {
  requireConnectedInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
} from "../lib/auth";
import { normalizeKeywordList } from "./shared";

const linkButtonValidator = v.object({
  label: v.string(),
  url: v.string(),
});

type LinkButtonInput = {
  label: string;
  url: string;
};

function normalizeLinkButtonsInput(linkButtons: LinkButtonInput[]) {
  return linkButtons
    .map((button) => ({
      label: button.label.trim(),
      url: button.url.trim(),
    }))
    .filter((button) => button.label.length > 0 && button.url.length > 0);
}

function getNormalizedLinkButtonsFromArgs(args: {
  linkButtons: LinkButtonInput[];
  linkUrl: string;
  linkButtonText: string;
}) {
  if (args.linkButtons.length > 0) {
    return normalizeLinkButtonsInput(args.linkButtons);
  }

  if (args.linkUrl.trim().length > 0) {
    return normalizeLinkButtonsInput([
      {
        label: args.linkButtonText,
        url: args.linkUrl,
      },
    ]);
  }

  return [];
}

function getSerializedLinkButtons(automation: Doc<"commentAutomations">) {
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

function getPrimaryLink(linkButtons: LinkButtonInput[]) {
  return linkButtons[0] ?? null;
}

function serializeCommentAutomation(automation: Doc<"commentAutomations">) {
  const linkButtons = getSerializedLinkButtons(automation);

  return {
    id: automation._id,
    name: automation.name,
    status: automation.status,
    postScope: automation.postScope,
    selectedMediaIds: automation.selectedMediaIds,
    commentFilter: automation.commentFilter,
    triggerKeywords: automation.triggerKeywords,
    commentReplyEnabled: automation.commentReplyEnabled,
    commentReplyTexts: automation.commentReplyTexts,
    openingDmEnabled: automation.openingDmEnabled,
    openingDmText: automation.openingDmText,
    openingDmButtonText: automation.openingDmButtonText,
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
    triggerCount: automation.triggerCount,
    lastTriggeredAt: automation.lastTriggeredAt,
  };
}

export const listCommentAutomations = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const automations = await ctx.db
      .query("commentAutomations")
      .withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
      .take(50);

    return automations.map(serializeCommentAutomation);
  },
});

export const getCommentAutomationById = query({
  args: { automationId: v.id("commentAutomations") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (automation === null || automation.workspaceId !== workspace._id) {
      return null;
    }

    return serializeCommentAutomation(automation);
  },
});

export const createCommentAutomation = mutation({
  args: {
    name: v.string(),
    postScope: v.union(
      v.literal("specific"),
      v.literal("any"),
      v.literal("next"),
    ),
    selectedMediaIds: v.array(v.string()),
    commentFilter: v.union(v.literal("specific_words"), v.literal("any_word")),
    triggerKeywords: v.array(v.string()),
    commentReplyEnabled: v.boolean(),
    commentReplyTexts: v.array(v.string()),
    openingDmEnabled: v.boolean(),
    openingDmText: v.string(),
    openingDmButtonText: v.string(),
    followGateEnabled: v.boolean(),
    followGateText: v.string(),
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),
    linkDmText: v.string(),
    linkButtons: v.array(linkButtonValidator),
    linkUrl: v.string(),
    linkButtonText: v.string(),
    followUpEnabled: v.boolean(),
    followUpText: v.string(),
    goLive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const account = await requireConnectedInstagramAccount(ctx, workspace._id);
    const userId = await requireCurrentUserId(ctx);

    if (!args.name.trim()) {
      throw new Error("Automation name is required.");
    }

    if (args.postScope === "specific" && args.selectedMediaIds.length === 0) {
      throw new Error(
        "Select at least one post or reel when using 'specific post' scope.",
      );
    }

    const normalizedKeywords =
      args.commentFilter === "specific_words"
        ? normalizeKeywordList(args.triggerKeywords)
        : [];

    if (
      args.commentFilter === "specific_words" &&
      normalizedKeywords.length === 0
    ) {
      throw new Error("Add at least one trigger keyword.");
    }

    const normalizedLinkButtons = getNormalizedLinkButtonsFromArgs(args);
    const primaryLink = getPrimaryLink(normalizedLinkButtons);

    if (!args.linkDmText.trim() && normalizedLinkButtons.length === 0) {
      throw new Error("A link message or URL is required.");
    }

    const automationId = await ctx.db.insert("commentAutomations", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      createdByUserId: userId,
      name: args.name.trim(),
      status: args.goLive ? "live" : "draft",
      postScope: args.postScope,
      selectedMediaIds: args.selectedMediaIds,
      commentFilter: args.commentFilter,
      triggerKeywords: normalizedKeywords,
      commentReplyEnabled: args.commentReplyEnabled,
      commentReplyTexts: args.commentReplyTexts
        .map((text) => text.trim())
        .filter(Boolean),
      openingDmEnabled: args.openingDmEnabled,
      openingDmText: args.openingDmText.trim(),
      openingDmButtonText:
        args.openingDmButtonText.trim() || "Send me the link",
      followGateEnabled: args.followGateEnabled,
      followGateText: args.followGateText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: args.linkDmText.trim(),
      linkUrl: primaryLink?.url ?? args.linkUrl.trim(),
      linkButtonText:
        primaryLink?.label || args.linkButtonText.trim() || "Open link",
      linkButtons:
        normalizedLinkButtons.length > 0 ? normalizedLinkButtons : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      triggerCount: 0,
      lastTriggeredAt: null,
    });

    return { automationId };
  },
});

export const updateCommentAutomation = mutation({
  args: {
    automationId: v.id("commentAutomations"),
    name: v.string(),
    postScope: v.union(
      v.literal("specific"),
      v.literal("any"),
      v.literal("next"),
    ),
    selectedMediaIds: v.array(v.string()),
    commentFilter: v.union(v.literal("specific_words"), v.literal("any_word")),
    triggerKeywords: v.array(v.string()),
    commentReplyEnabled: v.boolean(),
    commentReplyTexts: v.array(v.string()),
    openingDmEnabled: v.boolean(),
    openingDmText: v.string(),
    openingDmButtonText: v.string(),
    followGateEnabled: v.boolean(),
    followGateText: v.string(),
    emailCollectionEnabled: v.boolean(),
    emailCollectionText: v.string(),
    linkDmText: v.string(),
    linkButtons: v.array(linkButtonValidator),
    linkUrl: v.string(),
    linkButtonText: v.string(),
    followUpEnabled: v.boolean(),
    followUpText: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (automation === null || automation.workspaceId !== workspace._id) {
      throw new Error("Automation not found.");
    }

    const normalizedKeywords =
      args.commentFilter === "specific_words"
        ? normalizeKeywordList(args.triggerKeywords)
        : [];
    const normalizedLinkButtons = getNormalizedLinkButtonsFromArgs(args);
    const primaryLink = getPrimaryLink(normalizedLinkButtons);

    await ctx.db.patch(automation._id, {
      name: args.name.trim(),
      postScope: args.postScope,
      selectedMediaIds: args.selectedMediaIds,
      commentFilter: args.commentFilter,
      triggerKeywords: normalizedKeywords,
      commentReplyEnabled: args.commentReplyEnabled,
      commentReplyTexts: args.commentReplyTexts
        .map((text) => text.trim())
        .filter(Boolean),
      openingDmEnabled: args.openingDmEnabled,
      openingDmText: args.openingDmText.trim(),
      openingDmButtonText:
        args.openingDmButtonText.trim() || "Send me the link",
      followGateEnabled: args.followGateEnabled,
      followGateText: args.followGateText.trim(),
      emailCollectionEnabled: args.emailCollectionEnabled,
      emailCollectionText: args.emailCollectionText.trim(),
      linkDmText: args.linkDmText.trim(),
      linkUrl: primaryLink?.url ?? args.linkUrl.trim(),
      linkButtonText:
        primaryLink?.label || args.linkButtonText.trim() || "Open link",
      linkButtons:
        normalizedLinkButtons.length > 0 ? normalizedLinkButtons : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
    });

    return { automationId: automation._id };
  },
});

export const toggleCommentAutomation = mutation({
  args: {
    automationId: v.id("commentAutomations"),
    status: v.union(v.literal("live"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    const automation = await ctx.db.get(args.automationId);
    if (automation === null || automation.workspaceId !== workspace._id) {
      throw new Error("Automation not found.");
    }

    await ctx.db.patch(automation._id, { status: args.status });
    return { automationId: automation._id, status: args.status };
  },
});
