# Nudgra Cloud

Nudgra Cloud is an open alternative to ManyChat for the basic Instagram automations most users actually need: keyword DMs, comment replies, story replies, simple follow-ups, contacts, conversations, and logs.

This version uses Next.js for the dashboard and Convex Cloud for backend state, auth, scheduling, and Meta webhooks.

If you want to run the database and backend yourself, use Nudgra OSS instead: `TODO: add Nudgra OSS repo URL`.

If you run into setup issues, send a DM to [@Maikoke5](https://x.com/Maikoke5).

You can also give this README to a coding agent such as Codex, Claude Code, Cursor, or another assistant and ask it to walk you through the setup step by step. That works especially well for Convex environment variables, Google OAuth, Meta dashboard setup, and deployment logs.

## Stack

- Next.js 16
- React 19
- Convex
- Convex Auth
- Tailwind CSS 4
- `shadcn` UI components

## What You Need

- A Google account for dashboard sign-in.
- A Convex account for the backend deployment.
- A Meta Developer account.
- An Instagram professional account, business or creator, that you want to automate.
- For production: Vercel and a public domain or subdomain for the Next.js app.
- For local development: Node.js 24 or newer, Git, and optionally a public tunnel URL for Meta callback testing.

## Important URLs

Replace `https://your-app-domain.com` with your real app domain, for example `https://cloud.nudgra.example.com`.

Replace `https://your-convex-site.convex.site` with the Convex HTTP Actions URL for your deployment. In Convex, the site URL usually ends in `.convex.site`.

| Purpose | URL |
| --- | --- |
| App | `https://your-app-domain.com` |
| Google OAuth redirect URI | `https://your-convex-site.convex.site/api/auth/callback/google` |
| Meta / Instagram OAuth redirect URI | `https://your-app-domain.com/api/meta/callback` |
| Meta webhook callback URL | `https://your-convex-site.convex.site/meta/webhooks` |
| Convex dashboard | `npx convex dashboard` |

Meta webhooks must point to the Convex site URL, not the Next.js app URL. In this repo, the webhook route is defined in `convex/http.ts` at `/meta/webhooks`.

## Environment Variables

Copy `.env.example` to `.env.local` for local work:

```bash
cp .env.example .env.local
```

In Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Local values usually look like this:

```env
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=

SITE_URL=http://localhost:3000
CONVEX_DEPLOY_KEY=

AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
NUDGRA_ALLOWED_EMAILS=you@example.com

META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
```

Production values should be split between your Next.js host and Convex.

Set these on Vercel:

| Variable | Purpose |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Lets `npx convex deploy --cmd "npm run build"` deploy the Convex backend during hosted builds |
| `SITE_URL` | Public app origin used by Next.js routes, Meta OAuth callbacks, and tracked links |
| `META_APP_ID` | Meta app ID used by the Next.js connect route |
| `META_APP_SECRET` | Meta app secret used by the Next.js Meta routes |
| `META_VERIFY_TOKEN` | Verify-token presence check for the Meta connect flow |

Set these on the Convex production deployment:

| Variable | Purpose |
| --- | --- |
| `AUTH_GOOGLE_ID` | Google sign-in client ID |
| `AUTH_GOOGLE_SECRET` | Google sign-in client secret |
| `NUDGRA_ALLOWED_EMAILS` | Comma-separated Google emails allowed to access this private deployment |
| `META_APP_ID` | Meta app ID |
| `META_APP_SECRET` | Meta app secret |
| `META_VERIFY_TOKEN` | Meta webhook verification token |
| `SITE_URL` | Public app origin used by tracked links and callback-aware backend flows |
| `JWT_PRIVATE_KEY` | Convex Auth signing key |
| `JWKS` | Convex Auth JWKS document |

Important:

- `JWT_PRIVATE_KEY` and `JWKS` are required by Convex Auth. Generate them with `npx @convex-dev/auth --prod`; do not handcraft them unless you are following the Convex Auth manual setup docs.
- `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` are written by `npx convex dev` locally and injected by `npx convex deploy --cmd "npm run build"` during production builds.
- `NUDGRA_ALLOWED_EMAILS` is required. If your Google email is not in the allowlist, sign-in will be rejected.
- Keep `SITE_URL` exact. If your app is deployed at `https://cloud.example.com`, do not use a different Vercel preview URL or localhost value in production.

Generate random tokens with OpenSSL:

```bash
openssl rand -hex 32
```

Or generate one with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a generated value for `META_VERIFY_TOKEN`.

## Local Development

This path is best for dashboard development and UI testing. For a complete Instagram webhook flow, use a deployed Convex site URL and a public app domain or tunnel because Meta cannot call `localhost`.

### 1. Install Dependencies

Install:

- Git
- Node.js 24 or newer
- A Convex account

Clone the repo and install packages:

```bash
git clone YOUR_REPO_URL nudgra-cloud
cd nudgra-cloud
npm install
cp .env.example .env.local
```

In Windows PowerShell:

```powershell
git clone YOUR_REPO_URL nudgra-cloud
cd nudgra-cloud
npm install
Copy-Item .env.example .env.local
```

### 2. Configure Local `.env.local`

At minimum, set:

```env
SITE_URL=http://localhost:3000
NUDGRA_ALLOWED_EMAILS=your-google-email@gmail.com
```

Google OAuth is required for normal sign-in. Create Google OAuth credentials using the Google section below, then set:

```env
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

For local Google OAuth, use your local Convex site URL as the redirect URI, not the Next.js app URL. `npx convex dev` will print or write the Convex values:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-dev-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-dev-deployment.convex.site
```

Then configure Google with:

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI:
https://your-dev-deployment.convex.site/api/auth/callback/google
```

For local Meta OAuth or tracked links, set `SITE_URL` to a public tunnel URL instead of `http://localhost:3000`, for example:

```env
SITE_URL=https://your-tunnel.example.com
```

### 3. Run The App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Notes:

- The `predev` flow initializes Convex, runs the Convex Auth setup helper once, and opens the Convex dashboard.
- `npm run dev` runs Next.js and `convex dev` together.
- If the Convex Auth setup helper prompts for `SITE_URL`, use the local or tunnel URL you configured.

Useful local commands:

```bash
npm run lint
npm test
npx convex dashboard
npx convex env list
```

## Production Deployment

Recommended Cloud hosting model:

- Next.js app on Vercel.
- Convex backend on Convex Cloud.
- Google OAuth for sign-in.
- Meta app for Instagram OAuth and webhooks.

This is the Cloud version. If you want the database and backend fully self-hosted, use Nudgra OSS instead: `TODO: add Nudgra OSS repo URL`.

### 1. Choose The App Domain

Pick the final public URL for the Next.js app:

```text
https://your-app-domain.com
```

Use that exact value everywhere:

- Next.js host `SITE_URL`
- Convex production `SITE_URL`
- Meta OAuth redirect URI
- Google authorized JavaScript origin
- Any tracked-link testing

If the domain changes later, update all platform settings and redeploy.

### 2. Create The Convex Production Deployment

1. Create or open your Convex project.
2. Create a production deployment in the Convex dashboard.
3. Generate a production deploy key from the Convex dashboard.
4. Keep the production deployment's `.convex.site` URL handy. You will need it for Google and Meta.

You can also open the dashboard from the project root:

```bash
npx convex dashboard
```

### 3. Provision Convex Auth On Production

Run this from the project root:

```bash
npx @convex-dev/auth --prod
```

When prompted:

- set `SITE_URL` to your public app domain, for example `https://your-app-domain.com`
- let the tool generate and store `JWT_PRIVATE_KEY` and `JWKS`

This prepares the production Convex deployment for Google sign-in and redirects back to your app after auth.

### 4. Configure Convex Production Environment

Set the email allowlist:

```bash
npx convex env set --prod NUDGRA_ALLOWED_EMAILS your-google-email@gmail.com
```

Set the public app origin:

```bash
npx convex env set --prod SITE_URL https://your-app-domain.com
```

After Google and Meta are configured, you will also set:

```bash
npx convex env set --prod AUTH_GOOGLE_ID your-google-client-id
npx convex env set --prod AUTH_GOOGLE_SECRET your-google-client-secret
npx convex env set --prod META_APP_ID your-instagram-app-id
npx convex env set --prod META_APP_SECRET your-instagram-app-secret
npx convex env set --prod META_VERIFY_TOKEN your-random-verify-token
```

You can set the same values in the Convex dashboard instead of the CLI.

### 5. Deploy On Vercel

This is the simplest hosted path.

1. Import this repository into Vercel.
2. Set the install command to:

   ```bash
   npm install
   ```

3. Set the build command to:

   ```bash
   npx convex deploy --cmd "npm run build"
   ```

4. Set these Vercel environment variables:

   ```env
   CONVEX_DEPLOY_KEY=your-convex-production-deploy-key
   SITE_URL=https://your-app-domain.com
   META_APP_ID=your-instagram-app-id
   META_APP_SECRET=your-instagram-app-secret
   META_VERIFY_TOKEN=your-random-verify-token
   ```

5. Attach your production domain in Vercel.
6. Redeploy after the domain and environment variables are final.

Why the build command matters:

- it deploys the Convex backend during the build
- it typechecks and bundles Convex functions
- it injects the correct Convex deployment URLs into the Next.js build

### 6. Smoke Test The Hosted App

After the first deployment:

1. Open `https://your-app-domain.com`.
2. Sign in with a Google account listed in `NUDGRA_ALLOWED_EMAILS`.
3. Open `/dashboard/account`.
4. Connect an Instagram professional account.
5. Confirm the account appears as connected.
6. Send a real test DM, comment, or story reply.
7. Verify that contacts, conversations, automations, and logs update in the dashboard.
8. Verify that tracked links resolve through your app domain.
9. Verify that webhook activity appears in logs.

## Google OAuth Setup

Go to the Google Cloud Console and create OAuth credentials for a web application.

For production, set:

```text
Authorized JavaScript origin:
https://your-app-domain.com

Authorized redirect URI:
https://your-convex-site.convex.site/api/auth/callback/google
```

For local development, set:

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI:
https://your-dev-deployment.convex.site/api/auth/callback/google
```

If Google asks for an authorized domain, use the root domain, for example:

```text
example.com
```

Copy the client ID and secret into Convex:

```bash
npx convex env set --prod AUTH_GOOGLE_ID your-google-client-id
npx convex env set --prod AUTH_GOOGLE_SECRET your-google-client-secret
```

For local development, put the same values in `.env.local` or set them on your Convex dev deployment:

```env
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

Restart local development after changing auth values:

```bash
npm run dev
```

Redeploy production after changing hosted values:

```bash
npx convex deploy --cmd "npm run build"
```

## Meta / Instagram Setup

Meta's dashboard changes often, so labels may move slightly. The important pieces are the same: create a Meta app, add Instagram testers, publish the app, configure webhooks, configure Instagram business login, copy the Instagram app credentials into Convex and your Next.js host, and connect the account from Nudgra Cloud.

### 1. Create The Meta App

Go to:

```text
https://developers.facebook.com/apps/
```

Sign up if needed, then click **Create App**.

During setup:

- give the app a name
- for the use case, select **Manage messaging & content on Instagram**
- finish the app creation flow

### 2. Add Instagram Testers

Inside your Meta app dashboard:

1. Go to **App roles**.
2. Click **Roles**, not **Test users**.
3. Click **Add People**.
4. In the modal, choose **Instagram Tester**.
5. Add the Instagram accounts you want to automate with Nudgra Cloud.

Then each Instagram account must accept the invite:

1. Open Instagram in a desktop browser.
2. Go to **Settings**.
3. Go to **Website permissions**.
4. Go to **Apps and Websites**.
5. Open **Test invites**.
6. Accept the invite.

The **Website permissions** area may not appear on mobile, so use Instagram on a computer.

### 3. Add Permissions

In the Meta app dashboard:

1. Go to **Use cases**.
2. Open the Instagram use case.
3. Go to **API setup with Instagram login**.
4. In **Add required messaging permissions**, add the required permissions.

Nudgra Cloud needs:

```text
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
```

You do not need to manually generate access tokens in Meta for Nudgra Cloud. The app performs the Instagram login flow and stores account tokens in Convex.

### 4. Publish The Meta App

Webhooks need the app to be published for real delivery. For testing your own connected Instagram accounts, you can publish with basic app details.

In the Meta app dashboard:

1. Go to **Publish**.
2. Add a privacy policy URL.
3. Fill any required basic fields.
4. Publish the app.

For testing, a simple public privacy policy page is enough. For example, you can write the policy in Notion, publish the Notion page, and use that public URL.

### 5. Copy Instagram App Credentials

Return to your app in:

```text
https://developers.facebook.com/apps/
```

Then:

1. Go to **Use cases**.
2. Click **Customize** or open the Instagram use case.
3. Open **API setup with Instagram login**.
4. Find **Instagram app ID** and copy it.
5. Reveal and copy **Instagram app secret**.

Put them on the Convex production deployment:

```bash
npx convex env set --prod META_APP_ID your-instagram-app-id
npx convex env set --prod META_APP_SECRET your-instagram-app-secret
npx convex env set --prod META_VERIFY_TOKEN your-random-webhook-verify-token
```

Put the same values on the Next.js host:

```env
META_APP_ID=your-instagram-app-id
META_APP_SECRET=your-instagram-app-secret
META_VERIFY_TOKEN=your-random-webhook-verify-token
```

Generate a verify token yourself. It can be any strong random string:

```bash
openssl rand -hex 32
```

Or generate it with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Redeploy or restart after editing environment variables.

### 6. Configure Webhooks

In **API setup with Instagram login**, open **Configure webhooks**.

Set:

```text
Callback URL:
https://your-convex-site.convex.site/meta/webhooks

Verify token:
same value as META_VERIFY_TOKEN
```

Click **Verify and save**.

Subscribe to these webhook fields:

```text
messages
messaging_postbacks
comments
```

The app code expects Instagram webhook events through the Convex HTTP endpoint.

### 7. Configure Instagram Business Login

In **API setup with Instagram login**, open **Set up Instagram business login**.

Set:

```text
Redirect URL:
https://your-app-domain.com/api/meta/callback
```

Save the redirect URL.

### 8. Connect Instagram In Nudgra Cloud

Open your Nudgra Cloud deployment:

```text
https://your-app-domain.com
```

Sign in with the Google account included in `NUDGRA_ALLOWED_EMAILS`.

Then:

1. Go to **Dashboard > Account**.
2. Click **Add account**.
3. Complete the Instagram permission screen.
4. Allow profile/media access, comment access, and message access.
5. Confirm that the account appears as connected and active.

## Updating A Deployment

For Vercel, push to the branch connected to the project and let the build run:

```bash
npx convex deploy --cmd "npm run build"
```

## Backup And Data

Nudgra Cloud stores app data in Convex. Use the Convex dashboard and Convex CLI for data inspection, exports, and operational recovery.

Keep a private copy of production environment variables. You will need them if you recreate the deployment or move the app domain.

Important secrets:

- `JWT_PRIVATE_KEY`
- `JWKS`
- `AUTH_GOOGLE_SECRET`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `CONVEX_DEPLOY_KEY`

## Troubleshooting

### Google sign-in says the account is not allowed

Check that the exact Google email is listed in Convex:

```bash
npx convex env list --prod
```

Set or update the allowlist:

```bash
npx convex env set --prod NUDGRA_ALLOWED_EMAILS you@example.com,backup@example.com
```

For local development, also check `.env.local`.

### Google login redirects to the wrong URL

Check:

```env
SITE_URL=https://your-app-domain.com
```

Verify that the Google OAuth redirect URI uses the Convex site URL:

```text
https://your-convex-site.convex.site/api/auth/callback/google
```

Do not use:

```text
https://your-app-domain.com/api/auth/callback/google
```

This repo uses Convex Auth routes on the Convex site URL.

### Meta webhook verification fails

Check:

- `META_VERIFY_TOKEN` in Convex exactly matches the token entered in Meta.
- `https://your-convex-site.convex.site/meta/webhooks` is reachable publicly.
- Convex has been redeployed after code changes.
- The Meta app is published when testing real delivery.
- The subscribed webhook fields are `messages`, `messaging_postbacks`, and `comments`.

Useful commands:

```bash
npx convex logs --prod
npx convex env list --prod
```

A plain browser request to the webhook URL may return `403` because it is missing Meta's verification query parameters. That still proves the route is reachable; Meta's **Verify and save** button is the real webhook verification.

### Meta webhooks are verified but no events appear

Check:

- Meta webhook callback points to the Convex URL, not the app URL.
- The connected Instagram account accepted the tester invite during development.
- The app has the required Instagram permissions.
- The app is in Live mode for real users.
- The Instagram account is professional, business or creator.
- The connected account still appears active in `/dashboard/account`.

### Instagram account does not appear during connection

Check:

- The Instagram account accepted the tester invite.
- The invite was accepted from Instagram on desktop.
- The app has the required Instagram permissions.
- The Instagram account is professional, business or creator.
- You are logged into the correct Instagram account when authorizing.
- `SITE_URL` matches the Meta redirect URL exactly.

### The connect button returns a Meta config warning

Set these values on both Convex production and the Next.js host:

```env
META_APP_ID=your-instagram-app-id
META_APP_SECRET=your-instagram-app-secret
META_VERIFY_TOKEN=your-random-webhook-verify-token
```

Then redeploy or restart the app.

### Tracked links use the wrong host

Check Convex production:

```bash
npx convex env get --prod SITE_URL
```

Set it to the public app domain:

```bash
npx convex env set --prod SITE_URL https://your-app-domain.com
```

Redeploy after changing hosted settings.

## Useful Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npx convex dev
npx convex deploy --cmd "npm run build"
npx convex dashboard
npx convex logs --prod
npx convex env list --prod
npx @convex-dev/auth --prod
```

## Project Docs

- [Design](./DESIGN.md)
- [Product Overview](./docs/product-overview.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Meta Setup Notes](./docs/meta-setup.md)
- [Contributing](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Trademark Policy](./TRADEMARKS.md)

## Open Source Licensing And Branding

This repository's source code is released under the [MIT License](./LICENSE).

The `Nudgra` name, logo, and branding are not included in that license. If you fork or reuse the code for your own product, rename it and replace the branding. See [TRADEMARKS.md](./TRADEMARKS.md).

## Related References

- [Convex hosting docs](https://docs.convex.dev/production/hosting/)
- [Convex CLI deploy docs](https://docs.convex.dev/cli)
- [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual)
- [Convex Auth Google OAuth setup](https://labs.convex.dev/auth/config/oauth/google)
- [Google OAuth client rules](https://support.google.com/cloud/answer/15549257)
- [Meta setup notes for this repo](./docs/meta-setup.md)
