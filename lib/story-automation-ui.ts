type StoryScope = "specific" | "any";
type ReplyFilter = "specific_words_or_reactions" | "any_word_or_reaction";

type LinkLike = {
  label: string;
  url: string;
};

type LatestSessionLike = {
  currentStep: string;
  collectedEmail: string | null;
  outboundMessageCount: number;
  guardrailTrippedAt: number | null;
  guardrailReason: string | null;
  linkSentAt: number | null;
  linkClickedAt: number | null;
  followUpScheduledAt: number | null;
  followUpSentAt: number | null;
  reactionSentAt?: number | null;
  startedAt: number;
  lastStepAt: number;
};

export const STORY_EXPIRED_VALIDATION_MESSAGE =
  "The selected story is no longer live. Pick a new story before going live again.";

function sanitizeStoryTokenLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStoryToken(value: string) {
  return sanitizeStoryTokenLabel(value).toLowerCase();
}

function getStoryTokenEntries(values: string[]) {
  const seen = new Set<string>();
  const entries: Array<{ label: string; normalized: string }> = [];

  for (const value of values) {
    const label = sanitizeStoryTokenLabel(value);
    const normalized = normalizeStoryToken(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push({ label, normalized });
  }

  return entries;
}

function splitStoryTokenInput(value: string) {
  return value.split(",");
}

export function mergeStoryAutomationTokens(
  existingTokens: string[],
  pendingInput: string,
) {
  return getStoryTokenEntries([
    ...existingTokens,
    ...splitStoryTokenInput(pendingInput),
  ]).map((entry) => entry.label);
}

export function getNormalizedStoryAutomationTokens(
  existingTokens: string[],
  pendingInput = "",
) {
  return getStoryTokenEntries([
    ...existingTokens,
    ...splitStoryTokenInput(pendingInput),
  ]).map((entry) => entry.normalized);
}

export function getStoryAutomationFormValidationIssues(args: {
  name: string;
  storyScope: StoryScope;
  selectedStoryId: string | null;
  selectedStoryExpiredAt?: number | null;
  replyFilter: ReplyFilter;
  triggerTokens: string[];
  linkDmText: string;
  linkButtons: LinkLike[];
  followUpEnabled: boolean;
}) {
  const issues: string[] = [];

  if (!args.name.trim()) {
    issues.push("Automation name is required.");
  }

  if (args.storyScope === "specific" && !(args.selectedStoryId ?? "").trim()) {
    issues.push("Select a specific story.");
  }

  if (
    args.storyScope === "specific" &&
    (args.selectedStoryExpiredAt ?? null) !== null
  ) {
    issues.push(STORY_EXPIRED_VALIDATION_MESSAGE);
  }

  if (
    args.replyFilter === "specific_words_or_reactions" &&
    args.triggerTokens.length === 0
  ) {
    issues.push("Add at least one reply word or reaction.");
  }

  if (!args.linkDmText.trim() && args.linkButtons.length === 0) {
    issues.push("A link message or URL is required.");
  }

  if (args.followUpEnabled && args.linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return issues;
}

export function getStoryAutomationStepLabel(step: string) {
  switch (step) {
    case "follow_gate_sent":
      return "Follow gate sent";
    case "awaiting_follow":
      return "Waiting for follow verification";
    case "email_requested":
      return "Email requested";
    case "awaiting_email":
      return "Waiting for valid email";
    case "link_sent":
      return "Link sent";
    case "guardrail_tripped":
      return "Safety guardrail tripped";
    case "completed":
      return "Completed";
    default:
      return step
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function getStoryAutomationLatestSessionSummary(
  session: LatestSessionLike | null | undefined,
) {
  if (!session) {
    return null;
  }

  if (session.guardrailTrippedAt) {
    return (
      session.guardrailReason ??
      "Latest session was stopped by the safety guardrail."
    );
  }

  if (session.linkClickedAt) {
    return "Latest session clicked a tracked link.";
  }

  if (session.followUpSentAt) {
    return "Latest session received the follow-up DM.";
  }

  if (session.linkSentAt) {
    return "Latest session received the link DM.";
  }

  if (session.collectedEmail) {
    return "Latest session captured an email and is progressing.";
  }

  return `Latest session is at ${getStoryAutomationStepLabel(session.currentStep).toLowerCase()}.`;
}

export function formatStoryAutomationTimestamp(
  timestamp: number | null | undefined,
) {
  const safeTimestamp = timestamp ?? null;
  if (safeTimestamp === null) {
    return "Not yet";
  }

  return new Date(safeTimestamp).toLocaleString();
}
