import { v } from "convex/values";

export const storyLinkButtonValidator = v.object({
  label: v.string(),
  url: v.string(),
});

export type StoryLinkButton = {
  label: string;
  url: string;
};

export const STORY_REACTION_EMOJI = "❤️";
export const STORY_FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;
export const STORY_DEFAULT_LINK_MESSAGE = "Tap below to open your link.";
export const STORY_DEFAULT_LINK_BATCH_MESSAGE = "More links";
export const STORY_DEFAULT_FOLLOW_GATE_MESSAGE =
  `Nearly there! The link is especially for my followers ✨

Right after you follow me, I'll send you the link so you can dive straight in! 🎉`;
export const STORY_FOLLOW_GATE_CONSENT_MESSAGE =
  "Follow our account, then send any message here so I can verify and send the link.";
export const STORY_FOLLOW_GATE_BUTTON_TEXT = "I'm following";
export const STORY_INVALID_EMAIL_PROMPT =
  "Please send a valid email address so I can send the link.";
export const STORY_EXPIRED_MESSAGE =
  "The selected story is no longer live. Pick a new story before going live again.";

function sanitizeStoryTokenLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeStoryReplyToken(value: string) {
  return sanitizeStoryTokenLabel(value).toLowerCase();
}

export function getStoryTokenEntries(values: string[]) {
  const seen = new Set<string>();
  const entries: Array<{ label: string; normalized: string }> = [];

  for (const value of values) {
    const label = sanitizeStoryTokenLabel(value);
    const normalized = normalizeStoryReplyToken(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push({ label, normalized });
  }

  return entries;
}

export function normalizeStoryTriggerTokens(values: string[]) {
  return getStoryTokenEntries(values).map((entry) => entry.normalized);
}

export function getStoryTriggerTokenLabels(values: string[]) {
  return getStoryTokenEntries(values).map((entry) => entry.label);
}

export function normalizeAbsoluteUrl(value: string) {
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

export function normalizeStoryLinkButtonsInput(linkButtons: StoryLinkButton[]) {
  return linkButtons
    .map((button) => ({
      label: button.label.trim(),
      url: normalizeAbsoluteUrl(button.url),
    }))
    .filter((button) => button.label.length > 0 && button.url.length > 0);
}

export function getEffectiveStoryLinkDmText(args: {
  linkDmText?: string | null;
  hasLinkButtons?: boolean;
}) {
  const preferred = args.linkDmText?.trim() ?? "";
  if (preferred) {
    return preferred;
  }

  return args.hasLinkButtons ? STORY_DEFAULT_LINK_MESSAGE : "";
}

export function getStoryAutomationValidationIssues(args: {
  storyScope: "any" | "specific";
  selectedStoryId?: string | null;
  selectedStoryExpiredAt?: number | null;
  replyFilter:
    | "specific_words_or_reactions"
    | "any_word_or_reaction";
  triggerTokens: string[];
  linkDmText?: string | null;
  linkButtons?: StoryLinkButton[] | null;
  followUpEnabled?: boolean | null;
}) {
  const issues: string[] = [];
  const linkButtons = args.linkButtons ?? [];
  const effectiveLinkMessage = getEffectiveStoryLinkDmText({
    linkDmText: args.linkDmText,
    hasLinkButtons: linkButtons.length > 0,
  });

  if (args.storyScope === "specific" && !(args.selectedStoryId ?? "").trim()) {
    issues.push("Select a specific story.");
  }

  if (
    args.storyScope === "specific" &&
    (args.selectedStoryExpiredAt ?? null) !== null
  ) {
    issues.push(STORY_EXPIRED_MESSAGE);
  }

  if (
    args.replyFilter === "specific_words_or_reactions" &&
    args.triggerTokens.length === 0
  ) {
    issues.push("Add at least one reply word or reaction.");
  }

  if (!effectiveLinkMessage && linkButtons.length === 0) {
    issues.push("A link message or URL is required.");
  }

  if ((args.followUpEnabled ?? false) && linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return issues;
}

function normalizeUrlForComparison(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

export function matchesStoryAutomation(args: {
  automation: {
    storyScope: "any" | "specific";
    selectedStoryId: string | null;
    selectedStoryPermalink?: string | null;
    replyFilter:
      | "specific_words_or_reactions"
      | "any_word_or_reaction";
    triggerTokens: string[];
  };
  storyId: string | null;
  storyUrl: string | null;
  replyToken: string | null;
}) {
  if (args.automation.storyScope === "specific") {
    const selectedStoryId = args.automation.selectedStoryId?.trim() ?? "";
    const selectedStoryUrl = normalizeUrlForComparison(
      args.automation.selectedStoryPermalink,
    );
    const incomingStoryId = args.storyId?.trim() ?? "";
    const incomingStoryUrl = normalizeUrlForComparison(args.storyUrl);

    const matchesStoryId =
      selectedStoryId.length > 0 &&
      incomingStoryId.length > 0 &&
      selectedStoryId === incomingStoryId;
    const matchesStoryUrl =
      selectedStoryUrl.length > 0 &&
      incomingStoryUrl.length > 0 &&
      selectedStoryUrl === incomingStoryUrl;

    if (!matchesStoryId && !matchesStoryUrl) {
      return false;
    }
  }

  if (args.automation.replyFilter === "any_word_or_reaction") {
    return true;
  }

  const normalizedReplyToken = args.replyToken?.trim() ?? "";
  if (!normalizedReplyToken) {
    return false;
  }

  return args.automation.triggerTokens.some((token) =>
    normalizedReplyToken.includes(token),
  );
}

export function extractEmail(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}
