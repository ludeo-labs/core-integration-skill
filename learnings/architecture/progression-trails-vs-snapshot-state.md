---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "4,5"
question: "Does the game have progression-trail state — scripted milestones passed, objectives completed, mission props used, level-script event history, tutorial flags — that scripted systems react to as a sequence, rather than only snapshot state?"
sanitized: true
origin: "unreal:architecture/progression-trails-vs-snapshot-state"
---

# Progression trails are not snapshot state — capture the sequence, replay it through the game's own notifiers

**Precondition:** the game's scripted systems (level scripts, a mission director) respond to *what has happened*, not
to a single "current objective" value.

## The distinction

| Kind | Examples | Restore |
|---|---|---|
| **Snapshot state** | positions, health, equipped item, AI positions, current phase, inventory | capture current values; apply them |
| **Progression trail** | milestones passed, objectives completed, devices placed, cameras disabled, extraction zones activated, tutorial flags | capture the **time-ordered sequence**; replay it through the game's own notifiers, **before** the snapshot apply |

## Why snapshot restore fails on a trail

Restore `currentMilestone = 5` into a freshly loaded level and the level script doesn't know milestones 1–4 happened:
it starts from milestone 1. The briefing voice-over plays, setup-phase NPCs spawn, tutorial prompts appear mid-mission,
extraction zones re-arm. Suppression windows race, late sweeps of stray NPCs are fragile, and a one-off metadata value
is something the scripts never read.

## The diagnostic

For every subsystem found during code mapping, ask: *if I capture its current values at time T and restore them into a
fresh level, ignoring everything between, what breaks?* Nothing → snapshot. Scripts re-run, stale voice-over,
early-phase spawns, tutorial prompts → **trail**.

## The pattern

**Capture (Creator Flow):** append each milestone event, in order, to an attribute on the world object as it happens.

**Restore:** feed the captured events, in order, to the game's own notifier (the function the mission director calls
when a milestone passes), with presentation-only side effects (voice-over, prompts) gated on `IsRestoring()`. Then
apply the snapshot on top. If the notifiers do frame-dependent work, run them where frames run, with
state-mutating systems suppressed (CR-010, "Freeze vs suppress"). Where a consumed/triggered flag is enough to stop a
moment from re-firing, restoring that flag is the simpler path (`07 §11.3`).

## A trail is load-bearing

If the restored moment is visibly wrong without it, the trail is a **load-bearing** type: it goes in the earliest
wave (`06 §1.5`), never in phase 8 enrichment. On one integration milestone tracking was deferred as "enrichment"; the
demo broke, suppression attempts "sometimes won", and a week of work was pulled back into the core restore.

## Red flags

"We'll add mission progression later." "The level script will figure it out on restore." "We can just suppress the
briefing." "Objectives are enrichment." "Too game-specific for now." Each one signals a trail misclassified as snapshot
or as enrichment.
