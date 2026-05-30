# Meta Setup

This project uses Instagram Login for one operator-owned Instagram professional account.

## Required Environment Variables

Set these in your local and deployed environments:

```bash
SITE_URL=https://your-app-domain.com
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-convex-deployment.convex.site
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_VERIFY_TOKEN=your_custom_webhook_verify_token
```

`SITE_URL` must match the public origin that Meta redirects back to.
`NEXT_PUBLIC_CONVEX_SITE_URL` is the public Convex HTTP origin that receives
webhook traffic.

## Meta App Configuration

1. Create a Meta app that supports Instagram Login and Instagram messaging.
2. Add the Instagram business permissions used by the app:
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`
3. Add your development tester/admin roles in the Meta app.
4. Make sure the Instagram account you connect is a professional account with the right Meta role access during development.

## OAuth Redirect

Add this redirect URI in the Meta app:

```text
https://your-app-domain.com/api/meta/callback
```

For local work, use your dev tunnel or public dev URL if Meta needs a reachable callback.

## Webhook Configuration

Set the webhook callback URL in the Meta app to:

```text
https://your-convex-deployment.convex.site/meta/webhooks
```

Use `META_VERIFY_TOKEN` as the verification token.

Do not point Meta at `SITE_URL/meta/webhooks` unless you have added your own
proxy there. In this project, the webhook handler is defined in
`convex/http.ts`, so Meta must call the Convex HTTP endpoint instead.

Meta's webhook delivery also has two separate requirements:

1. Subscribe the app to Instagram webhooks in the Meta App Dashboard.
2. Set the app to Live mode so Meta actually sends webhook notifications.

After account connection, Nudgra also attempts to subscribe the connected Instagram account to the app's webhook delivery through the Graph API.
The account-level subscription requests `messages`, `messaging_postbacks`, and `comments` so comment-triggered private replies can open the normal 24-hour DM window after a tap or reply.

Meta's public Instagram webhook fields do not include a new-follower trigger.
Unfollowing and following a test account will not produce a webhook that Nudgra
can use for a welcome DM.

Important: a "Connected" account in Nudgra only confirms OAuth/token storage and
that the app attempted the account-level `subscribed_apps` call. It does not
guarantee that the app-level webhook callback is configured correctly.

## Current Product Assumptions

- One workspace per signed-in operator
- One Instagram professional account per workspace
- Text replies only for the MVP
- Keyword and story-reply triggers only

## Troubleshooting

- If `/dashboard/account` shows a config warning, confirm all three Meta environment variables are set.
- If OAuth succeeds but the UI warns about webhook subscription, re-check app roles, webhook field subscriptions, app Live mode, and account eligibility in Meta.
- If inbound events do not appear, verify that the Meta callback URL is the Convex URL (`NEXT_PUBLIC_CONVEX_SITE_URL/meta/webhooks`), not the app URL, and confirm the connected account is still subscribed.
