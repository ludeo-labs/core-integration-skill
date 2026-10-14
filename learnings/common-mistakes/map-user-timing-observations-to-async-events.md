---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/map-user-timing-observations-to-async-events"
---

# When the user says "if I wait N seconds it works", find the named async event in the log

## The mistake

The user reported: "If I wait a few seconds before pressing Play it works; if I press fast it doesn't." The wrong
response is to theorize about what "settles" in those seconds (subsystems initializing, garbage collection) and
propose a fixed delay or a longer settle.

The right response is to **open the log and find what completes in that window.** It is an async event with a
name. Find it and gate on it.

## The session that taught this

A voice-over timing bug reproduced on a fast click and not on a slow one. Two rounds of theorizing (a null dialog
manager, class layout, the preprocessor) were all wrong. The user then annotated the log: "the overlay appears
here; if I wait until here, it works." The answer was in plain sight between those two lines:

```
22:32:15.221  overlay appears
22:32:16.243  player state: loadout assets done loading
22:32:16.244  player character: loadout loaded
22:32:17.164  async package loads complete (cosmetic mesh)
```

The loadout-loaded event was the signal the user had been waiting on by hand. Gating on it fixed the bug.

## How to apply

1. Ask the user for the exact moment "it starts working", or annotate the log yourself.
2. Read the log in that window. Look for `OnDone*` / `OnLoaded` / `OnReady` / `OnInit*`, async asset loads, and
   subsystem initialization lines.
3. Match the moment to a specific event, then gate on its delegate or accessor. Under the restore order, that
   means: the wait belongs **before** the room opens. Extend the settle until the signal fires, bounded like every
   restore wait, with state-mutating systems suppressed on `IsRestoring()` (CR-010, "freeze vs suppress").
4. If there's no named signal, add a log inside the suspected subsystem and rerun. Don't guess.

**Anti-pattern:** a fixed-duration wait. It breaks on slower machines, faster disks and bigger maps.

Related: `learnings/architecture/active-gameplay-gate-must-wait-for-async-loads.md`,
`learnings/common-mistakes/verify-vo-path-before-proposing-skip.md`.
