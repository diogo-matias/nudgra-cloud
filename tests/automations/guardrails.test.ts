import { describe, expect, test } from "vitest";

import {
  formatGuardrailWindowLabel,
  shouldCountDeliveryAttemptForConversationGuardrail,
} from "@/convex/automations/guardrails";

describe("automation conversation guardrails", () => {
  test("formats minute-based windows for the guardrail reason", () => {
    expect(formatGuardrailWindowLabel(15 * 60 * 1000)).toBe("15 minutes");
    expect(formatGuardrailWindowLabel(60 * 60 * 1000)).toBe("1 hour");
  });

  test("counts only delivery attempts that could create outbound bursts", () => {
    expect(shouldCountDeliveryAttemptForConversationGuardrail("queued")).toBe(
      true,
    );
    expect(shouldCountDeliveryAttemptForConversationGuardrail("sent")).toBe(
      true,
    );
    expect(shouldCountDeliveryAttemptForConversationGuardrail("failed")).toBe(
      true,
    );
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail("blocked_auth"),
    ).toBe(false);
    expect(shouldCountDeliveryAttemptForConversationGuardrail("skipped")).toBe(
      false,
    );
    expect(
      shouldCountDeliveryAttemptForConversationGuardrail("skipped_expired"),
    ).toBe(false);
  });
});
