# Ludeo SDK - Master Integration Plan

> **Purpose:** Comprehensive guidelines for integrating Ludeo SDK into any game. This document serves as a research framework and implementation guide for AI agents.
>
> **Version:** 2.0  
> **Last Updated:** December 2025  
> **Format:** AI Agent Research-Oriented

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pre-Integration Research](#2-pre-integration-research)
3. [SDK Fundamentals](#3-sdk-fundamentals)
4. [Directory and File Structure](#4-directory-and-file-structure)
5. [Build System Integration](#5-build-system-integration)
6. [SDK Initialization and Game Session](#6-sdk-initialization-and-game-session)
7. [Gameplay Session Management](#7-gameplay-session-management)
8. [Tracking Strategy](#8-tracking-strategy)
9. [Restoration Strategy](#9-restoration-strategy)
10. [Environment and Metadata Tracking](#10-environment-and-metadata-tracking)
11. [Threading Considerations](#11-threading-considerations)
12. [Common Integration Patterns](#12-common-integration-patterns)
13. [Game Screen and State Management](#13-game-screen-and-state-management)
14. [Save System Analysis](#14-save-system-analysis)
15. [Macro-Based Design Patterns](#15-macro-based-design-patterns)
16. [Testing Strategy](#16-testing-strategy)
17. [Code Review Checklist](#17-code-review-checklist)
18. [Quick Reference](#18-quick-reference)

---

## 1. Executive Summary

### What is Ludeo SDK?

Ludeo SDK enables games to create and share "playable moments" - game states that can be captured, shared, and replayed by other players. The SDK handles state tracking, storage, and restoration.

### Key Success Factor

**Macro-Based Conditional Compilation is MANDATORY:**

All Ludeo SDK integration code MUST be wrapped with conditional compilation macros. This is non-negotiable for two reasons:
1. **Easy exclusion** - SDK can be disabled for builds without Ludeo support
2. **Clean integration** - No SDK code pollutes the main codebase when disabled

```cpp
// REQUIRED: All SDK code must be wrapped
#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriter.h>
    // SDK code here
#endif

// REQUIRED: Use capture macros for tracking
LUDEO_CAPTURE_FLOAT(this, "entity", "health", newHealth);
```

The macro-based capture system (see [Section 15: Macro-Based Design Patterns](#15-macro-based-design-patterns)) provides:
- Type-safe attribute capture
- Automatic no-op when SDK disabled
- Thread-safe queuing where needed
- RAII-based context management

### Critical: Ludeo Actions

**Actions are essential for great Ludeo experiences.** Unlike continuous state tracking, Actions are discrete gameplay EVENTS that:
- Define exciting/meaningful moments (kills, pickups, objectives)
- Enable Ludeo objectives ("Get 3 headshots to win!")
- Enable Ludeo scoring (100 points per kill, +50 headshot bonus)
- Create engagement and replayability

**Every game integration MUST identify and implement key gameplay Actions.** See [Section 8.5: Ludeo Actions](#85-ludeo-actions-critical-for-experience).

```cpp
// Action macro usage - fires discrete events
LUDEO_ACTION("Kill");                         // Enemy killed
LUDEO_ACTION("Headshot");                     // Headshot bonus
LUDEO_ACTION("MultiKill");                     // Combo action
```

---

## 2. Pre-Integration Research

### 2.1 Game Analysis Research Questions

Before starting integration, the AI agent must investigate and document the following aspects of the target game:

#### Game Type and Architecture

```markdown
## Research Questions: Game Architecture

### Multiplayer Model
- [ ] Is this a single-player, multiplayer, or hybrid game?
- [ ] If multiplayer, what is the network architecture? (client-server, peer-to-peer, dedicated servers)
- [ ] Which machine is authoritative for game state?
- [ ] How is game state synchronized between clients?
- [ ] Which side performs tracking/restoration? (server-only, client-authoritative, both)
- [ ] Do we need per-player DataWriter/DataReader flows?

### Internal State Management
- [ ] Does the game use a state machine for game flow?
- [ ] What states exist? (Menu, Loading, Playing, Paused, GameOver, etc.)
- [ ] Where is the central game state stored?
- [ ] Is there a GameManager, GameController, or similar singleton?
- [ ] How does the game handle external launch parameters (deep links/LudeoSelected)?
- [ ] Where should LudeoSelected-triggered level loads be hooked?
```

#### Game Flow and Screen Transitions

```markdown
## Research Questions: Game Flow

### Screen/Scene Management
- [ ] What system manages screen/scene transitions? (Unity SceneManager, custom system, etc.)
- [ ] What functions control game state transitions?
- [ ] Where does the game initialize a new gameplay session?
- [ ] Where does gameplay actually begin (after loading completes)?
- [ ] Where does gameplay end?
- [ ] How does the game handle returning to main menu?

### Critical Functions to Find
- [ ] Game initialization function (where SDK should initialize)
- [ ] Level/scene load function (where GameSession activates)
- [ ] Gameplay start function (where GameplaySession begins)
- [ ] Gameplay end function (where GameplaySession ends)
- [ ] Game shutdown function (where SDK shuts down)
- [ ] Screen/scene transition handlers used when restoring from LudeoSelected

### LudeoSelected Handling
- [ ] What function handles external game launch requests?
- [ ] Can the game be started directly into gameplay? (deep linking)
- [ ] What parameters does the game accept for launching into specific content?
- [ ] What level/scene should be loaded for a given Ludeo ID?
- [ ] Where to hook restoration once the level is loaded?

### Ludeo Playback Flow (Critical!)

**IMPORTANT:** The `LudeoSelected` event can be triggered from the Ludeo Platform **AT ANY POINT IN TIME** - while in main menu, mid-gameplay, during loading, in cutscenes, etc. The game **MUST** be able to:
- Interrupt/abort whatever it's currently doing
- Clean up current state gracefully
- Restart from any point and load the selected Ludeo
- Be ready to play the Ludeo

- [ ] How can the game interrupt and restart from ANY state? (menu, gameplay, loading, cutscene)
- [ ] What cleanup is needed when aborting current activity?
- [ ] How to gracefully end current gameplay session if one is active?
- [ ] How can the game freeze the simulation at `LudeoSelected` and wait for player input? (the level loads on Play, not before — read-then-load, 07 §2)
- [ ] Does the game have a "ready to play" or "press to start" screen?
- [ ] Where is the game simulation paused/unpaused?
- [ ] How to integrate with SDK's "player ready" callback?
- [ ] What UI should be shown while waiting for player to start?

### Window / Platform Handles
- [ ] How to obtain the native game window handle per platform? (needed for video/overlay)
- [ ] Is there an engine API for this, or should the OS API be used?
```

#### Save/Load System Analysis

```markdown
## Research Questions: Save System

### Existence and Location
- [ ] Does the game have a save/load system?
- [ ] What files/classes implement save functionality?
- [ ] What serialization format is used? (Binary, JSON, XML, custom)

### Save System Insights
- [ ] What objects/properties does the save system persist?
- [ ] Does it use a multi-pass approach? (create objects, then restore properties)
- [ ] How are object references/relationships saved and restored?
- [ ] How are object IDs handled? (UniqueIDs, GUIDs, indices)

### Learning from Save System
- [ ] Can we reuse object creation functions for restoration?
- [ ] What is the minimal data needed to recreate each object type?
- [ ] How does the save system handle object relationships?
```

#### Complete Entity Inventory

```markdown
## Research Questions: Game Objects

### Full Entity List (Document ALL object types)

| Object Type | Description | Game Experience Impact | Persistence Required |
|-------------|-------------|----------------------|---------------------|
| [List every object type in the game] | | High/Medium/Low | Yes/No |

### Object Creation Patterns
- [ ] How are game objects created? (new, factory, pool, manager)
- [ ] Are there object managers or factories?
- [ ] What managers exist and what do they manage?
- [ ] Do managers hold state that affects gameplay?
- [ ] Is there an entity/object registry?
- [ ] How are object IDs generated? Are they stable/deterministic across sessions?
- [ ] Where should we map LudeoObjectId ↔ game object IDs?

### Object Lifecycle
- [ ] When are objects created relative to gameplay start?
- [ ] When are objects fully initialized? (constructor vs init function)
- [ ] How are objects destroyed?
- [ ] Is there object pooling?
```

#### Environment and World Capture

```markdown
## Research Questions: Environment

### Level/Scene Data
- [ ] How are levels/scenes represented?
- [ ] What data defines a level? (ID, name, path, configuration)
- [ ] Are levels loaded dynamically or pre-loaded?
- [ ] What level metadata is needed to restore the environment?

### Camera System
- [ ] How is the camera controlled?
- [ ] What camera properties exist? (position, rotation, FOV, target)
- [ ] Are there multiple cameras or camera modes?
- [ ] How is camera state persisted during gameplay?

### World State
- [ ] What defines the world/environment state?
- [ ] Are there environmental objects that change? (doors, switches, destructibles)
- [ ] Is there a day/night cycle or weather system?
- [ ] What rendering settings affect gameplay? (fog, visibility)
- [ ] How is audio/music state managed? (combat/calm tracks, positional audio, buses)
- [ ] Are there UI modes/overlays that affect gameplay experience and need restoring?

### Game Time
- [ ] How is game time tracked?
- [ ] Is there a pause system?
- [ ] How does time affect gameplay state?
```

#### Non-Ludeoable Areas and Pause/Resume

```markdown
## Research Questions: Non-Ludeoable Areas & Pause/Resume

### Non-Ludeoable Areas (backend-controlled — marked by boundary actions, see `06 §7.3`)
- [ ] Which in-gameplay segments should never become a Ludeo? (tutorials, shops/stalls, NPC dialogue, in-game menus, safe zones)
- [ ] What are the enter/exit hooks (file:function) for each? (so `/6`–`/7` can emit boundary actions)
- [ ] What enter/exit action names will mark each boundary? (e.g. `ShopEntered`/`ShopExited`)
- [ ] Note: these do NOT pause tracking — capture runs through them; main menu/lobby/loading sit outside any session so need nothing.

### Cutscenes
- [ ] Does the game have cutscenes or cinematics?
- [ ] How are cutscenes triggered and ended?
- [ ] What functions/events mark cutscene start/end?
- [ ] Should cutscenes pause Ludeo tracking or skip entirely?
- [ ] Are there in-game scripted sequences (not pre-rendered)?

### Pause/Resume Tracking
- [ ] What events cause gameplay to pause? (pause menu, phone call, alt-tab, etc.)
- [ ] How can we detect when gameplay is truly paused vs. UI overlay?
- [ ] Should Ludeo tracking pause during game pause?
- [ ] Are there "soft pauses" (slow-mo, dialogue) vs "hard pauses" (menu)?

### Implementation Hooks
- [ ] What function/callback fires when entering each non-ludeoable area? (→ emit the enter action)
- [ ] What function/callback fires when leaving it? (→ emit the exit action)
- [ ] One-time platform step: connect each enter/exit action to its global trigger on Ludeo's platform.
```

#### Ludeo Actions (Critical for Experience)

```markdown
## Research Questions: Ludeo Actions

### What are Ludeo Actions?
Actions are gameplay EVENTS that happen during the game. Unlike object state (which is continuous),
actions are discrete moments that:
- Define exciting/meaningful gameplay moments
- Can be used for Ludeo objectives ("Get 3 headshots")
- Can be used for Ludeo scoring ("10 points per kill")
- Create engagement and replayability

### Action Identification
- [ ] What are the key exciting moments in this game?
- [ ] What actions would players want to replay or challenge others with?
- [ ] What actions define skill or achievement?
- [ ] What actions are measurable/countable?

### Action Categories to Consider

#### Combat Actions
- [ ] Kill enemy (with details: weapon type, distance, enemy type)
- [ ] Headshot / critical hit
- [ ] Multi-kill / combo
- [ ] Revenge kill
- [ ] First blood
- [ ] Player death
- [ ] Take damage
- [ ] Deal damage

#### Movement Actions
- [ ] Jump / double jump
- [ ] Dash / dodge / roll
- [ ] Fall from height
- [ ] Enter vehicle
- [ ] Exit vehicle
- [ ] Teleport / fast travel

#### Interaction Actions
- [ ] Collect item / pickup (coins, health, ammo, etc.)
- [ ] Open door / chest / container
- [ ] Activate switch / lever
- [ ] Destroy object (crate, wall, etc.)
- [ ] Use ability / spell / skill
- [ ] Build / place structure

#### Progression Actions
- [ ] Complete objective
- [ ] Capture point / territory
- [ ] Level up / rank up
- [ ] Unlock achievement
- [ ] Purchase / upgrade
- [ ] Spawn unit / create entity

#### Social Actions (Multiplayer)
- [ ] Assist / support teammate
- [ ] Revive player
- [ ] Trade / give item
- [ ] Emote / taunt

### Action Implementation Hooks
- [ ] Where in the code do these actions occur?
- [ ] What functions/events fire when actions happen?
- [ ] What data is available at action time? (actor, target, position, weapon, etc.)
```

### Full Action Inventory Template

For each action identified, document:

```markdown
## Action: [ActionName]

| Property | Value |
|----------|-------|
| **Name** | e.g., "Kill" |
| **Description** | Player kills an enemy |
| **Trigger** | When enemy health reaches 0 from player damage |
| **Code Location** | e.g., `Enemy::OnDeath()` or `CombatManager::ProcessKill()` |
| **Parameters** | killer_id, victim_id, weapon_type, position, distance, is_headshot |
| **Objective Potential** | Yes - "Kill X enemies", "Get X headshots" |
| **Scoring Potential** | Yes - 100 points base, +50 headshot bonus |
```

### 2.2 Object Tracking Scope

**Default Approach:** Track ALL game objects that affect gameplay experience.

The goal is complete state capture. Document every object type and its attributes:

```markdown
## Object Tracking Inventory

For each object type discovered in 2.1, document:

### Object: [ObjectTypeName]
- **Purpose:** What role does this object play in gameplay?
- **Creation:** How/where is it created?
- **Destruction:** How/where is it destroyed?
- **Key Attributes:** List all properties that define this object's state
- **Relationships:** What other objects does it reference?
- **Update Frequency:** When do its properties change?
```

### 2.3 Attribute Documentation

For each object type, document all attributes:

```markdown
## Attribute Reference: [ObjectTypeName]

| Attribute | Type | Description | When Updated |
|-----------|------|-------------|--------------|
| position | Vec3Float | World position | On movement |
| health | Float | Current health | On damage/heal |
| owner_id | UInt64 | Owning player | On ownership change |
| ... | ... | ... | ... |
```

---

## 3. SDK Fundamentals

### 3.1 SDK API Pattern Overview

```cpp
// SDK uses C API with handles and callbacks
// All operations that touch the network are ASYNC

// Sync operations:
ludeo_Initialize()
ludeo_Shutdown()
ludeo_Tick()
ludeo_Session_Create()
ludeo_DataWriter_CreateObject()
ludeo_DataWriter_Set*()

// ASYNC operations (require callbacks):
ludeo_Session_Activate()        // Call when game loads
ludeo_Session_OpenRoom()        // Returns DataWriter
ludeo_Room_AddPlayer()          // Returns GameplaySession
ludeo_GameplaySession_Begin()   // When gameplay actually starts
ludeo_GameplaySession_End()
ludeo_Room_Close()
ludeo_Session_Release()
ludeo_Session_GetLudeo()        // Returns DataReader for restoration
```

### 3.2 Critical SDK Rules

#### ✅ DO:

```cpp
// 1. Use attribute NAMES (strings), not IDs
ludeo_DataWriter_SetFloat("health", health_value);

// 2. Use context stack properly
ludeo_DataWriter_SetCurrent(writer);
if (ludeo_DataWriter_EnterObject(objectId)) {
    ludeo_DataWriter_SetFloat("health", health);
    ludeo_DataWriter_LeaveObject();  // ALWAYS leave!
}

// 3. Check return values for all SDK operations
LudeoResult result = ludeo_DataReader_GetObjectsInfo(reader, &params, &objects_info);
if (result != LudeoResult::Success) {
    LogError("Failed to get objects info: %d", result);
    return;
}

// 4. Always check DataWriter operations too (CreateObject, Set*)
//    and log/continue gracefully if they fail.

// 5. Handle errors gracefully
if (result != LudeoResult::Success) {
    LogWarning("SDK error: %d", result);
    // Continue game execution - don't crash!
}

// 6. Always check if DataWriter/DataReader is valid
if (writer == nullptr) {
    return;  // Can't track without writer
}
```

#### ❌ DON'T:

```cpp
// 1. DON'T cache attribute IDs (API doesn't use them)
std::map<string, int> attributeIds;  // NOT NEEDED

// 2. DON'T treat async operations as sync
LudeoResult result = ludeo_Session_Activate(...);  // WRONG - needs callback!
if (result == Success) { ... }  // This won't work

// 3. DON'T ignore return values
ludeo_DataReader_GetFloat("health", &health);  // CHECK the return!
```

### 3.3 Data Type Mapping

| C++ Type | SDK Function | Usage Example |
|----------|-------------|---------------|
| `int32_t` | `SetInt32` | `ludeo_DataWriter_SetInt32("state", state_enum)` |
| `uint32_t` | `SetUInt32` | `ludeo_DataWriter_SetUInt32("blueprint_id", id)` |
| `uint64_t` | `SetUInt64` | `ludeo_DataWriter_SetUInt64("entity_id", uid)` |
| `float` | `SetFloat` | `ludeo_DataWriter_SetFloat("health", hp)` |
| `bool` | `SetBool` | `ludeo_DataWriter_SetBool("is_dead", LUDEO_TRUE)` |
| `Vec3` | `SetVec3Float` | `float pos[3]; ludeo_DataWriter_SetVec3Float("position", pos)` |
| `Vec4/Quat` | `SetVec4Float` | `float rot[4]; ludeo_DataWriter_SetVec4Float("rotation", rot)` |
| `string` | `SetString` | `ludeo_DataWriter_SetString("name", str)` |

---

## 4. Directory and File Structure

### 4.1 Recommended C++ Project Organization

```
<project_root>/
├── external/                           # Third-party dependencies
│   └── ludeo/                          # Ludeo SDK
│       └── LudeoCoreSDK_X_X_X/
│           ├── Include/
│           │   └── Ludeo/
│           │       ├── Init.h
│           │       ├── Session.h
│           │       ├── Room.h
│           │       ├── DataWriter.h
│           │       ├── DataReader.h
│           │       └── GameplaySession.h
│           ├── Lib/
│           │   └── <platform>/
│           │       ├── Debug/
│           │       └── Release/
│           └── Bin/
│               └── <platform>/
│                   ├── Debug/
│                   └── Release/
│
├── src/                                # Game source code
│   ├── core/                           # Core systems
│   │   └── ludeo/                      # Ludeo integration
│   │       ├── LudeoConfig.h           # Macro definitions
│   │       ├── LudeoManager.h          # Manager singleton header
│   │       ├── LudeoManager.cpp        # Manager implementation
│   │       ├── LudeoStateAdapter.h     # Restoration header
│   │       ├── LudeoStateAdapter.cpp   # Restoration implementation
│   │       └── LudeoCaptureMacros.h    # Tracking helper macros
│   │
│   ├── game/                           # Game-specific code
│   │   ├── entities/                   # Game objects
│   │   ├── managers/                   # Object managers
│   │   └── ...
│   │
│   └── main.cpp                        # Entry point
│
├── docs/                               # Documentation
│   └── ludeo/
│       ├── README.md                   # Integration overview
│       ├── WORK_PLAN.md                # Progress tracking
│       └── OBJECT_TRACKING.md          # Tracked objects reference
│
└── CMakeLists.txt                      # Build configuration
```

### 4.2 Files to Create

| File | Purpose |
|------|---------|
| `LudeoConfig.h` | Macro definitions, enable/disable flag |
| `LudeoManager.h/cpp` | Singleton managing SDK lifecycle |
| `LudeoStateAdapter.h/cpp` | State tracking and restoration |
| `LudeoCaptureMacros.h` | Type-safe capture macros |

### 4.3 Files to Modify

| File Type | Modifications |
|-----------|---------------|
| Build system | Add SDK paths, library linking |
| Game initialization | Add SDK Initialize/Shutdown |
| Game loop | Add SDK Tick call |
| Scene/Level loader | Add Session activation, Room/GameplaySession management |
| Game objects | Add tracking calls via macros |

---

## 5. Build System Integration

### 5.1 CMake Integration

```cmake
# Option to enable/disable Ludeo SDK
option(LUDEO_SDK_ENABLED "Enable Ludeo SDK integration" OFF)

if(LUDEO_SDK_ENABLED)
    # SDK path
    set(LUDEO_SDK_PATH "${CMAKE_SOURCE_DIR}/external/ludeo/LudeoCoreSDK_X_X_X")
    
    # Include directories
    include_directories("${LUDEO_SDK_PATH}/Include")
    
    # Platform-specific library configuration
    if(WIN32)
        if(CMAKE_BUILD_TYPE MATCHES "Debug|Development")
            set(LUDEO_LIB_PATH "${LUDEO_SDK_PATH}/Lib/Win64/Debug")
            set(LUDEO_DLL_PATH "${LUDEO_SDK_PATH}/Bin/Win64/Debug")
            set(LUDEO_LIB_NAME "LudeoSDK-Win64-Debug")
        else()
            set(LUDEO_LIB_PATH "${LUDEO_SDK_PATH}/Lib/Win64/Release")
            set(LUDEO_DLL_PATH "${LUDEO_SDK_PATH}/Bin/Win64/Release")
            set(LUDEO_LIB_NAME "LudeoSDK-Win64-Release")
        endif()
        
        link_directories("${LUDEO_LIB_PATH}")
        target_link_libraries(${PROJECT_NAME} ${LUDEO_LIB_NAME})
        
        # Copy DLL to output
        add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${LUDEO_DLL_PATH}/${LUDEO_LIB_NAME}.dll"
            "$<TARGET_FILE_DIR:${PROJECT_NAME}>")
    endif()
    
    # Compile definition
    add_definitions(-DLUDEO_SDK_ENABLED=1)
else()
    add_definitions(-DLUDEO_SDK_ENABLED=0)
endif()
```

### 5.2 Configuration Header

```cpp
// LudeoConfig.h
#pragma once

#ifndef LUDEO_SDK_ENABLED
#define LUDEO_SDK_ENABLED 0
#endif

#if LUDEO_SDK_ENABLED
    #define LUDEO_CODE(...) __VA_ARGS__
    #define LUDEO_INCLUDE(x) x
#else
    #define LUDEO_CODE(...)
    #define LUDEO_INCLUDE(x)
#endif

// Fallback types when SDK disabled
#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriterTypes.h>
#else
    using LudeoObjectId = uint64_t;
    #define LUDEO_INVALID_OBJECTID 0
#endif
```

---

## 6. SDK Initialization and Game Session

### 6.1 Lifecycle Overview

The SDK has two main lifecycle phases:

1. **Game Session** - Activated when the game loads, persists until game closes
2. **Gameplay Session** - Created for each gameplay instance (level, match, etc.)

```
┌─────────────────────────────────────────────────────────────────┐
│ GAME LIFECYCLE                                                  │
│                                                                 │
│  Game Launch ──► Initialize SDK ──► Create Session              │
│                                           │                     │
│                                           ▼                     │
│                                    Activate Session             │
│                                    (Game Session Active)        │
│                                           │                     │
│         ┌─────────────────────────────────┼──────────────────┐  │
│         │ GAMEPLAY LIFECYCLE (repeatable) │                  │  │
│         │                                 ▼                  │  │
│         │  Level Load ──► Open Room ──► Add Players          │  │
│         │                                 │                  │  │
│         │                                 ▼                  │  │
│         │           Gameplay Start ──► Begin GameplaySession │  │
│         │                                 │                  │  │
│         │           (TRACKING ACTIVE)     │                  │  │
│         │                                 ▼                  │  │
│         │           Gameplay End ──► End GameplaySession     │  │
│         │                                 │                  │  │
│         │                                 ▼                  │  │
│         │                           Close Room               │  │
│         └────────────────────────────────────────────────────┘  │
│                                           │                     │
│  Game Shutdown ◄── Release Session ◄──────┘                     │
│        │                                                        │
│        ▼                                                        │
│   Shutdown SDK                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 SDK Initialization (Game Startup)

```cpp
// LudeoManager.cpp

bool LudeoManager::Initialize()
{
    if (m_initialized) {
        return true;
    }
    
    // Initialize SDK core
    LudeoInitializeParams init_params = {};
    init_params.apiVersion = LUDEO_INITIALIZE_API_LATEST;
    
    LudeoResult result = ludeo_Initialize(&init_params);
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to initialize SDK: %d", result);
        return false;
    }
    
    // Create session handle
    LudeoSessionCreateParams create_params = {};
    create_params.apiVersion = LUDEO_SESSION_CREATE_API_LATEST;
    
    result = ludeo_Session_Create(&create_params, &m_session_handle);
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to create session: %d", result);
        ludeo_Shutdown();
        return false;
    }
    
    // Register notifications BEFORE activation
    RegisterNotifications();
    
    // Activate session immediately (Game Session)
    // This should happen when game loads, not when gameplay starts
    ActivateSession();
    
    m_initialized = true;
    LogInfo("[Ludeo] SDK initialized and session activation started");
    return true;
}

void LudeoManager::ActivateSession()
{
    if (m_session_handle == nullptr) {
        LogError("[Ludeo] Cannot activate: no session handle");
        return;
    }
    
    LudeoSessionActivateParams params = {};
    params.apiVersion = LUDEO_SESSION_ACTIVATE_API_LATEST;
    params.platformUrl = "https://services.ludeo.com";
    params.apiKey = m_api_key.c_str();
    params.gameVersion = m_game_version.c_str();
    params.windowHandle = GetGameWindowHandle();  // Required for video capture
    
    LudeoResult result = ludeo_Session_Activate(
        m_session_handle, &params, this, OnSessionActivatedCallback);
    
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to start session activation: %d", result);
    }
}

// Callback - Session now active (Game Session ready)
void LudeoManager::OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode == LudeoResult::Success) {
        manager->m_session_active = true;
        LogInfo("[Ludeo] Game Session activated - ready for gameplay sessions");
    } else {
        LogError("[Ludeo] Session activation failed: %d", data->resultCode);
    }
}
```

### 6.3 Integration Points

| Game Event | Ludeo Action | Notes |
|------------|--------------|-------|
| Game launch | Initialize + Create + Activate Session | Game Session active |
| Every frame | `ludeo_Tick()` | Process callbacks |
| Level/Scene loading | Open Room + Add Players | Prepare for gameplay |
| Gameplay starts | Begin GameplaySession | Start tracking |
| Gameplay ends | End GameplaySession | Stop tracking |
| Return to menu | Close Room | Clean up gameplay |
| Game shutdown | Release Session + Shutdown | Full cleanup |

---

## 7. Gameplay Session Management

### 7.1 Gameplay Session Lifecycle

A **Gameplay Session** represents one instance of gameplay (a level, match, mission, etc.). It must be created when gameplay begins loading and ended when gameplay ends. Call **BeginGameplaySession** only after the level/content is fully loaded and gameplay actually starts; call **EndGameplaySession** when gameplay actually ends.

```cpp
// Called when level/gameplay starts loading
void LudeoManager::OnGameplayLoading(const char* levelId, const char* playerId)
{
    if (!m_session_active) {
        LogWarning("[Ludeo] Cannot start gameplay: Game Session not active");
        return;
    }
    
    // Open a room - this provides the DataWriter for tracking
    LudeoSessionOpenRoomParams room_params = {};
    room_params.apiVersion = LUDEO_SESSION_OPENROOM_API_LATEST;
    room_params.roomId = nullptr;  // Auto-generate
    room_params.ludeoId = m_pending_ludeo_id.empty() ? nullptr : m_pending_ludeo_id.c_str();
    
    LudeoResult result = ludeo_Session_OpenRoom(
        m_session_handle, &room_params, this, OnRoomOpenedCallback);
    
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to open room: %d", result);
    }
}

// Callback - Room opened, DataWriter available
void LudeoManager::OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode != LudeoResult::Success) {
        LogError("[Ludeo] Room open failed: %d", data->resultCode);
        return;
    }
    
    manager->m_room_handle = data->room;
    manager->m_data_writer = data->dataWriter;  // CRITICAL: Store DataWriter
    manager->m_room_open = true;
    
    LogInfo("[Ludeo] Room opened - DataWriter available for tracking");
    
    // Add player to room (creates GameplaySession handle)
    manager->AddPlayerToRoom();
}

// Add player - required before gameplay can begin
void LudeoManager::AddPlayerToRoom()
{
    LudeoRoomAddPlayerParams params = {};
    params.apiVersion = LUDEO_ROOM_ADDPLAYER_API_LATEST;
    params.playerId = m_player_id.c_str();
    
    LudeoResult result = ludeo_Room_AddPlayer(
        m_room_handle, &params, this, OnPlayerAddedCallback);
    
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to add player: %d", result);
    }
}

// Callback - Player added, GameplaySession handle available
void LudeoManager::OnPlayerAddedCallback(const LudeoRoomAddPlayerCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode != LudeoResult::Success) {
        LogError("[Ludeo] Add player failed: %d", data->resultCode);
        return;
    }
    
    manager->m_gameplay_session_handle = data->gameplaySession;
    LogInfo("[Ludeo] Player added - GameplaySession ready");
    
    // At this point, tracking can begin (level is loading)
    // Register initial objects, track level metadata, etc.
}

// Called when gameplay ACTUALLY begins (after loading complete)
void LudeoManager::OnGameplayBegin()
{
    if (m_gameplay_session_handle == nullptr) {
        LogWarning("[Ludeo] Cannot begin: no GameplaySession handle");
        return;
    }
    
    LudeoGameplaySessionBeginParams params = {};
    params.apiVersion = LUDEO_GAMEPLAYSESSION_BEGIN_API_LATEST;
    
    LudeoResult result = ludeo_GameplaySession_Begin(
        m_gameplay_session_handle, &params, this, OnGameplayBegunCallback);
    
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to begin gameplay: %d", result);
    }
}

// Callback - Gameplay officially started
void LudeoManager::OnGameplayBegunCallback(const LudeoGameplaySessionBeginCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode == LudeoResult::Success) {
        manager->m_gameplay_session_active = true;
        LogInfo("[Ludeo] Gameplay Session begun - full tracking active");
    } else {
        LogError("[Ludeo] Begin gameplay failed: %d", data->resultCode);
    }
}

// Called when gameplay ends
void LudeoManager::OnGameplayEnd()
{
    if (!m_gameplay_session_active) {
        return;
    }
    
    // End gameplay session
    LudeoGameplaySessionEndParams params = {};
    params.apiVersion = LUDEO_GAMEPLAYSESSION_END_API_LATEST;
    params.isAbort = LUDEO_FALSE;
    
    ludeo_GameplaySession_End(m_gameplay_session_handle, &params, this, OnGameplayEndedCallback);
}

// After gameplay ends, close the room
void LudeoManager::OnGameplayEndedCallback(const LudeoGameplaySessionEndCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    manager->m_gameplay_session_active = false;
    manager->m_gameplay_session_handle = nullptr;
    
    LogInfo("[Ludeo] Gameplay Session ended");
    
    // Close room
    LudeoRoomCloseParams close_params = {};
    close_params.apiVersion = LUDEO_ROOM_CLOSE_API_LATEST;
    ludeo_Room_Close(manager->m_room_handle, &close_params, manager, OnRoomClosedCallback);
}
```

### 7.2 Timeline Summary

```
Game Loads
    │
    ├─► ludeo_Initialize()
    ├─► ludeo_Session_Create()
    └─► ludeo_Session_Activate()         ←── Game Session starts
    
Level/Gameplay Loading Starts
    │
    ├─► ludeo_Session_OpenRoom()         ←── Get DataWriter
    ├─► ludeo_Room_AddPlayer()           ←── Get GameplaySession handle
    └─► [Begin tracking level metadata, initial objects]
    
Gameplay Actually Begins (loading complete)
    │
    └─► ludeo_GameplaySession_Begin()    ←── Full tracking active
    
During Gameplay
    │
    └─► Track all object state changes via DataWriter
    
Gameplay Ends
    │
    ├─► ludeo_GameplaySession_End()
    └─► ludeo_Room_Close()
    
Game Shutdown
    │
    ├─► ludeo_Session_Release()
    └─► ludeo_Shutdown()
```

---

## 8. Tracking Strategy

### 8.1 Object Tracking Pattern

Track ALL game objects that affect the gameplay experience. The goal is complete state capture for faithful restoration.

```cpp
// Basic object tracking pattern

// 1. Object Creation - Register with SDK
void GameObject::OnCreate()
{
#if LUDEO_SDK_ENABLED
    RegisterWithLudeo();
#endif
}

void GameObject::RegisterWithLudeo()
{
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) {
        return;  // Not ready for tracking
    }
    
    // Create tracked object
    LudeoDataWriterCreateObjectParams params = {};
    params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
    params.objectType = "game_object";  // Your object type name
    
    LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &m_ludeo_object_id);
    if (result != LudeoResult::Success) {
        LogWarning("[Ludeo] Failed to create object: %d", result);
        return;
    }
    
    // Set initial values
    SendInitialLudeoValues();
}

// 2. Property Changes - Update SDK
void GameObject::SetHealth(float newHealth)
{
    m_health = newHealth;  // Update game state first
    
    LUDEO_CAPTURE_FLOAT(this, "game_object", "health", newHealth);
}

void GameObject::SetPosition(const Vec3& newPos)
{
    m_position = newPos;
    
    LUDEO_CAPTURE_VEC3(this, "game_object", "position", newPos);
}

// 3. Object Destruction - Cleanup
void GameObject::OnDestroy()
{
#if LUDEO_SDK_ENABLED
    UnregisterFromLudeo();
#endif
}

void GameObject::UnregisterFromLudeo()
{
    if (m_ludeo_object_id == LUDEO_INVALID_OBJECTID) {
        return;
    }
    
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer != nullptr) {
        LudeoDataWriterDestroyObjectParams params = {};
        params.apiVersion = LUDEO_DATAWRITER_DESTROYOBJECT_API_LATEST;
        params.objectId = m_ludeo_object_id;
        ludeo_DataWriter_DestroyObject(writer, &params);
    }
    
    m_ludeo_object_id = LUDEO_INVALID_OBJECTID;
}
```

### 8.2 Identity and Reference Mapping

To restore relationships correctly, map SDK object IDs to game-stable IDs:

- Use **stable, deterministic game IDs** (not pointers) for attributes such as `entity_id`, `owner_id`, `player_id`, `squad_id`, `parent_id`, `attachment_id`.
- Maintain maps during tracking/restoration:

```cpp
// In LudeoStateAdapter or LudeoManager
std::unordered_map<LudeoObjectId, uint64_t> m_ludeo_to_game_id;
std::unordered_map<uint64_t, LudeoObjectId> m_game_to_ludeo_id;

void RegisterIdMapping(LudeoObjectId ludeoId, uint64_t gameId)
{
    m_ludeo_to_game_id[ludeoId] = gameId;
    m_game_to_ludeo_id[gameId] = ludeoId;
}
```

- When setting relationships, always write the **game ID** as the attribute value so it can be resolved on restore.
- During restoration, resolve references via the map (game ID → game object).

### 8.3 Tracking with Managers/Factories

If your game uses managers or factories for object creation, integrate tracking there:

```cpp
// Example: Entity Manager integration
class EntityManager {
public:
    Entity* CreateEntity(const EntityConfig& config)
    {
        Entity* entity = new Entity(config);
        m_entities.push_back(entity);
        
#if LUDEO_SDK_ENABLED
        entity->RegisterWithLudeo();
#endif
        
        return entity;
    }
    
    void DestroyEntity(Entity* entity)
    {
#if LUDEO_SDK_ENABLED
        entity->UnregisterFromLudeo();
#endif
        
        m_entities.erase(std::remove(m_entities.begin(), m_entities.end(), entity));
        delete entity;
    }
};
```

### 8.4 Batch Initial Registration

When gameplay loads, register all existing objects:

```cpp
void LudeoManager::RegisterAllExistingObjects()
{
    LudeoHDataWriter writer = GetDataWriter();
    if (writer == nullptr) return;
    
    // Register all entities
    for (Entity* entity : EntityManager::Get().GetAllEntities()) {
        entity->RegisterWithLudeo();
    }
    
    // Register all players
    for (Player* player : PlayerManager::Get().GetAllPlayers()) {
        player->RegisterWithLudeo();
    }
    
    // Register environment/level state
    RegisterEnvironmentState();
    
    LogInfo("[Ludeo] Registered %d entities, %d players", 
            EntityManager::Get().GetCount(),
            PlayerManager::Get().GetCount());
}
```

### 8.5 Ludeo Actions (Critical for Experience)

**Actions are discrete gameplay EVENTS** that define exciting moments. Unlike continuous state tracking, actions are one-time events that can be used for objectives and scoring in Ludeo.

#### Action Tracking API

```cpp
// LudeoManager - Action Support
class LudeoManager {
public:
    // Send an action event.
    // NOTE: ludeo_DataWriter_SendAction takes the DataWriter handle + a params
    // struct, and playerId is REQUIRED. Verify the signature against your cloned
    // SDK headers before use. The single-arg form defaults to the local player.
    void SendAction(const char* actionName)
    {
        SendAction(actionName, m_player_id.c_str());  // m_player_id = id passed to AddPlayer
    }

    void SendAction(const char* actionName, const char* playerId)
    {
        if (!m_gameplay_session_active || m_data_writer == nullptr) {
            return;
        }

        ludeo_DataWriter_SetCurrent(m_data_writer);

        LudeoDataWriterSendActionParams params = {};
        params.apiVersion = LUDEO_DATAWRITER_SENDACTION_API_LATEST;
        params.playerId   = playerId;    // REQUIRED
        params.action     = actionName;  // REQUIRED

        if (ludeo_DataWriter_SendAction(m_data_writer, &params) != LudeoResult::Success) {
            LogWarning("[Ludeo] SendAction('%s') failed", actionName);
            return;
        }
        LogInfo("[Ludeo] Action sent: %s (player %s)", actionName, playerId);
    }
};
```

#### Action Macro for Easy Integration

```cpp
// LudeoCaptureMacros.h - Add action macros

#if LUDEO_SDK_ENABLED

#define LUDEO_ACTION(actionName) \
    LudeoManager::Get().SendAction(actionName)

// Attribute the action to a specific player rather than the default local player.
#define LUDEO_ACTION_FOR_PLAYER(actionName, playerId) \
    LudeoManager::Get().SendAction(actionName, playerId)

#else

#define LUDEO_ACTION(actionName)
#define LUDEO_ACTION_FOR_PLAYER(actionName, playerId)

#endif
```

#### Example Action Integration

```cpp
// In combat system - when an enemy is killed
void CombatManager::OnEnemyKilled(Entity* killer, Entity* victim, 
                                   WeaponType weapon, bool isHeadshot)
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    // Send kill action
    LUDEO_ACTION("Kill");
    
    // Send specific action types for richer objectives
    if (isHeadshot) {
        LUDEO_ACTION("Headshot");
    }
    
    // Weapon-specific kills
    switch (weapon) {
        case WeaponType::Sniper:
            LUDEO_ACTION("SniperKill");
            break;
        case WeaponType::Explosive:
            LUDEO_ACTION("ExplosiveKill");
            break;
        case WeaponType::Melee:
            LUDEO_ACTION("MeleeKill");
            break;
    }
#endif
}

// In player controller - when player dies
void Player::OnDeath(Entity* killer)
{
    // Game logic...
    
    LUDEO_ACTION("PlayerDeath");
}

// In item pickup system
void ItemManager::OnItemCollected(Entity* collector, ItemType item)
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    switch (item) {
        case ItemType::Coin:
            LUDEO_ACTION("CollectCoin");
            break;
        case ItemType::HealthPack:
            LUDEO_ACTION("CollectHealth");
            break;
        case ItemType::Ammo:
            LUDEO_ACTION("CollectAmmo");
            break;
        case ItemType::PowerUp:
            LUDEO_ACTION("CollectPowerUp");
            break;
    }
#endif
}

// In objective system
void ObjectiveManager::OnObjectiveComplete(const char* objectiveId)
{
    // Game logic...
    
    LUDEO_ACTION("ObjectiveComplete");
}

// In building/crafting system
void BuildManager::OnStructurePlaced(StructureType type)
{
    // Game logic...
    
    LUDEO_ACTION("PlaceStructure");
}
```

#### Recommended Action Categories

Document and implement actions from these categories based on your game:

| Category | Example Actions | Use Case |
|----------|-----------------|----------|
| **Combat** | Kill, Headshot, MultiKill, Assist, TakeDamage | Core FPS/Action objectives |
| **Collection** | CollectCoin, CollectGem, PickupWeapon, GrabFlag | Collection challenges |
| **Movement** | Jump, DoubleJump, Dash, WallRun, Slide | Parkour/movement challenges |
| **Destruction** | DestroyCrate, BreakWall, Demolish | Destruction objectives |
| **Building** | PlaceStructure, BuildWall, CreateUnit | Strategy/building games |
| **Progression** | LevelUp, Unlock, CompleteQuest, CapturePoint | Progression milestones |
| **Survival** | PlayerDeath, Respawn, UseContinue | Survival challenges |
| **Social** | Revive, Trade, Assist, TeamKill | Multiplayer objectives |

### 8.6 Pause/Cutscene (local capture hygiene) — and a note on non-ludeoable areas

Two different things, often confused:

- **Local capture-hygiene pause** (this section): genuinely freeze capture during a true (sim-frozen) game pause or a cutscene, so scripted/cosmetic motion isn't recorded as gameplay state.
- **Non-ludeoable areas** (shops, NPC dialogue, tutorials, safe zones, in-game menus): these do **NOT** pause tracking — capture keeps running. They are **backend-controlled**, marked by enter/exit boundary actions wired once to global triggers on the platform. See `06-TRACKING-PATTERNS.md §7.3` and `/6`–`/7`. Do not implement them with local flags.

#### LudeoManager State for Pause/Resume

```cpp
class LudeoManager {
private:
    bool m_tracking_paused = false;
    bool m_in_cutscene = false;
    
public:
    // Check if tracking is currently active
    bool IsTrackingActive() const 
    {
        return m_gameplay_session_active 
            && !m_tracking_paused 
            && !m_in_cutscene;
    }
    
    // Pause/Resume tracking (e.g., when game is paused)
    void PauseTracking()
    {
        if (m_tracking_paused) return;
        m_tracking_paused = true;
        LogInfo("[Ludeo] Tracking paused");
    }
    
    void ResumeTracking()
    {
        if (!m_tracking_paused) return;
        m_tracking_paused = false;
        LogInfo("[Ludeo] Tracking resumed");
    }
    
    // Cutscene handling
    void OnCutsceneStart()
    {
        m_in_cutscene = true;
        LogInfo("[Ludeo] Cutscene started - tracking suspended");
    }
    
    void OnCutsceneEnd()
    {
        m_in_cutscene = false;
        LogInfo("[Ludeo] Cutscene ended - tracking resumed");
    }
    
};
```

#### Update Capture Macros to Respect Pause State

```cpp
// Enhanced capture that respects tracking state
#define LUDEO_CAPTURE_FLOAT(obj, objectType, attrName, floatValue) \
    do { \
        if (LudeoManager::Get().IsTrackingActive()) { \
            LudeoCapture::AttributeCapture<...>::CaptureFloat(...); \
        } \
    } while(0)

// Or simpler - check in AttributeCapture functions
static void CaptureFloat(T* obj, LudeoObjectId objId, ...)
{
    if (!LudeoManager::Get().IsTrackingActive()) {
        return;  // Skip capture during pause/cutscene
    }
    // ... rest of capture
}
```

#### Integration with Game Systems

```cpp
// In game pause handler
void GameManager::OnGamePaused()
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().PauseTracking();
#endif
}

void GameManager::OnGameResumed()
{
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().ResumeTracking();
#endif
}

// In cutscene system
void CutsceneManager::PlayCutscene(const char* cutsceneId)
{
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().OnCutsceneStart();
#endif
    
    // Play cutscene...
}

void CutsceneManager::OnCutsceneComplete()
{
    // Cleanup...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().OnCutsceneEnd();
#endif
}
```

#### Non-ludeoable areas are handled via boundary actions, not local flags

Shops, NPC dialogue, tutorials, safe zones, and in-game menus should never become a Ludeo — but tracking keeps running through them. Mark their boundaries with enter/exit Ludeo actions (`ShopEntered`/`ShopExited`, etc.) wired once to the global triggers on the platform; the backend excludes those windows. See `06-TRACKING-PATTERNS.md §7.3` and `/6`–`/7`. (Main menu, lobby, and loading sit outside any gameplay session, so nothing tracks them regardless.)

---

## 9. Restoration Strategy

### 9.1 LudeoSelected Handling

When a user selects a Ludeo to play, the SDK notifies the game:

```cpp
// Register for notification during initialization
void LudeoManager::RegisterNotifications()
{
    LudeoSessionAddNotifyLudeoSelectedParams params = {};
    params.apiVersion = LUDEO_SESSION_ADDNOTIFYLUDEOSELECTED_API_LATEST;
    
    ludeo_Session_AddNotifyLudeoSelected(
        m_session_handle, &params, this, OnLudeoSelectedCallback);
}

// Callback when user selects a Ludeo
void LudeoManager::OnLudeoSelectedCallback(const LudeoSessionLudeoSelectedCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    // Store the ludeo ID
    manager->m_pending_ludeo_id = data->ludeoId;
    
    LogInfo("[Ludeo] Ludeo selected: %s", data->ludeoId);
    
    // Fetch the Ludeo data
    LudeoSessionGetLudeoParams params = {};
    params.apiVersion = LUDEO_SESSION_GETLUDEO_API_LATEST;
    params.ludeoId = data->ludeoId;
    
    LudeoResult result = ludeo_Session_GetLudeo(
        manager->m_session_handle, &params, manager, OnLudeoDataReceivedCallback);
    
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to request Ludeo data: %d", result);
    }
}

// Callback with DataReader for restoration.
// ⚠️ May fire REPEATEDLY (forced-launch re-injects LudeoSelected); early cycles return Success + EMPTY reader.
void LudeoManager::OnLudeoDataReceivedCallback(const LudeoSessionGetLudeoCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode != LudeoResult::Success) {
        LogError("[Ludeo] Failed to get Ludeo data: %d", data->resultCode);  // hard failure — abort, no retry
        return;
    }

    // Success means a valid reader HANDLE, not that the data has landed. Validate it is populated
    // before accepting — otherwise we restore on an empty reader and the player stays at the default
    // spawn. See 07-RESTORATION-PATTERNS §2.2.1.
    if (!manager->ReaderIsPopulated(data->dataReader)) {
        return;  // empty/not-ready cycle — ignore; a populated reader arrives a cycle or two later
    }

    manager->m_data_reader = data->dataReader;   // KEEP the populated reader; never let a later empty cycle clobber it
    LogInfo("[Ludeo] DataReader populated, ready for restoration");

    // Restoration runs from the apply (gated on populated reader + RoomReady), retry-until-ready + timeout.
    LudeoStateAdapter::Get().BeginRestoration(data->dataReader);
}
```

### 9.2 Ludeo Playback Flow (Critical: Wait for User Input)

> ⚠️ **CRITICAL: LudeoSelected Can Happen AT ANY TIME!**
> 
> The `LudeoSelected` event from the Ludeo Platform can be triggered **at any point in time** - while the player is in the main menu, mid-gameplay, during a loading screen, watching a cutscene, in a pause menu, etc.
> 
> The game **MUST** be able to:
> 1. **Interrupt** whatever it's currently doing (abort loading, end current match, exit cutscene)
> 2. **Clean up** the current state gracefully (release resources, end gameplay session if active)
> 3. **Restart** from any point and load the appropriate level for the Ludeo
> 4. **Restore** the Ludeo state
> 5. **Wait** for player input before starting

**After loading and restoring a Ludeo**, the game must **PAUSE and WAIT** for user input before starting gameplay. The SDK will notify when the player is ready to begin.

#### Handling LudeoSelected from Any State

```cpp
// In LudeoManager - handle LudeoSelected from ANY game state
void LudeoManager::OnLudeoSelected(const char* ludeoId)
{
    LogInfo("[Ludeo] LudeoSelected received - ludeoId: %s", ludeoId);
    
    // Store the pending Ludeo
    m_pending_ludeo_id = ludeoId;
    
    // STEP 1: Interrupt current activity based on game state
    GameState currentState = GameStateManager::Get().GetCurrentState();
    
    switch (currentState)
    {
        case GameState::InGameplay:
            // End current gameplay session if active
            if (m_gameplay_session_active) {
                EndGameplaySession();
                CloseRoom();
            }
            // Abort current match/level
            GameManager::Get().AbortCurrentMatch();
            break;
            
        case GameState::Loading:
            // Cancel current loading operation
            LoadingManager::Get().CancelLoading();
            break;
            
        case GameState::Cutscene:
            // Skip/abort cutscene
            CutsceneManager::Get().SkipCutscene();
            break;
            
        case GameState::PauseMenu:
            // Close pause menu
            UIManager::Get().ClosePauseMenu();
            break;
            
        case GameState::MainMenu:
            // Already in menu, just proceed
            break;
    }
    
    // STEP 2: Clean up current state
    GameManager::Get().CleanupForLudeoPlayback();
    
    // STEP 3: Request Ludeo data and begin loading
    RequestLudeoData(ludeoId);
}
```

#### Playback State Machine

```cpp
// Ludeo Playback State Machine
enum class LudeoPlaybackState
{
    None,
    Loading,            // Level/content loading
    Restoring,          // State being restored
    WaitingForPlayer,   // PAUSED - waiting for SDK callback
    Playing             // User pressed play, gameplay active
};

