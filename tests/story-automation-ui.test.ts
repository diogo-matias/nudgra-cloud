import { describe, expect, it } from "vitest";
import {
  getNormalizedStoryAutomationTokens,
  mergeStoryAutomationTokens,
} from "@/lib/story-automation-ui";

describe("story automation token helpers", () => {
  it("merges comma-separated words and emoji without duplicates", () => {
    expect(
      mergeStoryAutomationTokens(["link"], "guide, 🔥, Link"),
    ).toEqual(["link", "guide", "🔥"]);
  });

  it("normalizes story reply tokens for matching", () => {
    expect(
      getNormalizedStoryAutomationTokens(["Guide", "🔥"], " LINK, guide "),
    ).toEqual(["guide", "🔥", "link"]);
  });
});
