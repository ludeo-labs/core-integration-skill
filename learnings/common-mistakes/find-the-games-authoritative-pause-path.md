---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,6"
question: "Does the game have more than one way to 'pause' — an engine-level simulation pause plus a per-player/mode-gated pause request, a time-scale or per-entity freeze, or a plain 'paused' flag driven by the pause menu?"
sanitized: true
origin: "unreal:common-mistakes/use-setgamepaused-not-pc-setpause, unreal:engine-quirks/custom-pause-via-timedilation-not-engine-pause, unreal:engine-quirks/actiongame-uses-setpausedpreferred-not-setgamepaused"
---

# Find the game's authoritative pause path — for driving the freeze and for detecting pauses

**Precondition:** the game has several pause-like mechanisms, and the one the engine exposes is not necessarily
the one the game's pause menu uses.

Three integrations hit the same wall from different sides:

1. **A pause *request* that can be refused.** The SDK pause handler called a per-player "request pause" API. In a
   multiplayer-style game mode the mode's "pausing allowed?" rule returned false, so the request was silently
   dropped and the simulation kept running behind the overlay (CR-011's #1 failure).
2. **A global engine pause the game ignores.** Another game silently rejected the engine's global pause and ran
   its own network-aware pause: the pause menu set a "preferred paused" state on the player's controller, which
   the authority applied. Engine-pause calls "succeeded" and changed nothing — the tell was the user saying "ESC
   does pause it."
3. **A pause the engine never hears about.** A third game paused by zeroing the time scale of tagged entities and
   setting a `paused` flag — the engine's "is paused" query stayed false. A non-gameplay detector built on that
   query never sent `PauseLudeo` for the pause menu, so the objective timer ran through it (`06 §7.3`).

## The rule

Find how the game's **own** pause menu pauses, and treat that as authoritative for both directions:

- **Driving** (CR-010 restore freeze, CR-011 overlay pause): the freeze must stop the **simulation tick**,
  unconditionally — not a request a game-mode rule can veto, and not an input-only block. Route it through the
  freeze controller's separate bits (CR-011: restore bit, overlay bit; engine paused if any is set), and have the
  bottom of that controller call the freeze primitive the pause menu uses — the call that stops the tick, not the
  one that also opens the menu UI.
- **Detecting** (`PauseLudeo`/`ResumeLudeo`, `phase 6 · task 2` Step 5): read the game's own pause signal, OR'd
  with the engine's, so every path reports once per transition.

```cpp
bool IsGamePaused() const {
    return engine.IsPaused()          // engine-level pause (and our own freeze)
        || gameState.paused           // the menu's custom flag / time-scale freeze
        || pauseMenu.IsOpen();        // UI-driven pause, if separate
}
```

## How to find it

1. Trace the ESC / pause-menu handler to the call that actually stops gameplay.
2. Grep the player/controller/game-state code for `pause`, `paused`, time scale / time dilation, and any
   "allow pausing" rule in the game-mode code.
3. Check for a refusal path: call the candidate with the game in its normal mode and confirm the tick really
   stops (log a frame counter).

If the custom pause only freezes some entities, the integration's own per-frame code keeps running through it —
gate its polling on the game's pause signal too, not just the engine's.