class LudeoManager
{
private:
    LudeoPlaybackState m_playback_state = LudeoPlaybackState::None;
    
public:
    // Called after level loads and restoration completes
    void OnRestorationComplete()
    {
        // CRITICAL: Do NOT start gameplay yet!
        // Pause the game and show "Ready to Play" UI
        m_playback_state = LudeoPlaybackState::WaitingForPlayer;
        
        // Pause game simulation
        GameSimulation::Get().SetPaused(true);
        
        // The Ludeo OVERLAY shows the Play button — do NOT draw your own.
        // The room was already opened (with the selected ludeoId — Player Flow) and the player
        // added during the LudeoSelected handler; only RoomReady is withheld until the player
        // presses Play. On RoomReady the game UNPAUSES and TryBeginGameplaySession() issues Begin
        // once BOTH player_added and room_ready are set (either order; see 05-LIFECYCLE-MANAGEMENT.md §6.6/§6.11).
        LogInfo("[Ludeo] Restoration complete - frozen, waiting for RoomReady");
    }

    // Register the MID-PLAY overlay-control notifications ONCE at session creation
    // (next to AddNotifyLudeoSelected), not per-Ludeo. These handle the player
    // reopening/closing the overlay during an active playback session.
    // NOTE: the POST-RESTORE resume is OnRoomReadyCallback, not OnResumeGameRequest.
    // There is NO PlayerReady notification in the SDK.
    // (Signatures follow the SDK's AddNotify pattern; verify against the cloned
    //  Include/Ludeo/Session.h + SessionTypes.h.)
    void RegisterOverlayControlCallbacks()
    {
        LudeoSessionAddNotifyPauseGameRequestParams pauseParams = {};
        pauseParams.apiVersion = LUDEO_SESSION_ADDNOTIFYPAUSEGAMEREQUEST_API_LATEST;
        ludeo_Session_AddNotifyPauseGameRequest(m_session_handle, &pauseParams, this, OnPauseGameRequest);

        LudeoSessionAddNotifyResumeGameRequestParams resumeParams = {};
        resumeParams.apiVersion = LUDEO_SESSION_ADDNOTIFYRESUMEGAMEREQUEST_API_LATEST;
        ludeo_Session_AddNotifyResumeGameRequest(m_session_handle, &resumeParams, this, OnResumeGameRequest);

        // Also register BackToMenuRequest and (optionally) MuteRequest here.
    }

