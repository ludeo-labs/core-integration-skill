---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Does the restore reconcile captured entities as match-or-spawn, enumerating 'live instances' from the game's own runtime registry — and does the level contain entities authored in but inactive until a trigger arms them (a boss, a gated encounter, an ambush)?"
sanitized: true
origin: "unity:common-mistakes/inactive-until-triggered-entities-are-a-third-restore-case"
---

# Inactive-until-triggered entities are a third restore case — and their late init needs the whole apply re-run

Applies when reconciliation (`07 §5`) sorts on the game's live registry and some entities are authored into the
level but switched on later by a trigger.

## The third bucket

An entity that joins the registry from its own activation / first-update hook is **in neither bucket** while it is
inactive: not a match candidate (not registered), not a spawn candidate (the level placed it). It silently drops out
of the replay, and the viewer has to walk back into the trigger and replay the intro — the moment the Ludeo existed
to skip. Census tell: the archetype counts `0` at level start and `1` once the player reaches it.

Sort on what you mean, not on registry membership: **in the live registry → match; in the level data but inactive →
activate, reset, apply; absent → spawn, or report a genuine absence** (`07 §5.4`). The level-restart reset often
re-arms the intro trigger and deactivates the entity itself — keep the reset and let the captured values (trigger
consumed, arena locked, entity active) land after it.

Resolve the instance from level data **including inactive objects**, and expect the key to be ambiguous: in the
observed level four instances shared the name — the real one plus three cutscene stand-ins. Accept only an instance
that is (1) off by its **own** switch and (2) has every owner/parent active. If two candidates pass, fail loud and
activate neither; restoring an encounter onto a cutscene prop is worse than not restoring it.

## Activation defers init — re-run the whole apply, never a hand-picked subset

Activating an entity often defers the init of **every component it owns** to a later tick — the same late-init
hazard as a spawn (`07 §6`). The first fix re-asserted the two fields found by reading the entity's own class. The
entity came back in the right phase with **full HP**: a sibling health component reset to max in its own init. A
curated list races every component someone adds and drifts from the capture schema with each wave.

- **Re-run the same idempotent per-entity apply**, in the same order, from the deferred queue (`ApplyDeferred()`),
  on a tick **after** the deferred init has actually run — check the frame counter moved; a same-tick re-assert runs
  before the clobber and changes nothing.
- Give the re-run a **scratch report** so restore counters don't double-count.
- **Probe one read whose result you know.** A `ludeo_DataReader_Get*` outside the entered object scope returns
  `false` silently, and every row no-ops.
- **De-duplicate registries** that both the reset and the late init appended to (`07 §11.2`).
- Watch for **debug-build-only init seeds** (a debug phase field applied in development builds) — they bite exactly
  in the build the acceptance test runs on.

## Write the latch before the value its threshold guards

A health setter fires its change notification **synchronously**; a handler like
`if (phase != Second && hp <= threshold) AdvancePhase();` sees phase still `First` and plays the transition you were
restoring past. Write the mode/phase/latch first and the game's own guard declines by itself. **Tell: a correct end
state preceded by a phantom transition.** Also check handlers wired in level data (live from load), overrides whose
latch never latches, and transitions that re-roll timers you just restored.

## Snap animated presentation after the last write

A health bar with a trailing ghost treats each restore write as damage; on a frozen clock the trail plays out the
instant the viewer gets control. Add a small `SnapToCurrent()` to the **widget** and call it after the last write
(including the deferred re-apply). Don't silence the change event — real logic subscribes to it (`07 §11.1`).

## Diagnostics: print applied-vs-previous

`life=191/280 (RE-ASSERTED over 280/280)` exposes a clobber; `life=280/280` hides it. And emit only causes you
checked — a "permanent-death divergence?" message for an entity whose progression flag was clear sent the
investigation the wrong way.
