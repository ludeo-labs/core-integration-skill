---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "4,5"
question: "How many objects does the capture track in the busiest level? Above roughly a hundred the state upload was observed DROPPING objects silently while every ludeo_DataWriter_CreateObject still returned Success — scope the sweep on a logged per-type census."
sanitized: true
origin: "unity:architecture/the-state-upload-is-lossy-above-a-ceiling"
---

# The state upload is lossy above a size ceiling, and every per-object result still says Success

**Precondition:** the capture tracks many objects at once — on the order of a hundred or more in the busiest level.

Three bug reports on one integration — "restore works but I see no enemies at all", "it does not restore the
collectibles I picked up", "the replay destroys things I never touched" — had one cause: **the state payload was too
big and the backend silently kept part of it.** Two measured failure modes, both with a clean capture log:

```
163 objects sent -> upload fails ("end of stream"); the stored Ludeo has FOUR objects, one per objectType
163 objects sent -> 147 stored (Enemy 31->26, WorldObject 129->118)
 34 objects sent -> fine
```

All 163 `ludeo_DataWriter_CreateObject` calls returned `Success`. **Per-object result codes prove nothing about what
the backend stored.** The ceiling is a lossy degradation, not a hard cap and not an error, so a smaller test that
passed earlier is no evidence the design scales.

## Why it is dangerous, not just lossy

Truncation meets the terminal rule ("absent from the snapshot ⇒ destroyed before capture", `06 §3.5`). A dropped
object reads as a dead one, so the restore removes entities the player never touched — about 5 enemies and 11 pickups
per replay here, and every enemy in the "end of stream" case. The rail that must exist regardless:
`learnings/architecture/an-empty-bucket-must-not-mean-everything-died.md`.

## Scope on a logged census, not on intuition

Two scoping decisions were guesses, and the first was wrong — moving platforms were dropped to fix it and nothing
changed, because that level had almost none. One log line settled it:

```
Coin:116, Leaf:6, Checkpoint:2, Shield:2, ExtraLife:1, Bonus:1, Surprise:1   (type names generalized)
```

116 of 129 world objects were one collectible type. **Log a per-type count at registration** before choosing what to
drop.

## Consequences for the wave plan

- **Do not track high-count collectibles individually.** Their *count* is what the player and objectives read — one
  counter on the session object carries it. Where "already collected" matters, carry the consumed ones as one keyed
  string (stable ids, `06 §4.2`), never as a positional mask over a roster whose order is not stable.
- **Warn at the gate:** log a warning when the tracked count passes a threshold (~80 was used), so an over-wide sweep
  shows up in the run, not as a truncated Ludeo three bug reports later.
- **The ceiling is unmeasured.** 34 worked, 163 did not; 80 is a guess. Say so in the plan, treat the payload as a
  budget each wave spends from, and report the observation to the Ludeo SDK owners.
