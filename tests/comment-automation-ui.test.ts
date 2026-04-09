import { describe, expect, it } from "vitest";
import {
  getNormalizedCommentAutomationKeywords,
  mergeCommentAutomationKeywords,
  parseCommentAutomationKeywordInput,
} from "@/lib/comment-automation-ui";

describe("comment automation keyword helpers", () => {
  it("splits comma-separated keyword input into unique display labels", () => {
    expect(
      parseCommentAutomationKeywordInput("Email, Link,  Shop  , email"),
    ).toEqual(["Email", "Link", "Shop"]);
  });

  it("merges pending keyword input with existing chips without losing casing", () => {
    expect(
      mergeCommentAutomationKeywords(["price"], "Email, link, price"),
    ).toEqual(["price", "Email", "link"]);
  });

  it("normalizes keywords separately for matching", () => {
    expect(
      getNormalizedCommentAutomationKeywords(["Email", "Shop"], " LINK, email "),
    ).toEqual(["email", "shop", "link"]);
  });
});
