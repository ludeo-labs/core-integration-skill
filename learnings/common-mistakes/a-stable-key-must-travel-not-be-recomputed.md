---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "4,5"
question: "About to rule out a candidate stable key because its value was decided at runtime — a rolled spawn position, a random pick, anything non-deterministic? That is the wrong test. A key has to be unique and unchanging WITHIN the recording; it does not have to be reproducible on the replaying machine, because it is written down and carried along, not recomputed."
sanitized: true
origin: "unity:common-mistakes/a-stable-key-must-travel-not-be-recomputed"
---

# A stable key has to travel, not be recomputed

**Precondition:** you are choosing stable ids (phase 4 Part B Step B2) and a candidate's value is rolled at runtime.

`06 §4.2` rules out pointers and engine runtime handles as ids because they don't survive the process. That is easy to
over-generalise into *"the key must be something the replaying machine can arrive at independently."* It must not.
The key is **captured as a value and transmitted inside the Ludeo**; the replaying process reads it, it doesn't derive
it. A key needs two properties:

1. **Unique** within its `objectType` for the recording.
2. **Unchanging** for the entity's lifetime, so per-tick updates address the same object and cross-entity references
   resolve at restore.

Reproducibility is not on the list. A pointer fails (2) in the only sense that matters — its meaning evaporates
outside the process that minted it. A recorded *number* doesn't, however it was chosen.

## The failure this produced

A run-based game had hand-placed enemies (keyed by authored start position — identical every run) and spawner-created
ones. The spawned enemies were declared unkeyable *because where they appeared was a random roll*, and a **blocking**
prerequisite was raised: change game code to stamp each with a run-local id. Wrong twice:

- **The test was wrong.** The rolled position, once rolled, never changed: unique and stable for the entity's life.
  That it couldn't be *predicted* elsewhere is irrelevant — it is read out of the capture.
- **The premise was wrong.** The game's registration path recorded a start position for **every** enemy, and the
  spawner went through that path. One function read would have shown it.

## Two rules

> **Before ruling a candidate key out, ask which of the two properties it actually fails.** Usually neither — the
> objection was about reproducibility, never a requirement.

> **Before declaring anything BLOCKING — especially when the remedy is a game-code edit — read the function that would
> already have to be doing it.** The integrator caught this one by not believing it: *"what do you mean they can't be
> identified?"*

## The real residual risk

Check uniqueness rather than assume it. A position-derived key collides if two entities can be born at the same spot
(a spawn point reused after being consumed, two authored entities at identical coordinates). Detect the collision at
registration and append an ordinal — entirely inside the integration layer, with no game edit.
