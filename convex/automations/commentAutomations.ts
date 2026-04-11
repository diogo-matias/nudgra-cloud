import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
import {
  requireConnectedInstagramAccount,
  requireCurrentUserId,
  requireCurrentWorkspace,
  requireWorkspaceInstagramAccount,
} from "../lib/auth";
import {
  getCommentAutomationValidationIssues,
} from "./commentFlow";
import { getKeywordEntries } from "./shared";

const linkButtonValidator = v.object({
  label: v.string(),
  url: v.string(),
});

type LinkButtonInput = {
  label: string;
  url: string;
};

function normalizeAbsoluteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

function normalizeLinkButtonsInput(linkButtons: LinkButtonInput[]) {
  return linkButtons
    .map((button) => ({
      label: button.label.trim(),
      url: normalizeAbsoluteUrl(button.url),
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

function serializeLatestSession(
  session: Doc<"commentAutomationSessions"> | null,
) {
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

function serializeCommentAutomation(
  automation: Doc<"commentAutomations">,
  latestSession: Doc<"commentAutomationSessions"> | null = null,
) {
  const linkButtons = getSerializedLinkButtons(automation);
  const triggerKeywordLabels =
    automation.triggerKeywordLabels && automation.triggerKeywordLabels.length > 0
      ? automation.triggerKeywordLabels
      : automation.triggerKeywords;

  return {
    id: automation._id,
    name: automation.name,
    status: automation.status,
    postScope: automation.postScope,
    selectedMediaIds: automation.selectedMediaIds,
    commentFilter: automation.commentFilter,
    triggerKeywords: automation.triggerKeywords,
    triggerKeywordLabels,
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
    nextPostActivatedAt: automation.nextPostActivatedAt ?? null,
    nextLockedMediaId: automation.nextLockedMediaId ?? null,
    nextLockedAt: automation.nextLockedAt ?? null,
    guardrailTrippedAt: automation.guardrailTrippedAt ?? null,
    guardrailReason: automation.guardrailReason ?? null,
    guardrailSessionId: automation.guardrailSessionId ?? null,
    guardrailConversationId: automation.guardrailConversationId ?? null,
    validationIssues: getCommentAutomationValidationIssues(automation),
    triggerCount: automation.triggerCount,
    lastTriggeredAt: automation.lastTriggeredAt,
    latestSession: serializeLatestSession(latestSession),
  };
}

function ensureSupportedConfiguration(args: {
  postScope: "specific" | "any" | "next";
  followGateEnabled: boolean;
  followUpEnabled: boolean;
  normalizedLinkButtons: LinkButtonInput[];
}) {
  const issues = getCommentAutomationValidationIssues({
    status: "draft",
    postScope: args.postScope,
    followGateEnabled: args.followGateEnabled,
    followUpEnabled: args.followUpEnabled,
    linkButtons:
      args.normalizedLinkButtons.length > 0 ? args.normalizedLinkButtons : undefined,
    linkUrl: "",
    linkButtonText: DEFAULT_LINK_BUTTON_TEXT,
    nextPostActivatedAt: null,
    nextLockedMediaId: null,
  } as Pick<
    Doc<"commentAutomations">,
    | "status"
    | "postScope"
    | "followGateEnabled"
    | "followUpEnabled"
    | "linkButtons"
    | "linkUrl"
    | "linkButtonText"
    | "nextPostActivatedAt"
    | "nextLockedMediaId"
  >);

  if (issues.length > 0) {
    throw new Error(issues[0] ?? "Unsupported comment automation configuration.");
  }
}

const DEFAULT_LINK_BUTTON_TEXT = "Open link";

export const listCommentAutomations = query({
  args: { accountId: v.id("instagramAccounts") },
  handler: async (ctx, args) => {
    const workspace = await requireCurrentWorkspace(ctx);
    await requireWorkspaceInstagramAccount(ctx, workspace._id, args.accountId);
    const automations = await ctx.db
      .query("commentAutomations")
      .withIndex("by_instagram_account_id", (q) =>
        q.eq("instagramAccountId", args.accountId),
      )
      .take(50);

    return automations.map((automation) => serializeCommentAutomation(automation));
  },
});

export const getCommentAutomationById = query({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("commentAutomations"),
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
      return null;
    }

    const latestSession =
      (
        await ctx.db
          .query("commentAutomationSessions")
          .withIndex("by_comment_automation_id", (q) =>
            q.eq("commentAutomationId", automation._id),
          )
          .order("desc")
          .take(1)
      )[0] ?? null;

    return serializeCommentAutomation(automation, latestSession);
  },
});

export const createCommentAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    name: v.string(),
    postScope: v.union(
      v.literal("specific"),
      v.literal("any"),
      v.literal("next"),
    ),
    selectedMediaIds: v.array(v.string()),
    commentFilter: v.union(v.literal("specific_words"), v.literal("any_word")),
    triggerKeywords: v.array(v.string()),
    triggerKeywordLabels: v.optional(v.array(v.string())),
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
    const account = await requireConnectedInstagramAccount(
      ctx,
      workspace._id,
      args.accountId,
    );
    const userId = await requireCurrentUserId(ctx);

    if (!args.name.trim()) {
      throw new Error("Automation name is required.");
    }

    if (args.postScope === "specific" && args.selectedMediaIds.length === 0) {
      throw new Error(
        "Select at least one post or reel when using 'specific post' scope.",
      );
    }

    const keywordEntries =
      args.commentFilter === "specific_words"
        ? getKeywordEntries(args.triggerKeywordLabels ?? args.triggerKeywords)
        : [];
    const normalizedKeywords = keywordEntries.map((entry) => entry.normalized);
    const triggerKeywordLabels = keywordEntries.map((entry) => entry.label);

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

    ensureSupportedConfiguration({
      postScope: args.postScope,
      followGateEnabled: args.followGateEnabled,
      followUpEnabled: args.followUpEnabled,
      normalizedLinkButtons,
    });

    const now = Date.now();
    const status: Doc<"commentAutomations">["status"] = args.goLive
      ? "live"
      : "draft";
    const shouldActivateNext = status === "live" && args.postScope === "next";

    const automationId = await ctx.db.insert("commentAutomations", {
      workspaceId: workspace._id,
      instagramAccountId: account._id,
      createdByUserId: userId,
      name: args.name.trim(),
      status,
      postScope: args.postScope,
      selectedMediaIds: args.selectedMediaIds,
      commentFilter: args.commentFilter,
      triggerKeywords: normalizedKeywords,
      triggerKeywordLabels,
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
      linkUrl: primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        primaryLink?.label || args.linkButtonText.trim() || DEFAULT_LINK_BUTTON_TEXT,
      linkButtons:
        normalizedLinkButtons.length > 0 ? normalizedLinkButtons : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      nextPostActivatedAt: shouldActivateNext ? now : null,
      nextLockedMediaId: null,
      nextLockedAt: null,
      guardrailTrippedAt: null,
      guardrailReason: null,
      guardrailSessionId: null,
      guardrailConversationId: null,
      triggerCount: 0,
      lastTriggeredAt: null,
    });

    return { automationId };
  },
});

