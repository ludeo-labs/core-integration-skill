---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "2"
question: "Are you recording a gameplay start/end boundary because you found a function, an event, and a subscriber for it? Check that something actually CALLS the firer - a fully wired boundary can still be dead code, and the wiring is what makes it look alive."
sanitized: true
origin: "unity:common-mistakes/a-session-boundary-can-exist-and-never-fire"
---

# A session boundary can exist, be subscribed to, and still never fire

**Precondition:** phase 2 is recording `session_boundaries` in `CODE_MAP.json` from wiring found by search.

Mapping a run-based game, the end-of-run boundary looked settled in one pass. The central gameplay controller had an
`EndGameplay()` that cleared the "gameplay running" flag, a `FireGameplayEnd()` wrapper with the usual null check, an
`OnGameplayEnd` event, and a flow manager that **subscribed on enable and unsubscribed on disable**, with a handler
setting the post-game flag. Four signals saying "end boundary". It went into the map.

It was dead. `EndGameplay()` had **zero callers in the project**; it was the only caller of the fire wrapper, so the
event never fired, the handler never ran, and the "gameplay running" flag — set at run start — **never returned to
false for the life of the process.**

## Why the wiring fooled the search

A subscriber proves only that a developer *expected* the event. Handlers outlive the call sites that once fed them: a
refactor removes the caller, the event goes quiet, nothing breaks loudly. An integration hooked there compiles, runs,
and silently reports nothing at the end of a run.

## The check — walk one more hop than feels necessary

1. Find the event. 2. Find the fire/raise wrapper. 3. **Find the wrapper's callers.** 4. **Find *their* callers.**
Stop only at a site real gameplay reaches — an input handler, a collision, a state transition, a UI button. A
project-wide grep for the function name with zero non-declaration hits means dead code, however convincing the
wiring. Do the same for per-frame gates keyed on the boundary's flag: one here was permanently open, which looks
identical to "correctly open" until a run ends.

## When the boundary is dead

**Record it as work to ADD, not a hook to use.** Here the real run ends were elsewhere: the player-death notification,
the return-to-hub call, the return-to-menu level load. Note also what *isn't* there — this project had **no
window-close/quit handler at all**, so closing the window was an unhandled CR-007 exit path the integration had to add.
Write the dead boundary into the map with its evidence ("zero callers, project-wide grep") so no later phase
rediscovers or quietly depends on it. Related:
`learnings/common-mistakes/audit-the-end-boundary-as-hard-as-the-start.md`.
