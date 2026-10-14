---
category: common-mistakes
tier: universal
sourceGame: EndlessFPS
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/verify-sdk-callback-fires-before-hooking"
---

# Prove an SDK callback fires in your scenario before building a fix on it

## What happened

To make the overlay's Play button clickable on a local run, the first fix released the mouse inside the
`PauseGameRequest` handler, assuming the SDK fires it when it shows the interactive overlay. The handler **never
ran**: the run log held zero entry lines for both the `PauseGameRequest` and `ResumeGameRequest` handlers. The SDK
handled overlay input itself and only narrated it in its own log. A whole implement-build-test cycle was spent on a
callback that never arrived.

The docs predict this one — those requests fire **only in a cloud Player-Flow session** (CR-011, `07 §2.4`) — but
the habit applies to every notification.

## The rule

1. Every handler logs one line on entry (make it standard for every `AddNotify*` handler in `phase 3 · task 4`).
2. Reproduce the scenario, then count: `grep -c "<entry line>" <log>`.
3. Zero ⇒ not your hook. Read the SDK's own log around that moment — it narrates overlay screens, input blocking
   and session transitions even when no notification reaches the game.

## Corollaries

- The SDK log is the source of truth for what fired and when; read it before assuming your code is wrong.
- Check the docs for flow/environment limits (cloud-only, one flow only) before reading a zero count as a bug. For
  cloud-only notifications, call the handler from a debug hook locally; the real check is the cloud run.
- A log line at registration proves registration, not firing.
