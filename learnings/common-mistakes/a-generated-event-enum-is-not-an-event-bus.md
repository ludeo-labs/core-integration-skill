---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "6"
question: "Does the game have a data-driven progression / quest / achievement system with a generated enum of typed gameplay events (OnEnemyKill, OnPlayerDeath, OnLevelClear...) and a single Trigger/Raise/Dispatch function? Before planning the action map around it, find out WHO CALLS that function."
sanitized: true
origin: "unity:common-mistakes/a-generated-event-enum-is-not-an-event-bus"
---

# A generated event enum is not an event bus — check who raises it

**Precondition:** the game ships a generated enum of typed gameplay events funnelled through one dispatch function.

It looks like the perfect action map: 30-odd typed events with exactly the names phase 6 wants (`OnEnemyKill`,
`OnPlayerDeath`, `OnDungeonClear`) and one `TriggerEvent(type, target)` they all pass through. One `switch`, one
game-file edit, phase done.

In one integration that enum had **no gameplay callers at all**. Its three call sites were a **dialogue-script
command** (the interpreter for a `progress(type, target)` line written inside dialogue *content*), an **editor
tool**, and a data-driven component that raises it from a level object — **placed in no level**. The enum was
generated from the rules database, so it enumerates what a *designer can bind a rule to*, not what the code emits.
The rules still worked through a different path (stats accumulating into a condition store), so nothing looked
broken.

**The tell** is provenance: a `GENERATED_*` file or a "generated from database" header means its members are
*authorable* — a much weaker claim than *raised*. That the names match your action list exactly is the reason to
check, not the reason to trust.

## What to do instead

1. **Grep for callers of the dispatch function, not for the enum members.** Members appear in the declaration and
   the enum's own switches, which read like usage and are not.
2. **Separate real callers from content and tooling.** A script interpreter forwarding an authored command is
   content; editor tools don't ship.
3. **Find the game's own funnels:** the single hit-application path (usually already carrying a `killed` flag and the
   victim's boss/elite status), the player's death callback, the wave/encounter finish, the level-result function.
   Each is one call site and knows more than the generic event would.
4. **Correct any design doc that already committed to the enum** (`GAME_ACTIONS_MAP.md`, the TDD).

## The related trap it hides

The same enum tempts you to anchor **non-ludeoable brackets** on it (`OnDialogStart`/`OnDialogEnd`, `OnShopEnter`).
A `StartNoneLudeable` with no reachable `StopNoneLudeable` suppresses **the rest of the run**. If the enum is inert,
re-site every bracket onto a real open/close pair — or deliberately leave it unwired when the bracketed thing cannot
occur inside a captured session.
