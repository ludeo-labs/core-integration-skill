---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/diagnostic-warning-logs-become-permanent-cruft"
---

# Diagnostic warning logs become permanent cruft unless you remove them with the fix

## The mistake

While hunting a bug, high-volume warning-level logs go in at every suspect site so the signal can't be missed.
They surface the bug, the bug gets fixed, and the logs survive the commit. Over time this turns into permanent spam
that hides the signal in **future** investigations.

Incident: one restore fix added several warning blocks to a spawn director's hot path, around 75 lines including
a 50-line per-vehicle, per-path predicate breakdown. The two bugs it found (an empty spline set making a filter
reject every path, and non-deterministic RNG) were fixed in the same commit. The commit message claimed the logs
"will surface the next layer when the investigation resumes". They didn't. The next bug (a silent drop between a
successful roll and the spawn call) lived at different call sites. The logs just spammed every session log until
a follow-up commit removed about 80 lines.

## Why "keep it for next time" fails

- The next bug almost always lives at a different call site, where the old logs don't reach.
- It needs different fields, and the old payloads don't match.
- At the same site, the new signal is buried under spam the previous bug needed.
- Fresh targeted logs (10–20 lines at the right site) are cheaper than grepping through old cruft.

## The rule

**Once a diagnostic log has surfaced its bug, delete it in the same change as the fix.** A verbose-level log that
is off by default may stay. Warning-level diagnostics that run in every integration test run must not.

If you think the instrumentation will matter again, write that down (a `risks` entry in `integration.json`, or a
tracked TODO with an owner) and keep it out of the code.

## Keep vs drop

**Keep:** one-shot lifecycle summaries (room open/close, apply start/end, restore complete), restore outcome
lines (objects created/matched/applied, deferred entries run), error logs on invariant violations, and the
per-restore instrumentation `11 §10` asks for.

**Drop:** per-tick or per-roll warnings, per-element dumps of whole collections every iteration, and duplicates
of state-change lines a normal-level log already prints.
