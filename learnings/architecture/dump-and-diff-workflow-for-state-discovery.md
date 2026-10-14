---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "4"
question: "Can the engine serialize every live entity's state generically — a reflection/property system, the save serializer, an editor inspector — so that two runtime snapshots can be dumped and diffed?"
sanitized: true
origin: "unreal:architecture/dump-and-diff-workflow-for-state-discovery"
---

# Dump and diff the live world to find which fields actually drive a behaviour

**Precondition:** the engine can walk every entity and write out its fields (and its sub-components') generically.
Without that, the same workflow works with per-type debug dump functions — slower to build, same payoff.

## When

You need to know which state to capture to restore behaviour X and don't know which fields drive it: a visual state
won't restore, an entity has many fields and only some matter, the state hides on a scripting object with no telling
name, or the visible effect spans several entities. Reading the code or scripts works, but it is slow and misses
derived state on sub-components. The diff gives an objective answer from runtime data (the same spirit as
`11 §10`, instrument before theorizing).

## The workflow

1. Put the world in the **baseline**: X in its default condition (doors closed, cases locked).
2. **Dump** every entity's fields to a file (`ludeo.dump_world baseline` as a debug console command).
3. **Trigger X** the way normal play does.
4. **Dump** again (`ludeo.dump_world with_x`).
5. **Diff** the two dumps into a small file of only the entities and fields that changed.
6. **Summarize** by entity type, ranked by number of changes; **focus** on one type's before/after values.

Fields that change consistently between the two dumps are the candidate sources of X.

## Real example

"Why do the containers re-lock on replay?" Baseline at mission start (containers locked), the player cut the power,
second dump with the containers visibly unlocked. The diff showed a control-panel entity's `state` flipping
false → true (the **source**) and, on every container, `currentState` Lockdown → Closed, `hasLockdown` true → false,
the interaction sub-component's `enabled` false → true and a lockdown animation's progress (all **derived**). The
natural first guess — "capture an `isLocked` on each case" — named a field that doesn't exist, and would have missed
the cross-entity chain.

## Pitfalls

- **Size.** Full dumps can run to hundreds of MB (pretty-printed, wide encodings); the diff is a few MB. Keep the dumps
  only long enough to diff them; write UTF-8.
- **Movement noise dominates.** AI, vehicles and anything moving change constantly and top the ranking. The signal is
  usually the low-change-count types.
- **Dump close together**, separated only by the action that causes X — 30 seconds apart buries the signal in drift.
- **Per-frame derived fields** (bounds, last-update stamps) are noise; filter them.

## Tools to build once

A dump command (walk every entity and its sub-components, write JSON), a streaming diff script, a by-type summarizer,
a by-type focus view — a few hundred lines in all. It pays back on the first hard bug, and the dumps double as the
diagnostic record for the next investigation.
