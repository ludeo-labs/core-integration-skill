---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3,5"
question: "Are you relying on the game's per-frame controls arbiter (the code that recomputes 'can the player act' and enables/disables input) as the seam your input hold or readiness gate releases through — and does that update function have any EARLY RETURN above the line that re-evaluates the gates?"
sanitized: true
origin: "unity:common-mistakes/a-mode-flag-that-early-returns-past-the-controls-arbiter-locks-the-gate-shut"
---

# A mode flag that early-returns past the controls arbiter locks your gate shut

**Precondition:** the layer holds and releases player control through a gate the game re-reads each frame.

The arbiter is a *line inside a per-frame update*, not a subsystem:

```cpp
void PlayerController::Update(float dt) {
    if (m_animDriver->IsStanceMode()) return;   // a mode flag, read FIRST
    RecomputeGatesAndToggleInput();             // the arbiter — never reached
    Move(dt); ApplyGravity(dt);
}
```

"Hold the gate and the player loses control; release it and control returns" is a guarantee about
`RecomputeGatesAndToggleInput()` running **this frame**. An early return above it suspends the arbiter, and input
keeps whatever enabled state it was last given.

## Why it is terminal, not a stall

In the observed game the mode flag was toggled by a player input; input is delivered only while enabled; only the
arbiter enables it; the arbiter runs only when the flag is false. So *flag set + input disabled* has no exit: the
layer's release is never read, the game's own re-enable is skipped, and the toggle-off is an input the player no
longer receives. Nothing errors, the sim is running, the restore report is clean — *"it just stands there and I can't
do anything."* (`11 §8` dead input.)

## Two windows expose it

1. **Restore (phase 5)** — a capture taken with the flag set restores it, or the input hold (CR-010) is released into
   an arbiter that already stopped running.
2. **Readiness (phase 3)** — the readiness gate (`LAUNCH-AND-READINESS §3`) holds control at level start and releases
   it once the SDK resolves. If *anything* can set the flag during that hold (a scripted opener, queued input, an
   animation event), the release lands on a suspended arbiter **on an ordinary capture run**.

## The check

Read **every line above** the gate recompute; for each early return ask: can its condition be true while input is
disabled? Is there any other writer that clears it (a timer, an animation event, another component's update)? Two
"yes, no" answers mean a terminal state. Such flags rarely show in an agency census: here it lived on a
*presentation* component (an animation driver) whose stated purpose was holding a pose.

## The fix

Force the flag — **and** the raw input field that re-derives it next frame — to the permissive value in the
restore's per-entity apply, with the rest of the agency family
(`learnings/common-mistakes/normalize-the-whole-agency-suppressing-flag-family-not-just-the-input-one.md`). Don't
poke the input component directly; that competes with the arbiter. Unblock the arbiter and let it work. **Log the
flag by name** in the restore report next to the other ability gates. Related:
`learnings/architecture/controls-gate-interface-is-the-non-ludeoable-census-and-a-suppression-seam.md`.
