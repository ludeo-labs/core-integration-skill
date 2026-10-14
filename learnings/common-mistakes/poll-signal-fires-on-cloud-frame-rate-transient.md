---
category: common-mistakes
tier: generalizable
sourceGame: TacticsGame
phase: "6"
question: "Does an action or signal compute its value per poll from transient game state (an active-unit reference, a phase value, an 'is X happening now' flag) that can be momentarily absent (null, between values) during moves, animations or transitions?"
sanitized: true
origin: "unreal:common-mistakes/player-flow-poll-signal-fires-on-cloud-frame-rate-transient"
---

# A poll signal that infers "not the positive case" fires spuriously on the cloud

**Precondition:** an action is driven by polling transient state that passes through a null or between-values
moment.

## The bug

A turn-based game sent `PauseLudeo` during the opponent's turn and `ResumeLudeo` on the player's. The code
paused whenever it was **not** the player's turn:

```cpp
bool playerTurn = active && !IsAIControlled(*active);   // null active unit → false
if (!playerTurn) SendPauseOnce();                       // ...so null counts as "enemy turn"
```

Moving on the player's own turn fired the pause, but **only on the cloud**. The turn manager's active-unit
reference goes briefly null during a move or a turn transition. Locally the poll never landed in that window; at
the cloud's slower, variable frame rate it did.

## Why it's a cloud trap

Local frame timing skips transient windows that were always there. **"Works locally" is no evidence that a
poll-based signal is correct.** Reason about the transient states explicitly.

## Fixes (apply all three)

1. **Detect the positive condition explicitly.** It is the opponent's turn only when the active unit exists
   **and** is AI-controlled: `bool enemyTurn = active && IsAIControlled(*active);`. Absent means transition.
2. **Debounce.** Commit a new state only after it has held for N consecutive polls (about 0.3 s).
3. **Fail safe.** If the discriminating read fails, default to the side that doesn't trigger the action.

**How to apply:** for every per-poll signal, list the states the polled value passes through, including the
momentary absent state during moves, animations, async loads and transitions. If "absent" lands on the triggering
side, the bug is latent and will show up on the cloud. Cloud logs may not show it either: reason it through, or
add diagnostics that survive into the cloud build (`learnings/engine-quirks/diagnostics-to-stdout-for-cloud-logs.md`).