    // SDK callback - overlay opened / platform wants the game paused
    static void OnPauseGameRequest(const LudeoSessionPauseGameRequestCallbackParams* data)
    {
        auto* manager = static_cast<LudeoManager*>(data->clientData);
        GameSimulation::Get().SetPaused(true);   // FREEZE the sim, not just input
    }

    // SDK callback - MID-PLAY only: player closed the overlay during an active
    // playback session → resume. (The POST-RESTORE resume is OnRoomReadyCallback,
    // not this one — the gameplay session is already running when this fires.)
    static void OnResumeGameRequest(const LudeoSessionResumeGameRequestCallbackParams* data)
    {
        auto* manager = static_cast<LudeoManager*>(data->clientData);

        LogInfo("[Ludeo] Mid-play resume (overlay closed)");

        // Unpause game simulation
        GameSimulation::Get().SetPaused(false);
    }
};
```

**Playback Timeline:**

```
1. LudeoSelected fires
   └── OnLudeoSelectedCallback() — marshal off the SDK notification thread
   └── FREEZE the simulation (may already be frozen at the menu); SetRestoring(true)
   └── Dispatch ludeo_Session_GetLudeo(ludeoId) AND OpenRoom(ludeoId) — they race, no ordering guarantee
       (OpenRoom carries the ludeoId = Player Flow; dispatched HERE, not off a level-load hook —
        the target level is UNKNOWN until the reader is in hand)

