---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "5"
question: "Is the entity key derived from a float coordinate (a spawn point, an authored position) and matched on restore by equality or by a quantised hash? Capture and replay build their worlds independently, so those floats will not agree bit-for-bit."
sanitized: true
origin: "unity:common-mistakes/match-a-stable-key-by-proximity-not-equality"
---

# A stable key travels correctly and still matches nothing — match by proximity, not equality

Applies when the key that pairs a captured entity with a rebuilt one is derived from a float position.

A key derived from an entity's authored position is a good key: unique within the recording, unchanging for the
entity's lifetime, carried in the capture as a value rather than recomputed. All of that can be true and the restore
can still match **zero** entities. The diagnostic that finally printed both sides:

```
recorded enemy:      key derived from (39.10, 20.70)
rebuilt enemy [7]:   key derived from (39.10, 20.71)
```

The same enemy, one centimetre apart. The key was quantised to a centimetre before hashing, so the two landed in
different buckets. The single recorded enemy matched none of the nine in the rebuilt room, and reconciliation —
reading that as "the recording says this room is empty" — switched the whole population off.

## Why quantising doesn't save you

Quantising doesn't remove the boundary, it **creates** one; any value near it flips depending on which code path
produced it. A finer grid narrows the window, a coarser one merges distinct entities. Capture (a live room build)
and replay (a restored build) assemble the world through different code, and floats don't survive that
bit-identically.

| Job | Requirement |
|---|---|
| Identify an entity **within** one recording, tick to tick | unique + unchanging — equality is right |
| Match a recorded entity **to** a separately rebuilt world | nearest neighbour within a tolerance |

The key was never wrong. The comparison was.

## The shape that works

Greedy one-to-one assignment on distance from the recorded key position: for each recorded entity take the nearest
**unclaimed** rebuilt entity, accept it only within a tolerance, and claim it so nothing matches twice. Pick the
tolerance from the two scales you measured — here 1 cm of divergence against metres between authored enemies.

## What made it cheap, and what made it expensive

- **Print both sides on mismatch.** Counts alone can't tell "different entities" from "same entities keyed
  differently", and those want opposite fixes.
- **Refuse to reconcile on a total mismatch.** If the recording carries entities and *none* match, that is an
  identity failure, not an empty world — bail loudly instead of switching everything off (`07 §5.4`: "not captured"
  means "destroyed" only when capture demonstrably worked).
- Expensive: reading the mismatch as a population problem and hunting for why the room had the wrong enemies, when
  it had exactly the right ones.

Complement: `learnings/common-mistakes/a-stable-key-must-travel-not-be-recomputed.md` — the key is carried as a
value; this lesson is what stays true after that: the carried value still has to be matched against a world someone
else built.
