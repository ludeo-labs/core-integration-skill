---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/dont-defer-player-begingameplay-past-its-window"
---

# Don't defer `ludeo_GameplaySession_Begin` past its gate; housekeeping runs after it

## The temptation

The gate latched (player added + room ready, and in Player Flow, applied). You want the world in its final,
swept state before telling the SDK gameplay has started, so you put `Begin` at the end of a multi-second
post-unfreeze cleanup: sweep stray level-script spawns, resume muted dialog, then `Begin`.

## What happened

In a fresh-load Player-Flow run, the deferred `Begin` **silently never ran**. The game was playable: pawn right,
weapons equipped, AI present, `SendAction` returning success. But the Ludeo "never really did anything": no goal
evaluation, no finalization. The SDK's log had **no** begin call at all, and the cleanup's own completion log was
missing too. The deferred callback had been dropped (its owner was re-created between scheduling and firing). The
exact mechanism isn't the lesson. Putting the SDK signal behind a housekeeping delay is fragile, so don't.

## The rule

**Issue `Begin` as the direct response to the gate latching** (`05 §6.6`, `TryBeginGameplaySession()`). If the
latch happens inside an SDK callback, queue it for the next tick (`03 §8.3`), but don't put it behind a timer
or a cleanup phase. Everything else comes after:

```cpp
void LudeoManager::TryBeginGameplaySession() {
    if (!m_playerAdded || !m_roomReady || (m_isPlayerFlowReplay && !m_applied)) return;
    if (m_begun) return;
    m_begun = true;
    BeginGameplaySession();                 // ludeo_GameplaySession_Begin: immediate
    if (m_isPlayerFlowReplay) { Unfreeze(); ReleaseInputHold(); }
    StartPostBeginHousekeeping();           // stray-spawn sweep, dialog resume: never calls the SDK
}
```

## Why

1. **SDK-side state advances on `Begin`.** Goal and constraint evaluation and session state can wait on it. Delay
   it and they hang with no error, even while actions are being sent.
2. **Deferred SDK calls are fragile.** Timers and delayed callbacks can be dropped by owner lifetime, level
   transitions or a frozen simulation. An immediate call from the gate has trivial ownership.
3. **"The world isn't settled" is the wrong worry here.** In Player Flow the core order already settled it before
   `OpenRoom` (`07 §2.1`). Late stray spawns are for housekeeping to clean up **after** `Begin`.

## Detect it

The gate's "all conditions met" log and the SDK's begin line should appear back to back. If the gate log fires
and the SDK line doesn't, look for a deferral between them (`learnings/common-mistakes/check-sdk-logs-not-just-game-logs.md`).
