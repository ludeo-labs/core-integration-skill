---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/instrument-compound-filters"
---

# Instrument compound predicate filters per predicate before guessing

## The mistake

A spawn director's compound filter (`if (enabled && pathsUsable && squadsAvailable && durationOk)`) rejected every
candidate after a restore. The agent proposed three different causes from reading source, and all three were
wrong. Per-predicate logging found the real cause on the next replay: a restored "enabled paths" array was empty
after the restore, so `pathsUsable` failed for every entry. That had cost more than 30 minutes of guesswork.

## The rule

When a decision path silently filters out or early-returns on everything after a restore, **log each clause's
result for each entry**, behind the integration's dev/offline define:

```cpp
#if LUDEO_DEV_DIAGNOSTICS
for (size_t i = 0; i < settings.size(); ++i) {
    const auto& s = settings[i];
    LUDEO_LOG("[Ludeo] spawn filter[%zu]: enabled=%d paths=%d squads=%d duration=%d (%zu path(s))",
              i, s.enabled, PathsUsable(s), SquadsAvailable(s), DurationOk(s), s.paths.size());
}
#endif
```

If a clause is itself compound (`PathsUsable` = enabled AND unoccupied), break it down one level further, per
sub-entry.

## How to apply

1. Find the compound condition on the failing path.
2. Log per clause **and** per entry. A single "filter rejected entry" line is a tripwire, not a diagnosis.
3. Run one replay and let the log name the clause. Don't deduce it from 200 lines of source and the captured
   fields.
4. After the fix you can leave the logs in, because they fire only on the failure path. They are cheap insurance
   against the next regression.

This is the restore-specific form of `11 §10`: log first, theorize second.
