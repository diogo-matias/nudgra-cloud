import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "@/convex/_generated/api";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-05-01T12:00:00.000Z").getTime();

async function seedWorkspace(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Operator",
      email: "operator@example.com",
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: "Workspace",
      timezone: "UTC",
    });
    const instagramAccountId = await ctx.db.insert("instagramAccounts", {
      workspaceId,
      instagramAccountId: "ig_account_1",
      metaUserId: null,
      username: "operator",
      name: "Operator",
      profilePictureUrl: null,
      accountType: "business",
      status: "connected",
      graphAccessToken: "graph-token",
      tokenExpiresAt: BASE_TIME + 60 * 24 * 60 * 60 * 1000,
      scopes: [],
      webhookSubscriptionStatus: "active",
      lastWebhookAt: null,
      lastError: null,
      connectedAt: BASE_TIME,
      disconnectedAt: null,
      graphApiVersion: "v23.0",
    });

    return { userId, workspaceId, instagramAccountId };
  });
}

describe("media queries", () => {
  it("lists the newest cached media before applying the picker limit", async () => {
    const t = convexTest({ schema, modules });
    const fixture = await seedWorkspace(t);
    const authT = t.withIdentity({ subject: fixture.userId });

    await t.run(async (ctx) => {
      for (let index = 0; index < 53; index += 1) {
        await ctx.db.insert("instagramMedia", {
          workspaceId: fixture.workspaceId,
          instagramAccountId: fixture.instagramAccountId,
          mediaId: `media_${index}`,
          mediaType: "VIDEO",
          thumbnailUrl: null,
          mediaUrl: `https://example.com/media-${index}.mp4`,
          caption: `Media ${index}`,
          timestamp: new Date(BASE_TIME + index * 60_000).toISOString(),
          permalink: `https://instagram.com/reel/media-${index}`,
          fetchedAt: BASE_TIME + index,
        });
      }
    });

    const media = await authT.query(api.meta.mediaQueries.listCachedMedia, {
      accountId: fixture.instagramAccountId,
    });

    expect(media).toHaveLength(50);
    expect(media[0]?.mediaId).toBe("media_52");
    expect(media[1]?.mediaId).toBe("media_51");
    expect(media.at(-1)?.mediaId).toBe("media_3");
    expect(media.some((item) => item.mediaId === "media_0")).toBe(false);
  });
});
