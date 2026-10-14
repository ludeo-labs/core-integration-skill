---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3,5"
question: "Does your restore or boot-straight path reach gameplay without going through the game's front end? Enumerate what the menus initialise — HUD, input-device binding, per-player widget lists, difficulty/mode state — because your path performs none of it, and in a Release build the menus may be the ONLY caller."
sanitized: true
origin: "unity:common-mistakes/a-path-that-skips-the-menus-skips-what-the-menus-initialise"
---

# A path that skips the menus skips the setup only the menus perform

**Precondition:** the restore (CR-010 step 4) or a direct-boot launch reaches gameplay without the front end.

On one integration the same root cause produced five separately-reported bugs; by the third, asking "what does a
menu normally initialise here?" was faster than debugging the symptom:

| Reported as | Actually |
|---|---|
| "the HUD is opaque white boxes" | HUD init runs from the map screen's level button only |
| "the game freezes, I can't move" | no input device bound to the player — the menus bind them |
| "the counter always shows 3" | the HUD sync iterated an empty per-player widget list |
| "the boss doesn't move or attack" | the level-entry branch that starts the boss was bypassed |
| wrong screen state on replay | menu-owned mode/language state never applied |

Dead input and a stale counter don't look like the same bug — hold "missing menu setup" as a first hypothesis.

## The dev-build fallback that hides it

Look for setup guarded on a development mode — a `#ifdef` or a game-mode check that runs the init from a start-up
hook as well as from the menu. In a development build the fallback covers everything; in the Release configuration
phase 7 ships, the menus become the **only** caller and every bug arrives at once. **Test the direct path in a
Release-configured build early**, and mirror the game's development branch exactly (here: HUD init, both
input-assignment calls, and a subsystem init the HUD expects first — in that order).

## Restoring a value is not refreshing the UI that shows it

1. **Sync order.** The game's "force sync the HUD" ran at level-loaded, *before* the apply, so counters showed
   pre-restore values over correct data. Run the sync after the apply — in `ApplyDeferred()` on the first settle
   tick — so the frozen moment behind the overlay already shows the right numbers.
2. **The sync can be a no-op.** It iterated a per-player widget list built only by the full HUD init, which this path
   never ran. A "refresh everything" call is only as good as the registration it walks.

Diagnose both with a log line reading the value **back** after the write
(`learnings/architecture/make-the-restore-verify-every-value-it-writes.md`): data-correct-but-display-stale and
write-didn't-stick look identical from outside. Related:
`learnings/common-mistakes/your-replay-branch-bypasses-the-rest-of-the-entry-switch.md`,
`learnings/architecture/boot-the-replay-through-the-games-own-entry-flow.md`.
