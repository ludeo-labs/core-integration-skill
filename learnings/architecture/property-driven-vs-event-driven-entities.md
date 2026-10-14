---
category: architecture
tier: universal
sourceGame: ActionGame
phase: "4,5"
question: null
sanitized: true
origin: "unreal:architecture/bp-state-machine-vs-property-driven-init, unreal:architecture/pre-vs-post-beginplay-restore-timing"
---

# Entities restore in one of two ways — property-driven or event-driven; classify before designing the restore

## The two patterns

**Property-driven init.** The entity's init reads its fields and derives everything else from them; the fields *are*
the source of truth. Examples: a lock with `isLocked` (init enables interaction, picks the mesh, sets the outline); a
display case with `state ∈ {Closed, Lockdown, Cut, Broken}` (init picks the idle animation and collision).

**Event-driven state machine.** The current *mode* is reached through a sequence of events; fields are written as a
side effect of transitions but don't drive them. Examples: an arriving vehicle (fly in → land → open doors → accept
cargo); an NPC mid scripted sequence; an animation driven by a play-from-frame sequence, where restoring the flag that
*enables* it doesn't resume it at the captured progress.

## Why the timing matters

In the core order (`07 §2.1`) the apply lands **after** the game's native spawn and init have run. By then a
property-driven entity has already derived its visuals and collision from default values; writing the field changes
memory, not the derived state ("the field says unlocked, the case is still locked"). So even the easy pattern needs
the apply to **re-run the derivation** — the entity's own setter or apply-config path, or the reset → apply of
`07 §5.4` — not a bare field write. (A restore that writes fields *before* init avoids this, but that is not the core
order.)

An event-driven entity is harder: writing the final mode's fields skips the transitions. In one capture the door field
held "both open" and survived, yet the vehicle stayed in the sky with cargo acceptance off — the field was a symptom
of the mode, not its cause. Options, all costly:

1. Drive the game's own transitions — call its public setters in order to walk the state machine.
2. Place the entity in the sequence's **end state** directly (`07 §6`: an arrival is placed already arrived).
3. Capture and restore the full sub-object tree (transform, every sub-component's active flag, derived state).
4. Accept partial restoration and record it in `RESTORATION_PLAN.md`.

## How to tell them apart

Dump and diff the entity's state across the two situations
(`learnings/architecture/dump-and-diff-workflow-for-state-discovery.md`):

- **A few primary fields change** → property-driven. Capture those, re-derive on apply.
- **Many fields change across sub-components, activation flags and position** → event-driven. It is in a different
  *mode*, not holding a different value.

## How to apply

Most games have many property-driven entities and a few event-driven ones (set-piece vehicles, scripted NPCs,
mid-mission spawnables). Clear the property-driven set first; treat each event-driven entity as its own design
problem. When "X doesn't restore" comes in, ask first: does this state live in a field the entity re-reads, or in a
runtime state machine? A state-machine entity doesn't need a better field fix — it needs a different mechanism.
