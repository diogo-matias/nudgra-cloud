# Nudgra MVP TODO

This list is intentionally opinionated. It reflects the fastest path to a credible MVP, not the largest feature list.

## Recommended MVP Cut

Ship **single-account Instagram automation** first.

Must-have outcomes:

- connect one Instagram professional account
- receive inbound DM and story-reply related webhook events
- create keyword-triggered auto replies
- tag contacts automatically
- run short delayed follow-up sequences
- inspect logs, contacts, and failures from the dashboard

Defer for later:

- multi-account support
- comment-to-DM automations
- persistent menu and ice breakers management UI
- analytics dashboards
- open-source hardening and public distribution

## P0: Product Decisions

- [ ] Decide whether "self-hosted" means strict self-hosting or simply "deployed in the user's own Vercel account"
- [ ] Confirm the MVP will be single-account first
- [ ] Choose Instagram Login as the primary integration path unless a hard blocker appears
- [ ] Define one opinionated automation rule format instead of building a full visual flow editor

## P0: Meta Platform Setup

- [ ] Create the Meta app and select the correct business-oriented setup
- [ ] Configure the current Instagram scopes: `instagram_business_basic`, `instagram_business_manage_messages`, and `instagram_business_manage_comments` as needed
- [ ] Add development testers and verify app/account role requirements
- [ ] Configure webhook field subscriptions in the Meta App Dashboard
- [ ] Implement professional-account webhook subscription during onboarding
- [ ] Test with one real Instagram professional sandbox account end to end

## P0: Backend Foundation

- [ ] Replace demo schema tables with Nudgra domain tables
- [ ] Add account, contact, conversation, message, rule, tag, sequence, and webhook event tables
- [ ] Build a single Meta client layer for Graph API requests
- [ ] Add token storage, expiration metadata, and reconnect handling
- [ ] Add webhook verification and ingestion endpoints
- [ ] Make webhook ingestion idempotent with dedupe keys
- [ ] Store raw webhook payloads for debugging
- [ ] Add outbound delivery queue and retry logic
- [ ] Add policy checks before every automated send

## P0: Core Product Features

- [ ] Onboard one Instagram professional account
- [ ] Create keyword-based rules with exact match and contains match
- [ ] Send text replies
- [ ] Enroll a contact into a sequence after a rule fires
- [ ] Support delayed follow-up steps
- [ ] Apply and remove tags from contacts
- [ ] Show contact timeline with inbound and outbound messages
- [ ] Show automation run history and failure states

## P0: Dashboard

- [ ] Replace the starter homepage with a real product shell
- [ ] Add onboarding flow for account connection
- [ ] Add rule list and rule editor
- [ ] Add contacts view
- [ ] Add conversations/logs view
- [ ] Add sequence status view
- [ ] Add error and retry view

## P1: Hardening

- [ ] Add rate-limit aware retry behavior
- [ ] Add structured audit logs for sends, skips, and failures
- [ ] Add environment variable validation
- [ ] Add secret handling guidelines and rotation docs
- [ ] Add tests for rule matching, sequence scheduling, and webhook parsing
- [ ] Add seed/demo data for local dashboard development

## P1: Policy And Launch Readiness

- [ ] Document the 24-hour automation window in code and operator UI
- [ ] Prevent automated use of `HUMAN_AGENT`
- [ ] Prepare App Review notes, screencasts, and permission justification
- [ ] Write a real setup guide for Meta app configuration
- [ ] Replace starter branding and metadata across the app

## P2: After MVP

- [ ] Multi-account support
- [ ] Comment-to-DM flows via private replies
- [ ] Persistent menu and ice breakers management
- [ ] Message templates and richer structured replies
- [ ] Analytics and attribution
- [ ] Team roles
- [ ] Open-source packaging, examples, and contribution docs

## Suggested Build Order

1. Meta app setup and webhook verification
2. Schema replacement and domain modules
3. Account connection flow
4. Webhook ingestion and raw event logging
5. Keyword matching and send pipeline
6. Contacts, tags, and timeline UI
7. Delayed sequences
8. Reliability, tests, and launch docs
