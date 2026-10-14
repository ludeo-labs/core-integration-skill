---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game run more than one clock — a game-owned logic clock (often with per-system scales) beside the engine's frame or real-time clock that drives animation, particles, physics, async waits or encounter schedulers?"
sanitized: true
origin: "unity:engine-quirks/a-game-clock-freeze-still-animates-on-the-engine-clock, unity:engine-quirks/schedule-clocks-tick-through-the-pre-play-hold"
---

# A freeze stops only the clocks it owns — inventory every clock before you hold a moment

Applies when the game splits its world across more than one clock. Freezing one leaves the others running, and each
half fails differently.

**Freezing only the game's logic clock** parked movement, waves and damage — checkpoint positions confirmed nothing
moved — yet the held moment visibly played: idle animations, attack wind-ups and particles run on the engine's frame
clock, which such games deliberately never scale.

**Freezing the engine clock as well** makes the picture still, but it is the more dangerous half:

- **Engine physics stops with it — including trigger volumes.** If room entry, encounter starts or pickups are
  physics triggers, an engine-clock freeze that leaks into gameplay reads as "nothing spawns anywhere" while every
  script-driven system (player movement, the logic clock itself) looks normal. It took a full build-test cycle to
  diagnose, because everything still working was script-driven.
- **Scaled-time async waits stall**, so any of the game's setup tasks still in flight never finish under the hold
  (CR-010, "Freeze vs suppress").

**A clock you did not freeze keeps mutating restored state.** A restored encounter's wave timer was written correctly,
but the wave scheduler ticked on a clock the pre-play hold did not cover. By Play the timer sat ~4 s past the recorded
value, every run. Spawn delivery is a schedule, so starting 4 s deep trimmed its tail: replays kept coming up a few
enemies short — 0, 1, 3 or 4, racing the player's kill pace, so it looked random. Nothing errors; no live system ever
audits a spawn count. **Diagnosis shortcut:** replays run short with no spawn-failure logs and no pending retries → the
enemies were never *requested*; look at the scheduler's clock before suspecting placement.

## The order that works (within `07 §2.1`)

1. Reach active gameplay with every clock running; let the level build and **all** its async setup drain.
2. Freeze the logic clock for the apply; run the settle on real frames, with the schedulers and other state-mutating
   systems suppressed on `IsRestoring()` — the settle runs time, and an unsuppressed scheduler advances through it.
3. Freeze **every** clock that mutates restored state — the engine clock included — gated on the game's own
   setup-idle signal, before `OpenRoom`. In Player Flow the moment may be held for minutes before Play, so any clock
   left running drifts the whole time.
4. Release unconditionally at `Begin` and on every abort path, and trace both transitions so a leak cannot hide.

## Verify, don't re-write

Log the scheduler's elapsed / wave index at `Begin` next to the restored values. Drift there means a clock escaped the
freeze or the suppression — fix the hold. Do not "fix" it by writing the values again after Play: nothing is written
after Play (CR-010).
