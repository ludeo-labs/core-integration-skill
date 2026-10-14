---
category: architecture
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:architecture/dont-pause-during-async-load-waits, unreal:architecture/player-flow-state-settle-requires-unpause, unreal:architecture/pause-before-player-flow-room"
---

# Anything the restore waits on needs frames — hold input, don't freeze, and settle until the state reports done

## The failure

Freezing the simulation stops the tick that pumps async asset loads, level streaming, attribute and ability systems,
animation graphs, physics and the game's "next frame" callbacks. A wait started under a freeze never completes; a
safety timeout eventually proceeds with the work undone.

Evidence from one integration: with the game frozen during a loadout wait, the log showed "waiting for loadout" at
T+0 and "timeout after 5 s, proceeding anyway" at T+5 — every time. With the game running and only input held, the
loadout signal arrived within about a second.

Applied state behaves the same way. Values written while frozen — an equipped item, a mode toggle, a health attribute
— don't propagate until frames run: change handlers, animation transitions and attribute processing are all
tick-driven. Begin from there and the first seconds show default stance, wrong weapon, mode off.

## The rule in the core order

CR-010 ("Freeze vs suppress") encodes it:

- **Waits run unfrozen with the input hold on.** Reaching active gameplay (`07 §2.1` step 4) — level load, streaming,
  loadout — runs with time running and `SetInputHold(true)`, never under the restoration freeze.
- **The apply itself is synchronous and frozen**, then the **settle** runs frames: `ApplyDeferred()` on its first tick
  (`07 §6`), then frames until the state has taken.
- **Settle until the game confirms, bounded.** Where the game exposes a query — the restored mode reports active, the
  equipped slot matches the capture — poll it during the settle instead of trusting a fixed frame count; keep the
  ~0.5 s floor and a timeout. Then freeze → `OpenRoom`.

## What must keep running under the freeze

The freeze stops the *simulation*, not the integration. `ludeo_Tick()` (CR-005), `LudeoManager`'s update and its
operation queue must be driven from the outer frame loop, outside any system the freeze stops — otherwise
`OpenRoom` / `AddPlayer` / `RoomReady` never complete while the moment is held. Restore timeouts and settle counters
belong there too: a timer on the simulation clock never fires while frozen.

## How to apply

Before freezing around any restore step, ask: does anything I am waiting for depend on the game ticking? If yes, run it
unfrozen with input held and suppress the systems that would overwrite the snapshot (`IsRestoring()`), then freeze
when it is done.

See also `learnings/architecture/hold-input-without-freezing-during-ticking-waits.md`.
