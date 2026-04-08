import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  buildMetaAuthorizeUrl,
  getMetaRedirectUri,
  getSiteUrl,
  isMetaConfigured,
  META_REQUESTED_SCOPES,
} from "@/lib/meta";

export async function GET(request: Request) {
  const siteUrl = getSiteUrl(request);

  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.redirect(new URL("/signin", siteUrl));
  }

  if (!isMetaConfigured()) {
    return NextResponse.redirect(
      new URL("/dashboard/account?error=meta-config-missing", siteUrl),
    );
  }

  await fetchMutation(api.workspaces.ensureCurrentWorkspace, {}, { token });

  const state = crypto.randomUUID();
  const redirectUri = getMetaRedirectUri(request);

  await fetchMutation(
    api.accounts.createConnectSession,
    {
      state,
      redirectUri,
      requestedScopes: [...META_REQUESTED_SCOPES],
    },
    { token },
  );

  return NextResponse.redirect(
    buildMetaAuthorizeUrl({
      state,
      redirectUri,
    }),
  );
}
