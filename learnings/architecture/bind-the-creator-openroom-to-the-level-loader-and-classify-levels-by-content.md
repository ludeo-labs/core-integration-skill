---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "In a level-based game, are you binding the Creator OpenRoom to a named game entry (a level-select handler, a 'new game' button) or deciding 'is this a gameplay level' from a level index list — and have you accounted for the developer's direct-launch-into-a-level path, which bypasses every menu entry?"
sanitized: true
origin: "unity:architecture/bind-openroom-to-sceneloaded-plus-manager-presence-not-a-named-entry"
---

# Bind the Creator `OpenRoom` to the level loader, and classify levels by what they contain — not by name, entry point or index

**Precondition:** a level-based game with several paths into gameplay (menu, level select, continue, retry,
debug launch).

Phase 3 (`3a`) asks for the one point every path into gameplay converges on. In a level-based game that point is
not a menu handler — it is **the level loader**. In the source integration six game paths reached gameplay and a
named-entry bind covered all six; the seventh — launching straight into a level, the loop the integrator used
dozens of times a day — ran no menu code at all. Only a loader-level hook covers it.

## Classify by content, not by index or name

The hook must decide "is this a gameplay level?". A hard-coded index list is brittle: in the source project three
level entries had been removed from the shipped level list, so the indices the game's own loader used no longer
matched anything, and would shift again when restored. The semantic test is **the presence of the per-level
gameplay manager** (or the level descriptor's own "gameplay" type) — that object exists only where gameplay exists,
and the test survives levels being added, removed or reordered. Once indices are known to be unreliable, stop using
them everywhere: load the menu by name and record the restore target as a stable level key.

Respect the timing in `05 §6.2` / CR-009: `OpenRoom` goes out when the level **starts loading**. If your content
test needs the loaded level, classify from the level's descriptor or manifest at load start; use the load-complete
callback only for the per-level installs below. *(The source engine bound the open itself after load; the core
timing rule wins here.)*

## The load-complete callback is the per-level install point

Use the hook that runs **after the level's objects exist and before their first tick**. In many engines that is the
load-complete callback — but verify the ordering in this engine (log both the callback and the first entity tick):
if load-complete fires after the first tick, install from the level-load / entity-spawn path instead, or the input
hold below is taken too late. From that one place, with no game edit:

- subscribe to the per-level manager's win/finish event for the `End` hook (check it fires from exactly one
  one-shot site), and unsubscribe from the previous level's manager — a long-lived `LudeoManager` otherwise
  accumulates subscriptions to destroyed objects;
- re-acquire any per-level aggregator the span machine reads
  (`learnings/architecture/non-ludeoable-spans-as-a-state-machine-not-paired-calls.md`);
- take the per-run input hold before the level's own start code hands the player control.

## Make the open idempotent

The guarded "try open Creator room" ends up called from several places (the loader hook, the idle state's start
trigger per `LAUNCH-AND-READINESS.md` §3, a teardown-completed continuation). Guard it on all of: `IsRestoring()` / Player Flow
(the restore opens its own room), session active, room already open **or open in flight**, and gameplay already
begun.

Related: `learnings/common-mistakes/scope-lifecycle-hooks-to-gameplay-levels-only.md` (what an unfiltered hook does on
menu levels), `learnings/architecture/classify-gameplay-levels-by-gameplay-infrastructure.md` (a rules-class default
leaking into non-gameplay levels).
