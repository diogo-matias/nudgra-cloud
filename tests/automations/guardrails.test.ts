import { describe, expect, test } from "vitest";

import type { Id } from "@/convex/_generated/dataModel";
import {
  formatGuardrailWindowLabel,
  getDeliveryAttemptAutomationType,
  shouldCountDeliveryAttemptForConversationGuardrail,
} from "@/convex/automations/guardrails";

describe("automation conversation guardrails", () => {
  test("formats minute-based windows for the guardrail reason", () => {
    expect(formatGuardrailWindowLabel(15 * 60 * 1000)).toBe("15 minutes");
    expect(formatGuardrailWindowLabel(60 * 60 * 1000)).toBe("1 hour");
  });

  test("derives the automation type from each delivery attempt", () => {
    expect(
      getDeliveryAttemptAutomationType({
        automationRuleId: null,
        storyAutomationId: null,
        sequenceEnrollmentId: null,
      }),
    ).toBe("comment_automation");
    expect(
      getDeliveryAttemptAutomationType({
        automationRuleId: "rule-id" as Id<"automationRules">,
        storyAutomationId: null,
        sequenceEnrollmentId: null,
      }),
    ).toBe("rule");
    expect(
      getDeliveryAttemptAutomationType({
        automationRuleId: null,
        storyAutomationId: "story-id" as Id<"storyAutomations">,
        sequenceEnrollmentId: null,
      }),
    ).toBe("story_automation");
    expect(
      getDeliveryAttemptAutomationType({
        automationRuleId: null,
        storyAutomationId: null,
        sequenceEnrollmentId: "seq-id" as Id<"sequenceEnrollments">,
      }),
    ).toBe("sequence");
  });

  test("counts only delivery attempts that could create outbound bursts", () => {
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "queued",
        },
        automationType: "comment_automation",
      }),
    ).toBe(true);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "sent",
        },
        automationType: "comment_automation",
      }),
    ).toBe(true);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "failed",
        },
        automationType: "comment_automation",
      }),
    ).toBe(true);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "blocked_auth",
        },
        automationType: "comment_automation",
      }),
    ).toBe(false);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "skipped",
        },
        automationType: "comment_automation",
      }),
    ).toBe(false);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: null,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "skipped_expired",
        },
        automationType: "comment_automation",
      }),
    ).toBe(false);
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail({
        attempt: {
          automationRuleId: "rule-id" as Id<"automationRules">,
          storyAutomationId: null,
          sequenceEnrollmentId: null,
          status: "sent",
        },
        automationType: "comment_automation",
      }),
    ).toBe(false);
  });
});
