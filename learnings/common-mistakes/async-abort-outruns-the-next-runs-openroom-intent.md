---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "3"
question: "Does the game's restart path end the old run and start the new one in the SAME synchronous call chain — i.e. does the next run's Creator-Flow OpenRoom trigger fire before the End/RemovePlayer/Room_Close callbacks have completed?"
sanitized: true
origin: "unity:common-mistakes/async-abort-outruns-the-next-runs-openroom-intent"
---

# On restart, the async teardown can finish AFTER the new run's `OpenRoom` intent — retry from the teardown callback

**Precondition:** an in-place restart tears down and re-starts the run synchronously, and `OpenRoom` is guarded
against stacking rooms.

The idempotency guard that keeps `OpenRoom` from stacking rooms ("do nothing if a room is already open") turns into a
**silent capture loss** on the restart path, because `ludeo_GameplaySession_End` → remove player → `ludeo_Room_Close`
is callback-driven (CR-009) while the game's restart is synchronous:

```
Restart()
  ├─ [Layer] EndCurrentGameplay(isAbort=true)   → End → (async) → RemovePlayer → (async) → Room_Close → (async)
  ├─ reset every level element
  └─ InitLevel() → [Layer] OnLevelLoadStart()   → wants a room
                    └─ room handle is STILL set → guard returns, does nothing
```

The close callbacks land a few frames later and clear the room — and **nothing retries**. The first run captures;
every run after a restart is silently uncaptured. A smoke test passes, because it is the first run.

## The fix — retry from the teardown's completion

In the room-closed handler (queued per `03 §8.3`, never inline in the SDK's dispatch): clear the room handle and the
`Begin` gates, run any continuation the teardown was carrying, **then** call the same guarded, idempotent
`TryOpenCreatorRoom()` used everywhere else. It is safe in both interleavings:

- **teardown finishes first** → no recorded intent, the retry no-ops; the later level-start hook opens normally;
- **the new run's intent lands first** → the level-start hook bailed on the still-open room; the retry picks it up.

Order matters: run the continuation **before** the retry. When the teardown is `EndCurrentLudeo` ahead of a new
restore, that continuation is what calls `SetRestoring(true)`, and the Creator-Flow retry must then see it and decline
(CR-009: Creator-Flow `OpenRoom` skips while `IsRestoring()`).

## The general rule

Any time an **async teardown** and a **synchronous next-run trigger** share a guard variable, the guard needs a retry
on the async side — recording intent alone is not enough, because the thing that *consumes* the intent already ran.
**Audit prompt:** for every "skip if a room/session already exists" guard, ask *what re-triggers this once the
existing one goes away?* If the answer is "the next time the game happens to fire the start signal", the run in
between is lost. Verify with a restart mid-run in the phase-3 run gate: the second run must log its own room open.
Related: `learnings/common-mistakes/hook-the-level-load-funnel-below-its-already-loading-guard.md`.
