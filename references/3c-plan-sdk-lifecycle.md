# Phase 3 · Task 3 — Plan SDK Lifecycle

Creates a detailed SDK lifecycle implementation plan from the outputs of previous commands. This command does NOT search the game codebase - it reads from `SDK_INTEGRATION_POINTS.json` and `CODE_MAP.json` produced by `phase 2` and `phase 3 · task 1`.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 3 · task 3 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 3 · task 3** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## 📚 Context Files

**Action Required:** You must read the following files for SDK lifecycle implementation guidance. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules (async callbacks, tick requirements)
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle phases, LudeoManager requirement, callback flow
- `ludeo-integration-docs/01-AI-AGENT-GUIDE.md` - LudeoManager implementation steps and patterns
- **If `CODE_MAP.session_boundaries` has the sub-structure `{ model, start_sites[], exit_sites[], pause_overlay[] }`** (open-world / streaming / sandbox / state-machine-driven game with no per-level scenes), also read `ludeo-integration-docs/game-patterns/open-world.md`. This is the phase where the **OpenRoom bind point** is decided; without `open-world.md` the agent has no doctrine for picking among multiple start sites and will either pick wrong (binding to a state that fires too late or too often) or stall asking the integrator who doesn't know the SDK.

## Prerequisites

> ⚠️ **REQUIRED:** Run these phases first:
> 1. `phase 2` → produces `ludeo-integration-plan/CODE_MAP.json`
> 2. `phase 3 · task 1` → produces `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`
> 3. `phase 3 · task 2` → produces `ludeo-integration-plan/TDD_<GameName>.md`
>
> This phase reads those files. It does **NOT** analyze game code directly.
>
> **If no TDD exists:** Check for `ludeo-integration-plan/TDD_*.md`. If not found, prompt the user:
> > "No TDD found. Run `phase 3 · task 2` first to create one, or continue without?"

## Description

This command transforms the integration points found by `phase 3 · task 1` into a structured implementation plan that includes:

- **LudeoManager class design** (header, implementation, member variables, methods) - **REQUIRED**
- LudeoConfig.h creation (exact file path and content adapted to game's logging patterns)
- Hook points with exact locations (file:function:line) and integration code snippets
- Callback chain documentation (async callback flow)

The output is a detailed implementation plan that guides the actual code integration.

## Parameters

- `game_path`: Path to the game codebase directory (where `ludeo-integration-plan/` folder exists)

## What It Does

> **Note:** This command does NOT search the codebase. It reads existing files produced by previous commands.

1. **Read Input Files:**
   - `ludeo-integration-plan/CODE_MAP.json` (from `phase 2`)
   - `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (from `phase 3 · task 1`)
   - `ludeo-integration-plan/TDD_*.md` (from `phase 3 · task 2`, if exists) — use its risk assessment and concept mapping to inform the plan

2. **Planning Phase:** Transforms the integration points into a detailed implementation plan:
   - **LudeoManager class design** with 🎮 hook methods and 📞 callback handlers
   - LudeoConfig.h structure adapted to game's logging system
   - Exact hook point locations with code snippets (for 🎮 operations only)
   - Callback chain documentation for async operations (📞 flow)

## Input/Output

All files are read from and written to the `ludeo-integration-plan/` folder in the game's root directory.

**Inputs (REQUIRED - from previous phases):**
- `ludeo-integration-plan/CODE_MAP.json` - From `phase 2`
- `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` - From `phase 3 · task 1`
- `ludeo-integration-plan/TDD_*.md` - From `phase 3 · task 2` (if exists)

**Outputs:**
- `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md` - Detailed implementation guide including:
  - **LudeoManager class structure** (header and implementation) - singleton wrapper for all SDK operations
  - File paths and content for LudeoConfig.h
  - Integration code snippets for each hook point
  - Callback flow documentation

## Notes

- **This command does NOT search the codebase** - it reads from the outputs of previous commands
- The implementation plan follows LudeoManager wrapper pattern (game code calls wrapper methods, not raw SDK functions)
- All SDK code in the plan is wrapped in `#if LUDEO_SDK_ENABLED` for conditional compilation
- The plan covers SDK Lifecycle (initialization, session, tick, shutdown, room management, gameplay sessions) **and the registration + handler bodies for all session-lifetime notifications** (see below).
- The plan does NOT cover tracking (DataWriter usage) or the *restoration logic* inside the LudeoSelected handler (DataReader-driven spawning, two-pass, etc. — that's phase 5 · tasks 3–4). **It does** cover the LudeoSelected handler stub and *all* overlay-control notifications, because those are session-lifetime concerns, not restoration-specific.

### Critical Distinctions

**🎮 Game Code Integration Points** (plan includes exact locations from SDK_INTEGRATION_POINTS.json):
- Initialize, Activate, Tick, OpenRoom, EndGameplaySession (ALL exit paths), Shutdown

**📞 Callback-Driven Operations** (plan includes callback handler implementations inside LudeoManager):
- AddPlayer (from OnRoomOpenedCallback)
- BeginGameplaySession (from TryBeginGameplaySession helper)
- RemovePlayer (from OnGameplayEndedCallback)
- CloseRoom (from OnPlayerRemovedCallback)

**🔔 Session-lifetime notifications the plan MUST cover** (registered once at session creation; see `05-LIFECYCLE-MANAGEMENT.md` "Registering Notifications"):
- `LudeoSelected` — register + stub handler (full restoration logic lands in `phase 5 · task 3`–`phase 5 · task 4`)
- `RoomReady` — full handler (gameplay-session-start gate; also post-Ludeo-load resume per CR-010)
- `PauseGameRequest` — full handler: **freeze the simulation tick** (CR-011 — game must pause while the overlay is up)
- `ResumeGameRequest` — full handler: unfreeze the sim (CR-011)
- `BackToMenuRequest` — full handler: tear down current Ludeo gameplay session + room, navigate to main menu
- Optional: `MuteRequest` — mute game audio

> Omitting any of the required four overlay-control notifications causes the #1 mid-play failure: the game keeps running while the overlay covers it. Plan them now; `phase 3 · task 4` implements them; CR-011 enforces them.

## Related Phases

- `phase 2` - Creates structural code map (run FIRST)
- `phase 3 · task 1` - Finds integration points (run SECOND)
- `phase 3 · task 2` - Creates Technical Design Document (run THIRD)
- `phase 3 · task 4` - Implements the plan created by this phase

## Next Steps

After running this command:
1. Review the implementation plan (`ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md`)
2. Create `LudeoConfig.h` as specified in the plan
3. Create `LudeoManager` class (header and implementation) as specified
4. Integrate SDK lifecycle calls at the identified hook points
5. Implement callback handlers for async SDK operations
