import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api";

const fetchMutationMock = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation: fetchMutationMock,
}));

describe("tracked link route", () => {
  beforeEach(() => {
    fetchMutationMock.mockReset();
  });

  it("redirects to the stored destination for a valid token", async () => {
    fetchMutationMock.mockResolvedValue({
      destinationUrl: "https://example.com/guide",
    });

    const { GET } = await import("@/app/api/comment-automation/links/[token]/route");
    const response = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ token: "token_123" }),
    });

    expect(fetchMutationMock).toHaveBeenCalledWith(
      api.automations.commentTracking.consumeTrackedLink,
      { token: "token_123" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://example.com/guide");
  });

  it("returns 404 when the token cannot be resolved", async () => {
    fetchMutationMock.mockRejectedValue(new Error("missing"));

    const { GET } = await import("@/app/api/comment-automation/links/[token]/route");
    const response = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ token: "missing_token" }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Tracked link not found.");
  });
});
