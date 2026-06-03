export const META_GRAPH_API_VERSION = "v23.0";

export const META_REQUESTED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
];

export const META_WEBHOOK_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "comments",
];

export function getMetaWebhookSubscribedFields() {
  return META_WEBHOOK_SUBSCRIBED_FIELDS;
}

export function requireMetaEnv() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (!appId || !appSecret || !verifyToken) {
    throw new Error(
      "Missing Meta environment variables. Expected META_APP_ID, META_APP_SECRET, and META_VERIFY_TOKEN.",
    );
  }

  return { appId, appSecret, verifyToken };
}

export function requireSiteUrl() {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) {
    throw new Error("Missing SITE_URL. Configure SITE_URL for tracked links.");
  }
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SITE_URL must use http or https.");
  }

  return parsed.origin;
}
