import { afterEach, describe, expect, it } from "vitest";
import { getSiteUrl } from "@/lib/meta";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_SITE_URL = process.env.SITE_URL;

function restoreEnv() {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }

  if (ORIGINAL_SITE_URL === undefined) {
    delete process.env.SITE_URL;
  } else {
    process.env.SITE_URL = ORIGINAL_SITE_URL;
  }
}

describe("Meta site URL configuration", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("uses the configured SITE_URL origin", () => {
    process.env.NODE_ENV = "production";
    process.env.SITE_URL = "https://app.example.com/some/path";

    expect(getSiteUrl(new Request("https://spoofed.example.com"))).toBe(
      "https://app.example.com",
    );
  });

  it("requires SITE_URL outside development and test", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SITE_URL;

    expect(() =>
      getSiteUrl(new Request("https://spoofed.example.com")),
    ).toThrow("SITE_URL is required");
  });

  it("allows request-origin fallback in test mode", () => {
    process.env.NODE_ENV = "test";
    delete process.env.SITE_URL;

    expect(getSiteUrl(new Request("https://local.example.com/path"))).toBe(
      "https://local.example.com",
    );
  });
});
