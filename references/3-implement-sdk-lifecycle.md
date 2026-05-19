# Implement SDK Lifecycle - Create Implementation Plan

Creates a detailed SDK lifecycle implementation plan from the outputs of previous commands. This command does NOT search the game codebase - it reads from `SDK_INTEGRATION_POINTS.json` and `CODE_MAP.json` produced by `phase 1` and `phase 2`.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 3 there."
- If this is a fresh conversation, proceed.

## 📚 Context Files

**Action Required:** You must read the following files for SDK lifecycle implementation guidance. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules (async callbacks, tick requirements)
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle phases, LudeoManager requirement, callback flow
- `ludeo-integration-docs/01-AI-AGENT-GUIDE.md` - LudeoManager implementation steps and patterns

## Prerequisites

> ⚠️ **REQUIRED:** Run these commands first:
> 1. `phase 1` → produces `ludeo-integration-plan/CODE_MAP.json`
> 2. `phase 2` → produces `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`
>
> This command reads those files. It does **NOT** analyze game code directly.

## Description

This command transforms the integration points found by `phase 2` into a structured implementation plan that includes:

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
   - `ludeo-integration-plan/CODE_MAP.json` (from `phase 1`)
   - `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` (from `phase 2`)

2. **Planning Phase:** Transforms the integration points into a detailed implementation plan:
   - **LudeoManager class design** with 🎮 hook methods and 📞 callback handlers
   - LudeoConfig.h structure adapted to game's logging system
   - Exact hook point locations with code snippets (for 🎮 operations only)
   - Callback chain documentation for async operations (📞 flow)

## Input/Output

All files are read from and written to the `ludeo-integration-plan/` folder in the game's root directory.

**Inputs (REQUIRED - from previous commands):**
- `ludeo-integration-plan/CODE_MAP.json` - From `phase 1`
- `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` - From `phase 2`

**Outputs:**
- `ludeo-integration-plan/PHASE0_PLAN_<GameName>.md` - Detailed implementation guide including:
  - **LudeoManager class structure** (header and implementation) - singleton wrapper for all SDK operations
  - File paths and content for LudeoConfig.h
  - Integration code snippets for each hook point
  - Callback flow documentation

## Notes

- **This command does NOT search the codebase** - it reads from the outputs of previous commands
- The implementation plan follows LudeoManager wrapper pattern (game code calls wrapper methods, not raw SDK functions)
- All SDK code in the plan is wrapped in `#if LUDEO_SDK_ENABLED` for conditional compilation
- The plan covers ONLY SDK Lifecycle (initialization, session, tick, shutdown, room management, gameplay sessions)
- The plan does NOT cover tracking (DataWriter usage) or restoration (DataReader, LudeoSelected)

### Critical Distinctions

**🎮 Game Code Integration Points** (plan includes exact locations from SDK_INTEGRATION_POINTS.json):
- Initialize, Activate, Tick, OpenRoom, EndGameplaySession (ALL exit paths), Shutdown

**📞 Callback-Driven Operations** (plan includes callback handler implementations inside LudeoManager):
- AddPlayer (from OnRoomOpenedCallback)
- BeginGameplaySession (from TryBeginGameplaySession helper)
- RemovePlayer (from OnGameplayEndedCallback)
- CloseRoom (from OnPlayerRemovedCallback)

## Related Phases

- `phase 1` - Creates structural code map (run FIRST)
- `phase 2` - Finds integration points (run SECOND)
- `phase 4` - Implements the plan created by this command

## Next Steps

After running this command:
1. Review the implementation plan (`ludeo-integration-plan/PHASE0_PLAN_<GameName>.md`)
2. Create `LudeoConfig.h` as specified in the plan
3. Create `LudeoManager` class (header and implementation) as specified
4. Integrate SDK lifecycle calls at the identified hook points
5. Implement callback handlers for async SDK operations
