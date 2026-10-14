---
category: architecture
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/player-flow-suppression-clobbering-vs-blocking"
---

# Two kinds of suppression: gate what clobbers, undo what blocks

`07 §9` (mistake 11) names the two categories a restore must suppress between `LudeoSelected` and the first
interactive frame:

- **State-clobbering** — code that **writes** over state the restore applies: default level-start spawns, default
  loadouts, fresh-load init, a live spawn trigger, per-tick defaults. **Gating it on `IsRestoring()` is complete**:
  not running it is exactly right, and there is nothing to clean up.
- **Flow-blocking** — code that **holds the replay back** without touching state: a non-gameplay overlay that pauses
  the game, an intro or loading gate that locks input, a "press start" screen, a warmup that won't hand over control.

## The mistake

Treating every suppression as "gate it off". That works for a blocker only if it **never engaged**. If its effect is
already latched — the pause applied, the input lock set, the widget shown — the path you skipped is usually the same
path that would have cleared it. Gating it off leaves a pause that never lifts, an input lock that never releases, an
overlay that never closes. The replay hangs, and it looks like a restore failure.

```cpp
// Clobbering — gating is complete
void DefaultSpawner::OnLevelStart() { if (LudeoManager::Instance().IsRestoring()) return; SpawnDefaults(); }

// Blocking, already engaged — gating its setup now is NOT enough; drive its dismiss
if (introOverlay.IsShown())
    introOverlay.Dismiss();   // the game's own close path: lifts the pause and the input lock it applied
```

Setting `SetRestoring(true)` at the commit, before the level load (`07 §2.1` step 3), keeps most blockers from ever
engaging. The latched ones are what's left: anything that engaged **before** the commit (a boot-straight game's idle
menu — `LAUNCH-AND-READINESS.md` §6, "leave idle at the commit"), or anything whose gate fires after its effect.

## The decision, per suppressed item

Ask: does this **clobber** restored state, or **block** the flow?

- Clobber → gate the write on `IsRestoring()` (or on the session-scoped replay flag if it fires after Play).
- Block → keep it from engaging **and** clear anything it already latched, through its own dismiss/undo path.

An item can be both — a warmup phase writes default state *and* holds control. Handle both halves.
