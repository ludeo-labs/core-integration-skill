---
category: save-systems
tier: universal
sourceGame: VoyagerV2
phase: "5,8"
question: null
sanitized: true
origin: "unreal:save-systems/saveworld-previous-failure-was-precondition-specific"
---

# A "nothing works" verdict on a capture approach is precondition-specific — record the preconditions with it

On one integration an automatic, property-traversal way of serializing entity state was tried five different ways
and every attempt failed. The conclusion went into the learnings as "manual per-entity writes are the ONLY option",
tagged `universal`. It was wrong: the five failures split into two kinds.

- **Inherent to the approach** — traversing every property crashed on unsupported types; following references
  into objects nothing had registered crashed. These hold on every project.
- **Caused by the project's state at the time** — the filter that should have selected gameplay values returned
  nothing because no value carried the marker the filter keyed on; serializing the game's own save object captured
  only metadata for the same reason. Change that precondition (mark the values) and those two failures go away.

So the honest record was `generalizable`, with the precondition "the game's values carry none of the markers the
approach selects on" — not a universal ban.

## The rule

When an empirical test ends in "every approach failed", write down **for each failure**:

1. what broke (crash, empty result, partial result);
2. whether it is **inherent** to the approach or **conditional** on something about this project, toolchain or SDK
   version;
3. for conditional failures, the condition itself, phrased as a question a future integration can check.

Then tier the learning from that table. If any failure is conditional, the verdict is `generalizable` and the
`question` is that condition. An absolute conclusion tagged `universal` is the red flag `SKILL.md` → **Learnings**
warns about.

## Why it matters

A wrongly universal "never" closes a path for every later integration, including ones where the precondition
does not hold and the approach would have saved real work. It also hides the cheaper fix on the project where the
verdict was reached: here, the blocker was a missing marker that could be added, not the approach. Before porting a
"we tried everything" note into a plan or a learning, re-read it for the preconditions it silently assumed.
