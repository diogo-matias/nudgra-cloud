import { describe, expect, it } from "vitest";
import {
  computeMetaWebhookSignature,
  verifyMetaWebhookSignature,
} from "@/convex/meta/webhookSignature";

describe("Meta webhook signature verification", () => {
  it("accepts a valid x-hub-signature-256 header", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const appSecret = "meta-app-secret";
    const digest = await computeMetaWebhookSignature({ body, appSecret });

    await expect(
      verifyMetaWebhookSignature({
        body,
        appSecret,
        signatureHeader: `sha256=${digest}`,
      }),
    ).resolves.toBe(true);
  });

  it("rejects missing, malformed, or tampered signatures", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const appSecret = "meta-app-secret";
    const digest = await computeMetaWebhookSignature({ body, appSecret });

    await expect(
      verifyMetaWebhookSignature({
        body,
        appSecret,
        signatureHeader: null,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyMetaWebhookSignature({
        body,
        appSecret,
        signatureHeader: `sha1=${digest}`,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyMetaWebhookSignature({
        body: body.replace("instagram", "tampered"),
        appSecret,
        signatureHeader: `sha256=${digest}`,
      }),
    ).resolves.toBe(false);
  });
});
