---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/player-flow-must-pause-before-restoration, unreal:common-mistakes/player-flow-sequence-game-first-then-ludeo, unreal:common-mistakes/player-flow-timing-apply-before-begingameplay"
---

# Player Flow order: reach gameplay, freeze, apply, settle, freeze, then the room. Every shortcut failed.

The order is fixed (CR-010, `07 §2.1`). Three integrations each broke it in a different way, and every
"reasonable" deviation failed.

## The failures

1. **No freeze during the apply.** Bots spawned and their AI started moving, the movement system overwrote
   restored positions on the next tick, the player took damage before health was restored, and the round timer
   kept counting. The reference said to freeze. The agent was focused on getting bots to spawn at all and
   deferred it.
2. **Applied before the game's own spawn ran.** The apply ran at level begin, a frame before the game's
   spawn-at-start logic, which then reset the player: "restored to the beginning of the mission".
3. **Applied in a frozen game via a next-frame timer.** The game was paused, so the timer never fired. That was a
   deadlock, not a slow restore.
4. **Applied after `Begin`.** The SDK records from whatever state exists at `Begin`, so it recorded the
   default state.
5. **Applied unfrozen "so physics and AI can settle on the next frame".** The insight is real: systems need frames
   to absorb new positions. The method is wrong, because a live simulation overwrites values as they land.

## The order that works

1. **Commit**, then **reach active gameplay** on the captured level: the game's own load and spawn path runs to
   completion, with only input held (`07 §2.1` steps 3–4). Wait for the real "native spawn done" signal, not just
   "gameplay phase started".
2. **Freeze → apply** Pass 1, Pass 2 and the environment, synchronously.
3. **Settle** about 0.5 s with time running and input still off. `ApplyDeferred()` runs on its first tick. This is
   where "systems need a frame" belongs, with state-mutating systems suppressed on `IsRestoring()`.
4. **Freeze again**, `SetRestoring(false)`, then `OpenRoom(ludeoId)` → `AddPlayer`.
5. **`RoomReady`** (Play) → `Begin` → unfreeze. Nothing is loaded or written after Play.

## Red flags

- Applying at level begin, before the game's spawn logic has finished.
- Any next-frame timer or "wait a frame" step **inside** a freeze (CR-010, "freeze vs suppress").
- Applying, or doing anything else but unfreezing, after `Begin`.
- Opening the room before the settle finishes.
- A pause that blocks only input while the simulation ticks.
