---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "3"
question: "Are you putting the CR-007 End/Abort hook in the game's level-load wrapper — and does that wrapper early-return when a load is already in flight?"
sanitized: true
origin: "unity:common-mistakes/hook-the-scene-load-funnel-below-its-already-loading-guard"
---

# Put the CR-007 level-transition hook below the loader's "already loading" guard, not at the top of the function

A single level-load wrapper is the best CR-007 hook a project can offer: one edit covers every level transition and
quit-to-menu, on the departure side. The reflex is to put the end call at the **top**. That is wrong whenever the
wrapper can decline:

```cpp
bool LevelLoader::LoadLevelAsync(const std::string& level, OnLoaded onDone) {
    // ✗ hook here: a rejected call ends the gameplay session with NO transition
    if (m_loadInFlight)
        return false;                       // already loading — nothing happens

    // ✓ hook here: past the guard, the load is definitely happening
    LudeoHooks::OnLevelChanging(level);
    m_loadInFlight = true;
    ...
}
```

Above the guard, a re-entrant or double-fired request (overlapping triggers, a button pressed twice, a fade callback
racing a direct call) ends the run while the player keeps playing the same level. Capture stops with no error and no
visible symptom until someone notices the Ludeo is short.

**Generalize:** before placing a hook in any game funnel, read the whole function for early returns, `bool` results
and no-op branches, and place the hook past the last one. A funnel that *reports* whether it acted is a strong hint
that it sometimes doesn't.

## Two companions for the same hook

- **Choose `isAbort` by destination.** The target level is right there:
  `level == kMenuLevel ? End(isAbort=true) : End(isAbort=false)`, per this game's CR-007 table.
- **Don't also hook the call sites that funnel into it.** Every gate, teleport and quit-to-menu path reaching the
  wrapper is covered; hooking them too double-ends the session. Confirm all callers pass through, hook only the
  funnel, and record the deliberately-unhooked list in the plan so a reviewer doesn't "fix" it.

Related: `learnings/common-mistakes/async-abort-outruns-the-next-runs-openroom-intent.md`.
