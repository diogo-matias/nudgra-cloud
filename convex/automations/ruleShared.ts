import { v } from "convex/values";

export const ruleLinkButtonValidator = v.object({
  label: v.string(),
  url: v.string(),
});

export type RuleLinkButton = {
  label: string;
  url: string;
};

export const RULE_FOLLOW_UP_DELAY_MS = 6 * 60 * 60 * 1000;
export const RULE_DEFAULT_LINK_MESSAGE = "Tap below to open your link.";
export const RULE_DEFAULT_LINK_BATCH_MESSAGE = "More links";
export const RULE_DEFAULT_FOLLOW_GATE_MESSAGE =
  "Please follow our account first, then tap below so I can verify and send the link.";
export const RULE_FOLLOW_GATE_CONSENT_MESSAGE =
  "Follow our account, then send any message here so I can verify and send the link.";
export const RULE_FOLLOW_GATE_BUTTON_TEXT = "I'm following";
export const RULE_INVALID_EMAIL_PROMPT =
  "Please send a valid email address so I can send the link.";

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

export function normalizeRuleLinkButtonsInput(linkButtons: RuleLinkButton[]) {
  return linkButtons
    .map((button) => ({
      label: button.label.trim(),
      url: normalizeAbsoluteUrl(button.url),
    }))
    .filter((button) => button.label.length > 0 && button.url.length > 0);
}

export function getEffectiveRuleLinkDmText(args: {
  replyText?: string | null;
  linkDmText?: string | null;
  hasLinkButtons?: boolean;
}) {
  const preferred = args.linkDmText?.trim() ?? "";
  if (preferred) {
    return preferred;
  }

  const legacy = args.replyText?.trim() ?? "";
  if (legacy) {
    return legacy;
  }

  return args.hasLinkButtons ? RULE_DEFAULT_LINK_MESSAGE : "";
}

export function getAutomationRuleValidationIssues(args: {
  triggerType: "keyword" | "story_reply";
  keywords: string[];
  replyText?: string | null;
  linkDmText?: string | null;
  linkButtons?: RuleLinkButton[] | null;
  followUpEnabled?: boolean | null;
}) {
  const issues: string[] = [];
  const linkButtons = args.linkButtons ?? [];
  const effectiveLinkMessage = getEffectiveRuleLinkDmText({
    replyText: args.replyText,
    linkDmText: args.linkDmText,
    hasLinkButtons: linkButtons.length > 0,
  });

  if (args.triggerType === "keyword" && args.keywords.length === 0) {
    issues.push("Add at least one trigger keyword.");
  }

  if (!effectiveLinkMessage && linkButtons.length === 0) {
    issues.push("A link message or URL is required.");
  }

  if ((args.followUpEnabled ?? false) && linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return issues;
}

export function extractEmail(text: string | null): string | null {
  if (!text) {
    return null;
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}
