---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Do level elements (traps, platforms, turrets) run a step sequence that can wait before its first step (a delay, or an event such as the player entering a trigger volume), and does the restore put them back by jumping to a recorded step?"
sanitized: true
origin: "unity:common-mistakes/restoring-a-sequence-step-releases-elements-that-were-still-waiting"
---

# Restoring a sequence step releases elements that were still waiting to start

Applies when level elements run step sequences gated by a first-activation wait, and the restore jumps them to a
recorded step.

Level elements ran a step sequence behind a first-activation wait — a timer, or an event like "the player enters
this volume". The capture wrote an active element as `A<step>`; the restore set the element active and jumped to
that step, and the jump helper cleared every wait flag so the element would play on.

Two flaws combined:

- **The capture couldn't tell "waiting" from "running step 0"** — both wrote `A0`.
- **The restore always released the wait**, so every element that hadn't started at the Ludeo's moment started the
  instant the Ludeo began: most of one level's path-following traps, and the rhythm offsets of timed platforms and
  turrets in others. The tested Ludeos happened to start after those traps were already running, so replay tests
  passed; a pre-upload re-scan found it.

## Fix shape

- **Capture a distinct token** for "active, still waiting" — plus the time left on a timed wait.
- **On restore, re-arm the wait** (with its remaining time) instead of jumping; jump only when the element had
  actually started. Timed waits that run on the game clock may need the remaining time written in `ApplyDeferred()`
  if the element's own init resets it (`07 §6`).
- **Test with a Ludeo recorded just before the player trips a trigger volume**, not only mid-action. Ludeos recorded
  mid-action pass by construction and prove nothing about the waiting state.

Generalization: whenever a state machine has an **idle-before-first-step** state, check that the capture encodes it
distinctly from step 0, and that the restore's "jump to step" helper doesn't silently consume it.
