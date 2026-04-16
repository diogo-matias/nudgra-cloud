import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAutomationGuardrailReason,
  chunkButtons,
  createTrackedLinkButtons,
  extractEmail,
  getFollowGateInputMode,
  hasInboundInteraction,
  isTerminalAutomationSessionStep,
} from "@/convex/automations/sessionShared";

const BASE_TIME = new Date("2026-04-10T10:00:00.000Z").getTime();

describe("shared automation session helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.SITE_URL = "https://app.example.com";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.SITE_URL;
  });

  it("maps follow-gate consent states to the expected input mode", () => {
    expect(getFollowGateInputMode(false)).toBe("button");
    expect(getFollowGateInputMode(true)).toBe("reply");
  });

  it("detects inbound interactions and terminal session steps", () => {
    expect(
      hasInboundInteraction({
        hasMessage: false,
        postbackPayload: null,
        quickReplyPayload: null,
      }),
    ).toBe(false);
    expect(
      hasInboundInteraction({
        hasMessage: true,
        postbackPayload: null,
        quickReplyPayload: null,
      }),
    ).toBe(true);
    expect(
      hasInboundInteraction({
        hasMessage: false,
        postbackPayload: "rule_automation:follow_gate",
        quickReplyPayload: null,
      }),
    ).toBe(true);
    expect(isTerminalAutomationSessionStep("completed")).toBe(true);
    expect(isTerminalAutomationSessionStep("link_sent")).toBe(true);
    expect(isTerminalAutomationSessionStep("guardrail_tripped")).toBe(true);
    expect(isTerminalAutomationSessionStep("awaiting_email")).toBe(false);
  });

  it("extracts and normalizes email addresses from freeform replies", () => {
    expect(extractEmail("Reach me at USER@Example.com for the guide")).toBe(
      "user@example.com",
    );
    expect(extractEmail("no email in this reply")).toBeNull();
    expect(extractEmail(null)).toBeNull();
  });

  it("builds readable guardrail reasons for both session and conversation bursts", () => {
    expect(
      buildAutomationGuardrailReason({
        automationLabel: "DM automation",
        limitType: "session",
        limit: 1,
        purpose: "the link delivery",
        windowLabel: "6 hours",
      }),
    ).toBe(
      "Safety guardrail paused this DM automation after 1 outbound DM in the same session while sending the link delivery.",
    );

    expect(
      buildAutomationGuardrailReason({
        automationLabel: "comment automation",
        limitType: "conversation_window",
        limit: 8,
        purpose: "the follow-up DM",
        windowLabel: "6 hours",
      }),
    ).toBe(
      "Safety guardrail paused this comment automation after 8 outbound DMs from the same automation type in the same conversation within 6 hours while sending the follow-up DM.",
    );
  });

  it("chunks buttons into stable batches", () => {
    expect(chunkButtons([1, 2, 3, 4, 5], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it("creates tracked link buttons with persisted metadata", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("token-a")
      .mockReturnValueOnce("token-b");
    const insertTrackedLink = vi.fn(async () => {});

    const trackedButtons = await createTrackedLinkButtons({
      buttons: [
        {
          type: "web_url",
          title: "Guide",
          url: "https://example.com/guide",
        },
        {
          type: "web_url",
          title: "Pricing",
          url: "https://example.com/pricing",
        },
      ],
      routePrefix: "/api/rule-automation/links",
      insertTrackedLink,
    });

    expect(insertTrackedLink).toHaveBeenCalledTimes(2);
    expect(insertTrackedLink).toHaveBeenNthCalledWith(1, {
      token: "token-a",
      destinationUrl: "https://example.com/guide",
      label: "Guide",
      buttonIndex: 0,
      createdAt: BASE_TIME,
    });
    expect(insertTrackedLink).toHaveBeenNthCalledWith(2, {
      token: "token-b",
      destinationUrl: "https://example.com/pricing",
      label: "Pricing",
      buttonIndex: 1,
      createdAt: BASE_TIME,
    });
    expect(trackedButtons).toEqual([
      {
        type: "web_url",
        title: "Guide",
        url: "https://app.example.com/api/rule-automation/links/token-a",
      },
      {
        type: "web_url",
        title: "Pricing",
        url: "https://app.example.com/api/rule-automation/links/token-b",
      },
    ]);
  });
});