2. DataReader received (callback may fire REPEATEDLY; early cycles return Success + EMPTY reader)
   └── OnLudeoDataReceivedCallback() — validate populated (GetObjectsInfo Success && objectsCount>0);
       ignore empty cycles, CACHE only a populated reader (don't clobber); do NOT apply yet; retry-until-ready + timeout

3. Player clicks "Play"
   └── OnRoomReadyCallback() fires — the platform withheld RoomReady until Play
       (the room was opened with the ludeoId and the player added back in the handler, not now)

4. Apply — fires ONCE, on the last of {reader cached, room_ready}; in this exact order:
   └── Unpause FIRST (load + apply need the sim running)
   └── Read level metadata from the reader → determine + LOAD the level (generic level if no rooms)
   └── Two-pass restoration executes — all objects created and properties restored
   └── BeginGameplaySession() — once both player_added && room_ready (either order, 05 §6.6); AFTER apply
   └── Normal gameplay begins

   ✅ This is the authoritative synchronous read-then-load order (CR-010, 07 §2): freeze at
   LudeoSelected; GetLudeo + OpenRoom dispatched in the handler; the level loads + state restores
   INSIDE the apply on RoomReady (after the unpause); then Begin. The level is NOT loaded before Play.
```

**Why This Matters:**
- The SDK overlay shows objectives, score targets, and the Play button while the game is frozen
- Ensures the player consciously starts the Ludeo challenge (the restored world appears on Play, when the level loads + state restores)
- Allows SDK to properly time the gameplay session

### 9.3 Two-Pass Restoration

Follow a two-pass approach for reliable restoration:

```cpp
void LudeoStateAdapter::RestoreFromLudeoData(LudeoHDataReader reader)
{
    // Pause simulation/AI before restoring to avoid mid-frame side effects
    GameSimulation::Get().SetPaused(true);

    // Get all tracked objects
    LudeoDataReaderGetObjectsInfoParams params = {};
    params.apiVersion = LUDEO_DATAREADER_GETOBJECTSINFO_API_LATEST;
    
    LudeoObjectsInfo* objects_info = nullptr;
    LudeoResult result = ludeo_DataReader_GetObjectsInfo(reader, &params, &objects_info);
    
    if (result != LudeoResult::Success || objects_info == nullptr) {
        LogError("[Ludeo] Failed to get objects info: %d", result);
        return;
    }

    // ⚠️ Success is NOT enough. Under the forced-launch path GetLudeo fires repeatedly and the
    //    EARLY cycles hand back an EMPTY reader (data not landed yet). objectsCount == 0 here is
    //    "not ready", NOT "nothing to restore" — applying anyway is a silent zero-spawn no-op that
    //    leaves the player at the default new-game spawn. Bail and let the caller retry-until-ready
    //    (with a timeout → abort). See 07-RESTORATION-PATTERNS §2.2.1.
    if (objects_info->objectsCount == 0) {
        ludeo_ObjectsInfo_Release(objects_info);    // release before bailing
        return;                                     // reader not populated yet — do NOT apply
    }
    LogInfo("[Ludeo] Restoring %d objects", objects_info->objectsCount);
    
    // Set current reader for operations
    ludeo_DataReader_SetCurrent(reader);
    
    // PASS 1: Create all objects
    std::unordered_map<LudeoObjectId, void*> restored_objects;
    
    for (uint32_t i = 0; i < objects_info->objectsCount; ++i) {
        LudeoObjectId obj_id = objects_info->objects[i].objectId;
        const char* obj_type = objects_info->objects[i].objectType;
        
        void* game_object = CreateGameObject(reader, obj_id, obj_type);
        if (game_object != nullptr) {
            restored_objects[obj_id] = game_object;
        }
    }
    
    // PASS 2: Restore all properties and relationships
    for (const auto& [obj_id, game_object] : restored_objects) {
        RestoreObjectProperties(reader, obj_id, game_object);
    }
    
    // CRITICAL: Release the objects info when done
    ludeo_ObjectsInfo_Release(objects_info);
    
    // Post-restoration cleanup
    OnRestorationComplete();

    // Resume simulation after state is valid
    GameSimulation::Get().SetPaused(false);

    // If the SDK requires releasing the DataReader handle, do it here
    // (Check the SDK version in use)
}
```

### 9.4 Reading Object Properties

```cpp
void LudeoStateAdapter::RestoreObjectProperties(LudeoHDataReader reader,
                                                LudeoObjectId obj_id,
                                                void* game_object)
{
    // Enter object context
    if (!ludeo_DataReader_EnterObject(obj_id)) {
        LogWarning("[Ludeo] Failed to enter object %llu", obj_id);
        return;
    }
    
    // Read and apply properties - CHECK RETURN VALUES
    float position[3];
    if (ludeo_DataReader_GetVec3Float("position", position)) {
        // Property exists, apply it
        static_cast<GameObject*>(game_object)->SetPosition(
            Vec3(position[0], position[1], position[2]));
    }
    
    float health;
    if (ludeo_DataReader_GetFloat("health", &health)) {
        static_cast<GameObject*>(game_object)->SetHealth(health);
    }
    
    uint64_t owner_id;
    if (ludeo_DataReader_GetUInt64("owner_id", &owner_id)) {
        // Resolve owner reference
        Player* owner = PlayerManager::Get().FindByID(owner_id);
        static_cast<GameObject*>(game_object)->SetOwner(owner);
    }
    
    // Always leave object context
    ludeo_DataReader_LeaveObject();
}
```

---

## 10. Environment and Metadata Tracking

### 10.1 Level/Scene Metadata

Track all information needed to recreate the game environment:

```cpp
// Track when level loads
void LudeoStateAdapter::TrackLevelMetadata()
{
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    // Create level metadata object
    LudeoDataWriterCreateObjectParams params = {};
    params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
    params.objectType = "level_metadata";
    
    LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &m_level_object_id);
    if (result != LudeoResult::Success) {
        LogError("[Ludeo] Failed to create level metadata object: %d", result);
        return;
    }
    
    ludeo_DataWriter_SetCurrent(writer);
    if (ludeo_DataWriter_EnterObject(m_level_object_id)) {
        // Track level identification
        ludeo_DataWriter_SetString("level_id", LevelManager::Get().GetCurrentLevelID());
        ludeo_DataWriter_SetString("level_name", LevelManager::Get().GetCurrentLevelName());
        
        // Track game mode
        ludeo_DataWriter_SetInt32("game_mode", GameManager::Get().GetGameMode());
        
        // Track game settings
        ludeo_DataWriter_SetInt32("difficulty", GameManager::Get().GetDifficulty());
        ludeo_DataWriter_SetFloat("game_speed", GameManager::Get().GetGameSpeed());
        
        ludeo_DataWriter_LeaveObject();
    }
}
```

### 10.2 Camera State

Track camera state for proper restoration:

```cpp
// Create a camera tracking object
void LudeoStateAdapter::TrackCameraState()
{
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    LudeoDataWriterCreateObjectParams params = {};
    params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
    params.objectType = "camera";
    
    LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &m_camera_object_id);
    if (result != LudeoResult::Success) return;
    
    UpdateCameraTracking();
}

