# Meta API Notes For Nudgra

This document captures the Meta platform facts that matter most for Nudgra's MVP planning. It is based on official Meta developer documentation and Meta's official Postman workspace as reviewed on April 7, 2026.

## Recommended Integration Path

For Nudgra's first version, the best default is **Instagram API with Instagram Login**.

Why:

- it supports Instagram professional accounts without requiring a linked Facebook Page
- it aligns with the newer `instagram_business_*` scope names
- it is a better fit for owner-operated, single-account onboarding

Meta notes that the old scope names for the Instagram Login flow were deprecated on **January 27, 2025**. The current scope names are:

- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_messages`
- `instagram_business_manage_comments`

## What Nudgra Can Reliably Build On

### Messaging

Meta's Send API supports Instagram direct messaging for professional accounts. Important restrictions:

- the recipient must have already sent a message to the professional account
- conversations begin when a user reaches out through channels such as feed, posts, story mentions, and similar entry points
- group messaging is not supported

Implication for Nudgra:

- keyword automation is viable
- follow-up sequences are viable after a user starts the thread
- "cold outbound automation" is not viable

## Webhooks

Meta documents a two-part webhook setup:

1. subscribe the app to the needed webhook fields in the Meta App Dashboard
2. enable webhook delivery for the connected professional account through an API call

Relevant webhook categories for Nudgra:

- `messages`
- `messaging_postbacks`
- `comments`
- `live_comments`

Meta's official workspace also includes a **reply-to-story webhook payload reference**, which is useful for story-triggered flows.

## Conversations API

The Conversations API gives Nudgra the ability to:

- list conversations
- fetch messages in a conversation
- inspect message details

Notable limits:

- requests-folder conversations inactive for 30 days are not returned
- only the most recent messages remain fully inspectable at the message-detail level
- share payloads may include only the shared media URL in webhook/API data

Implication for Nudgra:

- store inbound events immediately
- do not rely on Meta as the long-term system of record for full message history

## Access Levels

Meta distinguishes between:

- **Standard Access** for Instagram professional accounts you own or manage and have added to the app
- **Advanced Access** for Instagram professional accounts you do not own or manage

Implication for Nudgra:

- a self-operated MVP should target owned/self-managed accounts first
- "connect any client account" should be treated as a post-MVP goal because it pulls in app review and more compliance risk

## Development/Test Mode

Meta's official Instagram docs note that testers must have the correct app roles, grant the required permissions, and also have the right role on the Instagram professional account that owns the app.

Implication for Nudgra:

- local/dev onboarding will feel stricter than a typical OAuth integration
- setup docs must explicitly cover app roles and account roles

## Messaging Window

Meta's official Send API documentation for Instagram includes:

- a standard **24-hour messaging window**
- a `HUMAN_AGENT` tag path that allows messages up to **7 days**, but specifically for human support cases and not for automated follow-ups

Implication for Nudgra:

- automation logic must enforce the normal window
- sequences need a policy check before every delayed step
- do not market `HUMAN_AGENT` as an automation feature

## Useful Adjacent APIs

These are not required for the first MVP, but they are valuable near-term extensions:

### Messenger Profile API

Useful for:

- ice breakers
- persistent menu
- postback-driven flows

### Welcome Message Flows API

Useful for:

- ad-linked onboarding flows
- deeper click-to-message experiences

### Private Replies

Useful for:

- comment-to-DM automations
- story comment response flows

Meta documents that private replies can be sent to people who comment on posts, reels, stories, Live, or ad posts, but they come with their own timing and follow-up rules. This is a strong phase-two candidate, not a day-one requirement.

## Key Product Conclusions

### Best MVP Strategy

- single Instagram professional account
- owner-operated onboarding
- Instagram Login path
- keyword DMs
- story-reply entry points
- contact tagging
- short follow-up sequences

### Things To Avoid Promising Too Early

- any-account multi-tenant onboarding
- unlimited automated re-engagement after long delays
- strict "fully self-hosted" claims while using Convex
- feature parity with ManyChat

## Open Implementation Question

Meta's official materials clearly reference story mentions as a conversation entry point and provide a reply-to-story webhook payload reference. A dedicated "story mention trigger" should still be validated against real sandbox payloads during implementation before Nudgra promises it as a separate trigger type in the UI.

That is an implementation caution, not a blocker.

## Sources

- [Meta official Postman profile](https://www.postman.com/meta/)
- [Meta official Instagram API workspace](https://www.postman.com/meta/instagram/overview)
- [Instagram API documentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Subscribe to webhooks](https://www.postman.com/meta/instagram/request/xqn84vq/subscribe-to-webhooks)
- [Send API with HUMAN_AGENT tag](https://www.postman.com/meta/instagram/request/3ovk680/send-a-message-with-human-agent-tag)
- [Messaging reply to story webhook](https://www.postman.com/meta/instagram/request/f2smkqi/messaging-reply-to-story-webhook)
- [Create Ice Breakers](https://www.postman.com/meta/instagram/request/fx7tg37/create-ice-breakers)
- [Welcome Message Flows API](https://www.postman.com/meta/request/23987686-8053dfd7-022f-4247-aca9-5637bdbd284e)
- [Private Replies](https://www.postman.com/meta/instagram/request/k223fus/private-replies)
- [Messenger Platform Instagram Getting Started](https://developers.facebook.com/docs/messenger-platform/instagram/get-started)
