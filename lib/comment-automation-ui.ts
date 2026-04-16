export type PostScope = "specific" | "any" | "next";
export type CommentFilter = "specific_words" | "any_word";

export type LinkLike = {
  label: string;
  url: string;
};

export type CommentAutomationFormValues = {
  name: string;
  postScope: PostScope;
  selectedMediaIds: string[];
  commentFilter: CommentFilter;
  triggerKeywords: string[];
  commentReplyEnabled: boolean;
  commentReplyTexts: string[];
  openingDmEnabled: boolean;
  openingDmText: string;
  openingDmButtonText: string;
  followGateEnabled: boolean;
  followGateText: string;
  emailCollectionEnabled: boolean;
  emailCollectionText: string;
  linkDmText: string;
  linkButtons: LinkLike[];
  followUpEnabled: boolean;
  followUpText: string;
};

export function createDefaultCommentAutomationFormValues(): CommentAutomationFormValues {
  return {
    name: "",
    postScope: "specific",
    selectedMediaIds: [],
    commentFilter: "specific_words",
    triggerKeywords: [],
    commentReplyEnabled: true,
    commentReplyTexts: ["Thanks! Check your DMs"],
    openingDmEnabled: true,
    openingDmText:
      "Hey there! I'm so happy you're here, thanks so much for your interest.\n\nClick below and I'll send you the link in just a sec.",
    openingDmButtonText: "Send me the link",
    followGateEnabled: false,
    followGateText:
      "Nearly there! The link is especially for my followers.\n\nRight after you follow me, I'll send you the link so you can dive straight in!",
    emailCollectionEnabled: false,
    emailCollectionText: "Drop your email and we'll send it right over:",
    linkDmText: "Here's your link:",
    linkButtons: [],
    followUpEnabled: false,
    followUpText:
      "Just checking in - did you get the link? Let me know if you need anything!",
  };
}

export function createCommentAutomationFormValues(
  source: CommentAutomationFormValues,
): CommentAutomationFormValues {
  return {
    ...source,
    selectedMediaIds: [...source.selectedMediaIds],
    triggerKeywords: [...source.triggerKeywords],
    commentReplyTexts:
      source.commentReplyTexts.length > 0
        ? [...source.commentReplyTexts]
        : [""],
    linkButtons: source.linkButtons.map((button) => ({ ...button })),
  };
}

export function buildCommentAutomationMutationValues(
  values: CommentAutomationFormValues,
  keywordInput = "",
) {
  const triggerKeywordLabels = mergeCommentAutomationKeywords(
    values.triggerKeywords,
    keywordInput,
  );
  const primaryLink = values.linkButtons[0] ?? null;

  return {
    name: values.name,
    postScope: values.postScope,
    selectedMediaIds: [...values.selectedMediaIds],
    commentFilter: values.commentFilter,
    triggerKeywords: getNormalizedCommentAutomationKeywords(
      values.triggerKeywords,
      keywordInput,
    ),
    triggerKeywordLabels,
    commentReplyEnabled: values.commentReplyEnabled,
    commentReplyTexts: values.commentReplyTexts.filter((text) => text.trim()),
    openingDmEnabled: values.openingDmEnabled,
    openingDmText: values.openingDmText,
    openingDmButtonText: values.openingDmButtonText,
    followGateEnabled: values.followGateEnabled,
    followGateText: values.followGateText,
    emailCollectionEnabled: values.emailCollectionEnabled,
    emailCollectionText: values.emailCollectionText,
    linkDmText: values.linkDmText,
    linkButtons: values.linkButtons.map((button) => ({ ...button })),
    followUpEnabled: values.followUpEnabled,
    followUpText: values.followUpText,
    linkUrl: primaryLink?.url ?? "",
    linkButtonText: primaryLink?.label ?? "Open link",
  };
}

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
      return "Opening private reply sent";
    case "awaiting_button_click":
      return "Waiting for opening DM interaction";
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

export function formatRelativeTime(
  timestamp: number | null | undefined,
): string {
  if (!timestamp) return "\u2014";

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
