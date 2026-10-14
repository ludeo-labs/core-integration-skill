---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/use-ignore-input-during-player-flow-wait"
---

# Hold player input without freezing the game during restore waits that need time running

Parts of the restore must run with **time ticking**: reaching active gameplay (async loads, native spawn) and the
~0.5 s settle where `ApplyDeferred()` runs (`07 §2.1`). Freezing there stalls what you're waiting for, and CR-010
forbids frame-waits inside a freeze. The player still mustn't move, look or fire.

**Symptom when it's missing:** "I can move around until the overlay comes up."

## The rule

Use the **narrowest input block the game offers**: stop movement, look and action input, and leave simulation,
loading and AI ticking. (The input block itself must not stop them; suppressing the state-mutating systems that would
overwrite the snapshot during frame-dependent work is a separate guard, on `IsRestoring()` — CR-010 "Freeze vs
suppress".)

```cpp
// commit (07 §2.1 step 3)
playerControl.BlockGameplayInput(true);   // move + look + actions; tick, loads and AI untouched
// … reach active gameplay → freeze → apply → settle (time on, input held) → freeze → OpenRoom …
// RoomReady → Begin → unfreeze: release
```

Prefer the game's own "block player control" switch (cutscene and dialogue systems usually have one) over
unbinding devices, which is fragile to call order.

Don't use the game's pause for this, since it stops the tick, and avoid full cinematic modes, which also change
the HUD, camera and audio.

## Release on every exit

Release at `Begin`, and on every abort: an ignored selection, a timeout, back-to-menu. A hold left set causes
"dead input" on the next play (`11 §8`), so reset it in `EndCurrentLudeo` (`07 §2.6`).

Related: `learnings/architecture/frame-dependent-restore-work-runs-unfrozen.md` (which restore steps run unfrozen,
and how long to settle).
