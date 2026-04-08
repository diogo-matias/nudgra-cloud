export function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeKeywordList(values: string[]) {
  return [...new Set(values.map(normalizeKeyword).filter(Boolean))];
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
