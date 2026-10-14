---
category: architecture
tier: universal
sourceGame: EndlessFPS
phase: "3,5"
question: null
sanitized: true
origin: "unreal:architecture/validate-ludeo-selection-before-disturbing-session"
---

# Validate a selected Ludeo before disturbing the live session: a bad selection must be a no-op

## The trap

A naive `LudeoSelected` handler tears down first: it ends the session, closes the room and loads the level, and
only then calls `ludeo_Session_GetLudeo`. When the selection is foreign, stale, corrupt or empty, the teardown has
already happened, and the player is stuck in a broken free mode with nothing to resume.

## The pattern

**Validate first, disturb second** (CR-010, `07 §2.1`). On `LudeoSelected`, dispatch only `GetLudeo(ludeoId)`.
In its callback, require a **populated** reader (`07 §2.2.1`) and a playable entry identity. Only then commit:
end any current Ludeo, `SetRestoring(true)`, take the input hold. An invalid selection is logged and ignored,
and the running session continues untouched.

`GetLudeo` is read-only. It commits you to nothing.

## Why it matters more on the cloud

On a cloud streaming machine nobody is there to recover. A teardown-then-fail leaves the stream stuck until the
machine recycles. With validate-first, the worst case is "selection ignored", which is always recoverable.

## Verify

Feed the handler a bad selection (a foreign id, or an empty reader past the timeout). The log must show "selection
ignored", and no `ludeo_GameplaySession_End`, no `ludeo_Room_Close` and no level load.
