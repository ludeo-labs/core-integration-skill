---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: "2,3"
question: null
sanitized: true
origin: "unreal:common-mistakes/dead-bridge-methods-verify-bp-callers"
---

# Verify every planned hook has a live caller in the curated slice

## The mistake (caught before it shipped)

Code mapping picked the game's well-named bridge methods as the lifecycle hooks: a "battle finished spawning"
callback for opening the room, and "mission complete: success / fail / surrender" methods for closing it. They
were public, clearly named and obviously *designed* as the hooks a scripting/content layer would call.

Verification showed **none of them fire in the curated slice**:

- The battle-ready callback's only caller was a spawn manager that isn't present in the curated quick-play
  levels. Those levels have their units pre-placed in the level data, so the spawn flow never runs there.
- The mission-end methods had **no callers anywhere**: designed, never wired.

Built on those hooks, the integration would have compiled, run, and silently never opened or closed a room. That
looks like an SDK problem ("room never opens") rather than an analysis mistake.

## The rule

A hook isn't a hook until you've verified its **whole firing path in the curated slice**:

1. **Who calls it?** Search C++ call sites, and also the places a C++ grep misses: script files, data-driven
   event tables, level/scene data and UI bindings that name the function as a string. Zero callers means dead
   code, however intentional it looks.
2. **Is the caller present in the slice?** A caller that exists as an asset or class but isn't placed in, or
   spawned for, the curated levels never runs.
3. **Treat an empty body as a red flag.** "Empty in C++, driven from script" often means "planned, never
   finished".
4. **Prove it at runtime.** One log line in the hook and one run through the slice settles it. Do this before
   building anything on top.

## What to use instead

When the designed bridge is dead, the live signal is usually on the systems that actually run in the slice: a
phase/state variable on the match manager, its notification, or the state change itself. See
`learnings/architecture/phase-variable-is-the-lifecycle-signal.md`.

**Cost comparison:** a few minutes of caller search, against a full build-and-run cycle plus a misattributed SDK
investigation.
