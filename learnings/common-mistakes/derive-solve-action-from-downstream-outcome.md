---
category: common-mistakes
tier: generalizable
sourceGame: StoryPuzzleGame
phase: "6"
question: "Does the puzzle/objective you want a 'Solved' action for lack a solved flag, and is its own interaction state ambiguous (it cycles on every interaction, and cancel/escape resets it the same way a solve does)?"
sanitized: true
origin: "unreal:common-mistakes/derive-solve-action-from-downstream-outcome"
---

# Derive a "solved" action from the puzzle's downstream outcome, not its own ambiguous state

**Applies when** you need a per-puzzle or per-objective "solved" action detected by polling, the puzzle has **no
solved flag**, and its own interaction state is **ambiguous**: a shared interaction enum set on focus, cancel,
escape and solve alike.

## The trap

The tempting signal is the puzzle's own interaction/state field. But a `X → Default` transition happens on every
disengage, so attributing `Solved` to it fires on every cancel.

## The fix: poll what the solve unlocks

Every puzzle changes something concrete when solved. Detect the solve from **that** transition, which only
success produces:

```cpp
// keypad           <- the door it controls goes Locked → Unlocked
if (prevDoorLocked && !door->IsLocked()) { SendAction("KeypadSolved"); SendAction("PuzzleSolved"); }
// combination lock <- the container it controls unlocks
// print puzzle     <- the printed page becomes collidable/visible
// arrangement      <- current order == the puzzle's own winning order (read it from the puzzle; never hard-code)
```

Each specific solve also emits a broad `PuzzleSolved` on its own axis, so goals can target either. Read the
backing state through existing accessors, or add a minimal getter if one is missing. That's a smaller game edit
than reworking the puzzle classes.

**Baseline after the restore.** Initialize every outcome cache after the restore applies, before `Begin`, so a
puzzle already solved at the captured moment doesn't fire a spurious solve on the first poll. Detect in **both**
flows (`06 §7`).

## When the shared interaction state is usable

For a family of small sub-area puzzles with no individual downstream object, a shared base-class
"interaction → Default" transition can serve as a universal solve signal, but only if you've verified that the
cancel/escape path doesn't produce the same transition. Scope it to while that sub-area is active, and baseline it
on first sight so entities that stream in don't fire on appearance. It's a fallback, not the default.

## General rule

Attribute an objective action on the axis where its meaning is **unique**. A puzzle's input state is shared
across many situations. The state it *causes* (a door opens, a container unlocks) happens only on success. Poll
the effect, not the cause.
