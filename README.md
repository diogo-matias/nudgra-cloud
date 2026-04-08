# Nudgra

Nudgra is an Instagram automation app for creators, operators, and developers who want ManyChat-style DM flows without paying recurring SaaS fees for each account. The product idea is simple: deploy the app in your own environment, connect your Instagram professional account through Meta, and run your automations from infrastructure you control.

This repository is not at that product stage yet. As of April 7, 2026, it is still the default Convex + Next.js starter with auth and demo data. The docs in this repo define the intended product, the recommended technical direction, and the work required to reach a realistic MVP.

## Product Direction

- DM automations triggered by keywords or inbound message intent
- Story-triggered automation, starting with replies and validating mention handling during implementation
- Delayed follow-up sequences with policy-safe sending windows
- Contact tagging and conversation history
- A lightweight operator dashboard for setup, logs, and troubleshooting

## Current Repo Status

- Frontend: Next.js 16 + React 19
- UI system: `shadcn` components added as needed
- Backend: Convex
- Auth: Convex Auth with password sign-in
- Current app behavior: starter demo that stores random numbers

Important: the marketing idea says "self-hosted on Vercel", but the current codebase uses Convex, which is a managed backend. That means the product is not strictly self-hosted end-to-end in its current technical direction. If strict self-hosting is a hard requirement, the backend architecture will need to change.

## Documentation

- [About Nudgra](./ABOUT_PROJECT.md)
- [Design](./DESIGN.md)
- [Product Overview](./docs/product-overview.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Meta API Notes](./docs/meta-api-notes.md)
- [Meta Setup](./docs/meta-setup.md)
- [MVP TODOs](./docs/mvp-todo.md)

## Local Development

```bash
npm install
npm run dev
```

The current `npm run dev` flow starts both Next.js and Convex local development services.

## Recommended MVP Cut

The fastest credible MVP is not "ManyChat clone, but free." It is:

1. Connect one Instagram professional account.
2. Receive inbound DM and story-reply related webhook events.
3. Match keywords and send automated replies.
4. Enroll contacts into simple follow-up sequences with delays.
5. Track contacts, tags, message history, and delivery failures.

Multi-account support, richer templates, comment-to-DM flows, analytics, and open-source hardening should come after that initial cut.
