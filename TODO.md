# Nudgra MVP TODO

This file is the root execution tracker for the MVP. It is grouped by implementation PRs instead of feature categories.

## PR1 - Root Tracker And Repo Cleanup

- [x] Add this root `TODO.md` file as the MVP source of truth
- [x] Fix the current lint blocker in the rules UI
- [x] Remove starter demo routes and starter Convex demo functions
- [ ] Tighten copy and metadata so the product consistently says operator-owned deployment, not strict full self-hosting

## PR2 - Minimal Domain Foundation

- [x] Replace the demo `numbers` table with real domain tables for workspaces, accounts, contacts, conversations, messages, rules, tags, webhook events, delivery attempts, and sequences
- [x] Add Convex modules for workspaces, accounts, rules, dashboard reads, Meta send logic, Meta OAuth exchange, and webhook ingestion
- [x] Seed a minimal default workspace state with starter tags and one follow-up sequence

## PR3 - Meta Account Connection

- [x] Add `GET /api/meta/connect`
- [x] Add `GET /api/meta/callback`
- [x] Persist Instagram connect sessions and connected account metadata in Convex
- [x] Subscribe the connected Instagram account to webhook delivery during onboarding
- [x] Replace the Account page shell state with live Convex-backed state

## PR4 - Webhook Ingestion And Dashboard Data

- [x] Add Convex webhook verification and ingestion routes at `/meta/webhooks`
- [x] Store raw webhook payload items with dedupe keys
- [x] Normalize inbound events into contacts, conversations, and messages
- [x] Replace Overview, Contacts, Conversations, and Logs shell data with live Convex queries
- [x] Add a conversation detail page with a basic timeline view

## PR5 - Rules And Auto-Reply Vertical Slice

- [x] Add rule create/list/toggle flows
- [x] Support keyword and story-reply trigger types
- [x] Enforce the 24-hour messaging window before queued automated sends
- [x] Queue outbound sends and log delivered, skipped, and failed attempts
- [x] Add a basic rule detail page

## PR6 - Sequences And Tagging

- [x] Apply tags to contacts when a rule fires
- [x] Enroll contacts into one delayed follow-up sequence from a rule
- [x] Process delayed sequence steps through the Convex scheduler
- [x] Expose tag and sequence context in the dashboard

## PR7 - Hardening And Launch Prep

- [x] Add Meta environment variables to `.env.example`
- [ ] Add explicit env validation/readiness feedback beyond the account connect screen
- [ ] Add automated tests for rule matching, webhook parsing, and idempotency
- [x] Add setup docs for Meta roles, app config, and webhook verification
- [ ] Add stronger retry/backoff handling for Meta rate limits and transient Graph API failures
