---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does restoring a field require invoking the game's own change handler for it (the code that normally runs when the value changes — state-changed callbacks, setters with side effects), and do those handlers reach outside the entity?"
sanitized: true
origin: "unreal:engine-quirks/defer-onrep-to-post-beginplay"
---

# The game's change handlers assume a started gameplay world — don't fire them from an early load hook

**Precondition:** the restore re-creates a field's visible effect by calling the game's own change handler
(a state-changed callback, a setter that broadcasts), and some of those handlers touch game-wide systems.

## The trap

The tempting place to apply restored state is the earliest "all entities exist" hook of the level load — before
the level's own start/begin-play pass. Everything seems ready: the entities are there and accept writes.

It isn't ready. Change handlers are written assuming the gameplay world has **started**: the game mode has created
the gameplay player controller (not the main-menu one still alive from the previous level), the game state is
initialized, AI controllers are bound to their bodies, analytics and networking subsystems are up. In the early
hook the world is still mid-transition from the menu.

What it looked like: an objective's state-changed handler called into analytics, which did a checked cast of "the
first player controller" to the gameplay controller type — the controller was still the menu's, and the checked
cast was fatal. Other entity classes defended themselves instead, logging "state set before begin play, ignoring"
and dropping the restored value.

## The rule

This is why the core order applies the snapshot only after **reaching active gameplay** and the game's native
spawn has finished (CR-010 step 4, `07 §2.1`). Don't move the apply — or any handler call — earlier to "beat the
game's init".

If something genuinely has to land early (a value the level's start pass reads once), write the raw value early
but **queue** the handler invocations, and flush the queue only once the world reports started. Under the core
order that is simply the deferred queue: register the handler call in Pass 2 and fire it in `ApplyDeferred()` on
the settle's first tick (`07 §6`).

## Gotchas

- **Use a timer that runs while the game is frozen.** The apply runs frozen; a game-time timer or "next gameplay
  tick" callback won't fire until unfreeze — after Play. Drive the flush from the settle (or the integration's own
  per-frame update, which keeps running during the freeze).
- **Poll for readiness, don't guess a frame count.** If one class's handler still crashes after the world has
  started, it needs a stricter readiness check (e.g. "the match state's current-phase field is initialized"), not
  a longer delay.
- **Test with a class whose handler touches game-wide state** — simple self-contained handlers hide this bug.
