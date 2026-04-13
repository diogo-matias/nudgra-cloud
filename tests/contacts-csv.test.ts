import { describe, expect, it } from "vitest";
import { buildContactsCsv } from "@/lib/contacts-csv";

describe("contacts CSV export", () => {
  it("escapes CSV values and joins multiple emails into one cell", () => {
    const csv = buildContactsCsv([
      {
        displayName: 'Alice "A", Smith',
        username: "alice",
        latestEmail: "lead@example.com",
        emailCount: 2,
        emails: ["lead@example.com", "second@example.com"],
        tags: [{ label: "vip,hot" }],
        automations: [
          {
            kind: "rule",
            label: 'Welcome "DM"',
            status: "active",
          },
        ],
        subscribedAt: 0,
        lastInboundAt: 60_000,
        lastMessageAt: 120_000,
      },
    ]);

    expect(csv).toContain(
      '"Alice ""A"", Smith",@alice,lead@example.com,"lead@example.com\nsecond@example.com",2',
    );
    expect(csv).toContain('"Rule: Welcome ""DM"" (active)"');
    expect(csv).toContain('"vip,hot"');
    expect(csv.endsWith("\n")).toBe(true);
  });
});
