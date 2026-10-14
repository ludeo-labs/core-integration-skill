---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Beyond positions, health and phase, what runtime state gates this game's future decisions — RNG stream positions, runtime-enabled lists, counters compared by later events, cached derived data, active modifier flags?"
sanitized: true
origin: "unreal:architecture/snapshot-determinism-is-coverage-problem"
---

# "The snapshot model can't do that" is a coverage gap, not a model limitation

**Precondition:** something that should happen naturally after Play doesn't — a reinforcement vehicle never arrives, a
wave dries up — and the tempting explanation is "that's an event over time; a snapshot can't reproduce it".

## The rule

A replay restores one snapshot and then runs the game's own logic forward from it (`07 §11`): capture **every state field that gates a future decision**, and the game evolves
from the snapshot on its own — the events re-fire by themselves. The model is only as faithful as the capture's
coverage. The user pushed back hard on "the snapshot can't do this", and was right.

The hard part is **finding** the gating state. Beyond the obvious, it includes:

| Kind | Examples |
|---|---|
| RNG stream positions | a spawner's private random stream's current seed; the global RNG seed |
| Runtime lists filled by gameplay | spawn routes enabled by events; routes currently occupied |
| Counters later events compare against | waves completed; the wave chosen at level start for the reinforcement |
| Cached derived data | an order cache rebuilt by a setter — restoring only the index leaves it stale (`07 §11.2`) |
| Active modifier flags | cooldown reductions, "endless wave" flags set by events |
| References | asset and placed-entity keys (`learnings/architecture/capture-references-as-resolvable-keys.md`) |

One missing field cascades: no enabled-routes list → the vehicle filter rejects every candidate → the vehicle pump is
permanently idle → nothing ever drives in.

## How to find it

1. Name the visible behaviour that breaks after Play.
2. Trace the code path that produces it in live play; list every `if`, predicate and early return that gates it.
3. For each gate, find its source of truth: captured, derived, or runtime-only.
4. Runtime-only and not captured → that's the gap.
5. **Log every gate's inputs before guessing** (`11 §10`; `learnings/common-mistakes/instrument-compound-filters.md`) —
   the failing condition is often a surprise.

## Anti-pattern: synthesizing outcomes

The first proposal was to force-enable the cooldown-reduction modifier whenever progression was near the end — an
approximation of what live play "would look like seconds later". It hides the real gap (the reinforcement wave index
and the completed-wave count weren't captured) and works only for that one capture point. The user rejected it. Capture
the gate's inputs and let the natural event fire; where the game has a refresh or re-fire path for a cache or event,
mirror it rather than faking its result.
