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

export function getFollowerAutomationFormValidationIssues(args: {
  name: string;
  welcomeDmText: string;
  linkDmText: string;
  linkButtons: LinkLike[];
  followUpEnabled: boolean;
}) {
  const issues: string[] = [];

  if (!args.name.trim()) {
    issues.push("Automation name is required.");
  }

  if (!args.welcomeDmText.trim()) {
    issues.push("Welcome message is required.");
  }

  if (args.followUpEnabled && args.linkButtons.length === 0) {
    issues.push("Follow-up requires at least one tracked link button.");
  }

  return issues;
}

export function getFollowerAutomationStepLabel(step: string) {
  switch (step) {
    case "welcome_sent":
      return "Welcome DM sent";
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

export function getFollowerAutomationLatestSessionSummary(
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

  return `Latest session is at ${getFollowerAutomationStepLabel(session.currentStep).toLowerCase()}.`;
}

export function formatFollowerAutomationTimestamp(
  timestamp: number | null | undefined,
) {
  const safeTimestamp = timestamp ?? null;
  if (safeTimestamp === null) {
    return "Not yet";
  }

  return new Date(safeTimestamp).toLocaleString();
}
