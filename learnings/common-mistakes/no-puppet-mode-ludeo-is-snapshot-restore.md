---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "2"
question: null
sanitized: true
origin: "unreal:common-mistakes/no-puppet-mode-ludeo-is-snapshot-restore"
---

# Player Flow is snapshot-restore, not frame-by-frame replay

## The mistake

Asked how restored AI would behave, the agent invented a "puppet mode": AI behavior disabled and transforms
overridden every frame from recorded data. The Ludeo SDK has no such mechanism. It sounded like a reasonable
solution from general game-dev knowledge, and nobody checked it against the documentation.

## How Ludeo actually works

1. **Creator Flow:** the integration writes entity state (position, health, type, flags) with
   `ludeo_DataWriter_Set*` every capture tick, and the SDK records it.
2. **Player Flow:** `ludeo_Session_GetLudeo` hands the integration a `DataReader`. The integration reads the
   captured moment with `ludeo_DataReader_Get*` (the same attribute names it wrote), matches or spawns entities
   (two-pass, `07 §3`), applies state, and holds the finished moment frozen until Play (CR-010). **From Play on,
   the game simply runs.**
3. There is no frame-by-frame replay and no puppet/override mode. The SDK restores a snapshot, and the game takes
   over.

## What happens to AI after restore

Transient AI is spawned from its captured type, level-placed AI is matched by stable id, and their state is
applied. From Play, their own logic runs from the restored position. They won't remember their prior patrol or
combat plan, but they will navigate and fight normally. That is acceptable: Player Flow shows a believable,
playable moment, not a recording. (Transient decision state is normalized, not mirrored: `07 §1.2`.)

## Red flags

- Any restore strategy that **disables** game systems (AI, physics) and replaces them with recorded playback is
  almost certainly wrong. Ludeo restores state and lets the game run.
- "Puppet mode", "replay mode", "override transforms each frame" and "disable behavior during playback" are not
  Ludeo concepts.
- Before describing how Player Flow works, read `07 §1–§3` and CR-010. If you don't know, say so and read
  (`learnings/common-mistakes/never-claim-sdk-behavior-without-citation.md`).
