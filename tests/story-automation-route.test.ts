import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api";

const fetchMutationMock = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation: fetchMutationMock,
}));

describe("story tracked link route", () => {
  beforeEach(() => {
    fetchMutationMock.mockReset();
  });

  it("redirects to the stored destination for a valid token", async () => {
    fetchMutationMock.mockResolvedValue({
      destinationUrl: "https://example.com/story-guide",
    });

    const { GET } = await import(
      "@/app/api/story-automation/links/[token]/route"
    );
    const response = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ token: "story_token_123" }),
    });

    expect(fetchMutationMock).toHaveBeenCalledWith(
      api.automations.storyTracking.consumeTrackedLink,
      { token: "story_token_123" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.com/story-guide",
    );
  });

  it("returns 404 when the token cannot be resolved", async () => {
    fetchMutationMock.mockRejectedValue(new Error("missing"));

    const { GET } = await import(
      "@/app/api/story-automation/links/[token]/route"
    );
    const response = await GET(new Request("https://app.example.com"), {
      params: Promise.resolve({ token: "missing_story_token" }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Tracked link not found.");
  });
});
