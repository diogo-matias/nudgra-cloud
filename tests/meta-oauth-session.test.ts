import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { modules } from "@/convex/test.setup";

const BASE_TIME = new Date("2026-04-15T10:00:00.000Z").getTime();
const REDIRECT_URI = "https://app.example.com/api/meta/callback";
const ORIGINAL_META_APP_ID = process.env.META_APP_ID;
const ORIGINAL_META_APP_SECRET = process.env.META_APP_SECRET;
const ORIGINAL_META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

type Fixture = {
  userId: Id<"users">;
  workspaceId: Id<"workspaces">;
};

async function seedOperator(
  t: ReturnType<typeof convexTest>,
  args: { email: string; name: string },
): Promise<Fixture> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      name: `${args.name} Workspace`,
      timezone: "UTC",
    });

    return { userId, workspaceId };
  });
}

async function insertConnectSession(
  t: ReturnType<typeof convexTest>,
  fixture: Fixture,
  args: {
    state: string;
    status?: "pending" | "completed" | "failed";
    redirectUri?: string;
    expiresAt?: number;
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("instagramConnectSessions", {
      workspaceId: fixture.workspaceId,
      createdByUserId: fixture.userId,
      state: args.state,
      redirectUri: args.redirectUri ?? REDIRECT_URI,
      requestedScopes: ["instagram_business_basic"],
      status: args.status ?? "pending",
      expiresAt: args.expiresAt ?? BASE_TIME + 15 * 60 * 1000,
      errorMessage: null,
    });
  });
}

function upsertAccountArgs(state: string) {
  return {
    state,
    instagramAccountId: `ig_${state}`,
    metaUserId: null,
    username: "nudgra",
    name: "Nudgra",
    profilePictureUrl: null,
    accountType: "business" as const,
    graphAccessToken: "graph-token",
    tokenExpiresAt: BASE_TIME + 60 * 24 * 60 * 60 * 1000,
    scopes: ["instagram_business_basic"],
    webhookSubscriptionStatus: "active" as const,
    status: "connected" as const,
    lastError: null,
    graphApiVersion: "v23.0",
  };
}

function restoreOptionalEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function mockMetaOAuthFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url === "https://api.instagram.com/oauth/access_token") {
      return new Response(
        JSON.stringify({
          access_token: "short-lived-token",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }

    if (url.startsWith("https://graph.instagram.com/access_token")) {
      return new Response(
        JSON.stringify({
          access_token: "long-lived-token",
          expires_in: 60 * 24 * 60 * 60,
        }),
        { status: 200 },
      );
    }

    if (url.startsWith("https://graph.instagram.com/v23.0/me")) {
      return new Response(
        JSON.stringify({
          user_id: "ig_connected",
          username: "nudgra",
          name: "Nudgra",
          account_type: "BUSINESS",
          profile_picture_url: "https://example.com/profile.jpg",
        }),
        { status: 200 },
      );
    }

    if (
      url.startsWith(
        "https://graph.instagram.com/v23.0/ig_connected/subscribed_apps",
      )
    ) {
      return new Response("{}", { status: 200 });
    }

    throw new Error(`Unexpected Meta request: ${url}`);
  });
}

describe("Meta OAuth connect session guards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    process.env.NUDGRA_ALLOWED_EMAILS = "owner@example.com,other@example.com";
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
    process.env.META_VERIFY_TOKEN = "meta-verify-token";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env.NUDGRA_ALLOWED_EMAILS = "operator@example.com,test@example.com";
    restoreOptionalEnv("META_APP_ID", ORIGINAL_META_APP_ID);
    restoreOptionalEnv("META_APP_SECRET", ORIGINAL_META_APP_SECRET);
    restoreOptionalEnv("META_VERIFY_TOKEN", ORIGINAL_META_VERIFY_TOKEN);
  });

  it("returns a pending connect session only to the creating operator", async () => {
    const t = convexTest({ schema, modules });
    const owner = await seedOperator(t, {
      email: "owner@example.com",
      name: "Owner",
    });
    const other = await seedOperator(t, {
      email: "other@example.com",
      name: "Other",
    });
    await insertConnectSession(t, owner, { state: "state-owner" });

    const ownerT = t.withIdentity({ subject: owner.userId });
    const otherT = t.withIdentity({ subject: other.userId });

    const ownerSession = await ownerT.query(
      internal.accounts.getConnectSessionByState,
      {
        state: "state-owner",
        redirectUri: REDIRECT_URI,
      },
    );
    const otherSession = await otherT.query(
      internal.accounts.getConnectSessionByState,
      {
        state: "state-owner",
        redirectUri: REDIRECT_URI,
      },
    );
    const wrongRedirectSession = await ownerT.query(
      internal.accounts.getConnectSessionByState,
      {
        state: "state-owner",
        redirectUri: "https://app.example.com/wrong",
      },
    );

    expect(ownerSession?.createdByUserId).toBe(owner.userId);
    expect(otherSession).toBeNull();
    expect(wrongRedirectSession).toBeNull();
  });

  it("rejects completed or expired sessions before account upsert", async () => {
    const t = convexTest({ schema, modules });
    const owner = await seedOperator(t, {
      email: "owner@example.com",
      name: "Owner",
    });

    await insertConnectSession(t, owner, {
      state: "completed-state",
      status: "completed",
    });
    await insertConnectSession(t, owner, {
      state: "expired-state",
      expiresAt: BASE_TIME - 1,
    });

    await expect(
      t.mutation(
        internal.accounts.upsertConnectedAccount,
        upsertAccountArgs("completed-state"),
      ),
    ).rejects.toThrow("not pending");
    await expect(
      t.mutation(
        internal.accounts.upsertConnectedAccount,
        upsertAccountArgs("expired-state"),
      ),
    ).rejects.toThrow("not pending");
  });

  it("allows the creating operator to complete the public OAuth action once", async () => {
    const t = convexTest({ schema, modules });
    const owner = await seedOperator(t, {
      email: "owner@example.com",
      name: "Owner",
    });
    await insertConnectSession(t, owner, { state: "action-state" });
    vi.stubGlobal("fetch", mockMetaOAuthFetch());

    const ownerT = t.withIdentity({ subject: owner.userId });
    const result = await ownerT.action(api.meta.oauth.exchangeCodeForAccount, {
      code: "authorization-code",
      state: "action-state",
      redirectUri: REDIRECT_URI,
    });

    expect(result).toMatchObject({
      accountId: "ig_connected",
      username: "nudgra",
      warning: null,
    });

    const account = await t.run((ctx) =>
      ctx.db
        .query("instagramAccounts")
        .withIndex("by_instagram_account_id", (q) =>
          q.eq("instagramAccountId", "ig_connected"),
        )
        .unique(),
    );
    expect(account?.graphAccessToken).toBe("long-lived-token");

    await expect(
      ownerT.action(api.meta.oauth.exchangeCodeForAccount, {
        code: "authorization-code",
        state: "action-state",
        redirectUri: REDIRECT_URI,
      }),
    ).rejects.toThrow("invalid or expired");
  });
});
