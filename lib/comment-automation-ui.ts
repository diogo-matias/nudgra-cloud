type PostScope = "specific" | "any" | "next";
type CommentFilter = "specific_words" | "any_word";

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
  startedAt: number;
  lastStepAt: number;
};

function normalizeCommentAutomationKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function sanitizeCommentAutomationKeywordLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getCommentAutomationKeywordEntries(values: string[]) {
  const seen = new Set<string>();
  const entries: Array<{ label: string; normalized: string }> = [];

  for (const value of values) {
    const label = sanitizeCommentAutomationKeywordLabel(value);
    const normalized = normalizeCommentAutomationKeyword(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push({ label, normalized });
  }

  return entries;
}

function splitCommentAutomationKeywordInput(value: string) {
  return value.split(",");
}

export function parseCommentAutomationKeywordInput(value: string) {
  return getCommentAutomationKeywordEntries(
    splitCommentAutomationKeywordInput(value),
  ).map((entry) => entry.label);
}

export function mergeCommentAutomationKeywords(
  existingKeywords: string[],
  pendingInput: string,
) {
  return getCommentAutomationKeywordEntries([
    ...existingKeywords,
    ...splitCommentAutomationKeywordInput(pendingInput),
  ]).map((entry) => entry.label);
}

export function getNormalizedCommentAutomationKeywords(
  existingKeywords: string[],
  pendingInput = "",
) {
  return getCommentAutomationKeywordEntries([
    ...existingKeywords,
    ...splitCommentAutomationKeywordInput(pendingInput),
  ]).map((entry) => entry.normalized);
}

export function getCommentAutomationFormValidationIssues(args: {
  name: string;
  postScope: PostScope;
  selectedMediaIds: string[];
  commentFilter: CommentFilter;
  triggerKeywords: string[];
  followGateEnabled: boolean;
  linkDmText: string;
  linkButtons: LinkLike[];
  followUpEnabled: boolean;
}) {
  const issues: string[] = [];

  if (!args.name.trim()) {
    issues.push("Automation name is required.");
  }

  if (args.postScope === "specific" && args.selectedMediaIds.length === 0) {
    issues.push(
      "Select at least one post or reel when using 'specific post' scope.",
    );
  }

  if (
    args.commentFilter === "specific_words" &&
    args.triggerKeywords.length === 0
  ) {
    issues.push("Add at least one trigger keyword.");
  }

  if (!args.linkDmText.trim() && args.linkButtons.length === 0) {
    issues.push("A link message or URL is required.");
  }

  if (args.followUpEnabled && args.linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return issues;
}

export function getCommentAutomationStepLabel(step: string) {
  switch (step) {
    case "opening_dm_sent":
      return "Opening DM sent";
    case "awaiting_button_click":
      return "Waiting for opening DM click";
    case "email_requested":
      return "Email requested";
    case "awaiting_email":
      return "Waiting for valid email";
    case "follow_gate_sent":
      return "Follow verification sent";
    case "awaiting_follow":
      return "Waiting for follow verification";
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

export function getCommentAutomationLatestSessionSummary(
  session: LatestSessionLike | null | undefined,
) {
  if (!session) {
    return null;
  }

  if (session.guardrailTrippedAt) {
    return session.guardrailReason ?? "Latest session was stopped by the safety guardrail.";
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

  return `Latest session is at ${getCommentAutomationStepLabel(session.currentStep).toLowerCase()}.`;
}

export function formatCommentAutomationTimestamp(
  timestamp: number | null | undefined,
) {
  const safeTimestamp = timestamp ?? null;
  if (safeTimestamp === null) {
    return "Not yet";
  }

  return new Date(safeTimestamp).toLocaleString();
}
