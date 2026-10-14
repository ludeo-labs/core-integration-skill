---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "3"
question: "Does the game keep a single match/battle phase variable (e.g. Setup / Active / GameOver) that is set when gameplay becomes active AND on every end path (victory, defeat, surrender, quit)?"
sanitized: true
origin: "unreal:architecture/toolkit-gamestate-phase-enum-is-the-gate"
---

# One phase variable can carry the whole gameplay-session lifecycle

**Applies when** the game has a match/battle phase variable that is written both when play becomes active and on
every way the match ends, and code reading confirms that all end paths go through the same setter.

## Why it beats hooking individual events

- **One variable covers both edges.** "Phase became GameOver" starts the end chain: `ludeo_GameplaySession_End`,
  then remove player, then `ludeo_Room_Close` (`05 §6.7`–`§6.9`). Every end path that goes through the setter is
  covered at once, including ones you would have missed hooking separately (surrender, forfeit, quit-to-menu).
  "Phase became Active" is the game's own "gameplay is live" edge: use it as the restore's "reached active gameplay"
  readiness (`07 §2.1` step 4), and — if the setup phase before it must not become a Ludeo — to close the
  non-ludeoable span that covers it (`06 §7.3`). It is **not** an extra gate on `Begin`: the room opens at level-load
  start (CR-009) and `Begin` waits only on player-added and room-ready (`05 §6.6`; plus `applied` in Player Flow).
- **Minimal game edits, and cheap.** Read it from the manager that owns it. Polling a few times a second is
  plenty for slow-paced games.

```cpp
void LudeoManager::PollPhase() {
    const MatchPhase p = match.GetPhase();
    if (p == MatchPhase::Active && !m_phaseActive) { m_phaseActive = true; OnGameplayLive(); }  // not a Begin gate
    if (p == MatchPhase::GameOver && !m_gameOverLatched) { m_gameOverLatched = true; EndGameplay(); }
}
```

## Notes that matter

1. **Prove the setter is on every end path** (victory, defeat, surrender, abort). A path that skips it leaves a
   room open.
2. **Compare by meaning, not by raw value.** If the phase values come from data or a script layer, the numeric
   values can be non-contiguous and can reorder when the data is edited. Resolve them by name, or through the
   game's own enum, at runtime.
3. **Latch the terminal edge.** A results/debrief screen can hold the phase at GameOver for many ticks. Fire the
   end chain once, and reset the latch in the teardown (`07 §2.6`).

Related: `learnings/architecture/explicit-game-phase-enum.md` (gate on an explicit phase value, not inferred state).