export const updateCommentAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
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
    triggerKeywordLabels: v.optional(v.array(v.string())),
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

    if (args.postScope === "specific" && args.selectedMediaIds.length === 0) {
      throw new Error(
        "Select at least one post or reel when using 'specific post' scope.",
      );
    }

    const keywordEntries =
      args.commentFilter === "specific_words"
        ? getKeywordEntries(args.triggerKeywordLabels ?? args.triggerKeywords)
        : [];
    const normalizedKeywords = keywordEntries.map((entry) => entry.normalized);
    const triggerKeywordLabels = keywordEntries.map((entry) => entry.label);

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

    ensureSupportedConfiguration({
      postScope: args.postScope,
      followGateEnabled: args.followGateEnabled,
      followUpEnabled: args.followUpEnabled,
      normalizedLinkButtons,
    });

    const switchingIntoNext = automation.postScope !== "next" && args.postScope === "next";
    const leavingNext = automation.postScope === "next" && args.postScope !== "next";
    const shouldActivateNext = switchingIntoNext && automation.status === "live";

    await ctx.db.patch(automation._id, {
      name: args.name.trim(),
      postScope: args.postScope,
      selectedMediaIds: args.selectedMediaIds,
      commentFilter: args.commentFilter,
      triggerKeywords: normalizedKeywords,
      triggerKeywordLabels,
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
      linkUrl: primaryLink?.url ?? normalizeAbsoluteUrl(args.linkUrl),
      linkButtonText:
        primaryLink?.label || args.linkButtonText.trim() || DEFAULT_LINK_BUTTON_TEXT,
      linkButtons:
        normalizedLinkButtons.length > 0 ? normalizedLinkButtons : undefined,
      followUpEnabled: args.followUpEnabled,
      followUpText: args.followUpText.trim(),
      nextPostActivatedAt: leavingNext
        ? null
        : shouldActivateNext
          ? Date.now()
          : (automation.nextPostActivatedAt ?? null),
      nextLockedMediaId:
        leavingNext || switchingIntoNext
          ? null
          : (automation.nextLockedMediaId ?? null),
      nextLockedAt:
        leavingNext || switchingIntoNext ? null : (automation.nextLockedAt ?? null),
      guardrailTrippedAt: automation.status === "live" ? null : (automation.guardrailTrippedAt ?? null),
      guardrailReason: automation.status === "live" ? null : (automation.guardrailReason ?? null),
      guardrailSessionId: automation.status === "live" ? null : (automation.guardrailSessionId ?? null),
      guardrailConversationId:
        automation.status === "live" ? null : (automation.guardrailConversationId ?? null),
    });

    return { automationId: automation._id };
  },
});

export const toggleCommentAutomation = mutation({
  args: {
    accountId: v.id("instagramAccounts"),
    automationId: v.id("commentAutomations"),
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
      const issues = getCommentAutomationValidationIssues({
        ...automation,
        status: "live",
      });
      if (issues.length > 0) {
        throw new Error(issues[0] ?? "Automation must be fixed before going live.");
      }
    }

    await ctx.db.patch(automation._id, {
      status: args.status,
      nextPostActivatedAt:
        args.status === "live" && automation.postScope === "next"
          ? Date.now()
          : (automation.nextPostActivatedAt ?? null),
      nextLockedMediaId:
        args.status === "live" && automation.postScope === "next"
          ? null
          : (automation.nextLockedMediaId ?? null),
      nextLockedAt:
        args.status === "live" && automation.postScope === "next"
          ? null
          : (automation.nextLockedAt ?? null),
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
    });

    return { automationId: automation._id, status: args.status };
  },
});
