---
category: architecture
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Does an entity's visible or derived state (mesh, effects, collision, interactability) change only when the game runs a transition — a state setter, a change event, or a network/save 'state received' handler — rather than being re-read from the field every frame?"
sanitized: true
origin: "unreal:architecture/onrep-based-restoration-pattern, unreal:architecture/onrep-invariants-must-be-preserved-by-restore, unreal:architecture/cold-spawned-actors-need-explicit-state-restore-for-cosmetics"
---

# A raw field write skips the cascade — apply through a game path that fires it

**Precondition:** the entity's visuals and derived state follow transitions, not the field itself — the usual shape
`SetState(new) → OnStateChanged(old, new) → show mesh, spawn effects, set collision`.

## Symptom

"Limbo" entities: the field says *Open* and the door is closed; *Destroyed* and the intact mesh is up; *Burning* and a
freshly spawned device is invisible. A Pass-1 spawn starts at its default state and no interaction ever happens on
the replay, so the change event never fires.

## The mechanism

Apply the value through a path that runs the transition — preferring, in this order (the full decision rule is
`learnings/common-mistakes/choose-the-restore-write-path-per-field.md`):

1. **The game's "state received" / initial-state handler**, if it has one — the code its netcode runs when a late
   joiner receives current values, or its save loader's apply step. Its authors wrote it for exactly "this state just
   arrived from elsewhere; sync up", it fires the cascade with the flags they chose for that case (usually without
   the live one-shots), and one mechanism covers every class that has such a handler, instead of a growing per-class
   adapter list. Setters often early-exit when the value already matches; these handlers usually don't.
2. **The entity's own state setter**, the one gameplay calls, with its one-shots suppressed on `IsRestoring()`
   (`learnings/common-mistakes/restore-through-the-initial-state-path-not-the-live-play-setter.md`). If it is private,
   add a public proxy gated on `LUDEO_SDK_ENABLED` that calls it. Don't write the field directly, and don't simulate
   the interaction (a fake "ignite" press double-fires its side effects).

## Caveats

- **Timing.** Handlers that touch the player, game state or other subsystems assume a running world — run them from
  `ApplyDeferred()` (`07 §6`), not the frozen apply, when they reach beyond the entity.
- **Double cascade.** If the entity's own init already re-derives from the field ("if state != default, call
  SetState"), firing the handler as well runs the cascade twice; one class crashed this way. Exclude such classes.
- **Invariants.** A replication handler assumes the network path's shapes: array lengths fixed at init, per-element
  references set up at init, only values changing. Replacing the array wholesale trips its asserts and destroys those
  references. Copy the mutable fields element by element, keep the references, and pass a **pre-edit copy** of the
  current value as the "old" argument — never `old == new` (the diff loop does nothing) and never a default-constructed
  old (every per-element comparison fails). Read the handler end to end first: every assert, every dereference of a
  member outside the payload, every use of `old`.
- **Some animations play only on live transitions.** Handlers that pass "initial state" flags may skip a swing
  animation; the state is right and the visual rests at its default. Accept it, or place the end state explicitly.
- **If the handler does too much**, write the values and invoke just the cosmetic subset yourself.
- **Field coverage.** The cascade restores only what you captured; state that lives in a destroyed child entity needs
  its own handling.

## Detection

For every captured type: does a setter or handler fire a change event that drives visuals? If yes, capture the state
and apply through it. If visuals are built at construction from fields, a plain apply is fine.
