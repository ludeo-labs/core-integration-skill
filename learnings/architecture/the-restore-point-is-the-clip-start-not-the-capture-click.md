---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
origin: "unity:architecture/the-restore-point-is-the-clip-start-not-the-capture-click"
---

# The restore point is the clip START, not the capture click

When a creator marks a moment, the clip covers a fixed window that **ends** at the click (60 seconds in the observed
configuration). The platform builds the restorable state **at the start of that window**: base state plus the captured
event stream cut at the clip's start. Objects whose first write comes after the cut are absent; objects whose
destroy precedes the cut are removed.

## Why it matters

A creator who marks a moment shortly after a fight begins produces a Ludeo whose restore point **predates the fight**.
The restore correctly puts back zero enemies — there were none at clip start — and the fight is expected to happen
during forward play, driven by the game's own triggers. That is faithful behaviour, not a capture or restore defect.

Observed: a moment marked ~60 s after entering a combat room restored 49 world objects and **zero** enemies, because
the first enemy's first attribute write landed 12 s after clip start. A sibling moment marked a minute later carried
49 enemy objects plus 22 deletions. Both were right for their clip-start instants. A prior session had blamed the
empty restore on "the capture ended in the player's death" — wrong; where the capture **ends** is irrelevant to what
the moment restores.

## Consequences for the integration

- **Restore must tolerate a pre-event state.** Anything the game populates via triggers (encounter waves, scripted
  sequences) may be captured *not yet started*. Distinguish "in progress — put it back" from "not yet triggered —
  leave it alone so the game runs it forward": capture the encounter's state, not just its entities
  (`learnings/architecture/capture-the-state-machine-not-its-derived-booleans.md`, `07 §11.1`).
- **Mark test moments late enough.** To verify entity restore, the entities must exist at clip start — mark the moment
  after the fight has run longer than the clip length.
- **"Zero restored" is diagnosable from data.** The platform keeps, per highlight, the built state snapshot, the event
  stream and a deleted-objects list. Reading the snapshot answers "was it captured?" in one step and splits
  capture-side from restore-side bugs. Ask the Ludeo platform team for the highlight's files before hunting a restore
  bug the data may already exonerate.
