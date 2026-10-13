# 01-AI-AGENT-GUIDE.md - How AI Agents Should Use This Documentation

> **For:** AI agents performing Ludeo SDK integration  
> **Purpose:** Integration strategy, workflow guidance, and best practices  
> **Read Time:** 10 minutes

**Last Updated:** December 2025

---

## 📋 **Table of Contents**

1. [Overview: Your Role](#overview-your-role)
2. [User-Pending Integration Model](#user-pending-integration-model)
3. [The Integration Workflow](#the-integration-workflow)
4. [Context Management Strategy](#context-management-strategy)
5. [Research-First Approach](#research-first-approach)
6. [Decision Framework](#decision-framework)
7. [Code Generation Principles](#code-generation-principles) *(brief - see 03-SDK-FUNDAMENTALS for details)*
8. [Common Pitfalls to Avoid](#common-pitfalls-to-avoid) *(workflow pitfalls only)*
9. [Checkpoints and Validation](#checkpoints-and-validation)
10. [When to Ask for Help](#when-to-ask-for-help)

---

## 1. Overview: Your Role

### What You're Doing
You are integrating the **Ludeo SDK** into a game to enable:
- **Capturing** gameplay state (tracking)
- **Storing** gameplay moments (Ludeos)
- **Restoring** gameplay state (playback)
- **Recording** gameplay actions for objectives/scoring

### Success Criteria
A successful integration means:
- ✅ Game compiles with SDK enabled AND disabled
- ✅ Players can capture gameplay moments
- ✅ Players can play back captured moments
- ✅ Game remains stable with SDK errors (graceful degradation)
- ✅ Actions enable objectives and scoring

### Your Constraints
- **Minimal intrusion:** Game code should work without SDK
- **Macro-based:** All SDK code behind `#if LUDEO_SDK_ENABLED`
- **No crashes:** SDK errors log warnings, never crash game
- **Complete capture:** Track ALL gameplay-affecting state

---

## 2. User-Pending Integration Model

### Integration Philosophy

This integration follows a **user-pending, step-by-step** approach:
- **Agent proposes** specific changes with preview/diff
- **User confirms** before agent executes (or user implements manually)
- **Each step** is a separate propose-confirm-execute cycle

### The Propose → Confirm → Execute Cycle

```
1. AGENT: Analyzes codebase + context → Proposes change → Shows preview/diff
2. USER: Confirms OR requests modification OR implements manually
3. AGENT: Executes (if confirmed) OR adjusts proposal → Moves to next step
```

### Agent Responsibilities

**Before proposing:** Load relevant docs, analyze codebase, identify integration points, prepare complete working code.

**When proposing:** Explain WHAT/WHY, show WHERE (file paths/line numbers), provide full preview/diff, highlight assumptions.

**Proposal format:**
```
Step X.Y: [Action]

File: [path] (new/modified)
Purpose: [brief description]
Changes: [bullet list]
Preview: [complete file/diff]
Should I proceed?
```

### User Options

1. ✅ **Approve** - Agent creates/modifies automatically
2. ✏️ **Modify** - User provides feedback, agent revises
3. 🔧 **Manual** - User implements themselves
4. ⏭️ **Skip** - Skip step (not recommended)
5. ❌ **Stop** - Pause to reassess

### Phase Structure

Each major phase is broken into **minute steps** (5-30+ per phase). Each step requires separate user confirmation.

---

## 3. The Integration Workflow

### Stage 0: Preparation (Before Writing Code)

**Load these files:**
- `00-CRITICAL-REQUIREMENTS.md` (always in context)
- `02-RESEARCH-TEMPLATE.md` (complete the questionnaire)

**Your tasks:**
1. **Analyze the game architecture**
   - Identify game loop, initialization, shutdown
   - Find state machines, managers, singletons
   - Document threading model
   
2. **Inventory all game objects**
   - List every object type that affects gameplay
   - Document their properties and relationships
   - Identify creation/destruction patterns

3. **Identify gameplay actions**
   - What are the exciting moments? (kills, pickups, objectives)
   - What events should trigger actions?
   - What actions would make good objectives?

4. **Map game flow**
   - How does game initialize?
   - How do levels/scenes load?
   - When does gameplay actually begin?
   - How does gameplay end?
   - How can LudeoSelected interrupt any state?

5. **Find integration points**
   - Where to initialize SDK?
   - Where to activate Ludeo Session?
   - Where to open/close Rooms?
   - Where to begin/end GameplaySession?

**Output:** Completed research document (save as `GAME_ANALYSIS.md`)

**Validation Checkpoint:**
- [ ] I can explain the game's architecture
- [ ] I have a complete object inventory
- [ ] I know all gameplay actions
- [ ] I've identified all integration points
- [ ] I understand game flow and state management

---

### Stage 0 Continued: Build System Setup

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `04-BUILD-INTEGRATION.md`, `03-SDK-FUNDAMENTALS.md` (reference)

> **Note:** Each step below requires user confirmation. Agent proposes → shows preview/diff → user confirms → agent executes.

#### Step 0.1: Verify Prerequisites
Analyze and report: SDK location, build system (CMake/VS/Makefile), main config file, target name.

#### Step 0.2: Create Ludeo Directory Structure
Create `src/core/ludeo/` (or game-appropriate path). Verify SDK in `external/ludeo/LudeoCoreSDK_X_X_X/`.

#### Step 0.3: Create LudeoConfig.h
Generate `src/core/ludeo/LudeoConfig.h` with `LUDEO_SDK_ENABLED` macro, helper macros (`LUDEO_CODE`, `LUDEO_INCLUDE`), fallback types, logging macros adapted to game's system. (~150-200 lines)

#### Step 0.4: Add SDK Option to Build System
Modify build config (CMake example): Add `option(LUDEO_SDK_ENABLED ...)`, set SDK version/paths, platform-specific config, path verification. (~50 lines added)

#### Step 0.5: Configure Target with SDK
Link SDK: `target_compile_definitions`, `target_include_directories`, `target_link_libraries`, post-build DLL/SO copy. (~30 lines)

#### Step 0.6: Test Compilation (SDK Enabled)
Build command: `cmake .. -DLUDEO_SDK_ENABLED=ON`. Verify success.

#### Step 0.7: Test Compilation (SDK Disabled)
Build command: `cmake .. -DLUDEO_SDK_ENABLED=OFF`. Verify success.

---

**Stage 0 Complete When:**
- [ ] All 7 steps completed and confirmed
- [ ] Project compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Project compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No linker errors
- [ ] SDK DLLs copied to output directory

---

### Phase 1: SDK Lifecycle (23 Steps)

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `05-LIFECYCLE-MANAGEMENT.md`, `03-SDK-FUNDAMENTALS.md` (reference)

> **Note:** Each step requires user confirmation. See [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) for detailed implementation patterns.

#### Steps 1.1-1.7: Core SDK Lifecycle
- **1.1:** Analyze game entry points (init, loop, shutdown, singleton pattern)
- **1.2:** Create `LudeoManager.h` with singleton, handles, lifecycle methods, callbacks (~150-200 lines)
- **1.3:** Implement `Initialize()` - `ludeo_Initialize()`, `ludeo_Session_Create()`, error handling (~60-80 lines)
- **1.4:** Implement `ActivateSession()` - params setup, window handle, API key, callback (~80-100 lines)
- **1.5:** Implement `Tick()` - `ludeo_Tick()`, guards, error handling (~15-20 lines)
- **1.6:** Implement `Shutdown()` - release handles, `ludeo_Shutdown()`, cleanup (~30-40 lines)
- **1.7:** Register LudeoSelected notification - callback, notification ID storage (~50-60 lines)

#### Steps 1.8-1.11: Hook into Game Lifecycle
- **1.8:** Hook `Initialize()` into game init - include guard, call, logging
- **1.9:** Hook `ActivateSession()` into game init (after Initialize, **after window/graphics init** - window handle required)
- **1.10:** Hook `Tick()` into game loop - ensure called every frame
- **1.11:** Hook `Shutdown()` into game cleanup - before final cleanup

#### Step 1.12: Test SDK Initialization
Build and run. Verify logs: SDK initialized, session created, session activated (callback), no errors, game runs normally.

#### Steps 1.13-1.19: Gameplay Session Management
- **1.13:** Analyze game flow - level load/unload, gameplay start/end, document flow
- **1.14:** Add gameplay session members to `LudeoManager.h` - room, gameplay session, DataWriter, player handles, active flag (~12 lines)
- **1.15:** Implement `OpenRoom()` - params, callback, store handles (~70-90 lines)
- **1.16:** Implement `AddPlayer()` - params, callback, store GameplaySession handle (~60-80 lines)
- **1.17:** Implement `BeginGameplaySession()` - params, callback, set active flag (~50-60 lines)
- **1.18:** Implement `EndGameplaySession()` - callback, clear active flag (~40-50 lines)
- **1.19:** Implement `CloseRoom()` - callback, clear handles (~40-50 lines)

#### Steps 1.20-1.22: Hook into Game Flow
- **1.20:** Hook `OpenRoom()` into level load start - guard, call with level ID, logging
- **1.21:** Hook callback chain - `OnRoomOpenedCallback()` calls `AddPlayer()`, `OnPlayerAddedCallback()` + `OnRoomReadyCallback()` both call `TryBeginGameplaySession()` (checks BOTH conditions), **CRITICAL:** only begin when player added AND RoomReady received
- **1.22:** Hook cleanup chain - gameplay end calls `EndGameplaySession()`, callback calls `RemovePlayer()`, callback calls `CloseRoom()`, ensure proper sequencing

#### Step 1.23: Test Gameplay Session Flow
Build and run. Load level. Verify logs in order: room opening, room opened (DataWriter obtained), adding player, player added (GameplaySession obtained), beginning session, session begun. End gameplay. Verify cleanup logs: ending session, session ended, removing player, player removed, closing room, room closed. No errors.

---

**Phase 1 Complete When:**
- [ ] All 23 steps completed and confirmed
- [ ] SDK initializes without errors
- [ ] Ludeo Session activates (verified in logs)
- [ ] Tick runs every frame (can add counter log every 60 frames)
- [ ] Room opens when level loads (verified in logs)
- [ ] Player added successfully (verified in logs)
- [ ] GameplaySession begins when gameplay starts (verified in logs)
- [ ] GameplaySession ends when gameplay ends (verified in logs)
- [ ] Player removed successfully (verified in logs)
- [ ] Room closes properly (verified in logs)
- [ ] SDK shuts down cleanly (verified in logs)
- [ ] No SDK errors in any logs

---

### Phase 2: Code Patterns and Macros

> **Note:** Each macro and helper requires separate proposal and user confirmation.

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `06-TRACKING-PATTERNS.md`, `03-SDK-FUNDAMENTALS.md` (reference)

**Tasks:** Create `LudeoCaptureMacros.h` with RAII ObjectScope helper, type-safe capture functions, capture macros (`LUDEO_CAPTURE_FLOAT`, etc.), action macro (`LUDEO_ACTION`). Test macros compile to no-op when SDK disabled.

**Validation:** Macros compile enabled/disabled, RAII ensures cleanup, type-safe functions work.

---

### Phase 3: Object Tracking

> **Note:** Each object type requires separate tracking implementation with user confirmation. Expect 20-30+ individual propose-confirm cycles.

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `06-TRACKING-PATTERNS.md` (reference)

**Tasks:** Add `LudeoObjectId` to objects, implement `RegisterWithLudeo()`/`UnregisterFromLudeo()` per type, add capture macros to property setters, track environment metadata, implement ID mapping, register objects on gameplay start, identify/implement actions, add `LUDEO_ACTION` calls, implement pause/resume tracking (local capture hygiene), emit enter/exit boundary actions for non-ludeoable areas (06 §7.3 — backend-controlled, tracking keeps running).

**Code modifications:** Every game object class, object managers, property setters, game events, pause/cutscene handlers.

**Validation:** All objects register, properties tracked, environment tracked, actions fire, tracking pauses correctly, StartNoneLudeable/StopNoneLudeable fire at non-ludeoable areas (backend excludes those windows; tracking is not paused for them), every pause emits PauseLudeo/ResumeLudeo, destruction tracked, SDK logs show activity.

---

### Phase 4: State Restoration

> **Note:** Restoration logic is complex. Each restoration function requires careful review and confirmation.

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `07-RESTORATION-PATTERNS.md`, `06-TRACKING-PATTERNS.md` (reference)

**Tasks:** Create `LudeoStateAdapter` class, implement LudeoSelected handler, data fetch callback, two-pass restoration (Pass 1: create objects, Pass 2: restore properties), environment restoration, "wait for player" flow, player ready callback, handle LudeoSelected from any state, graceful interruption.

**Code:** `LudeoStateAdapter.h/cpp`, modify `LudeoManager` (restoration handlers), game state machine (LudeoSelected interrupts).

**Validation:** LudeoSelected received, DataReader obtained, correct level loads, objects restored (two-pass), properties match, environment restored, game pauses, player ready works, gameplay starts after input, works from any state.

---

### Phase 5: Testing and Validation

> **Note:** Testing is primarily user-driven. Agent assists with test setup and analysis.

**Load:** `00-CRITICAL-REQUIREMENTS.md`, `04-BUILD-INTEGRATION.md` (section 8), `12-SDK-API-REFERENCE.md` (reference)

**Tasks:** Run test checklists, verify SDK lifecycle, test tracking/actions/pause-resume/restoration/LudeoSelected/wait-for-player/error handling, review code against checklist.

**Validation:** All tests pass, checklist complete, logs match expected, no crashes/errors, graceful degradation works.

---

## 4. Context Management Strategy

**Always loaded:** `00-CRITICAL-REQUIREMENTS.md` (~15 KB)

**Load by phase:**
- Stage 0 (Prep): `02-RESEARCH-TEMPLATE.md`
- Stage 0 (Build): `04-BUILD-INTEGRATION.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 1: `05-LIFECYCLE-MANAGEMENT.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 2: `06-TRACKING-PATTERNS.md` + `03-SDK-FUNDAMENTALS.md`
- Phase 3: `06-TRACKING-PATTERNS.md`
- Phase 4: `07-RESTORATION-PATTERNS.md` + `06-TRACKING-PATTERNS.md`
- Phase 5: `04-BUILD-INTEGRATION.md` (section 8) + `12-SDK-API-REFERENCE.md`

**Maximum 3-4 files per phase.** Reload when moving phases, following cross-references, debugging, or validating. Drop when changing phases, context full, or no longer relevant.

---

## 5. Research-First Approach

**DON'T:** Jump straight to code generation  
**DO:** Complete research template first

**Why:** Avoids rework, identifies edge cases early, ensures complete tracking, finds best integration points, documents actions for objectives/scoring.

**How:**
1. **Read game code** - Start with entry point, follow initialization, map state machines, identify managers/singletons
2. **Search patterns:**
   - `"new ", "delete ", "Create", "Destroy", "Spawn"` → object creation/destruction
   - `"Update(", "Tick(", "Step("` → game loop
   - `"SetHealth", "SetPosition", "SetOwner"` → property setters
   - `"OnKilled", "OnDamage", "OnCollect", "OnComplete"` → action triggers
3. **Document** - Complete research template, create object/action inventory tables, diagram game flow, note threading model
4. **Identify gaps** - Missing data, unclear creation patterns, unclear relationships, potential missed actions

---

## 6. Decision Framework

### "Should I track this object?"
```
Is it visible to the player?
├─ Yes → Track it
└─ No → Does it affect gameplay?
    ├─ Yes → Track it
    └─ No → Skip it

Exception: UI elements generally not tracked unless they affect gameplay
```

### "Is this an action or continuous state?"
```
Does it happen once at a moment in time?
├─ Yes → It's an ACTION (use LUDEO_ACTION)
│   Examples: Kill, Pickup, Jump, Objective Complete
│
└─ No → It's CONTINUOUS STATE (use LUDEO_CAPTURE_*)
    Examples: Health, Position, Velocity, Rotation
```

### "Should tracking pause here?"
```
Is this a cutscene, a loading screen, or a true (sim-frozen) game pause?
├─ Yes → Is gameplay still simulating in the background?
│         ├─ Yes → Continue tracking
│         └─ No  → Pause tracking (local capture hygiene) + emit PauseLudeo / ResumeLudeo
│
└─ No → Is this a shop / NPC dialogue / tutorial / in-game menu / safe zone?
          ├─ Yes → Do NOT pause. It is a non-ludeoable AREA, not a tracking pause:
          │         keep tracking and emit StartNoneLudeable / StopNoneLudeable, connected to
          │         a Global Trigger on the platform (06 §7.3, phase 6).
          └─ No  → Continue tracking (player is actively playing).
```

### "Which restoration pass does this belong to?"
```
Does this object reference other objects?
├─ No → Pass 1 (creation)
│   Examples: Basic position, type, ID
│
└─ Yes → Pass 2 (properties)
    Examples: owner_id, parent_id, target_id, attachment_id
```

---

## 7. Code Generation Principles

### Macro-First Philosophy

**Always prefer macros over raw SDK calls in game code.**

```cpp
// ❌ Bad: Raw SDK calls scattered in game code
void Enemy::SetHealth(float health) {
    m_health = health;
#if LUDEO_SDK_ENABLED
    // ... 10 lines of SDK boilerplate ...
#endif
}

// ✅ Good: Clean macro
void Enemy::SetHealth(float health) {
    m_health = health;
    LUDEO_CAPTURE_FLOAT(this, "enemy", "health", health);
}
```

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Variables | `snake_case` | `m_ludeo_object_id`, `data_writer` |
| Functions | `PascalCase` | `RegisterWithLudeo()`, `BeginGameplay()` |
| Attributes | `snake_case` | `"health"`, `"position"`, `"owner_id"` |
| Object types | `snake_case` | `"player"`, `"enemy"`, `"projectile"` |
| Actions | `PascalCase` | `"Kill"`, `"Headshot"`, `"CollectCoin"` |

→ **For SDK patterns (error handling, callbacks, logging):** See [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md)

---

## 8. Common Pitfalls to Avoid

> **⚠️ All critical requirements are documented in [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)**

### Quick Checklist

| Pitfall | Quick Fix |
|---------|-----------|
| Missing `#if LUDEO_SDK_ENABLED` guards | All SDK code must be wrapped (CR-001) |
| Single-pass restoration | Use two passes: create objects, then properties (CR-006) |
| Missing `EndGameplaySession()` exit paths | Hook ALL gameplay exit paths (CR-007) |
| Ignoring async operation results | Wait for callbacks, don't treat as sync (CR-003) |
| Missing `LeaveObject()` calls | Always pair with `EnterObject()` - use RAII (CR-002) |
| **Calling AddPlayer from game code** | **AddPlayer called FROM OnRoomOpened callback only (CR-009)** |

### ❌ Common Mistake #1: Calling Async Operations Sequentially

**THE MISTAKE:** Treating callback chain as synchronous game code.

**Wrong:**
```cpp
void StartMap(const char* mapName) {
    ludeo_mgr.OpenRoom(mapName);      // Async - returns immediately
    ludeo_mgr.AddPlayer(playerId);    // ❌ WRONG! Room not open yet!
}
```

**Why This Fails:** `OpenRoom()` is async - returns before room opens. `AddPlayer()` requires open room. Callbacks haven't fired yet.

**Correct:**
```cpp
// Game code only calls OpenRoom
void StartMap(const char* mapName) {
    ludeo_mgr.OpenRoom(mapName);  // Triggers async operation
}

// SDK callback handler calls AddPlayer
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data) {
    if (data->resultCode == LudeoResult::Success) {
        m_room_handle = data->room;
        m_data_writer = data->dataWriter;
        AddPlayer(m_player_id);  // Called from HERE
    }
}
```

**The Rule:** 🎮 Game code calls `OpenRoom()` only. 📞 SDK callbacks call `AddPlayer()`, `BeginGameplaySession()`. Callbacks drive the flow.

→ **See:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) and [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md#6-gameplay-session-management) for details

---

## 9. Checkpoints and Validation

**After each phase:** Run validation checkpoint (see phase descriptions above).

**Before moving to next phase:** All checkpoints pass, code compiles (SDK enabled/disabled), logs show expected behavior.

**When stuck:** Load `11-TROUBLESHOOTING.md`, find error/symptom, follow diagnostic steps, load relevant implementation file if needed.

---

## 10. When to Ask for Help

**Ask for clarification when:**
1. **Game architecture unclear** - Can't find object creation, threading model unclear, complex state machine
2. **SDK behavior unexpected** - Callback never fires, return values fail, objects don't restore
3. **Integration point ambiguous** - When gameplay begins, track during loading?, what's non-ludeoable?
4. **Requirements conflict** - Game requires X but SDK requires Y, performance budget tight, threading incompatible

**Provide context:** Current phase, what you've tried, error messages/logs, relevant code snippets, expected vs actual behavior.

---

## 11. Success Indicators

**You're on track when:** Research template complete, all phase checkpoints pass, code compiles (SDK enabled/disabled), logs show expected lifecycle, objects register/track correctly, actions fire appropriately, restoration accurate, player can capture/play Ludeos, game stable with SDK errors.

**Final validation:** Capture Ludeo → exit to menu → play Ludeo → verify: correct level loads, all objects restored, environment restored, game pauses/wait for player, gameplay starts after input, actions work for objectives/scoring.

---

## 📚 Quick Reference Links

**Critical:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md), [00-INDEX.md](./00-INDEX.md)

**Phase-Specific:** [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md), [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md), [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md), [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md), [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md)

**Support:** [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md), [12-SDK-API-REFERENCE.md](./12-SDK-API-REFERENCE.md)

**Remember:** Research first, code second. Validate constantly. Ask for help when stuck. **Next Step:** Complete [02-RESEARCH-TEMPLATE.md](./02-RESEARCH-TEMPLATE.md) before writing any code.