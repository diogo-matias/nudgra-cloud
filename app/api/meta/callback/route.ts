import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getMetaRedirectUri, getSiteUrl } from "@/lib/meta";

export async function GET(request: Request) {
  const siteUrl = getSiteUrl(request);
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.redirect(new URL("/signin", siteUrl));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/account?error=${encodeURIComponent(errorReason ?? error)}`,
        siteUrl,
      ),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/account?error=missing-code-or-state", siteUrl),
    );
  }

  try {
    const result = await fetchAction(
      api.meta.oauth.exchangeCodeForAccount,
      {
        code,
        state,
        redirectUri: getMetaRedirectUri(request),
      },
      { token },
    );

    const redirectUrl = new URL("/dashboard/account?connected=1", siteUrl);
    if (result.warning) {
      redirectUrl.searchParams.set("warning", result.warning);
    }
    return NextResponse.redirect(redirectUrl);
  } catch (connectError) {
    const message =
      connectError instanceof Error
        ? connectError.message
        : "instagram-connection-failed";
    return NextResponse.redirect(
      new URL(
        `/dashboard/account?error=${encodeURIComponent(message)}`,
        siteUrl,
      ),
    );
  }
}
