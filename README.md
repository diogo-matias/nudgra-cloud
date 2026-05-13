# Nudgra

Nudgra is an operator-owned Instagram automation app built with Next.js and Convex. It is aimed at creators and small operators who want to run DM, comment, and story automations from infrastructure they control instead of paying ongoing SaaS fees for the same core workflows.

This repository is no longer just a starter template. It already includes a real dashboard, Google sign-in, Instagram account connection through Meta, automation management, contacts, conversations, logs, and the backend plumbing for tracked links, webhook ingestion, delivery attempts, and follow-up flows.

## What Is In The Repo Today

- Google sign-in with Convex Auth
- Workspace-scoped Instagram account management
- Meta OAuth connect flow for Instagram professional accounts
- Keyword DM automations
- Comment automations
- Story reply automations
- Contacts view with export and automation filters
- Conversation inbox and message history
- Activity and webhook logs
- Convex schema/modules for accounts, contacts, messages, automations, sequences, webhook events, and delivery tracking
- Vitest coverage for the main automation flows

## Stack

- Next.js 16
- React 19
- Convex
- Convex Auth
- Tailwind CSS 4
- `shadcn` UI components

## Project Docs

- [Design](./DESIGN.md)
- [Product Overview](./docs/product-overview.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Meta Setup Notes](./docs/meta-setup.md)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Trademark Policy](./TRADEMARKS.md)

## Local Development

### Prerequisites

- Node.js 24+
- A Convex account
- A Google OAuth app for sign-in
- A Meta app if you want to test Instagram connection and webhooks
- A public tunnel URL for local Meta callback testing, because Meta cannot call `localhost`

### Run Locally

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create a local env file from `.env.example`.

3. Fill the values you actually need:
   - `SITE_URL`
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_VERIFY_TOKEN`

4. Start the app.

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

Notes:

- The `predev` flow boots Convex, runs the Convex Auth setup helper once, and starts the dashboard.
- `npx convex dev` writes the local `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` values for you.
- If you want Meta OAuth, tracked links, or webhook testing locally, set `SITE_URL` to a public tunnel URL instead of `http://localhost:3000`.

## Environment Variables

### Vercel

Set these in Vercel because the Next.js app reads them during hosted builds and
runtime route handling:

| Variable | Purpose |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Lets the build deploy Convex code during production builds |
| `SITE_URL` | Public app origin used for callbacks and tracked links |
| `META_APP_ID` | Meta app ID used by the connect flow |
| `META_APP_SECRET` | Meta app secret used by the Next.js Meta routes |
| `META_VERIFY_TOKEN` | Meta webhook verification token presence check for the connect flow |

### Convex Production

Set these on the Convex deployment:

| Variable | Purpose |
| --- | --- |
| `AUTH_GOOGLE_ID` | Google sign-in client ID |
| `AUTH_GOOGLE_SECRET` | Google sign-in client secret |
| `META_APP_ID` | Meta app ID |
| `META_APP_SECRET` | Meta app secret |
| `META_VERIFY_TOKEN` | Meta webhook verification token |
| `SITE_URL` | Public app origin used for tracked links and callback-aware flows |
| `JWT_PRIVATE_KEY` | Convex Auth signing key |
| `JWKS` | Convex Auth JWKS document |

### Local Development

Your local `.env.local` should usually include:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex cloud URL used by Next.js |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL used by auth-related wiring |
| `SITE_URL` | Public app origin or local origin |
| `META_APP_ID` | Optional, only needed when testing Meta locally |
| `META_APP_SECRET` | Optional, only needed when testing Meta locally |
| `META_VERIFY_TOKEN` | Optional, only needed when testing Meta locally |
| `AUTH_GOOGLE_ID` | Optional, only needed when testing auth locally |
| `AUTH_GOOGLE_SECRET` | Optional, only needed when testing auth locally |

Important:

- `JWT_PRIVATE_KEY` and `JWKS` are required by Convex Auth, but you should not handcraft them. Generate them by running `npx @convex-dev/auth --prod` for production.
- `CONVEX_SITE_URL` is provided by Convex inside deployments. You do not normally set it yourself.
- This repo falls back to `NEXT_PUBLIC_CONVEX_SITE_URL` in [`convex/auth.config.ts`](./convex/auth.config.ts).

## Step-By-Step Hosting Guide

Recommended hosting model:

- Next.js app on Vercel
- Convex backend on Convex Cloud
- Google OAuth for operator sign-in
- Meta app for Instagram OAuth and webhooks

