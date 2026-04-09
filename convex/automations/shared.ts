function sanitizeKeywordLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeKeyword(value: string) {
  return sanitizeKeywordLabel(value).toLowerCase();
}

export function getKeywordEntries(values: string[]) {
  const seen = new Set<string>();
  const entries: Array<{ label: string; normalized: string }> = [];

  for (const value of values) {
    const label = sanitizeKeywordLabel(value);
    const normalized = normalizeKeyword(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    entries.push({ label, normalized });
  }

  return entries;
}

export function normalizeKeywordList(values: string[]) {
  return getKeywordEntries(values).map((entry) => entry.normalized);
}

export function getKeywordLabelList(values: string[]) {
  return getKeywordEntries(values).map((entry) => entry.label);
}

export function matchesAutomationRule(args: {
  triggerType: "keyword" | "story_reply";
  matchType: "contains" | "exact";
  keywords: string[];
  messageText: string | null;
  isStoryReply: boolean;
}) {
  if (args.triggerType === "story_reply") {
    return args.isStoryReply;
  }

  if (!args.messageText) {
    return false;
  }

  const normalizedText = normalizeKeyword(args.messageText);
  if (!normalizedText) {
    return false;
  }

  if (args.matchType === "exact") {
    return args.keywords.some((keyword) => normalizedText === keyword);
  }

  return args.keywords.some((keyword) => normalizedText.includes(keyword));
}

export function makeMessagePreview(text: string | null) {
  if (!text) {
    return "Instagram event received";
  }

  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}
