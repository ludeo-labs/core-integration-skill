---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does a restored attribute's setter (health, armor, any stat) fan out into handlers that create UI, touch render/mesh state or notify AI, or are you tempted to defer restore work with the game's own timer system?"
sanitized: true
origin: "unreal:common-mistakes/defer-health-restoration-to-next-tick, unreal:common-mistakes/dont-defer-health-with-timer-while-paused"
---

# Defer handler-heavy applies into `ApplyDeferred()`, never onto a game-time timer while frozen

**Applies when** a restored attribute's setter does more than store a value. Health is the usual case: its
changed-handler creates a damage widget, sets material parameters on the mesh and reports a damage event to AI
perception.

## Failure 1: the synchronous apply crashes

In one integration, applying health synchronously crashed: setter → changed-broadcast → handler → UI creation on a
viewport that wasn't ready. (That apply ran just after the session began; under the core order the apply runs
frozen before Play, where the UI is no more ready.) `07 §6` lists this exact case (the "Health" row): queue it in Pass 2 and apply it in
`ApplyDeferred()` on the first tick of the settle.

When you queue it:

- **Store the stable id, not a raw pointer.** The entity can be destroyed before the settle, so re-resolve it in
  `ApplyDeferred()`.
- **Copy the value by value** into the queue entry.
- Plain fields like transforms can still be applied synchronously. Defer only what fans out.

## Failure 2: the deferral never runs

In a separate integration, the restore deferred the health apply **and** the unfreeze using the game's own "next tick" timer, then
froze the game. The game's timer manager ticks with the simulation, so a frozen simulation never fires it. Health
was never applied and the game stayed frozen permanently.

**Rule:** while the simulation is frozen, game-time timers, "next frame" callbacks and anything driven by the
simulation tick don't run. Use the core order instead:

- Pass-2 work that must wait for frames goes into the deferred queue and runs in `ApplyDeferred()` during the
  settle, which runs **with time on and input held** (`07 §2.1` step 5).
- The restore state machine itself is driven from the integration's own per-frame tick (the one that pumps
  `ludeo_Tick`), which runs whether or not the simulation is frozen.
- Nothing that waits on a frame runs inside a freeze (CR-010 checklist).

## Verify

Log from inside `ApplyDeferred()` (entries applied, entries whose entity was gone), and check that health on
screen after the settle matches the captured value.
