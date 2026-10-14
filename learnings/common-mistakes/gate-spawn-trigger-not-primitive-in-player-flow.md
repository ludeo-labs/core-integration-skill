---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the game populate the world through a runtime trigger (wave start, combat start, room enter, elimination refill) that can fire again while the replay plays forward from the restored moment?"
sanitized: true
origin: "unreal:common-mistakes/gate-spawn-trigger-not-primitive-in-player-flow"
---

# Gate the spawn trigger, never the spawn primitive

**Precondition:** a runtime trigger calls the game's spawn routine, and the restore repopulates the same entities
from the capture.

## Problem

Pass 1 (`07 §3.1`) recreates the captured population by calling the game's spawn primitive. After Play, a live
trigger can fire again: the wave director starts the wave you already restored, an encounter re-arms, or a refill
tops up the pool. The restored population then gets duplicated, with wrong counts and a second copy of the moment.

The instinct is to guard the spawn call itself on "is this a replay". That gives an **empty replay**, because the
restore's own Pass 1 calls that primitive.

## Fix

Gate the **decision to populate**, not the **mechanism that populates**:

```cpp
// WRONG — also blocks Pass 1
void EnemySpawner::SpawnWave(int wave) { if (IsPlayerFlowReplay()) return; ... }

// RIGHT — gate the trigger; the primitive stays callable by the restore
void WaveDirector::OnWaveShouldStart(int wave) {
    if (encounter.started) return;     // restored flag, see below
    spawner.SpawnWave(wave);
}
```

## Re-create versus advance

- **Re-create** is a trigger that re-fires the wave or encounter you already restored. Suppress it.
- **Advance** is a spawner that moves to the *next* wave from the restored cursor. Keep it: that is legitimate
  forward play. Capture and restore the wave index or cursor, so advance continues from the right point.

Prefer the game's own "already started" flag, captured and restored per encounter, to a blanket replay gate
(`07 §11.1`). A global "no triggers during a replay" gate starves the encounters the player reaches later, and
the replay plays out over an empty level. Inside the restore window, start-of-run triggers are gated on
`IsRestoring()` (`07 §9.11`).

**How to apply:** for each populate trigger, ask: *"if this fires after Play, does it duplicate the restored
population or advance past it?"*

Related: `learnings/architecture/the-replay-world-comes-pre-populated-reconcile-dont-add.md`,
`learnings/common-mistakes/gate-only-state-writes-in-player-flow.md`.
