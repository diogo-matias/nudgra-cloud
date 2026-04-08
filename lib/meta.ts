export const META_REQUESTED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
] as const;

export function isMetaConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_VERIFY_TOKEN,
  );
}

export function getSiteUrl(request: Request) {
  const siteUrl = process.env.SITE_URL;
  if (siteUrl) {
    return siteUrl;
  }

  return new URL(request.url).origin;
}

export function getMetaRedirectUri(request: Request) {
  return new URL("/api/meta/callback", getSiteUrl(request)).toString();
}

export function buildMetaAuthorizeUrl(args: {
  state: string;
  redirectUri: string;
}) {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    throw new Error("META_APP_ID is missing.");
  }

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_REQUESTED_SCOPES.join(","));
  url.searchParams.set("state", args.state);
  return url.toString();
}
