---
category: architecture
tier: generalizable
sourceGame: TacticsGame
phase: "5"
question: "Is the game turn-based, and did the team agree that captures land at turn starts?"
sanitized: true
origin: "unreal:architecture/turn-boundary-quantized-write-cadence"
---

# Turn-based games: quantize state writes to turn boundaries, as a swappable policy, and validate it early

**Applies when** the game is turn-based and the team agreed (and you recorded) that "captures start at the
beginning of a turn". See `learnings/architecture/turn-based-capture-at-turn-boundaries.md`.

## The pattern

The platform picks an arbitrary frame from the recording, and the restored state is whatever the state stream
held at that frame. Writing every tick therefore restores mid-move and mid-animation states. **Writing state only
at turn boundaries makes every restore land at the latest turn start**, which enforces the agreed semantics by
construction.

Implementation: the existing poll reads a turn tuple from the turn manager (turn number, active unit id, turn
phase) and rewrites **all** tracked objects when the tuple changes. Deaths are still handled at poll time (a
final write, then `ludeo_DataWriter_DestroyObject`), because the entity may be gone before the next boundary.

## Make the cadence a policy, not a design lock-in

Use **one** write path with a `ShouldWriteThisPoll()` predicate driven by a `ludeo.ini` key (for example
`writeCadence=TurnBoundary|PerTick`). Flipping the cadence is then a config change.

Tell the team that switching cadence does **not** invalidate earlier Ludeos, because the attribute schema is
identical. Only adding, removing or retyping attributes forces a re-record (`11 §6.8`).

## Side effects to record so QA doesn't file them

- The video can show a mid-turn moment while the restore lands at that turn's start. The player replays the
  turn from its beginning, possibly re-killing a unit that died mid-turn in the video.
- Camera state written at turn cadence restores the camera where it was at the turn start.

## Counter-evidence: validate with a real capture immediately

The same team that agreed to turn-start captures found the first real replay **broken** ("units aren't where the
Ludeo shows them") and switched to per-tick. In a tactics game units can stay still for whole turns, so the last
boundary can equal the **battle-start formation** even when the video shows a mid-turn moment, and the replay
looks like a restart. Every self-check (restore vs data) was green, because the data itself didn't match the
video. Three debugging rounds went into restore bugs that didn't exist.

1. Schedule a **watch-the-replay** check right after the first capture, and expect the decision to flip.
2. When restore-vs-data checks are green but the user sees the wrong scene, check **data vs video** before
   hunting restore bugs.
3. Keep the config-driven cadence: it's what makes the flip a one-line change.
