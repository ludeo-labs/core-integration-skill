---
category: common-mistakes
tier: universal
sourceGame: CoopShooter
phase: "5,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/classify-tracking-data-as-state-not-actions"
---

# Continuous input/telemetry is tracked state, not actions: classify the data before picking the primitive

## The mistake

Asked to "track all key presses and mouse movement" in the recording, the agent sent every input as an
**action** (`KeyDown_W`, `MouseMove_Left`, …) through `ludeo_DataWriter_SendAction`, instead of writing it as
**attributes on a tracked object** (`ludeo_DataWriter_Set*`), the way position and health are already written
every tick.

## Why it's wrong

- **Actions and state are different channels** (`06 §1.3`). Actions are discrete, player-attributed timeline
  markers that goals, constraints and highlights match on. Hundreds of raw input markers per session pollute that
  matching. Tracked attributes are sampled state, and that is where telemetry belongs.
- **The API misfit was a stop sign that got rationalized.** An action is a name plus a `playerId`, with no value
  payload, so an analog value like a mouse delta can't be represented. The agent encoded direction into the action
  *name* and threw away magnitude. When the chosen primitive can't carry the data, it's the wrong primitive. Don't
  engineer around it.
- **An English word matched the wrong SDK concept.** "A key press is an action" in plain language doesn't make it
  a Ludeo action.
- **The process locked it in.** Once the spec said "actions", every review checked "actions implemented
  correctly", and none asked "should these be actions at all?"

## The rule

Classify first:

- **Discrete, goal-relevant, at a point in time** (a kill, an objective completed, a phase change) → **action**.
- **Sampled, continuous, "what is true right now"** (position, velocity, health, held inputs, mouse delta) →
  **tracked attribute**, written each tick like every other tracked field (Creator Flow only).

## How to apply

When the user says "track / record X", ask whether X is a discrete goal event or continuous state, and present
the two genuinely different mechanisms with a recommendation. Don't offer variants of one mechanism as if it were
already decided. For state, add the field to the existing per-tick writer, or put it on a dedicated object
(`learnings/architecture/track-auxiliary-telemetry-on-a-dedicated-object.md`).