// Update camera state (call when camera moves)
void LudeoStateAdapter::UpdateCameraTracking()
{
    if (m_camera_object_id == LUDEO_INVALID_OBJECTID) return;
    
    Camera* camera = CameraManager::Get().GetActiveCamera();
    if (camera == nullptr) return;
    
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    ludeo_DataWriter_SetCurrent(writer);
    if (ludeo_DataWriter_EnterObject(m_camera_object_id)) {
        // Position
        Vec3 pos = camera->GetPosition();
        float position[3] = {pos.x, pos.y, pos.z};
        ludeo_DataWriter_SetVec3Float("position", position);
        
        // Rotation (as quaternion)
        Quat rot = camera->GetRotation();
        float rotation[4] = {rot.x, rot.y, rot.z, rot.w};
        ludeo_DataWriter_SetVec4Float("rotation", rotation);
        
        // Or as euler angles
        Vec3 euler = camera->GetEulerAngles();
        float angles[3] = {euler.x, euler.y, euler.z};
        ludeo_DataWriter_SetVec3Float("euler_angles", angles);
        
        // Camera properties
        ludeo_DataWriter_SetFloat("fov", camera->GetFOV());
        ludeo_DataWriter_SetFloat("near_clip", camera->GetNearClip());
        ludeo_DataWriter_SetFloat("far_clip", camera->GetFarClip());
        
        // Target (if applicable)
        if (camera->HasTarget()) {
            Vec3 target = camera->GetTargetPosition();
            float target_pos[3] = {target.x, target.y, target.z};
            ludeo_DataWriter_SetVec3Float("target", target_pos);
        }
        
        // Camera mode
        ludeo_DataWriter_SetInt32("camera_mode", camera->GetMode());
        
        ludeo_DataWriter_LeaveObject();
    }
}
```

### 10.3 World/Environment State

Track any environmental state that affects gameplay:

```cpp
void LudeoStateAdapter::TrackWorldState()
{
    LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
    if (writer == nullptr) return;
    
    LudeoDataWriterCreateObjectParams params = {};
    params.apiVersion = LUDEO_DATAWRITER_CREATEOBJECT_API_LATEST;
    params.objectType = "world_state";
    
    LudeoResult result = ludeo_DataWriter_CreateObject(writer, &params, &m_world_object_id);
    if (result != LudeoResult::Success) return;
    
    ludeo_DataWriter_SetCurrent(writer);
    if (ludeo_DataWriter_EnterObject(m_world_object_id)) {
        // Game time
        ludeo_DataWriter_SetFloat("game_time", GameTime::GetElapsed());
        ludeo_DataWriter_SetUInt64("game_tick", GameTime::GetTick());
        
        // Pause state
        ludeo_DataWriter_SetBool("is_paused", GameManager::Get().IsPaused() ? LUDEO_TRUE : LUDEO_FALSE);
        
        // Weather/environment (if applicable)
        if (WeatherSystem::Exists()) {
            ludeo_DataWriter_SetInt32("weather_type", WeatherSystem::Get().GetCurrentWeather());
            ludeo_DataWriter_SetFloat("weather_intensity", WeatherSystem::Get().GetIntensity());
        }
        
        // Day/night cycle (if applicable)
        if (DayNightCycle::Exists()) {
            ludeo_DataWriter_SetFloat("time_of_day", DayNightCycle::Get().GetTimeOfDay());
        }

        // Audio/music state (if applicable)
        if (AudioManager::Exists()) {
            ludeo_DataWriter_SetInt32("music_state", AudioManager::Get().GetCurrentState());
            ludeo_DataWriter_SetFloat("music_intensity", AudioManager::Get().GetIntensity());
        }

        // UI/overlay state (if it affects experience)
        if (UIManager::Exists()) {
            ludeo_DataWriter_SetInt32("ui_mode", UIManager::Get().GetActiveMode());
        }
        
        ludeo_DataWriter_LeaveObject();
    }
}
```

### 10.4 Restoring Environment

```cpp
void LudeoStateAdapter::RestoreEnvironment(LudeoHDataReader reader)
{
    ludeo_DataReader_SetCurrent(reader);
    
    // Find and restore level metadata
    LudeoObjectsInfo* objects_info = nullptr;
    LudeoDataReaderGetObjectsInfoParams params = {};
    params.apiVersion = LUDEO_DATAREADER_GETOBJECTSINFO_API_LATEST;
    
    LudeoResult result = ludeo_DataReader_GetObjectsInfo(reader, &params, &objects_info);
    if (result != LudeoResult::Success) return;
    
    for (uint32_t i = 0; i < objects_info->objectsCount; ++i) {
        LudeoObjectId obj_id = objects_info->objects[i].objectId;
        const char* obj_type = objects_info->objects[i].objectType;
        
        if (strcmp(obj_type, "level_metadata") == 0) {
            RestoreLevelMetadata(reader, obj_id);
        }
        else if (strcmp(obj_type, "camera") == 0) {
            RestoreCamera(reader, obj_id);
        }
        else if (strcmp(obj_type, "world_state") == 0) {
            RestoreWorldState(reader, obj_id);
        }
    }
    
    ludeo_ObjectsInfo_Release(objects_info);
}

