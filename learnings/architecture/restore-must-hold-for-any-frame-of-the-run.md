---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "1,4"
question: null
sanitized: true
origin: "unreal:architecture/curated-slice-is-mission-coverage-commitment"
---

# Scope is a coverage commitment over the whole run, not a highlight window

The platform cuts a Ludeo from anywhere inside an open room's recording (`03 §2.8`); the game doesn't choose the
moment. So whatever levels and modes the integration supports, the restore must work from **any** frame of a run in
them.

## The mistake

Picking "a 30-second to 2-minute highlight" — the boss fight, the escape — and optimizing for that imagined moment.
What follows:

- the entity list becomes aspirational (ten categories declared, four implemented);
- restore works for the imagined moment and breaks for a capture taken anywhere else;
- actions are dense in the imagined phase and sparse elsewhere;
- checks pass on the imagined moment, and field captures fail later.

## The rule

The scope is **one level (or set of levels) and one mode**, and within it:

- round-trip every piece of time-varying world state, regardless of the capture point;
- the census (`06 §1.5`) is a closed spec — every entry gets capture and restore by the end of its wave; no "we'll get
  to it" entries;
- actions fire across every phase of the run, not just the exciting one.

If that is too much for the timebox, **narrow the level or mode** (a smaller map, a simpler mode) — never the
temporal window inside it.

## How to apply

1. At intake, pick the level(s) and mode.
2. Walk the run's timeline and list every distinct phase (intro, setup, objective, combat, escape, …).
3. Per phase, list which entities are visible or active and which actions fire.
4. The union is the coverage commitment; it feeds the census in phase 4.
5. Test restores from **randomly chosen** capture points across the run, not only from the canonical highlight.

## Red flags

- Census entries with no owner for capture or restore.
- A scope described as a story ("stealth entry, firefight, extraction") rather than as levels, modes and types.
- Actions that only exist for the middle of the run.
- Every test Ludeo taken at the same moment.