This is operator-controlled, but it is not strict end-to-end self-hosting because Convex is a managed backend.

### 1. Create The Convex Production Deployment

1. Create or open your Convex project.
2. Create a production deployment in the Convex dashboard.
3. Generate a production deploy key from the Convex dashboard.
4. Keep the production deployment's `.convex.site` URL handy. You will need it for Google and Meta.

### 2. Provision Convex Auth On Production

Run this from the project root:

```bash
npx @convex-dev/auth --prod
```

When prompted:

- set `SITE_URL` to your public app domain, for example `https://app.example.com`
- let the tool generate and store `JWT_PRIVATE_KEY` and `JWKS`

This step prepares the production Convex deployment for Google sign-in and redirects back to your site after auth.

### 3. Configure Google Sign-In

Create a Google OAuth client for the operator dashboard.

Use:

- Authorized JavaScript origin: `https://your-app-domain.com`
- Authorized redirect URI: `https://your-convex-site.convex.site/api/auth/callback/google`

Then set the Google credentials on the Convex production deployment:

```bash
npx convex env set --prod AUTH_GOOGLE_ID your-google-client-id
npx convex env set --prod AUTH_GOOGLE_SECRET your-google-client-secret
```

### 4. Configure Meta For Instagram

Create a Meta app for Instagram Login and messaging.

Required permissions for this repo:

- `instagram_business_basic`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

Set these URLs in the Meta app:

- OAuth redirect URI: `https://your-app-domain.com/api/meta/callback`
- Webhook callback URL: `https://your-convex-site.convex.site/meta/webhooks`
- Webhook verify token: the same value you will store as `META_VERIFY_TOKEN`

Also make sure you:

- add the correct tester/admin roles during development
- subscribe the app to the Instagram webhook fields you need, especially `messages`, `messaging_postbacks`, and `comments`
- switch the app to Live mode when you are ready for real delivery

Store the Meta values on the Convex production deployment:

```bash
npx convex env set --prod META_APP_ID your-meta-app-id
npx convex env set --prod META_APP_SECRET your-meta-app-secret
npx convex env set --prod META_VERIFY_TOKEN your-random-verify-token
```

### 5. Create The Vercel Project

1. Import this repository into Vercel.
2. Set these Vercel environment variables:
   - `CONVEX_DEPLOY_KEY`
   - `SITE_URL=https://your-app-domain.com`
3. Set the build command to:

   ```bash
   npx convex deploy --cmd "npm run build"
   ```

4. Keep the install command as:

   ```bash
   npm install
   ```

Why this build command matters:

- it deploys the Convex backend during the build
- it injects the correct `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` into the Next.js build

### 6. Add Your Domain And Redeploy

1. Attach your final domain in Vercel.
2. Make sure Vercel `SITE_URL` matches that exact domain.
3. Make sure Convex production `SITE_URL` matches that exact domain too.
4. Redeploy.

If the domain changes later, update `SITE_URL` in both places and re-check the Google and Meta callback settings.

### 7. Smoke Test The Hosted App

After the first deployment:

1. Open the hosted app and confirm Google sign-in works.
2. Open `/dashboard/account` and connect an Instagram professional account.
3. Confirm the account appears as connected.
4. Send a real test DM, comment, or story reply.
5. Verify that contacts, conversations, automations, and logs update in the dashboard.
6. Verify that tracked links resolve through your app domain and that webhook activity appears in logs.

## Common Deployment Mistakes

- Pointing Meta webhooks at your Vercel domain instead of `https://your-convex-site.convex.site/meta/webhooks`
- Setting `SITE_URL` only in Vercel and forgetting to set it in Convex
- Forgetting to run `npx @convex-dev/auth --prod`, which leaves production auth without `JWT_PRIVATE_KEY` and `JWKS`
- Using the wrong Google redirect URI. This repo uses the Convex Auth callback on the Convex site URL, not `/api/auth/callback/google` on Vercel
- Expecting Meta callbacks to work against `localhost`

## Open Source Licensing And Branding

This repository's source code is released under the [MIT License](./LICENSE).

The `Nudgra` name, logo, and branding are not included in that license. If you
fork or reuse the code for your own product, rename it and replace the
branding. See [TRADEMARKS.md](./TRADEMARKS.md).

## Useful Commands

```bash
npm run dev
npm run lint
npm test
npx convex dashboard
npx @convex-dev/auth --prod
```

## Related References

- [Convex hosting docs](https://docs.convex.dev/hosting)
- [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual)
- [Meta setup notes for this repo](./docs/meta-setup.md)
