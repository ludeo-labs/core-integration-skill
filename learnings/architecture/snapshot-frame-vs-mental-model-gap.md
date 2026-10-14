---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "4"
question: null
sanitized: true
origin: "unreal:architecture/snapshot-frame-vs-mental-model-gap"
---

# The user remembers the whole recording; the Ludeo is one frame of it

## The situation

Capture writes state every tick; the integration is technically correct. The user plays three minutes, creates a
Ludeo, and reports "the replay is missing X" — where X happened during the recording. Before assuming capture or
restore is broken, check **which frame** the Ludeo starts from.

| The user thinks | Actually |
|---|---|
| "I captured the moment I was in heavy combat" | The Ludeo starts at the frame the platform cut / the creator trimmed to — possibly minutes earlier (`03 §2.8`) |
| "All my kills should be there" | Only what happened **before** that frame is in its cumulative state |
| "It should start where I stopped" | It starts at the chosen frame, not at the end of the recording |

## Consequences for capture design

**Frame-local** state — true at that instant — replays faithfully whichever frame is chosen: transforms, health,
which enemies are alive now, the current objective and phase, which doors are open.

**Cumulative** state — a running tally — surprises the user when the frame is earlier than they remember: kill count,
a corpse buffer, shots fired, damage dealt, "has the player done X yet" flags, loot gathered.

## Rules

1. **Prefer frame-local state.** If the game keeps a live list (alive enemies, active objectives), capture it directly
   rather than rebuilding it from an event log.
2. **When cumulative state is unavoidable, log it at capture** (a verbose line with the tallies per tick), so "zero
   kills on replay" can be checked against what the chosen frame actually held.
3. **For milestones the user expects to see, capture the trail** and replay it on restore
   (`learnings/architecture/progression-trails-vs-snapshot-state.md`).
4. **Log which frame was restored** — its phase, progression and key counts — so "why does it look different from my
   memory" has an answer before anyone hunts for reader/writer bugs:

```
[Ludeo] restored: phase=1 progression=1.00 enemiesAlive=0 waveIndex=3
```

## Anti-patterns

- Blaming the platform for a "bad" frame. If the integration depends on a particular frame being chosen, the
  integration is wrong — every frame must restore (`03 §2.8`).
- Retry loops that re-read "did the frame have X". The frame is fixed once chosen; re-reading won't produce X.
- Capturing "will happen" state. Only what has happened up to now exists.
