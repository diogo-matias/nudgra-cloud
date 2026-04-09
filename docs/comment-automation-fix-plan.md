# Comment Automation Reliability Fix Plan

## Summary
- Start implementation by writing this spec to `docs/comment-automation-fix-plan.md`, then use that file as the working checklist.
- Bring the comment automation backend and UI into parity so every advertised condition is either truly enforced or explicitly blocked.
- Fix the missing behaviors in this order: truthful gating, `next post` locking, click-tracked link delivery, timed follow-up, and UI/status parity.

## Key Changes
- Extend comment automation state to support real `next post` behavior.
  - Add activation and lock fields so a live `next` automation can lock to the first post or reel published after activation and keep using that media until edited out of `next` mode.
  - Reset that state when an automation is changed back into `next` mode, and initialize it when a draft/paused automation goes live.

- Make session progression condition-driven instead of “any inbound message”.
  - Opening DM only advances when the inbound event is the matching postback payload for the configured CTA.
  - Email collection stays in `awaiting_email` until a valid email is parsed; invalid replies trigger a fixed retry prompt and do not release the link.
  - Remove the current fake follow-gate progression path. With the chosen strict policy, `followGateEnabled` must fail closed unless an official Meta follower-verification path is implemented and verified.

- Implement real `next post` resolution.
  - On the first relevant webhook for a live `next` automation, refresh account media if needed, find the earliest media published after activation, and lock that media on the automation.
  - Match comments only when the incoming `mediaId` equals the locked media.
  - If no future media exists yet, ignore the event and leave the automation unresolved.

- Add tracked link delivery and click-aware follow-up.
  - Introduce a token-backed link target store so every DM button points to a tracked redirect URL under `SITE_URL`, not directly to the final destination.
  - Add a redirect route that records the click in Convex, marks the session as clicked, and then issues a `302` to the stored URL.
  - When the link DM is sent and follow-up is enabled, schedule one follow-up job for 6 hours later.
  - The follow-up job sends only if no click was recorded, no follow-up was already sent, and the 24-hour messaging window is still open.

- Update validation, serialization, and dashboard/detail UX.
  - Expose the new automation/session fields needed for the UI to show locked `next post`, click state, and follow-up state.
  - Block save/go-live when strict follow gate is enabled but unsupported.
  - Make the preview and detail pages reflect the real backend order and capabilities so they stop promising behavior the backend does not enforce.

## Important Interface Changes
- `commentAutomations` gains persistent fields for `next` activation and locked media resolution.
- `commentAutomationSessions` gains persistent fields for link-sent time, click time, follow-up scheduling, and follow-up sent time.
- Add a new token-backed redirect surface for tracked link clicks under a public app route using `SITE_URL`.
- Serialized automation/session responses exposed to the dashboard must include the new status fields needed for inspection and debugging.

## Test Plan
- Add Convex tests for create/update/toggle validation, including `next` state resets and blocked strict follow gate.
- Add Convex tests for session progression: comment trigger, opening-DM postback gating, invalid email retry loop, valid email completion, and no premature link send.
- Add Convex tests for `next post` locking, including comments on older media, first future media resolution, and stable lock reuse after resolution.
- Add Convex tests for tracked link flow and follow-up scheduling: click recorded, no follow-up after click, follow-up sent once after 6 hours when untouched, and no send after the 24-hour window expires.
- Add route-handler tests for valid token redirect, invalid token handling, repeat click idempotency, and destination URL correctness.
- Add a regression pass for simple live automations using only keyword matching, optional public comment reply, and direct DM link delivery.

## Assumptions And Defaults
- `Next post or reel` means: lock to the first post or reel published after activation and keep using that media until the automation is edited out of `next` mode.
- Email collection is a true gate: the link is never sent until a valid email is captured.
- Follow-up sends once, 6 hours after link delivery, only if no tracked link click has been recorded.
- Strict follow verification is fail-closed: unless an official Meta verification path is proven during implementation, follow gate is treated as unsupported and cannot be saved live as a fake confirmation step.
