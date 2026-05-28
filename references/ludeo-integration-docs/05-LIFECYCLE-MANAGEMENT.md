# 05-LIFECYCLE-MANAGEMENT.md - SDK Lifecycle Management

> **Purpose:** Complete guide to SDK initialization, session management, and game flow integration  
> **When to use:** When implementing SDK lifecycle hooks in your game  
> **Read time:** ~20 minutes  
> **Prerequisites:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [SDK Lifecycle Phases](#2-sdk-lifecycle-phases)
3. [Ludeo Session vs Gameplay Session](#3-ludeo-session-vs-gameplay-session)
4. [SDK Initialization (Game Startup)](#4-sdk-initialization-game-startup)
5. [Ludeo Session Activation](#5-ludeo-session-activation)
6. [Gameplay Session Management](#6-gameplay-session-management)
7. [Session Cleanup and Shutdown](#7-session-cleanup-and-shutdown)
8. [Integration Points Summary](#8-integration-points-summary)
9. [Timeline and Flow Diagrams](#9-timeline-and-flow-diagrams)
10. [Error Handling](#10-error-handling)
11. [Testing and Validation](#11-testing-and-validation)

---

## 1. Overview

The Ludeo SDK lifecycle must be carefully managed for proper state tracking and restoration. This document covers SDK initialization, session management (Ludeo Session and Gameplay Sessions), and cleanup.

### LudeoManager Class (Required)

> **📋 REQUIRED:** All SDK integrations must implement a `LudeoManager` class (or equivalent singleton wrapper).
>
> The LudeoManager is the central integration point that:
> - Owns all SDK handles (session, room, gameplay session, data writer)
> - Provides lifecycle methods (`Initialize`, `ActivateSession`, `Tick`, `Shutdown`)
> - Implements all SDK callback handlers (`OnRoomOpenedCallback`, `OnPlayerAddedCallback`, etc.)
> - Manages gameplay session state (`OpenRoom`, `EndGameplaySession`)
>
> **Do NOT** scatter raw SDK calls throughout game code. All SDK interaction goes through LudeoManager.
>
> See [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) Phase 1 for step-by-step implementation.

### Two-Level Session Model

1. **Ludeo Session** - Activated when game loads, persists until game closes (ONE per launch)
2. **Gameplay Session** - Created for each gameplay instance (level, match, mission, etc.) - MANY per Ludeo Session

This separation allows SDK to remain active throughout the game's lifetime while tracking individual gameplay moments.

### Callback-Driven Architecture

**CRITICAL CONCEPT:** Most SDK operations are asynchronous and callback-driven.

**🎮 Game Code Integration Points:** Call SDK functions from game event handlers (map loading starts, game shuts down)  
**📞 SDK Callback Handlers:** SDK calls back into your code when async operations complete

**Only ONE game code integration point for gameplay session:** Call `ludeo_Session_OpenRoom()` when level/match loading starts.

**Everything else happens via callbacks:** `OnRoomOpenedCallback` → `AddPlayerToRoom()` → `OnPlayerAddedCallback` + `OnRoomReadyCallback` → `TryBeginGameplaySession()`. The callbacks drive the flow, not game events.

---

## 2. SDK Lifecycle Phases

| Phase | Trigger | SDK Operations | State |
|-------|---------|----------------|-------|
| **Initialization** | Game launch | `ludeo_Initialize()`, `ludeo_Session_Create()` | SDK ready |
| **Ludeo Session Active** | Game loaded | `ludeo_Session_Activate()` | Ready for gameplay |
| **Gameplay Session Start** | Level/match loading | `ludeo_Session_OpenRoom()`, `ludeo_Room_AddPlayer()` | Preparing tracking |
| **Gameplay Active** | Gameplay begins | `ludeo_GameplaySession_Begin()` | Full tracking active |
| **Gameplay End** | Match/level ends | `ludeo_GameplaySession_End()` | Tracking stopped |
| **Room Closed** | Return to menu | `ludeo_Room_Close()` | Cleanup |
| **Shutdown** | Game exit | `ludeo_Session_Release()`, `ludeo_Shutdown()` | SDK terminated |

**Critical Rules:** Ludeo Session activated ONCE per launch. Gameplay Sessions created/destroyed for EACH gameplay instance (many times). Never skip phases. Check `resultCode` in callbacks for async operations. Call `ludeo_Tick()` every frame on consistent thread.

**Quick Reference:** Only **Room Open** (`ludeo_Session_OpenRoom()`) is triggered by game events. Player adding (`ludeo_Room_AddPlayer()`) and gameplay begin (`ludeo_GameplaySession_Begin()`) happen inside SDK callbacks.

---

## 3. Ludeo Session vs Gameplay Session

**→ See [03-SDK-FUNDAMENTALS.md Section 2.1](./03-SDK-FUNDAMENTALS.md#21-ludeo-session-vs-gameplay-session) for full explanation**

**Quick reference:** **Ludeo Session** (Section 5): ONE per game launch, activated once, released at shutdown. **Gameplay Session** (Section 6): ONE per level/match, created and destroyed many times.

---

## 4. SDK Initialization (Game Startup)

Initialize the SDK **as early as possible** during game startup (main initialization function or GameInstance initialization).

```cpp
// Example initialization implementation

bool Initialize()
{
    // Initialize core SDK
    
    auto params = Ludeo::create<LudeoInitializeParams>();
    LudeoResult result = ludeo_Initialize(&params);
    if (result != LudeoResult::Success) {
        // Handle error - log and continue without Ludeo
        return false;
    }

    // Default ludeo commands
	ludeo_Command("backendlogs-enabled", "0");
	ludeo_Command("monitor-enabled", "0");
    
    // Local debug command used to force ludeo playback
    ludeo_Command("activation-ludeoid", /*selectedLudeoID*/);

    // Create session handle
    auto create_params = Ludeo::create<LudeoSessionCreateParams>();
    
    // Register notifications BEFORE activation
    RegisterNotifications();
    
    return true;
}
```

### Registering Notifications

Register for notifications **after session creation, before** activating the session:

```cpp
void RegisterNotifications()
{
    // Register for LudeoSelected - this is how the game knows when a user wants to play a Ludeo
    auto selectedParams = Ludeo::create<LudeoSessionAddNotifyLudeoSelectedParams>();
    LudeoResult result = ludeo_Session_AddNotifyLudeoSelected(
        session_handle, &selectedParams, callback_data, OnLudeoSelectedCallback);
    
    // Register for RoomReady - CRITICAL: register upon session creation
    auto roomReadyParams = Ludeo::create<LudeoSessionAddNotifyRoomReadyParams>();
    result = ludeo_Session_AddNotifyRoomReady(
        session_handle, &roomReadyParams, nullptr, OnRoomReadyCallback);
    
    // Check results and handle errors appropriately for your game
}
```

### Integration Point: Game Startup

```cpp
// Example: In your game's main initialization

int main()
{
    // Initialize other game systems...
    
#if LUDEO_SDK_ENABLED
    // Initialize Ludeo SDK early
    if (!InitializeLudeoSDK("your-api-key")) {
        // Log warning - game continues without Ludeo
    }
#endif
    
    // Continue game initialization...
    return RunGame();
}
```

**→ See:** [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md) for build system setup  
**→ See:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) for API patterns

---

## 5. Ludeo Session Activation

Activate **immediately after initialization** (during game startup, before main menu). **Why:** Receive LudeoSelected notifications, enable SDK overlay/platform features, prepare for gameplay sessions, establish backend connection, hide async latency in startup time.

**Window Handle (CRITICAL!):** `windowHandle` parameter is **REQUIRED** for video capture and overlay functionality. Provide native window handle for your platform. **This means Session Activation must occur AFTER graphics/window initialization** - the window must exist before you can pass its handle.

### Steam Authentication

**Two modes—implement both, config selects at runtime:**

| Mode | `authDetails` | Requires Steam? | Use Case |
|------|---------------|-----------------|----------|
| **Implicit** | `nullptr` | Yes, game must call `SteamAPI_Init()` first | Production |
| **Explicit** | `&authDetails` | No | Development |

**⚠️ Implicit gotcha:** SDK does NOT init Steam. Game must ensure Steamworks is initialized before `Session_Activate`.

```cpp
LudeoSteamAuthDetails authDetails{};

if (explicitSteamId && *explicitSteamId)
{
    // EXPLICIT: Manual credentials (dev/test)
    authDetails.authType = LudeoAuthType::Steam;
    authDetails.authId = explicitSteamId;
    params.authDetails = &authDetails;
}
else
{
    // IMPLICIT: SDK reads from Steamworks (production)
    if (SteamAPI_IsSteamRunning() && SteamAPI_Init())
        m_shutdownSteamworks = true;  // Clean up in Shutdown()
    params.authDetails = nullptr;
}
```

#### Getting Window Handle by Platform

```cpp
void* GetPlatformWindowHandle()
{
#if defined(_WIN32)
    // Windows - Get HWND
    return /* your game's HWND */;
    
#elif defined(__APPLE__)
    // macOS - Get NSWindow*
    return /* your game's NSWindow* */;
    
#elif defined(__linux__)
    // Linux - Get X11 Window or Wayland surface
    return /* your game's window */;
    
#endif
}
```

### Implementation (Both Modes Supported)

**IMPORTANT:** Implement both authentication modes using an if/else structure. The configuration determines which path is taken at runtime.

```cpp
void ActivateSession()
{
    LudeoConfig& config = LudeoConfig::Instance();
    LudeoAuthDetails steamAuthDetails = {};
    
    // Branch based on authentication mode (both modes implemented)
    if (config.GetAuthMode() == LudeoAuthMode::Explicit)
    {
        // EXPLICIT MODE: Game provides Steam credentials to Ludeo
        steamAuthDetails.authId = config.GetAuthID().c_str();
        steamAuthDetails.currentBetaName = config.GetBetaBranch().empty() 
            ? nullptr : config.GetBetaBranch().c_str();
        steamAuthDetails.authType = LudeoAuthType::Steam;
        
        LUDEO_LOG_INFO("Using explicit Steam authentication");
    }
    else
    {
        // IMPLICIT MODE: Ludeo handles Steam initialization
        LUDEO_LOG_INFO("Using implicit Steam authentication");
        
        // Optional: Initialize Steam if not already running
        if (SteamAPI_IsSteamRunning() && SteamAPI_Init())
        {
            m_shutdownSteamworks = true;  // Remember to shut down later
        }
    }
    
    // Prepare activation parameters (common for both modes)
    auto params = Ludeo::create<LudeoSessionActivateParams>();
    params.platformUrl = config.GetPlatformUrl().c_str();
    params.apiKey = config.GetApiKey().c_str();
    params.gameVersion = config.GetGameVersion().c_str();
    params.windowHandle = GetPlatformWindowHandle();  // CRITICAL for video/overlay
    
    // Set auth details based on mode
    params.authDetails = (config.GetAuthMode() == LudeoAuthMode::Explicit) 
        ? &steamAuthDetails  // Explicit: provide credentials
        : nullptr;           // Implicit: Ludeo handles it
    
    // Activate (async operation - returns void, result via callback)
    ludeo_Session_Activate(
        session_handle, &params, nullptr, OnSessionActivatedCallback);
    // Success/failure reported in OnSessionActivatedCallback
}

// Callback when activation completes
void OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data)
{
    if (data->resultCode == LudeoResult::Success) {
        // Session is now active - ready for gameplay sessions
        LudeoManager::Instance().m_session_active = true;
    } else {
        // Handle activation failure - game continues without Ludeo
    }
}
```

**Key Points:**
- Both modes are implemented in the same function using if/else
- Configuration (from file or programmatic) determines which branch executes
- Explicit mode: Populate `authDetails` with Steam credentials
- Implicit mode: Set `authDetails` to `nullptr`, optionally call `SteamAPI_Init()`
- Window handle is required for both modes

### Integration Point: After Initialization

```cpp
bool Initialize()
{
    // Load config from file (or set programmatically)
    LudeoConfig::Instance().LoadFromFile("ludeo.cfg");
    
    // ... initialization code from Section 4 ...
    
    // Activate session immediately after creation
    ActivateSession();
    
    return true;
}
```

---

## 6. Gameplay Session Management

### 6.1 Overview

A **Gameplay Session** represents one instance of gameplay. Flow: Open Room (level loading starts) → Add Player(s) → Wait for Room Ready → Begin Gameplay → End Gameplay → Remove Player(s) → Close Room.

### ⚠️ **CRITICAL: Callback-Driven Flow - Common Mistake**

**THE MISTAKE:** Calling `AddPlayer()` directly from game code after `OpenRoom()`.

```cpp
// ❌ WRONG - Don't do this!
void Game::StartMap(const char* mapName) {
    ludeo_mgr.OpenRoom(mapName);           // Async operation
    ludeo_mgr.AddPlayer(playerId, name);   // ❌ WRONG! Room not open yet!
}
```

**Why this fails:** `OpenRoom()` is async - returns before room opens. `AddPlayer()` requires open room. DataWriter/Room handles unavailable until callback fires.

**THE CORRECT FLOW:**

```cpp
// ✅ CORRECT - Game code
void Game::StartMap(const char* mapName) {
    ludeo_mgr.OpenRoom(mapName);  // Only call this from game code
    // AddPlayer happens automatically in callback chain
}

// ✅ CORRECT - Callback handler
void LudeoManager::OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data) {
    if (data->resultCode == LudeoResult::Success) {
        m_room_handle = data->room;
        m_data_writer = data->dataWriter;
        AddPlayer(m_player_id, m_player_name);  // Called from HERE
    }
}

// ✅ CORRECT - More callbacks
void LudeoManager::OnPlayerAddedCallback(...) {
    player_added = true;
    TryBeginGameplaySession();  // Checks if both conditions met
}

void LudeoManager::OnRoomReadyCallback(...) {
    room_ready = true;
    TryBeginGameplaySession();  // Checks if both conditions met
}

void LudeoManager::TryBeginGameplaySession() {
    if (m_player_added && m_room_ready) {  // BOTH must be true
        BeginGameplaySession();
    }
}
```

**The Rule:** 🎮 Game Code calls `OpenRoom()` when level loading starts. 📞 Callbacks handle `AddPlayer()`, `BeginGameplaySession()`. SDK callback chain drives flow automatically.

**Integration Points:** Game code: **1** (OpenRoom only). Callback handlers: **4** (OnRoomOpened, OnPlayerAdded, OnRoomReady, TryBeginGameplaySession).

---

### 6.2 Opening a Room (Level Loading Starts)

**🎮 GAME CODE INTEGRATION POINT** - Call when level/match **starts loading** (not when ready).

```cpp
void OnGameplayLoading(const char* levelId, const char* playerId)
{
    auto room_params = Ludeo::create<LudeoSessionOpenRoomParams>();
    room_params.roomId = nullptr;  // Auto-generate room ID
    room_params.ludeoId = pending_ludeo_id;  // nullptr if not restoring
    
    // Async operation - returns void, result via callback
    ludeo_Session_OpenRoom(
        session_handle, &room_params, callback_data, OnRoomOpenedCallback);
    // Success/failure reported in OnRoomOpenedCallback
}
```

### 6.3 Room Opened Callback

**📞 SDK CALLBACK HANDLER** - SDK calls this when room is ready (NOT called directly by game code).

```cpp
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) return;
    
    room_handle = data->room;
    data_writer = data->dataWriter;  // CRITICAL: Store DataWriter
    
    AddPlayerToRoom(player_id);  // ← Trigger player adding from HERE
}
```

### 6.4 Adding Players to Room

**📞 CALLED FROM SDK CALLBACK** - Triggered by `OnRoomOpenedCallback`

**CRITICAL:** Add **ALL players** that will participate. Single-player: one player. Multiplayer: add each player. Called from `OnRoomOpenedCallback`, not from game event handlers.

```cpp
void AddPlayerToRoom(const char* playerId)
{
    auto params = Ludeo::create<LudeoRoomAddPlayerParams>();
    params.playerId = playerId;
    
    // Async operation - returns void, result via callback
    ludeo_Room_AddPlayer(
        room_handle, &params, callback_data, OnPlayerAddedCallback);
    // Success/failure reported in OnPlayerAddedCallback
}

void OnPlayerAddedCallback(const LudeoRoomAddPlayerCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) {
        // Handle add player failure
        return;
    }
    
    // Store GameplaySession handle for this player
    gameplay_session_handle = data->gameplaySession;
    player_added = true;
    
    // For multiplayer: Add remaining players
    // For single-player: Check if both conditions met to begin gameplay
    TryBeginGameplaySession();  // ← May trigger gameplay begin from HERE
}
```

### 6.5 Room Ready Notification

**📞 SDK CALLBACK HANDLER** - SDK calls this automatically when room is ready (NOT triggered by game events).

**CRITICAL:** Must wait for **Room Ready** notification before beginning gameplay. Confirms all players added successfully. **Must register upon session creation** (Section 4), before any room is opened.

> **Dual role — also the post-Ludeo-load resume:** This same `OnRoomReadyCallback` is what unpauses the game during **Ludeo playback**. After a Ludeo is selected and restoration completes, the game stays paused; when the player presses Play on the Ludeo overlay, the SDK runs this same `OpenRoom → AddPlayer → RoomReady → Begin` chain, and **`OnRoomReadyCallback` is where the game calls `TryBeginGameplaySession()` and unpauses**. The restoration phases (`/10`, `/11`, [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §7, [CR-010](./00-CRITICAL-REQUIREMENTS.md)) **reuse** this callback as the post-restore resume — they do not introduce a separate one. (`ResumeGameRequest` is a *different* notification, used only for mid-play overlay open/close.)

```cpp
// 🎮 GAME CODE: Register during session creation (Section 4)
void RegisterRoomReadyNotification()
{
    auto params = Ludeo::create<LudeoSessionAddNotifyRoomReadyParams>();
    
    LudeoResult result = ludeo_Session_AddNotifyRoomReady(
        session_handle, &params, callback_data, OnRoomReadyCallback);
    
    // Check result and handle appropriately
}

// 📞 SDK CALLBACK: Called automatically by SDK when room ready
void OnRoomReadyCallback(const LudeoSessionRoomReadyCallbackParams* data)
{
    if (data->resultCode == LudeoResult::Success) {
        // Room is ready
        room_ready = true;
        
        // Check if player was already added - if both conditions met, begin gameplay
        TryBeginGameplaySession();  // ← May trigger gameplay begin from HERE
    }
}
```

### 6.6 Beginning Gameplay (After Loading Complete)

**📞 CALLED FROM SDK CALLBACKS** - Triggered when both conditions are met.

**PREREQUISITES (both must be true):** ✅ Player(s) added (`OnPlayerAddedCallback` received) ✅ Room Ready received (`OnRoomReadyCallback` fired).

**IMPORTANT:** Called from SDK callbacks (Sections 6.4 and 6.5), not directly from game code. Both `OnPlayerAddedCallback` and `OnRoomReadyCallback` call `TryBeginGameplaySession()`, which checks if both conditions are met.

```cpp
void TryBeginGameplaySession()
{
    // Only begin when BOTH conditions are met
    if (!player_added || !room_ready) {
        return;  // Wait for other condition
    }
    
    OnGameplayBegin();  // ← Gameplay begin happens HERE
}

void OnGameplayBegin()
{
    auto params = Ludeo::create<LudeoGameplaySessionBeginParams>();
    
    // Async operation - returns void, result via callback
    ludeo_GameplaySession_Begin(
        gameplay_session_handle, &params, nullptr, OnGameplayBeginCallback);
    // Success/failure reported in OnGameplayBeginCallback
}

void OnGameplayBeginCallback(const LudeoGameplaySessionBeginCallbackParams* data)
{
    if (data->resultCode == LudeoResult::Success) {
        // Gameplay session is now active
        gameplay_session_active = true;
    } else {
        // Handle begin gameplay failure
    }
}
```

### 6.7 Ending Gameplay

Call this when gameplay ends (level complete, match over, player dies, etc.).

```cpp
void OnGameplayEnd(bool isAbort)
{
    auto params = Ludeo::create<LudeoGameplaySessionEndParams>();
    params.isAbort = isAbort ? LUDEO_TRUE : LUDEO_FALSE;
    
    // Async operation - returns void, result via callback
    ludeo_GameplaySession_End(
        gameplay_session_handle, &params, callback_data, OnGameplayEndedCallback);
    // Success/failure reported in OnGameplayEndedCallback
}

void OnGameplayEndedCallback(const LudeoGameplaySessionEndCallbackParams* data)
{
    gameplay_session_active = false;
    
    // CRITICAL: Remove all players before closing room
    RemovePlayerFromRoom(player_id);
}
```

### 6.8 Removing Players from Room

**CRITICAL:** Remove **ALL players** from room before closing (reverse of adding players).

```cpp
void RemovePlayerFromRoom(const char* playerId)
{
    auto params = Ludeo::create<LudeoRoomRemovePlayerParams>();
    params.playerId = playerId;
    
    // Async operation - returns void, result via callback
    ludeo_Room_RemovePlayer(
        room_handle, &params, callback_data, OnPlayerRemovedCallback);
    // Success/failure reported in OnPlayerRemovedCallback
}

void OnPlayerRemovedCallback(const LudeoRoomRemovePlayerCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) {
        // Handle remove player failure
        return;
    }
    
    // For multiplayer: Remove remaining players
    // For single-player: All players removed, proceed to close room
    
    if (all_players_removed) {
        CloseRoom();
    }
}
```

### 6.9 Closing Room

**PREREQUISITE:** All players must be removed before closing.

```cpp
void CloseRoom()
{
    auto close_params = Ludeo::create<LudeoRoomCloseParams>();
    
    // Async operation - returns void, result via callback
    ludeo_Room_Close(
        room_handle, &close_params, callback_data, OnRoomClosedCallback);
    // Success/failure reported in OnRoomClosedCallback
}

void OnRoomClosedCallback(const LudeoRoomCloseCallbackParams* data)
{
    // Cleanup handles
    room_handle = nullptr;
    data_writer = nullptr;
    gameplay_session_handle = nullptr;
    
    // Ready for next gameplay session
}
```

### 6.10 Integration Points

**KEY CONCEPT:** Only **Room Opening** called directly from game code. Player adding and gameplay begin triggered by SDK callbacks.

```cpp
// 🎮 GAME CODE INTEGRATION POINT
void LoadLevel(const char* levelId)
{
#if LUDEO_SDK_ENABLED
    OnGameplayLoading(levelId, GetCurrentPlayerId());  // Triggers callback chain
#endif
    // Continue loading... (Gameplay begin happens asynchronously via callbacks)
}

// 🎮 GAME CODE INTEGRATION POINT
void OnLevelEnd(bool playerQuit)
{
#if LUDEO_SDK_ENABLED
    OnGameplayEnd(playerQuit);  // End gameplay, remove players, close room
#endif
}
```

**→ See:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) for state tracking during gameplay  
**→ See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) for LudeoSelected handling

---

## 7. Session Cleanup and Shutdown

### 7.1 Releasing Session

Release Ludeo Session when game is shutting down:

```cpp
void ReleaseSession()
{
    // Ensure room is closed first if still open
    if (room_handle != nullptr) {
        // Close room before releasing session
    }
    
    auto params = Ludeo::create<LudeoSessionReleaseParams>();
    
    // Async operation - returns void, result via callback
    ludeo_Session_Release(
        session_handle, &params, callback_data, OnSessionReleasedCallback);
    // Success/failure reported in OnSessionReleasedCallback
}

void OnSessionReleasedCallback(const LudeoSessionReleaseCallbackParams* data)
{
    session_handle = nullptr;
    session_active = false;
    
    // Session released successfully
}
```

### 7.2 SDK Shutdown

Shutdown the SDK when the game exits:

```cpp
void Shutdown()
{
    // Release session first
    if (session_handle != nullptr) {
        ReleaseSession();
        // May need to wait for callback depending on your implementation
    }
    
    // Shutdown SDK
    ludeo_Shutdown();
}
```

### 7.3 Integration Point: Game Exit

```cpp
// Example: In your game's shutdown code

void GameShutdown()
{
#if LUDEO_SDK_ENABLED
    ShutdownLudeoSDK();
#endif
    
    // Shutdown other systems...
}
```

---

## 8. Integration Points Summary

### Game Code Integration Points

| Integration Point | SDK Function | When to Call | Notes |
|------------------|--------------|--------------|-------|
| **SDK Initialize** | `ludeo_Initialize()` | Game launch, after core dependencies loaded | Early startup, before game systems |
| **SDK Session Activate** | `ludeo_Session_Activate()` | After window/OpenGL context ready | Window handle must be available |
| **SDK Tick** | `ludeo_Session_Tick()` | Every frame, main game loop | Must be called consistently on main thread |
| **Gameplay Session Start** | `ludeo_Session_OpenRoom()` | When level/match loading starts | **NOT when ready** - call when loading begins |
| **Gameplay Session End** | `ludeo_GameplaySession_End()` | When gameplay ends, before map cleanup | Match over, level complete, before cleanup |
| **SDK Shutdown** | `ludeo_Shutdown()` | Game exit, during shutdown | Before resource cleanup |

**⚠️ CRITICAL - NOT game code integration points:** `ludeo_Room_AddPlayer()` (called from `OnRoomOpenedCallback`), `ludeo_GameplaySession_Begin()` (called from `TryBeginGameplaySession()`), `ludeo_Room_RemovePlayer()` (called from `OnGameplayEndedCallback`), `ludeo_Room_Close()` (called from `OnPlayerRemovedCallback`).

### Complete Integration Checklist

| Game Event | Ludeo Action | SDK Function | Called From | Notes |
|------------|--------------|--------------|-------------|-------|
| Game launch | Initialize SDK | `ludeo_Initialize()` | 🎮 Game code | Early in startup |
| Game ready | Activate session | `ludeo_Session_Activate()` | 🎮 Game code | After init, before menu |
| Every frame | Process callbacks | `ludeo_Session_Tick()` | 🎮 Game code | In main loop |
| **Level/match loading** | **Open room** | **`ludeo_Session_OpenRoom()`** | **🎮 Game code** | **When loading starts** |
| Room opened | Add player(s) | `ludeo_Room_AddPlayer()` | 📞 SDK callback | Called from `OnRoomOpenedCallback` |
| Player added | Track condition | `OnPlayerAddedCallback()` | 📞 SDK callback | Set `player_added = true` |
| Room ready | Track condition | `OnRoomReadyCallback()` | 📞 SDK callback | Set `room_ready = true` |
| Both conditions met | Begin gameplay | `ludeo_GameplaySession_Begin()` | 📞 SDK callback | Called from `TryBeginGameplaySession()` helper |
| Gameplay ends | End gameplay | `ludeo_GameplaySession_End()` | 🎮 Game code | Match over, level complete |
| Gameplay session ended | Remove player(s) | `ludeo_Room_RemovePlayer()` | 📞 SDK callback | Remove ALL players |
| All players removed | Close room | `ludeo_Room_Close()` | 📞 SDK callback | Final cleanup |
| Game shutdown | Release & shutdown | `ludeo_Shutdown()` | 🎮 Game code | During exit |

**Legend:**
- 🎮 **Game code** = Call from your game's event handlers (integration points)
- 📞 **SDK callback** = Called automatically by SDK in response to async operations (NOT integration points)

### State Machine

```
UNINITIALIZED
    │
    ├─► Initialize() ──► INITIALIZED
    │                        │
    │                        ├─► ActivateSession() ──► SESSION_ACTIVE
    │                                                        │
    │                                                        ├─► OnGameplayLoading()
    │                                                        │       │
    │                                                        │       ├─► Room Opens
    │                                                        │       │       │
    │                                                        │       │       ├─► Add Player(s)
    │                                                        │       │               │
    │                                                        │       │               ├─► Room Ready
    │                                                        │       │                       │
    │                                                        │       │                       ├─► READY_FOR_GAMEPLAY
    │                                                        │       │                               │
    │                                                        │       │                               ├─► OnGameplayBegin()
    │                                                        │       │                                       │
    │                                                        │       │                                       ├─► GAMEPLAY_ACTIVE
    │                                                        │       │                                               │
    │                                                        │       │                                               ├─► OnGameplayEnd()
    │                                                        │       │                                                       │
    │                                                        │       │                                                       ├─► Remove Player(s)
    │                                                        │       │                                                               │
    │                                                        │       │                                                               ├─► Close Room
    │                                                        │       └───────────────────────────────────────────────────────────────┘
    │                                                        │       (Can repeat for multiple gameplay sessions)
    │                                                        │
    │                                                        ├─► Shutdown() ──► SHUTTING_DOWN
    │                                                                               │
    └────────────────────────────────────────────────────────────────────────────► SHUTDOWN
```

---

## 9. Timeline and Flow Diagrams

### Full Lifecycle Timeline

```
┌──────────────────────────────────────────────────────────────────┐
│ GAME LAUNCH                                                      │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Initialize()                                               │
│ ludeo_Session_Create()                                           │
│ ludeo_Session_AddNotifyLudeoSelected()                          │
│ ludeo_Session_Activate() ──────────► [ASYNC]                    │
│     └─► OnSessionActivatedCallback() ──► Ludeo Session Active   │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LEVEL/MATCH STARTS LOADING                                       │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Session_OpenRoom() ──────────► [ASYNC]                    │
│     └─► OnRoomOpenedCallback()                                  │
│         └─► DataWriter available                                │
│         └─► ludeo_Room_AddPlayer() ──────────► [ASYNC]         │
│             └─► OnPlayerAddedCallback()                         │
│                 └─► GameplaySession handle ready                │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ LOADING COMPLETE, GAMEPLAY BEGINS                                │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_GameplaySession_Begin() [SYNC]                             │
│     └─► Returns immediately - full tracking active              │
│                                                                  │
│ [TRACK GAMEPLAY - Use DataWriter to capture state]              │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ GAMEPLAY ENDS                                                    │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_GameplaySession_End() ──────────► [ASYNC]                 │
│     └─► OnGameplayEndedCallback()                               │
│         └─► ludeo_Room_RemovePlayer() ──────────► [ASYNC]      │
│             └─► OnPlayerRemovedCallback()                       │
│                 └─► ludeo_Room_Close() ──────────► [ASYNC]     │
│                     └─► OnRoomClosedCallback()                  │
│                         └─► Room closed, ready for next session │
└──────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Can repeat for multiple gameplay sessions)
                            │
┌──────────────────────────────────────────────────────────────────┐
│ GAME SHUTDOWN                                                    │
├──────────────────────────────────────────────────────────────────┤
│ ludeo_Session_Release() ──────────► [ASYNC]                     │
│     └─► OnSessionReleasedCallback()                             │
│         └─► ludeo_Shutdown()                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Callback Chain

```
Initialize()
    │
    └─► Session_Create() [SYNC]
        │
        └─► AddNotifyLudeoSelected() [SYNC]
            │
            └─► Session_Activate() [ASYNC]
                    │
                    └─► OnSessionActivatedCallback()
                            │
                            └─► [Ready for gameplay sessions]
                                    │
                                    └─► OpenRoom() [ASYNC]
                                            │
                                            └─► OnRoomOpenedCallback()
                                                    │
                                                    └─► AddPlayer() [ASYNC] (repeat for all players)
                                                            │
                                                            └─► OnPlayerAddedCallback()
                                                                    │
                                                                    └─► TryBeginGameplaySession()
                                                                            │
                                                                            (waits for OnRoomReadyCallback if not yet received)
                                                                            │
                                                    OnRoomReadyCallback() ──┴─► (if both conditions met)
                                                                                    │
                                                                                    └─► GameplaySession_Begin() [SYNC]
                                                                                    │
                                                                                    └─► ... gameplay ...
                                                                                                    │
                                                                                                    └─► GameplaySession_End() [ASYNC]
                                                                                                            │
                                                                                                            └─► OnGameplayEndedCallback()
                                                                                                                    │
                                                                                                                    └─► RemovePlayer() [ASYNC]
                                                                                                                            │
                                                                                                                            └─► OnPlayerRemovedCallback()
                                                                                                                                    │
                                                                                                                                    └─► Room_Close() [ASYNC]
```

---

## 10. Error Handling

**General Principles:** Always check return values, log errors but don't crash, gracefully degrade (game works without Ludeo), clean up partial state on errors.

### Error Handling Pattern

**For synchronous operations** (e.g., `ludeo_Initialize()`):
```cpp
LudeoResult result = ludeo_Initialize(&params);
if (result != LudeoResult::Success) {
    // Log error appropriately for your game
    // Continue game execution - don't crash
    // Set flag that Ludeo is unavailable for this session
    ludeo_available = false;
    return;
}
```

**For asynchronous operations** (e.g., `ludeo_Session_OpenRoom()`) - handle errors in callbacks:
```cpp
// Async functions return void - cannot check result here
ludeo_Session_OpenRoom(session, &params, nullptr, OnRoomOpenedCallback);

// Handle result in callback
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data) {
    if (data->resultCode != LudeoResult::Success) {
        // Log error appropriately for your game
        ludeo_available = false;
        return;
    }
    // Success - continue with room operations
}
```

### Common Error Scenarios

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| Initialization fails | Log warning, continue without Ludeo |
| Session activation fails | Log error, disable Ludeo features |
| Room open fails | Skip tracking for this gameplay session |
| Player add fails | Close room, retry or skip session |
| Gameplay begin fails | Log error, continue gameplay without tracking |

### Defensive Checks

```cpp
// Always check if handles are valid before using
if (data_writer == nullptr) {
    // DataWriter not available - skip operation
    return;
}

if (!session_active) {
    // Session not active - cannot start gameplay
    return;
}

if (room_handle != nullptr) {
    // Room already open - close previous room first
    return;
}
```

---

## 11. Testing and Validation

### Lifecycle Test Checklist

```markdown
## SDK Lifecycle Tests

### Initialization
- [ ] SDK initializes without errors
- [ ] Session handle created successfully
- [ ] Notifications registered
- [ ] Activation starts successfully
- [ ] OnSessionActivatedCallback receives Success

### Gameplay Session
- [ ] Room opens when gameplay loads
- [ ] OnRoomOpenedCallback receives DataWriter
- [ ] All players added successfully
- [ ] OnPlayerAddedCallback receives GameplaySession handle for each player
- [ ] OnRoomReadyCallback fires (registered at session creation via ludeo_Session_AddNotifyRoomReady)
- [ ] GameplaySession begins after room ready confirmed (synchronous call)
- [ ] GameplaySession_Begin returns Success

### Cleanup
- [ ] GameplaySession ends when gameplay ends
- [ ] All players removed from room
- [ ] OnPlayerRemovedCallback fires for each player
- [ ] Room closes after all players removed
- [ ] Multiple gameplay sessions work correctly (play multiple levels)
- [ ] Session releases on shutdown
- [ ] SDK shuts down cleanly

### Error Handling
- [ ] Failed initialization doesn't crash game
- [ ] Game works without Ludeo if SDK unavailable
- [ ] Null checks prevent crashes
- [ ] Errors logged clearly
```

### Expected Log Output Example

```
SDK initialized
Session created
Session activation started (async)
Ludeo Session activated - ready for gameplay

Opening room for level: <level_id>
Room opened - DataWriter available
Adding player to room: <player_id>
Player added - GameplaySession handle received
Room ready - all players added
Beginning gameplay session - tracking active

... gameplay happens ...

Ending gameplay session
Gameplay Session ended
Removing player from room: <player_id>
Player removed
Closing room
Room closed - ready for next session

... can repeat for multiple gameplay sessions ...

Releasing session
Session released
SDK shutdown complete
```

### Validation Commands

```cpp
// Example: Add debug commands to validate state
void PrintLudeoStatus()
{
    // Print: SDK initialized, session active, room open, gameplay session active,
    // DataWriter handle validity, DataReader handle validity (if restoring)
}
```

---

## Related Documentation

- **⚠️ Critical:** [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Non-negotiable rules
- **📖 Prerequisites:** [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - SDK API patterns
- **🔗 Related:** [04-BUILD-INTEGRATION.md](./04-BUILD-INTEGRATION.md) - Build system setup
- **🔗 Next Steps:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Object tracking during gameplay
- **🔗 Advanced:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - LudeoSelected and restoration

---

**Last Updated:** December 2025  
**Version:** 1.0