void LudeoStateAdapter::RestoreCamera(LudeoHDataReader reader, LudeoObjectId obj_id)
{
    if (!ludeo_DataReader_EnterObject(obj_id)) return;
    
    Camera* camera = CameraManager::Get().GetActiveCamera();
    
    float position[3];
    if (ludeo_DataReader_GetVec3Float("position", position)) {
        camera->SetPosition(Vec3(position[0], position[1], position[2]));
    }
    
    float rotation[4];
    if (ludeo_DataReader_GetVec4Float("rotation", rotation)) {
        camera->SetRotation(Quat(rotation[0], rotation[1], rotation[2], rotation[3]));
    }
    
    float fov;
    if (ludeo_DataReader_GetFloat("fov", &fov)) {
        camera->SetFOV(fov);
    }
    
    int32_t camera_mode;
    if (ludeo_DataReader_GetInt32("camera_mode", &camera_mode)) {
        camera->SetMode(static_cast<CameraMode>(camera_mode));
    }
    
    ludeo_DataReader_LeaveObject();
}
```

---

## 11. Threading Considerations

### 11.1 Research Questions for Threading

```markdown
## Research Questions: Game Threading Model

- [ ] What threading model does the game use?
- [ ] Which thread runs game logic/simulation?
- [ ] Which thread should SDK calls be made from?
- [ ] Are there any thread-safety requirements for SDK integration?
- [ ] Does the game have a specific pattern for cross-thread communication?
```

### 11.2 General Threading Guidelines

```cpp
// General principle: Make SDK calls from a consistent thread
// Run ludeo_Tick() once per frame on that thread; keep all SDK callbacks and calls on the same thread.

// Option 1: All SDK calls on main thread
void GameLoop::Update()
{
    // Game logic update
    GameManager::Get().Update();
    
#if LUDEO_SDK_ENABLED
    // SDK tick on main thread
    LudeoManager::Get().Tick();
#endif
    
    // Render
    Renderer::Get().Render();
}

// Option 2: If game logic runs on a different thread,
// queue SDK operations for main thread
class LudeoManager {
    std::mutex m_queue_mutex;
    std::vector<std::function<void()>> m_pending_operations;
    
public:
    // Called from any thread
    void QueueOperation(std::function<void()> op)
    {
        std::lock_guard<std::mutex> lock(m_queue_mutex);
        m_pending_operations.push_back(std::move(op));
    }
    
    // Called from main thread during Tick
    void ProcessQueue()
    {
        std::vector<std::function<void()>> ops;
        {
            std::lock_guard<std::mutex> lock(m_queue_mutex);
            ops.swap(m_pending_operations);
        }
        
        for (auto& op : ops) {
            op();
        }
    }
};
```

---

## 12. Common Integration Patterns

### 12.1 Generic Game Integration Example

Here's a complete example for integrating Ludeo into a generic C++ game:

```cpp
// ========================================
// LudeoManager.h - Generic Implementation
// ========================================

#pragma once
#include "LudeoConfig.h"

#if LUDEO_SDK_ENABLED
#include <Ludeo/Init.h>
#include <Ludeo/Session.h>
#include <Ludeo/Room.h>
#include <Ludeo/DataWriter.h>
#include <Ludeo/DataReader.h>
#include <Ludeo/GameplaySession.h>
#include <string>

class LudeoManager
{
public:
    static LudeoManager& Get();
    
    // Lifecycle
    bool Initialize(const char* apiKey, const char* gameVersion);
    void Shutdown();
    void Tick();
    
    // Gameplay session
    void StartGameplay(const char* levelId, const char* playerId);
    void BeginGameplay();  // Call when loading complete
    void EndGameplay();
    
    // Access
    LudeoHDataWriter GetDataWriter() const { return m_data_writer; }
    LudeoHDataReader GetDataReader() const { return m_data_reader; }
    bool IsGameplayActive() const { return m_gameplay_session_active; }
    bool IsRestoring() const { return m_is_restoring; }
    
private:
    LudeoManager() = default;
    
    // Callbacks
    static void OnSessionActivated(const LudeoSessionActivateCallbackParams* data);
    static void OnRoomOpened(const LudeoSessionOpenRoomCallbackParams* data);
    static void OnPlayerAdded(const LudeoRoomAddPlayerCallbackParams* data);
    static void OnGameplayBegun(const LudeoGameplaySessionBeginCallbackParams* data);
    static void OnGameplayEnded(const LudeoGameplaySessionEndCallbackParams* data);
    static void OnRoomClosed(const LudeoRoomCloseCallbackParams* data);
    static void OnLudeoSelected(const LudeoSessionLudeoSelectedCallbackParams* data);
    static void OnLudeoDataReceived(const LudeoSessionGetLudeoCallbackParams* data);
    
    void* GetWindowHandle();
    
    // State
    bool m_initialized = false;
    bool m_session_active = false;
    bool m_room_open = false;
    bool m_gameplay_session_active = false;
    bool m_is_restoring = false;
    
    // Handles
    LudeoHSession m_session_handle = nullptr;
    LudeoHRoom m_room_handle = nullptr;
    LudeoHGameplaySession m_gameplay_session_handle = nullptr;
    LudeoHDataWriter m_data_writer = nullptr;
    LudeoHDataReader m_data_reader = nullptr;
    
    // Config
    std::string m_api_key;
    std::string m_game_version;
    std::string m_player_id;
    std::string m_pending_ludeo_id;
};

#endif // LUDEO_SDK_ENABLED
```

```cpp
// ========================================
// Game Integration Points
// ========================================

// In main.cpp or equivalent
int main()
{
    // Initialize game systems...
    
#if LUDEO_SDK_ENABLED
    // Initialize Ludeo when game starts
    if (!LudeoManager::Get().Initialize("your-api-key", "1.0.0")) {
        // Log warning but continue - game works without Ludeo
        Log("Ludeo SDK initialization failed");
    }
#endif
    
    // Run game...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().Shutdown();
#endif
    
    return 0;
}

// In game loop
void GameLoop::Update()
{
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().Tick();
#endif
    
    // Rest of update...
}

// In level/scene loader
void LevelManager::LoadLevel(const char* levelId)
{
    // Start loading...
    
#if LUDEO_SDK_ENABLED
    // Start gameplay session when level begins loading
    LudeoManager::Get().StartGameplay(levelId, GetCurrentPlayerId());
#endif
    
    // Continue loading...
}

void LevelManager::OnLevelLoadComplete()
{
    // Level is ready...
    
#if LUDEO_SDK_ENABLED
    // Begin gameplay session now that loading is complete
    LudeoManager::Get().BeginGameplay();
    
    // Track initial state
    LudeoStateAdapter::Get().TrackLevelMetadata();
    LudeoStateAdapter::Get().TrackCameraState();
    LudeoStateAdapter::Get().RegisterAllObjects();
#endif
    
    // Start gameplay...
}

// When level/gameplay ends
void LevelManager::UnloadLevel()
{
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().EndGameplay();
#endif
    
    // Unload...
}
```

### 12.2 Unity Integration Pattern

```csharp
// For Unity games, similar pattern applies:

public class LudeoIntegration : MonoBehaviour
{
    private static LudeoIntegration _instance;
    
    void Awake()
    {
        _instance = this;
        DontDestroyOnLoad(gameObject);
        
#if LUDEO_SDK_ENABLED
        LudeoManager.Initialize(apiKey, Application.version);
#endif
    }
    
    void Update()
    {
#if LUDEO_SDK_ENABLED
        LudeoManager.Tick();
#endif
    }
    
    void OnApplicationQuit()
    {
#if LUDEO_SDK_ENABLED
        LudeoManager.Shutdown();
#endif
    }
    
    // Called from SceneManager.sceneLoaded event
    public void OnSceneLoaded(Scene scene, LoadSceneMode mode)
    {
#if LUDEO_SDK_ENABLED
        if (IsGameplayScene(scene)) {
            LudeoManager.StartGameplay(scene.name, GetPlayerId());
        }
#endif
    }
    
