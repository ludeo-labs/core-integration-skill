---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Does per-frame game logic keep running between the restored level finishing its load and the apply — because the restore holds only input there, or because the game's pause zeroes the time step but still runs per-frame updates — and is that window being treated as inert?"
sanitized: true
origin: "unity:common-mistakes/the-window-between-scene-load-and-apply-is-live-because-timescale-zero-does-not-stop-update"
---

# The window between level load and apply is live — a frozen clock stops timers, not per-frame checks

Applies when frames run between the restored level's load and the apply, whether under the input hold alone or a
pause that only zeroes the time step.

Every Player-Flow restore has this window: CR-010 step 4 reaches active gameplay with only the input hold on, then
step 5 freezes and applies. In between, the level is fully assembled, every entity's init has run, **the player is at
the authored spawn**, every counter is at its level-start value — and frames are running. Even where the game's pause
is used, many engines' pauses only zero the time step: physics and timers stop, per-frame update logic doesn't. What
happens depends on a distinction nobody writes down:

| A per-frame update that… | With a zero time step | Window hazard |
|---|---|---|
| advances a timer and acts when it crosses a threshold | inert — the timer never moves | none |
| waits on a game-clock delay | inert — never resumes | none here — but it resumes after the apply (`learnings/common-mistakes/the-restore-freeze-parks-the-levels-own-setup-and-it-resumes-on-top-of-you.md`) |
| tests a **distance / overlap / count** every frame, no timer | ⚠ **fires** | real |
| tests a **flag** every frame | ⚠ **fires** | real |

In the observed project:

- a world pickup compared squared distance to the player against a ~1 m radius with **no timer**, so a pickup
  authored near the spawn point was **collected during the window** — added to the inventory and destroyed before
  the apply wrote a row;
- an escort companion's update compared distance to the player and, on a hit, called the owner's collect method,
  which **appended to a collection and incremented a counter** — the collection the restore was about to rebuild
  already had an extra member.

Both silent. The input hold doesn't help (these are proximity-driven, not player-driven); the freeze doesn't help
where it only zeroes time; and the window can't be removed (the level must load before the apply).

## The fix: reset-then-rebuild, not append

The damage lands in **a collection or counter the apply writes anyway**, so make those applies window-proof:

1. **Clear the collection at the top of its apply, then rebuild it from the buckets** — including entries the game
   seeds in its own init (a follower line seeded with the player). Idempotent and window-proof; appending is
   neither (`07 §5.4`).
2. **Warn when the reset finds residue.** `count != 0` at the top of the apply is the only sign the window did
   something; without the log a spurious pickup is indistinguishable from one the capture held.
3. **Counters: write them from the snapshot**, never trust incremental side effects (`07 §11.2`).

Gating the two updates on `IsRestoring()` also works and is more correct, but it edits game files the restore
otherwise never touches. Price both and say which you chose.

## Audit it during planning (`phase 5 · task 2`)

For every per-frame update in the captured level ask: **does it advance a timer, or test a distance / flag?** Only
the second needs a row. Here ~12 components gave 4 findings: the two above; a win check comparing a restored
numerator to a level-derived denominator (a zero denominator would end the replay on frame 1 → preflight-assert it
before the apply); and a death check off a plain bool (normalize a captured "dead" flag, `07 §1.2`). The audit also
shows which attributes are authoritative: a platform that recomputes its position from a phase value each frame makes
the captured position a cross-check, not the placement authority.
