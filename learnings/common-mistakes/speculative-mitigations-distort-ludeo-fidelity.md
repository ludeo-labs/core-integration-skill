---
category: common-mistakes
tier: universal
sourceGame: EndlessFPS
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/speculative-mitigations-distort-ludeo-fidelity"
---

# Don't paper over a cloud-only symptom with gameplay-altering mitigations

## The anti-pattern

A symptom shows up **only on the cloud** and can't be reproduced locally (the player dies instantly on restore).
Unable to reproduce it, the integration stacks **gameplay-altering mitigations** to soften it:

- a wall-clock timer that force-begins gameplay
  (`learnings/common-mistakes/never-force-begin-without-roomready.md`);
- freezing or slowing enemy AI for a "reaction window" after Play (time dilation);
- capping the frame rate or forcing low graphics settings to dodge a cloud-GPU issue.

Every mitigation not tied to a **proven** cause has two costs.

## Cost 1: it masks the root cause

The symptom gets quieter, and the real cause (viewer-connect timing, a platform routing bug, a GPU device loss) is
hidden instead of found. Stacked band-aids interact: the one that "fixed" it may not be the one you think, and the
next regression in that area stays invisible.

## Cost 2: it corrupts the moment itself

The Creator captures, and Player Flow replays, the **actual** gameplay. A mitigation that changes how the game runs
(frozen AI, dilated time, a capped frame rate that delays reactions) changes the moment itself: the viewer gets a
softened copy, not the real highlight. The fidelity of the moment is the product, so a gameplay-altering band-aid
degrades the product **even when it "fixes" the symptom**.

## What to do instead

- Add **diagnostics, not mitigations**: one cheap, durable trace that survives into the cloud build
  (`learnings/engine-quirks/diagnostics-to-stdout-for-cloud-logs.md`). Find the cause before changing behavior.
- Gate strictly on the SDK's real signals (`RoomReady`, `PauseGameRequest`), never on a wall-clock timer or a guess
  about when an overlay appears. A workaround with no SDK callback behind it silently becomes dead code, or a
  visible artifact, when its assumption is false.
- Play hands control to a **live, true-speed world**: no AI freeze and no time dilation after `Begin`.
- A genuinely needed **environment** workaround (such as a GPU fix) is opt-in, off by default, scoped to the
  machine that needs it, and labelled as an environment workaround. It is never baked into the capture path.

## After the cause is fixed: audit and remove

Go back through every mitigation added during the debugging push. **Remove the ones whose cause is fixed.** Keep
only those tied to a still-open, separately tracked issue, and write down which issue and why. A leftover
workaround distorts fidelity, masks the next regression, and misleads the next integrator into thinking the
behavior is intended.
