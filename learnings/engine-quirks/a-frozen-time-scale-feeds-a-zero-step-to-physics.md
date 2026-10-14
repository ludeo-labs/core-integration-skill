---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game step its physics itself, with a step size derived from a game-owned time scale that the restore freeze (or the overlay pause) sets to zero?"
sanitized: true
origin: "unity:engine-quirks/non-positive-physics-simulate-spams-negative-time"
---

# A frozen game that steps its own physics spams "called with a negative time"

Applies when the game advances physics explicitly — `physics.Step(fixedDelta * gameTimeScale)` from its fixed-step
loop — and the freeze works by zeroing that scale. The fixed loop keeps running (it is driven by the engine's frame
clock, not the game's scale), so every fixed step for the whole frozen wait calls the physics step with `0`. The
physics engine rejected each one with a warning that it was "called with a negative time" and skipped the step. One
pre-play wait logged **1,566** of them; a longer one, thousands. Physics middleware commonly rejects or asserts on a
non-positive elapsed time, so expect some form of this whenever a zero step reaches it.

Two traps inside the trap:

- **The message says "negative"; the value need not be.** A diagnostic guarding `dt < 0.f` sat two lines above the step
  call for days and never fired while the warning repeated continuously — the step was zero (or non-finite), which
  `< 0` does not catch but the physics engine still rejects. Write such checks as `!(dt > 0.f)`, which also catches
  NaN.
- **The spam buries real errors.** At thousands of lines a minute every log read became a dig, and twice it masked the
  actual failure line of the run.

## Fix

One guard at the call site — and it is semantically correct, not a workaround: physics not advancing is exactly what a
zero time scale means, so skip the call rather than make it and have it refused.

```cpp
const float physicsDt = fixedDelta * GameTime::Scale();
if (physicsDt > 0.f)          // false for 0, negatives and NaN
    m_physics->Step(physicsDt);
```

Check every system the fixed loop drives the same way: anything that divides by the step, integrates with it, or
asserts on it will misbehave under a zero scale, and the pre-play hold (CR-010) can last minutes in Player Flow. Prefer
the game's own pause path, if it already skips these calls, over a bare scale of zero
(`learnings/common-mistakes/time-scale-arbiter-must-restore-the-observed-value.md`).
