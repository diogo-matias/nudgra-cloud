type ContactCsvAutomation = {
  kind: "rule" | "comment_automation" | "story_automation" | "sequence";
  label: string;
  status: string | null;
};

type ContactCsvTag = {
  label: string;
};

export type ContactCsvRecord = {
  displayName: string | null;
  username: string | null;
  latestEmail: string | null;
  emailCount: number;
  emails: string[];
  tags: ContactCsvTag[];
  automations: ContactCsvAutomation[];
  subscribedAt: number;
  lastInboundAt: number;
  lastMessageAt: number;
};

function getContactDisplayName(
  displayName: string | null,
  username: string | null,
) {
  const normalizedDisplayName = displayName?.trim();
  if (normalizedDisplayName) {
    return normalizedDisplayName;
  }

  const normalizedUsername = username?.trim();
  if (normalizedUsername) {
    return normalizedUsername;
  }

  return "Unknown contact";
}

function getInstagramHandle(username: string | null) {
  const normalizedUsername = username?.trim();
  return normalizedUsername ? `@${normalizedUsername}` : "";
}

function getAutomationKindLabel(kind: ContactCsvAutomation["kind"]) {
  switch (kind) {
    case "comment_automation":
      return "Comment";
    case "story_automation":
      return "Story";
    case "sequence":
      return "Sequence";
    default:
      return "Rule";
  }
}

function formatAutomationValue(automation: ContactCsvAutomation) {
  if (automation.status === null) {
    return `${getAutomationKindLabel(automation.kind)}: ${automation.label}`;
  }

  return `${getAutomationKindLabel(automation.kind)}: ${automation.label} (${automation.status.replaceAll("_", " ")})`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function formatCsvRow(values: Array<string | number>) {
  return values.map((value) => escapeCsvCell(String(value))).join(",");
}

export function buildContactsCsv(records: ContactCsvRecord[]) {
  const rows = [
    formatCsvRow([
      "Name",
      "Instagram Handle",
      "Latest Email",
      "All Emails",
      "Email Count",
      "Automations",
      "Tags",
      "Subscribed At",
      "Last Inbound At",
      "Last Message At",
    ]),
    ...records.map((record) =>
      formatCsvRow([
        getContactDisplayName(record.displayName, record.username),
        getInstagramHandle(record.username),
        record.latestEmail ?? "",
        record.emails.join("\n"),
        record.emailCount,
        record.automations.map(formatAutomationValue).join(" | "),
        record.tags.map((tag) => tag.label).join(" | "),
        formatTimestamp(record.subscribedAt),
        formatTimestamp(record.lastInboundAt),
        formatTimestamp(record.lastMessageAt),
      ]),
    ),
  ];

  return `${rows.join("\n")}\n`;
}