    // Called when gameplay actually begins (e.g., after countdown)
    public void OnGameplayBegin()
    {
#if LUDEO_SDK_ENABLED
        LudeoManager.BeginGameplay();
        LudeoStateAdapter.TrackInitialState();
#endif
    }
}
```

### 12.3 Unreal Engine Integration Pattern

```cpp
// For Unreal Engine games:

// In your GameInstance class
void UMyGameInstance::Init()
{
    Super::Init();
    
#if LUDEO_SDK_ENABLED
    FLudeoManager::Get().Initialize(ApiKey, GetBuildVersion());
#endif
}

void UMyGameInstance::Shutdown()
{
#if LUDEO_SDK_ENABLED
    FLudeoManager::Get().Shutdown();
#endif
    
    Super::Shutdown();
}

// In your GameMode class
void AMyGameMode::BeginPlay()
{
    Super::BeginPlay();
    
#if LUDEO_SDK_ENABLED
    FLudeoManager::Get().StartGameplay(GetWorld()->GetMapName(), GetPlayerId());
#endif
}

void AMyGameMode::HandleMatchHasStarted()
{
    Super::HandleMatchHasStarted();
    
#if LUDEO_SDK_ENABLED
    FLudeoManager::Get().BeginGameplay();
    FLudeoStateAdapter::Get().TrackInitialState();
#endif
}

void AMyGameMode::EndMatch()
{
#if LUDEO_SDK_ENABLED
    FLudeoManager::Get().EndGameplay();
#endif
    
    Super::EndMatch();
}
```

---

## 13. Game Screen and State Management

### 13.1 State-Based Integration

Map Ludeo lifecycle to your game's state machine:

| Game State | Ludeo Action |
|------------|--------------|
| Game Launch | Initialize SDK, Activate Game Session |
| Main Menu | Game Session active, ready for LudeoSelected |
| Level Loading | Open Room, Add Players |
| Gameplay Start | Begin GameplaySession, start tracking |
| Gameplay (playing) | Track all state changes |
| Gameplay Paused | Continue tracking (paused state) |
| Gameplay End | End GameplaySession |
| Return to Menu | Close Room |
| Game Quit | Release Session, Shutdown SDK |

### 13.2 LudeoSelected Screen Transition

When a Ludeo is selected, the game may need to transition screens:

```cpp
void LudeoManager::OnLudeoSelectedCallback(const LudeoSessionLudeoSelectedCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    // Store ludeo ID
    manager->m_pending_ludeo_id = data->ludeoId;
    manager->m_is_restoring = true;
    
    // Request ludeo data
    LudeoSessionGetLudeoParams params = {};
    params.apiVersion = LUDEO_SESSION_GETLUDEO_API_LATEST;
    params.ludeoId = data->ludeoId;
    
    ludeo_Session_GetLudeo(manager->m_session_handle, &params, manager, OnLudeoDataReceivedCallback);
}

void LudeoManager::OnLudeoDataReceivedCallback(const LudeoSessionGetLudeoCallbackParams* data)
{
    auto* manager = static_cast<LudeoManager*>(data->clientData);
    
    if (data->resultCode != LudeoResult::Success) {
        LogError("[Ludeo] Failed to get ludeo data: %d", data->resultCode);
        manager->m_is_restoring = false;
        return;
    }
    
    manager->m_data_reader = data->dataReader;
    
    // Read level metadata to know which level to load
    std::string levelId = LudeoStateAdapter::Get().ReadLevelIdFromLudeo(data->dataReader);
    
    // Trigger level load - restoration happens after load
    GameManager::Get().LoadLevel(levelId);
}

// In level load complete handler
void LevelManager::OnLevelLoadComplete()
{
#if LUDEO_SDK_ENABLED
    if (LudeoManager::Get().IsRestoring()) {
        // Restore game state from Ludeo data
        LudeoStateAdapter::Get().RestoreFromLudeoData(LudeoManager::Get().GetDataReader());
    } else {
        // Normal gameplay - track initial state
        LudeoStateAdapter::Get().TrackInitialState();
    }
#endif
}
```

---

## 14. Save System Analysis

### 14.1 Learning from Existing Save Systems

If the game has a save system, analyze it for valuable patterns:

```markdown
## Save System Analysis Template

### Serialization Format
- What format is used? (Binary, JSON, XML)
- Is there a schema or structure definition?

### Saved Data
- List all data that is saved
- Compare with Ludeo tracking requirements
- Identify gaps (what save system captures that Ludeo doesn't need)
- Identify additions (what Ludeo needs that save system doesn't capture)

### Object Recreation
- How does the save system recreate objects?
- Can we reuse these functions for Ludeo restoration?
- What is the minimal data needed for recreation?

### Multi-Pass Strategy
- Does the save system use multiple passes?
- Pass 1: Object creation (typically needs: type, position, ID)
- Pass 2: Property restoration (everything else)
- This pattern is RECOMMENDED for Ludeo restoration

### Reference Resolution
- How are object references saved? (IDs, indices, paths)
- How are references resolved during load?
- Apply same pattern for Ludeo object relationships
```

### 14.2 Reusing Save System Code

```cpp
// Example: Reuse save system's object creation
Entity* LudeoStateAdapter::CreateEntityFromLudeo(LudeoHDataReader reader, LudeoObjectId obj_id)
{
    if (!ludeo_DataReader_EnterObject(obj_id)) {
        return nullptr;
    }
    
    // Read creation data
    char type_name[256];
    if (!ludeo_DataReader_GetString("type_name", type_name, sizeof(type_name))) {
        ludeo_DataReader_LeaveObject();
        return nullptr;
    }
    
    float position[3];
    if (!ludeo_DataReader_GetVec3Float("position", position)) {
        ludeo_DataReader_LeaveObject();
        return nullptr;
    }
    
    ludeo_DataReader_LeaveObject();
    
    // Use same creation function as save system
    EntityConfig config;
    config.typeName = type_name;
    config.position = Vec3(position[0], position[1], position[2]);
    
    // EntityManager::CreateFromSave() is reused from save system
    return EntityManager::Get().CreateFromSave(config);
}
```

---

## 15. Macro-Based Design Patterns

### 15.1 Configuration Header

```cpp
// LudeoConfig.h
#pragma once

#ifndef LUDEO_SDK_ENABLED
#define LUDEO_SDK_ENABLED 0
#endif

#if LUDEO_SDK_ENABLED
    #define LUDEO_CODE(...) __VA_ARGS__
    #define LUDEO_INCLUDE(x) x
#else
    #define LUDEO_CODE(...)
    #define LUDEO_INCLUDE(x)
#endif

#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriterTypes.h>
#else
    using LudeoObjectId = uint64_t;
    #define LUDEO_INVALID_OBJECTID 0
#endif
```

### 15.2 Capture Macros (Required)

```cpp
// LudeoCaptureMacros.h
#pragma once

#include "LudeoConfig.h"

#if LUDEO_SDK_ENABLED

#include "LudeoManager.h"
#include <Ludeo/DataWriter.h>

namespace LudeoCapture {

// RAII helper for safe object context management
class ObjectScope final
{
public:
    explicit ObjectScope(LudeoObjectId objId) : m_entered(false)
    {
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer != nullptr && ludeo_DataWriter_EnterObject(objId)) {
            m_entered = true;
        }
    }
    
    ~ObjectScope()
    {
        if (m_entered) {
            ludeo_DataWriter_LeaveObject();
        }
    }
    
    bool IsEntered() const { return m_entered; }
    
    // Non-copyable, non-movable
    ObjectScope(const ObjectScope&) = delete;
    ObjectScope& operator=(const ObjectScope&) = delete;
    ObjectScope(ObjectScope&&) = delete;
    ObjectScope& operator=(ObjectScope&&) = delete;
    
private:
    bool m_entered;
};

// Template-based capture functions
template<typename T>
class AttributeCapture
{
public:
    static void CaptureVec3(T* obj, LudeoObjectId objId, const char* objectType, 
                           const char* attributeName, float x, float y, float z)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            float value[3] = {x, y, z};
            ludeo_DataWriter_SetVec3Float(attributeName, value);
        }
    }
    
    static void CaptureFloat(T* obj, LudeoObjectId objId, const char* objectType,
                            const char* attributeName, float value)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            ludeo_DataWriter_SetFloat(attributeName, value);
        }
    }
    
    static void CaptureBool(T* obj, LudeoObjectId objId, const char* objectType,
                           const char* attributeName, bool value)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            ludeo_DataWriter_SetBool(attributeName, value ? LUDEO_TRUE : LUDEO_FALSE);
        }
    }
    
    static void CaptureUInt64(T* obj, LudeoObjectId objId, const char* objectType,
                             const char* attributeName, uint64_t value)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            ludeo_DataWriter_SetUInt64(attributeName, value);
        }
    }
    
    static void CaptureInt32(T* obj, LudeoObjectId objId, const char* objectType,
                            const char* attributeName, int32_t value)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            ludeo_DataWriter_SetInt32(attributeName, value);
        }
    }
    
    static void CaptureString(T* obj, LudeoObjectId objId, const char* objectType,
                             const char* attributeName, const char* value)
    {
        if (objId == LUDEO_INVALID_OBJECTID) return;
        if (value == nullptr) return;
        
        LudeoHDataWriter writer = LudeoManager::Get().GetDataWriter();
        if (writer == nullptr) return;
        
        ObjectScope scope(objId);
        if (scope.IsEntered()) {
            ludeo_DataWriter_SetString(attributeName, value);
        }
    }
};

} // namespace LudeoCapture

// Convenience macros - USE THESE IN GAME CODE
#define LUDEO_CAPTURE_VEC3(obj, objectType, attrName, vec3Value) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureVec3( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), \
        (vec3Value).x, (vec3Value).y, (vec3Value).z)

#define LUDEO_CAPTURE_FLOAT(obj, objectType, attrName, floatValue) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureFloat( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), (floatValue))

#define LUDEO_CAPTURE_BOOL(obj, objectType, attrName, boolValue) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureBool( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), (boolValue))

#define LUDEO_CAPTURE_UINT64(obj, objectType, attrName, uint64Value) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureUInt64( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), (uint64Value))

#define LUDEO_CAPTURE_INT32(obj, objectType, attrName, int32Value) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureInt32( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), (int32Value))

#define LUDEO_CAPTURE_STRING(obj, objectType, attrName, stringValue) \
    LudeoCapture::AttributeCapture<std::remove_pointer_t<decltype(obj)>>::CaptureString( \
        (obj), (obj)->m_ludeo_object_id, (objectType), (attrName), (stringValue))

// ================== ACTION MACROS ==================
// For discrete gameplay events (kills, pickups, objectives, etc.)
#define LUDEO_ACTION(actionName) \
    LudeoManager::Get().SendAction(actionName)


#else // !LUDEO_SDK_ENABLED

// No-op macros when SDK disabled
#define LUDEO_CAPTURE_VEC3(obj, objectType, attrName, vec3Value)
#define LUDEO_CAPTURE_FLOAT(obj, objectType, attrName, floatValue)
#define LUDEO_CAPTURE_BOOL(obj, objectType, attrName, boolValue)
#define LUDEO_CAPTURE_UINT64(obj, objectType, attrName, uint64Value)
#define LUDEO_CAPTURE_INT32(obj, objectType, attrName, int32Value)
#define LUDEO_CAPTURE_STRING(obj, objectType, attrName, stringValue)
#define LUDEO_ACTION(actionName)

#endif // LUDEO_SDK_ENABLED
```

**Minimal Intrusion Guidance**
- Keep raw SDK calls centralized in `LudeoManager`/`LudeoStateAdapter`; game objects should use capture macros only.
- Wrap every SDK include and call with `#if LUDEO_SDK_ENABLED` to keep the base game clean.
- Prefer adding capture macros inside existing setters/update functions rather than spreading SDK logic elsewhere.

### 15.3 Usage Examples

