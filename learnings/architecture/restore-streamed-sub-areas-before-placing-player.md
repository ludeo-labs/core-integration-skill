---
category: architecture
tier: generalizable
sourceGame: StoryPuzzleGame
phase: "5"
question: "Can the player be inside a sub-area the game streams in on a trigger (an interior, a set-piece, a flashback scene) that is not loaded when the captured level boots — and does entering it also swap lighting or ambience separately from geometry?"
sanitized: true
origin: "unreal:architecture/restream-capture-time-sublevels-before-restore, unreal:architecture/capture-lighting-sublevel-visibility-not-just-geometry"
---

# Re-stream the capture-time sub-areas (and their lighting) before placing the player

**Precondition:** the game streams sub-areas into the level on a trigger, beyond the chunk that loads with the level
itself, and the player can be standing inside one when the moment is captured.

## Symptom

A capture taken inside the sub-area restores the player into the void — falling through the floor, black
surroundings — while captures in the always-loaded area work. The capture data looks valid, which sends you hunting
for a serialization bug that isn't there.

**Fast tell:** compare the player's captured position with the tracked entities'. If the player is hundreds of
thousands of units from every one of them, they were in a sub-area authored at a far offset, not in a corrupt
transform.

## Root cause

Reaching active gameplay loads only the primary chunk. The readiness gate passes (its entities exist), and the apply
places the player in a sub-area that was never streamed on this boot — no geometry, no collision.

## Fix

1. **Capture** on the world object, per tick, the ids of the sub-areas that are loaded **and** visible (empty in the
   primary area). This is a schema change — version-gate the read
   (`learnings/architecture/capture-schema-lifecycle-management.md`).
2. **Restore** as part of reaching active gameplay (`07 §2.1` step 4), before the apply: stream each listed sub-area
   with the game's own loader and wait, **unfrozen** and bounded, until all are visible — a streaming wait under a
   freeze never completes (CR-010, "Freeze vs suppress"). Then freeze → apply. The player lands on real geometry.

Capturing the actually-loaded set beats inferring it from a progression flag: it reproduces what the player saw and
unifies set-piece and free-roam sub-areas. Still restore the progression flag so the scripted entry doesn't re-fire.

## Lighting is often a separate stream

Entering a sub-area may also **hide the host area's lighting chunk and show the sub-area's**. A geometry-only restore
then lights a dark exterior with bright interior lighting — the player is in the right room and the scene is visibly
wrong. Capture the host-lighting visibility flag too (older captures default to "host lighting on"); when the capture
was taken inside a sub-area, hide the host lighting and show the sub-area's lighting once its chunks have streamed —
replaying what the entry trigger does. Lighting chunks hold no gameplay entities, so entity scans and "position
restored" checks miss them; when you find a lighting swap on an entry path, add it in the same pass as the geometry.

**Offset caveat:** this assumes sub-areas are authored at their final world coordinates. If the game streams them at
a runtime offset, capture and reapply that offset; check the first frame of a replay.
