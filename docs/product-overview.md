# Nudgra Product Overview

## What Nudgra Is

Nudgra is a self-operated Instagram automation tool aimed at people who want the core utility of ManyChat without buying into a hosted subscription platform. The user should be able to deploy the app, connect an Instagram professional account, define automation rules, and let the system handle common inbound conversations.

## The Problem

ManyChat is good at operational convenience, but it becomes expensive when:

- one person manages several Instagram accounts
- audience size grows and pricing scales with contacts or features
- the operator wants more control over data, deployment, and custom logic

Nudgra is a bet that a narrower, ownership-first product can be good enough for creators and small operators who care more about cost control and flexibility than about buying a full customer engagement suite.

## Who It Is For

- solo creators selling products, courses, or links through Instagram
- small operators managing one or a few branded accounts
- developers who would rather self-operate than rent automation as a service

## Core Product Promise

- No recurring ManyChat bill for the basic Instagram automation use case
- Full control over rules, deployment, and data model
- A technical setup that stays understandable and hackable

## Recommended MVP Scope

To reach MVP quickly, Nudgra should focus on the smallest set of features that creates real operator value:

### In Scope

- Connect one Instagram professional account
- Receive and store inbound messaging webhook events
- Trigger automated DM replies from keyword rules
- Support story-reply based entry points
- Apply tags to contacts based on matched rules
- Enroll contacts into short follow-up sequences
- Show rule logs, contact history, and failed deliveries in a dashboard

### Out of Scope For The First MVP

- Multi-account management
- Full visual flow builder
- AI-generated replies
- Advanced analytics and attribution
- Team roles and permissions beyond a single operator

The reason to cut multi-account from v1 is simple: it adds account scoping, onboarding complexity, token lifecycle edge cases, UI complexity, and more failure modes before the first automation is even proven.

## Jobs To Be Done

- "When someone DMs me a keyword, send the right reply immediately."
- "When someone replies to a story, start a simple follow-up."
- "Let me tag people automatically so I can segment them later."
- "Show me what fired, what failed, and who received what."

## Positioning

Nudgra should not market itself as "everything ManyChat does." That is not credible for an MVP. The sharper position is:

> Instagram DM automation for people who want ownership, low cost, and hackable infrastructure.

## MVP Success Criteria

An MVP is credible if one operator can:

1. connect their own Instagram professional account without manual database edits
2. create at least one keyword-based DM automation
3. receive inbound events in real time
4. send replies reliably inside Meta policy limits
5. see contact history, tags, and failures from the dashboard

## After MVP

Once the single-account flow is stable, the next sensible expansions are:

- multi-account support
- comment-triggered private replies
- persistent menu and ice breakers
- better templates and onboarding presets