```cpp
// In any game object class
class Player
{
public:
    void SetHealth(float newHealth)
    {
        m_health = newHealth;
        LUDEO_CAPTURE_FLOAT(this, "player", "health", newHealth);
    }
    
    void SetPosition(const Vec3& newPos)
    {
        m_position = newPos;
        LUDEO_CAPTURE_VEC3(this, "player", "position", newPos);
    }
    
    void SetScore(int32_t newScore)
    {
        m_score = newScore;
        LUDEO_CAPTURE_INT32(this, "player", "score", newScore);
    }
    
    void SetName(const char* newName)
    {
        m_name = newName;
        LUDEO_CAPTURE_STRING(this, "player", "name", newName);
    }

    // Action example: Player performs an action
    void OnKillEnemy(Entity* enemy, bool isHeadshot)
    {
        // Game logic to handle kill...
        m_kills++;
        
        // Track actions for Ludeo objectives/scoring
        LUDEO_ACTION("Kill");
        if (isHeadshot) {
            LUDEO_ACTION("Headshot");
        }
    }
    
    void OnDeath()
    {
        // Game logic to handle death...
        
        LUDEO_ACTION("PlayerDeath");
    }
    
    void OnCollectItem(ItemType type)
    {
        // Game logic...
        
        if (type == ItemType::Coin) {
            LUDEO_ACTION("CollectCoin");
        }
    }

private:
    LudeoObjectId m_ludeo_object_id = LUDEO_INVALID_OBJECTID;
    float m_health = 100.0f;
    Vec3 m_position;
    int32_t m_score = 0;
    int32_t m_kills = 0;
    std::string m_name;
};
```

---

## 16. Testing Strategy

### 16.1 Test Phases

| Phase | Focus | Verification |
|-------|-------|--------------|
| SDK Lifecycle | Init/Shutdown | No crashes, clean lifecycle |
| Game Session | Activation | Session activates on game load |
| Gameplay Session | Room/Player/Begin | Full chain completes |
| Object Tracking | Registration | Objects tracked correctly |
| State Changes | Attribute updates | Changes captured |
| Restoration | Full restore | State matches original |

### 16.2 Test Checklist

```markdown
## Ludeo Integration Test Checklist

### SDK Lifecycle
- [ ] SDK initializes without errors
- [ ] Game Session activates on game load
- [ ] SDK ticks without errors
- [ ] SDK shuts down cleanly

### Gameplay Session
- [ ] Room opens when gameplay loads
- [ ] Player added successfully
- [ ] GameplaySession begins when gameplay starts
- [ ] GameplaySession ends when gameplay ends
- [ ] Room closes properly

### Object Tracking
- [ ] All object types register correctly
- [ ] Initial values are set
- [ ] Property changes are tracked
- [ ] Object destruction is tracked

### Environment Tracking
- [ ] Level metadata tracked
- [ ] Camera state tracked
- [ ] World state tracked

### Actions
- [ ] Actions fire when expected (kill, pickup, objective, etc.)
- [ ] Actions appear in Ludeo data (check logs/debug)
- [ ] No duplicate or missing actions
- [ ] Action names are consistent and meaningful

### Pause/Cutscene (capture hygiene) & Non-Ludeoable Areas
- [ ] Tracking pauses when game paused
- [ ] Tracking resumes when game unpaused
- [ ] Cutscenes suspend tracking
- [ ] Non-ludeoable area boundary actions fire (enter/exit) — tracking keeps running through them
- [ ] Boundary actions wired to global triggers on the platform
- [ ] State consistency after resume (no data loss)
- [ ] Ludeos don't contain paused/cutscene content; backend excludes non-ludeoable windows

### LudeoSelected from Any State (Critical!)
- [ ] LudeoSelected works from main menu
- [ ] LudeoSelected works mid-gameplay (interrupts and restarts)
- [ ] LudeoSelected works during loading screen
- [ ] LudeoSelected works during cutscene
- [ ] LudeoSelected works from pause menu
- [ ] Current gameplay session ends cleanly before Ludeo loads
- [ ] Resources cleaned up properly on interrupt

### Restoration
- [ ] LudeoSelected notification received
- [ ] DataReader obtained
- [ ] Level loads correctly
- [ ] All objects restored
- [ ] Properties match original
- [ ] Camera restored

### Playback Wait Flow (Critical!)
- [ ] Game pauses after restoration completes
- [ ] Player sees restored state frozen
- [ ] SDK overlay/UI shows play button
- [ ] RoomReady received when player clicks Play on the overlay (the gameplay-session-start chain reused for playback; there is no PlayerReady; ResumeGameRequest is mid-play only)
- [ ] Game unpauses correctly
- [ ] GameplaySession begins after player ready
- [ ] Gameplay proceeds normally

### Error Handling
- [ ] SDK errors logged but don't crash game
- [ ] Return values checked
- [ ] Graceful degradation if SDK unavailable
```

### 16.3 Expected Log Output

```
[Ludeo] SDK initialized
[Ludeo] Session created
[Ludeo] Session activation started
[Ludeo] Game Session activated
[Ludeo] Room opened - DataWriter available
[Ludeo] Player added
[Ludeo] Gameplay Session begun
[Ludeo] Registered 50 objects
[Ludeo] Tracking active
...
[Ludeo] Action sent: Kill
[Ludeo] Action sent: CollectCoin
...
[Ludeo] Tracking paused
[Ludeo] Cutscene started - tracking suspended
[Ludeo] Cutscene ended - tracking resumed
[Ludeo] Tracking resumed
[Ludeo] Entered non-ludeoable area: Tutorial
[Ludeo] Exited non-ludeoable area
...
[Ludeo] Gameplay Session ended

// For Ludeo Playback (restoration):
[Ludeo] Ludeo selected: abc123
[Ludeo] DataReader ready for restoration
[Ludeo] Restoring 50 objects
[Ludeo] Restoration complete - waiting for player input
[Ludeo] Player ready - starting gameplay!
[Ludeo] Gameplay Session begun
[Ludeo] Room closed
[Ludeo] Session released
[Ludeo] SDK shutdown complete
```

---

## 17. Code Review Checklist

### Mandatory Requirements

- [ ] **All SDK code wrapped with `#if LUDEO_SDK_ENABLED`**
- [ ] Code compiles with SDK enabled
- [ ] Code compiles with SDK disabled
- [ ] Capture macros used for tracking (not raw SDK calls in game code)

### API Usage

- [ ] Attributes use names (strings)
- [ ] Async operations have callbacks
- [ ] Return values checked for all SDK operations (DataWriter and DataReader)
- [ ] DataWriter/DataReader validity checked before use
- [ ] Context stack properly managed (Enter/Leave matched)
- [ ] Stable game IDs used for relationships (owner_id, player_id, squad_id, etc.)
- [ ] LudeoObjectId ↔ game ID mapping maintained for restoration

### Lifecycle

- [ ] SDK initialized on game load
- [ ] Game Session activated on game load
- [ ] GameplaySession opened when gameplay loads
- [ ] GameplaySession begun when gameplay starts
- [ ] GameplaySession ended when gameplay ends
- [ ] Room closed when returning to menu
- [ ] SDK shutdown on game exit
- [ ] Window handle provided during Session activation (for video/overlay)
- [ ] ludeo_Tick() called once per frame on a consistent thread

### Tracking

- [ ] All game object types tracked
- [ ] Initial values set on registration
- [ ] Property changes captured
- [ ] Object destruction tracked
- [ ] Environment metadata tracked (level, camera, world)
- [ ] Audio/music and UI mode state tracked when relevant
- [ ] ID mapping stored for relationships

### Actions

- [ ] Key gameplay actions identified and documented
- [ ] LUDEO_ACTION macros integrated at action trigger points
- [ ] Combat actions tracked (kills, deaths, damage)
- [ ] Collection actions tracked (pickups, items)
- [ ] Progression actions tracked (objectives, unlocks)
- [ ] Actions have meaningful names for objectives/scoring

### Pause/Cutscene (capture hygiene) & Non-Ludeoable Areas

- [ ] Tracking pauses when game is paused
- [ ] Tracking resumes when game unpauses
- [ ] Cutscenes suspend tracking
- [ ] Non-ludeoable area boundaries emit enter/exit actions wired to global triggers (tracking is not paused for them)
- [ ] `IsTrackingActive()` check in capture macros (optional, for the pause/cutscene cases)

### Error Handling

- [ ] SDK failures logged, not crashes
- [ ] Graceful degradation implemented
- [ ] Null checks present
- [ ] Restoration performed with simulation paused; resumed after success

---

## 18. Quick Reference

### 18.1 Integration Checklist

```markdown
## Integration Progress

### Phase 1: Setup
- [ ] Add SDK to project
- [ ] Create LudeoConfig.h
- [ ] Create LudeoManager
- [ ] Create LudeoCaptureMacros.h
- [ ] Create LudeoStateAdapter

### Phase 2: SDK Lifecycle
- [ ] Initialize SDK on game load
- [ ] Activate Game Session on game load
- [ ] Add Tick to game loop
- [ ] Shutdown on game exit

### Phase 3: Gameplay Session
- [ ] Open Room when gameplay loads
- [ ] Add Player to room
- [ ] Begin GameplaySession when gameplay starts
- [ ] End GameplaySession when gameplay ends
- [ ] Close Room when returning to menu

### Phase 4: Object Tracking
- [ ] Add LudeoObjectId to game objects
- [ ] Implement RegisterWithLudeo for each type
- [ ] Add capture macros to property setters
- [ ] Implement UnregisterFromLudeo

### Phase 5: Environment
- [ ] Track level metadata
- [ ] Track camera state
- [ ] Track world state
- [ ] Track audio/music state (if relevant)

### Phase 6: Actions
- [ ] Identify key gameplay actions (kills, pickups, objectives, etc.)
- [ ] Add LUDEO_ACTION macros to action trigger points
- [ ] Document actions for objective/scoring potential
- [ ] Test action delivery to SDK

### Phase 7: Pause/Cutscene (capture hygiene) & Non-Ludeoable Areas
- [ ] Implement PauseTracking/ResumeTracking
- [ ] Hook game pause/resume events
- [ ] Implement cutscene start/end handlers
- [ ] Emit enter/exit boundary actions for non-ludeoable areas + wire them to global triggers (06 §7.3)
- [ ] Test tracking suspension (pause/cutscene) and boundary-action emission

### Phase 8: Restoration
- [ ] Handle LudeoSelected notification
- [ ] Implement two-pass restoration
- [ ] Restore environment
- [ ] Restore all objects
```

### 18.2 Attribute Naming Convention

```
Use snake_case for all attributes:
- position (not Position)
- health (not Health)
- owner_id (not ownerId)
- is_active (not isActive)
- max_health (not maxHealth)
```

### 18.3 SDK References

- **API Docs:** https://api-docs.ludeo.com/docs/core/topics.html
- **Session Activation:** https://docs.ludeo.com/docs/core/pages/SessionActivation
- **Gameplay Session:** https://docs.ludeo.com/docs/core/pages/HandlingGameplaySession
- **Track Gameplay:** https://docs.ludeo.com/docs/core/pages/TrackGameplay
- **Restore Gameplay:** https://docs.ludeo.com/docs/core/pages/RestoreGameplay
- **Testing Locally:** https://docs.ludeo.com/docs/core/pages/developer-tools/TestingLudeosLocally

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial version based on COH3 integration |
| 2.0 | Dec 2025 | Generic rewrite, research-oriented format, removed game-specific workarounds |
| 2.1 | Dec 2025 | Added Ludeo Actions (critical for objectives/scoring), non-ludeoable areas, pause/resume, cutscene handling |

---

## AI Agent Usage Guide

This document is optimized for AI agent integration work:

### How to Use This Document

1. **Start with Section 2** - Complete the research questions for the target game
2. **Document all findings** - Create a game-specific tracking reference
3. **Identify Actions (Critical!)** - Document gameplay events for objectives/scoring (Section 8.5)
4. **Follow Section 18.1 checklist** - Track integration progress
5. **Reference specific sections** - As implementation proceeds
6. **Use code examples as templates** - Adapt to the target game's patterns

### Research-First Approach

Before writing any code, the AI agent should:
1. Investigate the game's architecture (Section 2.1)
2. Document all game objects (Section 2.1 - Entity Inventory)
3. **Identify key gameplay ACTIONS** (Section 2.1 - Ludeo Actions) - kills, pickups, objectives, etc.
4. Identify non-ludeoable areas, cutscenes, pause points (Section 2.1 - Non-Ludeoable Areas)
5. Analyze save system if present (Section 14)
6. Identify integration points (screen transitions, object lifecycle)

### Code Generation Order

1. LudeoConfig.h (Section 5.2)
2. LudeoCaptureMacros.h (Section 15.2)
3. LudeoManager (Sections 6, 7)
4. LudeoStateAdapter (Sections 9, 10)
5. Game object modifications (Section 8)

---

*End of LUDEO_SDK_MASTER_INTEGRATION_PLAN.md*
