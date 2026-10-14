---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does level-start briefing/intro voice-over play through a central dialog system that has a master play gate and a clear/interrupt call that also cancels queued (pre-delay) lines — and is that VO kicked off by the same level-start event that drives gameplay setup?"
sanitized: true
origin: "unreal:architecture/suppress-engine-vo-via-dialog-manager-mute, unreal:common-mistakes/dialog-mute-window-must-bracket-all-deferred-triggers"
---

# Suppress briefing VO by muting the dialog system, and keep the mute open past every deferred trigger

**Applies when** the briefing VO goes through a central dialog/VO system with a master "can play" gate and a
clear call that cancels queued lines, and the event that queues the VO is the same level-start event that opens
doors, spawns enemies and places objective markers.

## Don't kill the trigger event

The obvious fix for "the briefing VO plays when a Ludeo starts" is to skip the level-start event while
`IsRestoring()`. That also skips the gameplay setup hanging off the same event. The replay then loads into an
empty level: no doors open, no spawns, no objectives. Briefing VO belongs on the start-of-run list (`07 §9.11`),
but suppress the **VO**, not the event.

## Mute the dialog system instead

Add a small suppress/resume pair to the game's dialog system, modelled on whatever it already does for a
restart or a black screen:

```cpp
void DialogSystem::SuppressForLudeo() { m_canPlay = false; Clear(); }  // Clear() also cancels pre-delay timers
void DialogSystem::ResumeAfterLudeo() { m_canPlay = true; }
```

Check that `Clear()` cancels lines that are queued but haven't started yet (a short initial delay before the
first line is common). If it only stops lines already playing, a line queued in the same frame still plays.

Call suppress at the commit, while `IsRestoring()` is set. The level-start event still fires, gameplay setup
still runs, and only the dialog queue is dropped.

## The mute window must cover the latest deferred trigger

Symptom: the log shows the suppress firing and the gate is checked at play time, but the VO plays anyway. The
trigger was **deferred**: it queued the VO only after something slower finished (a loadout async load, a timer, a
latent script node). By then resume had already reopened the gate.

The obvious resume point is `Begin` (Play pressed → unfreeze). But a deferred trigger whose wait was frozen until
then fires *after* the unfreeze, so resuming at `Begin` is too early. Either:

- **move resume later**: after the slowest deferred trigger has had its chance to fire and be rejected, for
  example on the trigger's own completion signal, or a short time after `Begin`, outside the SDK path; or
- **move the event that resume follows**: make the restore wait for the same readiness signal the deferred
  trigger waits for before it settles and opens the room.

**Diagnose with timestamps:** log the suppress, the resume and the VO's actual play call. If the play call comes
after the resume, the window is too narrow.

If the game has no central gate, find the specific VO asset and interrupt it, or fall back to gating the trigger.
Do that only after confirming which system actually plays the line.
