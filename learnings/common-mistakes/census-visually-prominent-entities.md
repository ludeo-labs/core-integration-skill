---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "4"
question: null
sanitized: true
origin: "unreal:common-mistakes/track-all-visible-entities-for-curated-slice"
---

# Census every visually prominent entity — not just the "gameplay" ones

## Problem

The agent deferred vehicles to a late wave because they weren't "gameplay entities": no health, not killable, not
part of the objective. But the captured street had parked cars and enemy vehicles in plain view. Played back
without them, the street was empty and the replay looked obviously wrong.

A replay is judged first by how it looks against the highlight the viewer just watched. A type the moment is
*visibly wrong* without is **load-bearing** (`06 §1.5`) — wave 1, not enrichment.

## Fix — a visual-completeness pass in the census

During the `phase 4` census, after listing gameplay entities, ask:

> "Comparing a screenshot of the captured gameplay with one of the playback, what would obviously differ besides
> what's already tracked?"

Commonly missed:

- **Vehicles** — traffic, parked, scripted.
- **Destructible props** — smashed containers, broken windows.
- **Environmental state** — lights, alarms, shutters.
- **Placed equipment** — deployables, mines, turrets.

Census each prominent type with at least its transform and `objectType` — enough for Pass 1 to recreate or match
it (`07 §3`) — even with no other gameplay state.

## How to apply

Walk the captured area: the street, walls and floors, visible environmental state. Then ask the human: *"Anything
else that would look wrong if missing?"* Record a disposition for every prominent type (`06 §9.6`).
