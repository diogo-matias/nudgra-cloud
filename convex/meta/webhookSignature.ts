const META_WEBHOOK_SIGNATURE_PREFIX = "sha256=";
const HEX_SHA256_LENGTH = 64;

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeMetaWebhookSignature(signatureHeader: string | null) {
  const signature = signatureHeader?.trim() ?? "";
  if (!signature.startsWith(META_WEBHOOK_SIGNATURE_PREFIX)) {
    return null;
  }

  const digest = signature.slice(META_WEBHOOK_SIGNATURE_PREFIX.length);
  if (digest.length !== HEX_SHA256_LENGTH || !/^[0-9a-fA-F]+$/.test(digest)) {
    return null;
  }

  return digest.toLowerCase();
}

function timingSafeHexEqual(left: string, right: string) {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftCode = index < left.length ? left.charCodeAt(index) : 0;
    const rightCode = index < right.length ? right.charCodeAt(index) : 0;
    diff |= leftCode ^ rightCode;
  }

  return diff === 0;
}

export async function computeMetaWebhookSignature(args: {
  body: string;
  appSecret: string;
}) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(args.appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(args.body),
  );

  return toHex(new Uint8Array(signature));
}

export async function verifyMetaWebhookSignature(args: {
  body: string;
  appSecret: string;
  signatureHeader: string | null;
}) {
  const providedSignature = normalizeMetaWebhookSignature(args.signatureHeader);
  if (providedSignature === null) {
    return false;
  }

  const expectedSignature = await computeMetaWebhookSignature({
    body: args.body,
    appSecret: args.appSecret,
  });

  return timingSafeHexEqual(providedSignature, expectedSignature);
}
