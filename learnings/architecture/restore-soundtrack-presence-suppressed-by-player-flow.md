---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the game start its music from a level-start hook (level load, an intro sequence, a music manager's auto-start) that the restore suppresses under IsRestoring()?"
sanitized: true
origin: "unreal:architecture/restore-soundtrack-presence-suppressed-by-player-flow"
---

# Restore soundtrack presence explicitly — start-of-run suppression silences the replay

**Precondition:** the soundtrack starts from the same start-of-run logic the restore gates on `IsRestoring()`
(`07 §9.11`) because that logic also writes fresh-level state.

## Symptom

Positions, entities and gameplay state restore perfectly, and the replay is **silent**. The music trigger shared a
hook with the state-clobbering setup; gating the hook (correct for the state) took the music with it, so nothing ever
starts a track on the restored run. A silent replay reads as broken to a viewer.

## Fix

`07 §8.5` is the rule: capture the **active track id** on the world object and restart it from `RestoreEnvironment`,
idempotently — no second track stacked on one already playing.

```cpp
// Capture (Creator Flow, per tick on the world object)
SetInt32("active_music_track", music.ActiveTrackId());

// RestoreEnvironment
int32_t track = 0;
if (GetInt32("active_music_track", track)) music.PlayTrack(track);   // no-op if already the active track
```

Without a music manager, capture the sound asset's key and start it through the game's own 2D-sound or persistent
audio-emitter path.

## Keep three concerns apart

- **Presence** — *which* track. Every game with a soundtrack. Restarting from the top is enough.
- **Position** — the offset into the track. Only for time-driven moments (rhythm, music-synced, timed games — `07 §8.5`).
- **Intensity** — dynamic mixing, layered stems. Optional polish.

## How to apply

Find where the game starts its music (the music manager, a "play music" call at level start, an emitter on a persistent
entity). If that path is gated in the restore, add track-presence capture and restart. It is not load-bearing for the
first frame, but it is part of a complete restore — don't drop it because it isn't urgent.

Related: `learnings/common-mistakes/prefer-narrow-mute-over-killing-trigger-event.md` — broad suppression takes more
than you intended.
