---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the game reveal a newly spawned entity at the END of a timed arrival sequence — a dissolve, fade-in, spawn animation, emerge-from-the-ground — rather than when it is created? Then a restore that spawns and then freezes leaves entities present, placed, valued and invisible."
sanitized: true
origin: "unity:architecture/restored-entities-must-arrive-already-arrived"
---

# A restored entity has to be placed already-arrived, not spawned

**Precondition:** spawning an entity starts a timed reveal, and only the reveal's last step makes it visible.

Spawn-from-data restoration recreates entities through the game's own spawn path, which is usually right — the entity
gets its components, identity and callbacks. But the **visual arrival** is often a separate timed sequence:

```
show the mesh
start the dissolve / fade / spawn animation
wait until the effect finishes      <-- driven by the game clock
set visible
```

The restore spawns the entities and then holds the world still (`07 §2.1` step 5 and the freeze before Play). The
arrival runs on that same clock, so it never gets past the wait. Every restored entity is present, at the right
position, with the right health and references — and invisible. (The settle's ~0.5 s does not save you if the
effect is longer, and the moment is frozen behind the overlay afterwards.)

## Why existing checks miss it

Placement validation in the run that found this reported the enemy count intact, worst drift under a metre, nothing
missing — and a third of the enemies could not be seen. Placement says an object is where you put it, not that
anyone can see it. The integrator noticed only because enemies in front of him appeared and the ones behind did not.
The one machine-readable hint was a stale flag: entities still parked in the arrival branch of their behaviour logic
carried an arriving/dying flag the recording said should be clear — a **symptom** of an unfinished arrival, not a
value the restore failed to write.

## What to do

At the point of restoring an entity, **complete the arrival instead of playing it**:

- snap the reveal effect to its finished value (effect controllers usually have an internal "finish now" step —
  expose it rather than reimplementing the interpolation);
- set the entity's "arrival finished" flag;
- set it visible and show its renderables directly.

The moment is mid-fight; nothing in it arrived a second ago, so no arrival should play at all. If the spawn path
re-plays the sequence on its first tick, do this in `ApplyDeferred()` (`07 §6`).

## Check for it explicitly

Add visibility to the per-entity restore check, **ahead of** the value comparisons, because it hides every other
failure:

```
entity 'X' is present but NOT VISIBLE [visible=0, arrival_finished=0, dissolve=0.87]
```

Print the arrival state alongside any per-entity complaint — it separates "the restore wrote the wrong value" from
"the entity never finished arriving". See
`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`.
