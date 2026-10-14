---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "7,8"
question: "Does the game have levels, worlds, regions or modes that the replay tests so far never touched?"
sanitized: true
origin: "unity:common-mistakes/rescan-every-level-before-the-first-cloud-upload"
---

# Re-scan every part of the game before the first cloud upload

Applies when replay testing so far covered only some of the game's levels or modes.

By the upload, the integration had a phase-4 census of every trackable type (with per-level counts) and a replay
proven end to end — on two of twenty levels. The census read "correct after wave 1" for most levels. A re-scan of
**all** levels right before the upload, done against the **code** rather than the plan, found:

- **A bug in already-shipped restore code.** Restoring an element onto its recorded sequence step released elements
  still waiting for their first activation (`learnings/common-mistakes/restoring-a-sequence-step-releases-elements-that-were-still-waiting.md`).
  The two tested Ludeos happened to start after those traps were running.
- **A whole object class the census missed.** Destructibles restored as "resolved" without the event that hides them
  came back visible and solid — in one level blocking the only way forward
  (`learnings/common-mistakes/silently-resolving-a-destructible-leaves-it-visible-and-solid.md`).
- **Underrated severity.** "Moving platforms restart from their start pose" was really "come back moving the wrong
  way" — lethal over a kill floor.
- **State that lives only in a running coroutine / timer task** (a survive sequence's wave counter, an exit counter)
  — restarts on restore, in levels the plan listed as fine.

## How to run the re-scan

- **Scope by the game's structure:** one read-only worker per world / region / mode, in parallel
  (`references/orchestration.md`).
- **Enumerate what's really there:** each level's data plus every entity definition it spawns, resolved to the code
  that runs them. A small script beats reading level files by eye.
- **Ground truth is the capture/restore code, not the docs.** Classify each stateful type: covered (verified in code)
  / planned (which wave) / **missed**.
- **One verdict per level:** OK / Partial (plays, something visibly off — say what) / Broken, plus what a Ludeo
  starting mid-level there would show wrong, and any mechanic that lacks an action.
- **Include cutscene and "resolved" replays:** re-applying end states can re-fire screens, sounds and tweens.

## What to do with the result

The gaps rarely block the cloud test itself (auth, streaming, input, overlay pause, load time): upload and test on
the levels rated OK while the found bugs are fixed and planned waves follow. Record the verdict table in the plan
(`RESTORATION_PLAN.md`) so creators and QA know which areas make reliable Ludeos; a cheap stopgap for Broken areas is
a non-ludeoable span (`StartNoneLudeable` / `StopNoneLudeable`) until their wave lands.

**Re-scan before every upload that widens coverage.** Before a second upload (bosses and more traps added) the
re-scan found three issues no replay had shown, one introduced by an earlier fix — including two settle problems
(`learnings/common-mistakes/the-settle-is-live-so-clear-what-it-spawns-and-hold-what-chases.md`). Pair it with a
scripted replay of the confirmed Ludeos
(`learnings/architecture/replay-every-confirmed-ludeo-as-a-regression-gate-before-upload.md`).
