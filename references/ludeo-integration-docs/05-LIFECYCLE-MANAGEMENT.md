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
| **Gameplay End** | Creator Flow: match/level ends. Player Flow: only a game interrupt (§6.11) — the backend ends a Ludeo | `ludeo_GameplaySession_End()` | Tracking stopped |
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

Register for notifications **after session creation, before** activating the session. **These are session-lifetime — register them once at session creation, not per-Ludeo.** Five are required for a working integration; one is optional:

| Notification | Required? | Triggers / Purpose |
|---|---|---|
| `ludeo_Session_AddNotifyLudeoSelected` | ✅ | Player picked a Ludeo from the overlay — entry into the restoration flow (`07-RESTORATION-PATTERNS.md` §2). |
| `ludeo_Session_AddNotifyRoomReady` | ✅ | Gameplay-session-start gate (§6.5) — and, during playback, the viewer's Play click (CR-010). |
| `ludeo_Session_AddNotifyPauseGameRequest` | ✅ | Ludeo overlay opened during playback — **game MUST pause (freeze the sim, not just input)** (CR-011). |
| `ludeo_Session_AddNotifyResumeGameRequest` | ✅ | Ludeo overlay closed during playback — game resumes (CR-011). |
| `ludeo_Session_AddNotifyBackToMenuRequest` | ✅ | Player chose "back to menu" from the overlay — tear down the current Ludeo gameplay session + room and navigate to menu. |
| `ludeo_Session_AddNotifyMuteRequest` | optional | Platform requests mute — mute game audio. |

> ⚠️ **Skipping `PauseGameRequest`/`ResumeGameRequest` is the #1 mid-play failure** — the game keeps running while the Ludeo overlay covers it, and the player sees a game they can't see playing itself. CR-011 makes this non-negotiable.

```cpp
void RegisterNotifications()
{
    // LudeoSelected — entry into restoration (07 §2)
    auto selectedParams = Ludeo::create<LudeoSessionAddNotifyLudeoSelectedParams>();
    ludeo_Session_AddNotifyLudeoSelected(
        session_handle, &selectedParams, callback_data, OnLudeoSelectedCallback);

    // RoomReady — gameplay-session-start gate (§6.5); during playback, the viewer's Play click (CR-010)
    auto roomReadyParams = Ludeo::create<LudeoSessionAddNotifyRoomReadyParams>();
    ludeo_Session_AddNotifyRoomReady(
        session_handle, &roomReadyParams, nullptr, OnRoomReadyCallback);

    // PauseGameRequest — overlay opened mid-play → FREEZE the sim (CR-011)
    auto pauseParams = Ludeo::create<LudeoSessionAddNotifyPauseGameRequestParams>();
    ludeo_Session_AddNotifyPauseGameRequest(
        session_handle, &pauseParams, callback_data, OnPauseGameRequestCallback);

    // ResumeGameRequest — overlay closed mid-play → resume (CR-011)
    auto resumeParams = Ludeo::create<LudeoSessionAddNotifyResumeGameRequestParams>();
    ludeo_Session_AddNotifyResumeGameRequest(
        session_handle, &resumeParams, callback_data, OnResumeGameRequestCallback);

    // BackToMenuRequest — overlay "back to menu" → tear down + navigate
    auto backToMenuParams = Ludeo::create<LudeoSessionAddNotifyBackToMenuRequestParams>();
    ludeo_Session_AddNotifyBackToMenuRequest(
        session_handle, &backToMenuParams, callback_data, OnBackToMenuRequestCallback);

    // (Optional) AddNotifyMuteRequest — platform-driven audio mute

    // Check each result and handle errors appropriately
}
```

**Handler responsibilities** (the contract — engine-specific implementations vary):
- `OnLudeoSelectedCallback` — marshal off the SDK thread; continue per `07-RESTORATION-PATTERNS.md` §2.
- `OnRoomReadyCallback` — `TryBeginGameplaySession()`. Dual role: gameplay-session-start gate (tracking) AND, during playback, the viewer's Play click — `Begin` then unfreezes the already-restored moment (§6.11, CR-010).
- `OnPauseGameRequestCallback` — **freeze the simulation tick** (not just input). Reuse the game's pause; build a minimal tick-freeze if none. Freezing does not stop the objective timer: in phase 6 this path also reports `PauseLudeo` via the pause primitive (CR-011, `06 §7.3`).
- `OnResumeGameRequestCallback` — unfreeze the sim (and, from phase 6, report `ResumeLudeo`).
- `OnBackToMenuRequestCallback` — tear down the current Ludeo gameplay session + room (SDK Session stays alive); navigate to main menu.
- `OnMuteRequestCallback` (optional) — the request says whether to mute or unmute (the field is in `SessionTypes.h`). Apply it as a **separate mute layer** on the game's master audio, idempotent across repeats. **Don't write it into the player's saved volume settings**, so unmuting restores exactly what the player had. It is session-lifetime like the others: register it once, and don't reset it per Ludeo.

→ See `07-RESTORATION-PATTERNS.md` §2.4 for the overlay-control flow in the restoration context, **CR-010** (the restored moment held frozen until Play), and **CR-011** (mid-play overlay pause).

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

> **No main menu to hide that latency?** A game that boots straight into gameplay, auto-starts from a fast menu, or launches into a preselected Ludeo has nothing to absorb the async `Activate`. It needs an explicit, bounded **SDK-readiness gate** before its first interactive frame, and an idle "ready" state before any room opens. If the activation traffic in `ludeo_Tick()` stalls the game's own async boot, activation can be deferred. See [LAUNCH-AND-READINESS.md](./LAUNCH-AND-READINESS.md).

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
        steamAuthDetails.authId = config.GetExplicitAuthID().c_str();
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

> **No discrete level / match / mission?** The `(level, match, mission)` examples in [§3](#3-ludeo-session-vs-gameplay-session) are illustrative, not constraining. For open-world / streaming / sandbox / MMO games — where session boundaries are state-machine or event-driven rather than scene loads — **one continuous live run is one Gameplay Session**. Bind `OpenRoom` to the game's canonical "gameplay began" event, end on death / return-to-menu / quit, and keep the standard two-gate `RoomReady + PlayerAdded` (no third gate needed — see [`game-patterns/open-world.md`](./game-patterns/open-world.md) §4). Read [`game-patterns/open-world.md`](./game-patterns/open-world.md) before mapping `OpenRoom` for these games.

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
    room_params.ludeoId = pending_ludeo_id;  // selected Ludeo id when replaying; nullptr when recording — see callout
    
    // Async operation - returns void, result via callback
    ludeo_Session_OpenRoom(
        session_handle, &room_params, callback_data, OnRoomOpenedCallback);
    // Success/failure reported in OnRoomOpenedCallback
}
```

> 🔴 **`ludeoId` selects the flow — it is what makes a rerun a *scored replay* rather than a new recording.** Setting `room_params.ludeoId` to the selected Ludeo's id opens the room in **Player Flow**: the SDK serves the captured Ludeo and **scores the run against its win/fail conditions** (via the action sends that fire during playback — [06 §7](./06-TRACKING-PATTERNS.md)). Leaving it `nullptr` opens **Creator Flow** — a fresh recording (the tracking default). On the restoration path the id comes from the `LudeoSelected` callback (`params->ludeoId` — the **same** id you pass to `ludeo_Session_GetLudeo` for the state reader); stash it (e.g. `m_pending_ludeo_id`) and pass it here. **Opening the playback room with `nullptr` is the silent "state restored perfectly but the rerun isn't a scored replay" failure** — see §6.11 for the full playback lifecycle and [07-RESTORATION-PATTERNS.md §2](./07-RESTORATION-PATTERNS.md).

### 6.3 Room Opened Callback

**📞 SDK CALLBACK HANDLER** - SDK calls this when room is ready (NOT called directly by game code).

```cpp
void OnRoomOpenedCallback(const LudeoSessionOpenRoomCallbackParams* data)
{
    if (data->resultCode != LudeoResult::Success) return;
    
    room_handle = data->room;
    data_writer = data->dataWriter;  // CRITICAL: Store DataWriter
    
    // Trigger player adding from HERE — queued, never inline inside the SDK's dispatch (03 §8.3)
    LudeoManager::Instance().QueueOperation([] { AddPlayerToRoom(player_id); });
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
    // For single-player: Check if both conditions met to begin gameplay (queued — 03 §8.3)
    LudeoManager::Instance().QueueOperation([] { TryBeginGameplaySession(); });
}
```

### 6.5 Room Ready Notification

**📞 SDK CALLBACK HANDLER** - SDK calls this automatically when room is ready (NOT triggered by game events).

**CRITICAL:** Must wait for **Room Ready** notification before beginning gameplay. Confirms all players added successfully. **Must register upon session creation** (Section 4), before any room is opened.

> **Dual role — also the Play click during playback:** This same `OnRoomReadyCallback` is what resumes the game during **Ludeo playback**. On the playback path the room is opened (with the Ludeo's `ludeoId`, §6.2) and the player added **after** the restored moment has been built, applied and settled — so by the time the overlay shows Play, the captured moment is on screen, frozen, and only `room_ready` is pending. The platform **withholds `RoomReady` until the viewer presses Play**; when it fires, **`OnRoomReadyCallback` calls `TryBeginGameplaySession()`**, which issues `Begin` and then unfreezes — nothing is loaded or applied after Play. The SDK does **not** open the room or add the player on the Play press — that already happened (§6.11). The restoration phases (`phase 5 · task 2`, `phase 5 · task 3`, [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §7, [CR-010](./00-CRITICAL-REQUIREMENTS.md)) **reuse** this callback as the post-restore resume — they do not introduce a separate one. (`ResumeGameRequest` is a *different* notification, used only for mid-play overlay open/close.)

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
        
        // Check if player was already added - if both conditions met, begin gameplay (queued — 03 §8.3)
        LudeoManager::Instance().QueueOperation([] { TryBeginGameplaySession(); });
    }
}
```

### 6.6 Beginning Gameplay (After Loading Complete)

**📞 CALLED FROM SDK CALLBACKS** - Triggered when both conditions are met.

**PREREQUISITES (both must be true):** ✅ Player(s) added (`OnPlayerAddedCallback` received) ✅ Room Ready received (`OnRoomReadyCallback` fired).

**IMPORTANT:** Called from SDK callbacks (Sections 6.4 and 6.5), not directly from game code. Both `OnPlayerAddedCallback` and `OnRoomReadyCallback` call `TryBeginGameplaySession()`, which checks if both conditions are met.

> ⚠️ **The two callbacks can arrive in EITHER order — never assume one precedes the other.** `OnPlayerAddedCallback` and `OnRoomReadyCallback` are independent async completions; depending on timing, SDK version, and (during playback) when the player presses Play, either may fire first. That is *why* both call the same `TryBeginGameplaySession()` and it gates on **both** flags rather than either one acting alone. Do not wire `Begin` to assume a fixed arrival order. During restoration the apply has already run before the room opened; on `RoomReady`, `Begin` and then the unfreeze — correct regardless of which flag was set first.

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

**Creator Flow:** call this when gameplay ends (level complete, match over, player dies, etc.).
**Player Flow:** the game's own end does **not** call this — the backend ends a Ludeo, and the game holds the world
until it does. Only a game interrupt (validated `LudeoSelected`, `BackToMenuRequest`, quit, error) calls it, with
`isAbort=true` (§6.11).

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
    
    // CRITICAL: Remove all players before closing room — queued, never inline: the SDK is still tearing
    // down (video encoder) on this tick, and a call issued inside its dispatch can abort() the process (03 §8.3)
    LudeoManager::Instance().QueueOperation([] { RemovePlayerFromRoom(player_id); });
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
        LudeoManager::Instance().QueueOperation([] { CloseRoom(); });   // queued — 03 §8.3
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
    if (LudeoManager::Instance().IsPlayerFlow() && !playerQuit) {
        // A Ludeo is playing: the backend owns its end (§6.11). Hold the world on the end screen,
        // keep the room open, and block restart / map vote / next level until PauseGameRequest.
        LudeoManager::Instance().HoldForBackendEnd();
        return;
    }
    OnGameplayEnd(playerQuit);  // Creator Flow, or a quit: End, remove players, close room
#endif
}
```

**→ See:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) for state tracking during gameplay  
**→ See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) for LudeoSelected handling

---

### 6.11 Playback (Player Flow) Session Lifecycle

Everything in §6.1–§6.10 describes a gameplay session that **records** (Creator Flow). A session that **replays a selected Ludeo** (Player Flow) uses the **same** `OpenRoom → AddPlayer → RoomReady → Begin` chain and the **same** `TryBeginGameplaySession()` two-gate (§6.6) — `Begin` fires only when **both** `player_added` **and** `room_ready` are true. Only two things differ, and getting either wrong yields a Ludeo that **restores correctly but whose rerun fails** — the most common shape of "reconstructs fine, rerun broken."

**1. The room is opened with the Ludeo's `ludeoId` — after the restored moment is built, not at `LudeoSelected` and not on Play.**
The flow ([07 §2.1](./07-RESTORATION-PATTERNS.md)) is: `LudeoSelected` → `GetLudeo` validates the selection (read-only) → commit → reach active gameplay on the captured level → freeze → apply → settle → freeze → **`OpenRoom(ludeoId)`**. So `OpenRoom` is called **directly by the restore flow** once the moment is settled, *not* hung off the "OpenRoom when level-load starts" path (§6.2) that Creator Flow uses. It **must carry the selected `ludeoId`**. That drives `OnRoomOpened → AddPlayer → OnPlayerAdded`, so `player_added` becomes true and `TryBeginGameplaySession()` runs — but it **waits**, because `room_ready` is still false (see below). `ludeoId = nullptr` on this call turns the entire rerun into a Creator-flow recording instead of a scored replay (§6.2).

**2. `RoomReady` is the viewer's Play click; `Begin` still needs both gates.**
On the playback path the platform **withholds `RoomReady` until the viewer presses Play** — a long `AddPlayer → RoomReady` gap in a log is a person reading the overlay, not SDK latency. When it fires, `room_ready` becomes true and `TryBeginGameplaySession()` issues `ludeo_GameplaySession_Begin` once `player_added` **and** `room_ready` are set (and the restore has applied), **then unfreezes**. The apply already ran before the room opened, so nothing loads or is written after Play, and the SDK records playback from the restored state (CR-010). In the typical playback timeline `player_added` is already set — but **do not hard-code that order** (§6.6): the gate is order-independent by design, and `TryBeginGameplaySession()` is also called from `OnPlayerAddedCallback`. This is the *same* `RoomReady` callback and the *same* two-gate as tracking-start (§6.5–§6.6) — playback **reuses** it; it does **not** introduce a new resume signal. Not `PlayerReady` (doesn't exist), not `ResumeGameRequest` (mid-play overlay open/close only — [07 §2.4](./07-RESTORATION-PATTERNS.md)).

**3. Ending a playback session (end) — two distinct paths:**

| End path | Who ends it | What the game does |
|---|---|---|
| **Backend ends the Ludeo** — timer hits 0, objective met/failed, or any backend-decided reason | **The backend** — the game does **NOT** detect end-of-moment and does **NOT** call `End` or "submit" | The backend sends **`PauseGameRequest`**; the game's handler just **pauses (freezes the sim)** and waits for further platform events (CR-011). Submission is the backend's job. There is **no game-facing "moment ended" callback** — `PauseGameRequest` is the universal end-of-moment cue. |
| **Game-initiated interrupt** — another `LudeoSelected` mid-play, `BackToMenuRequest`, or the player quitting | **The game** calls `ludeo_GameplaySession_End(isAbort=true)` | Tear down: `End(isAbort=true) → RemovePlayer → CloseRoom` (§6.7–§6.9). The SDK `Session` stays alive. |
| **The game's own end inside a Ludeo** — match over (frag/time limit), race finished, level complete, game over, intermission, map vote | **Nobody yet** — this is **not** an end path. The backend still ends the Ludeo on its timer, goal or constraint | **Hold the world**: keep the room and gameplay session open, stay on (or freeze at) the end screen, and **block** every follow-on the game would start by itself — map restart, map vote / next level, a respawn-limit restart, a Creator room for the next match. The goal check needs the session alive until the backend's `PauseGameRequest`. The hold is **not a pause**: no `PauseLudeo` (it would stop the objective timer and the backend would never end the Ludeo). |

**Seen in the field (each ended Ludeos early and lost the timer goal):** a match end called `End` as an abort, then the
map vote loaded the next map and opened a Creator room mid-Ludeo; a key press on the intermission scoreboard restarted
the map; a finished race ended the session at the line ("Mission failed"), and freezing the finished race then asserted.
Check each of these against the game in phase 3 and again in the phase 8 conformance suite (`8-polish.md`).

**`HoldForBackendEnd()`** — the LudeoManager helper every game-own end hook calls in Player Flow: set a `m_holding_for_backend` flag that the game's restart, map-vote, next-level and Creator-room paths check and refuse; keep the room and gameplay session open; and, if the game would keep simulating something harmful on its end screen, freeze through a **freeze-only** path (its own bit, like the CR-010 restore freeze) — never the pause primitive, which reports `PauseLudeo` (`phase 6 · task 2`). Clear the flag with the other per-Ludeo flags in `EndCurrentLudeo()` (`phase 5 · task 3` Step 5).

- On the **backend-ends** path, the failure is the game trying to detect end-of-moment itself, or calling `End`/submitting on the backend's behalf — it owns neither. The game's only job is to **freeze on `PauseGameRequest` and wait**. Don't look for a "playback ended" notification; there isn't one.
- On the **interrupt** path, the failure is `End(isAbort=false)` (marks an aborted run as a real completion) or skipping `End` entirely before teardown.

→ Restoration-side wiring of this lifecycle: [07-RESTORATION-PATTERNS.md §2](./07-RESTORATION-PATTERNS.md), `phase 5 · task 2` Steps 3 & 10, `phase 5 · task 3` Steps 2 & 4 (the player-flow/lifecycle half; the two-pass data read-back is `phase 5 · task 4`).

### 6.12 Flow Spines — Creator and Player at a Glance

The two end-to-end sequences on one screen each. They summarize §4–§6.11 and add nothing new. Where a spine and a section disagree, the section (and `07 §2.1` for Player Flow) is right.

**Creator Flow (capture):**

```
startup   Initialize → Session_Create → AddNotify* (all, once) → Activate ─cb Success─► session active
             (boot-straight / fast-menu game: readiness gate + idle "ready" state first — LAUNCH-AND-READINESS.md)
start     level/match starts loading (game code; skipped while IsRestoring())
             └─ OpenRoom(ludeoId = nullptr) ─cb─► store room + DataWriter → AddPlayer ─cb─► player_added ┐ either
                RoomReady ─────────────────────────────────────────────────────────────► room_ready   ┘ order
                   TryBeginGameplaySession() → Begin                                      (CR-009, §6.6)
play      per-tick attribute writes via the DataWriter · SendAction at each action site (06)
exit      EVERY exit path (CR-007) → End(isAbort) ─cb─► RemovePlayer ─cb─► Room_Close ─cb─► ready for the next room
shutdown  End any active gameplay → Session_Release → Shutdown (§7)
```

**Player Flow (playback)** — the steps are numbered as in `07 §2.1`:

```
1  LudeoSelected → marshal off the SDK thread → stash candidate id → GetLudeo(id)      touch NOTHING else
2  GetLudeo cb → VALIDATE: Success · reader populated (07 §2.2.1) · entry identity playable
                 any "no" → ignore the selection; the running Ludeo / menu is untouched
3  COMMIT → EndCurrentLudeo FIRST if a Ludeo is playing or still restoring (End(isAbort=true) if Begin ran
           → RemovePlayer → Close) → SetRestoring(true) → pending id/reader, reset Begin gates + freeze bits,
           bump restore generation → input HOLD on
4  REACH ACTIVE GAMEPLAY on the captured level (game's own load path; boot a run at the menu) → native spawn done
5  FREEZE → SetCurrent → RestoreTwoPass → RestoreEnvironment
6  SETTLE ~0.5 s, time on, input off (ApplyDeferred on its first tick) → FREEZE → SetRestoring(false)
7  OpenRoom(ludeoId) → AddPlayer → player_added            moment on screen, frozen, behind the overlay
8  RoomReady (= the viewer pressed Play) → room_ready → Begin (player_added ∧ room_ready ∧ applied) → UNFREEZE + release input
play   SendAction fires (scoring); NO state writes for the whole replay (07 §2.3) · overlay → Pause/ResumeGameRequest (CR-011)
end    backend ends → PauseGameRequest → freeze and wait (NO End)  |  interrupt (validated LudeoSelected,
       BackToMenuRequest, quit) → End(isAbort=true) → RemovePlayer → Close (§6.11)
```

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

### 7.4 Quit Path — There Is No Next Tick

Every teardown step is queued to the next `Tick` (`03 §8.3`) — but when the player quits, there may be no next
tick, and a queued `RemovePlayer` / `Room_Close` is silently dropped; ending a recording is also asynchronous, so
shutting down on the line after `End` loses it. On the quit path, drive the teardown to completion before
`ludeo_Shutdown`: issue `End(isAbort=true)`, then keep pumping the queue and `ludeo_Tick()` in a **bounded** loop
(a few seconds at most) until `OnRoomClosedCallback` has fired, then release the session and shut down. If the
bound runs out, log it and shut down anyway — never hang the game's exit.

## 8. Integration Points Summary

### Game Code Integration Points

| Integration Point | SDK Function | When to Call | Notes |
|------------------|--------------|--------------|-------|
| **SDK Initialize** | `ludeo_Initialize()` | Game launch, after core dependencies loaded | Early startup, before game systems |
| **SDK Session Activate** | `ludeo_Session_Activate()` | After window/OpenGL context ready | Window handle must be available |
| **SDK Tick** | `ludeo_Tick()` | Every frame, main game loop | Must be called consistently on main thread |
| **Gameplay Session Start** | `ludeo_Session_OpenRoom()` | When level/match loading starts | **NOT when ready** - call when loading begins |
| **Gameplay Session End** | `ludeo_GameplaySession_End()` | When gameplay ends, before map cleanup | Creator Flow: match over, level complete. Player Flow: interrupts only (§6.11) |
| **SDK Shutdown** | `ludeo_Shutdown()` | Game exit, during shutdown | Before resource cleanup |

**⚠️ CRITICAL - NOT game code integration points:** `ludeo_Room_AddPlayer()` (called from `OnRoomOpenedCallback`), `ludeo_GameplaySession_Begin()` (called from `TryBeginGameplaySession()`), `ludeo_Room_RemovePlayer()` (called from `OnGameplayEndedCallback`), `ludeo_Room_Close()` (called from `OnPlayerRemovedCallback`).

### Complete Integration Checklist

| Game Event | Ludeo Action | SDK Function | Called From | Notes |
|------------|--------------|--------------|-------------|-------|
| Game launch | Initialize SDK | `ludeo_Initialize()` | 🎮 Game code | Early in startup |
| Game ready | Activate session | `ludeo_Session_Activate()` | 🎮 Game code | After init, before menu |
| Every frame | Process callbacks | `ludeo_Tick()` | 🎮 Game code | In main loop |
| **Level/match loading** | **Open room** | **`ludeo_Session_OpenRoom()`** | **🎮 Game code** | **When loading starts** |
| Room opened | Add player(s) | `ludeo_Room_AddPlayer()` | 📞 SDK callback | Called from `OnRoomOpenedCallback` |
| Player added | Track condition | `OnPlayerAddedCallback()` | 📞 SDK callback | Set `player_added = true` |
| Room ready | Track condition | `OnRoomReadyCallback()` | 📞 SDK callback | Set `room_ready = true` |
| Both conditions met | Begin gameplay | `ludeo_GameplaySession_Begin()` | 📞 SDK callback | Called from `TryBeginGameplaySession()` helper |
| Gameplay ends | End gameplay | `ludeo_GameplaySession_End()` | 🎮 Game code | Creator Flow: match over, level complete. Player Flow: interrupts only — the backend ends a Ludeo (§6.11) |
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

### Common Lifecycle Failures

Symptom → cause → fix. Check this table before debugging deeper; [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) has the full diagnostics for the rows that point there.

| Symptom | Cause | Fix |
|---|---|---|
| No Ludeo created for one scenario (quit, restart, back-to-menu) | That exit path never calls `End` | Route **every** exit through one helper (CR-007) |
| `Begin` never fires or the run records nothing, intermittently | `Begin` is wired to one callback and assumes the other has already fired | Call `TryBeginGameplaySession()` from **both** `OnPlayerAddedCallback` and `OnRoomReadyCallback`, gated on both flags (§6.6, CR-009) |
| `AddPlayer` / `Begin` fail or no-op | Called from a game event instead of the callback chain | Game code calls only `OpenRoom`; the rest is chained from callbacks (CR-009) |
| Attribute never records / never restores | `Set*`/`Get*` called outside an `EnterObject`/`LeaveObject` pair | Scope every read and write (CR-002) |
| First room never records on a boot-straight game; or the cloud machine never reports ready | Creator `OpenRoom` fired at boot, before `Activate` resolved and with no idle "ready" state | Readiness gate + idle state + room only on an explicit trigger ([LAUNCH-AND-READINESS.md](./LAUNCH-AND-READINESS.md)) |
| Boot hangs on the game's loading screen only with the SDK enabled | Activation traffic processed in `ludeo_Tick()` starves the game's async boot chain | Keep rooms and tracking out of boot; defer `ActivateSession()` if needed ([LAUNCH-AND-READINESS.md](./LAUNCH-AND-READINESS.md) §5) |
| `InvalidAuth` in the activate callback (implicit auth) | Steam not initialized before `Session_Activate`, or `apiKey` unset | Init Steamworks first (§5 Steam Authentication); set `apiKey` in `ludeo.ini` (`04 §4`) |
| Restored state is wrong / the game keeps running under the restore | Apply not frozen, unfrozen before the apply, or the level loaded/applied on `RoomReady` | CR-010 order: validate → commit → reach gameplay → freeze → apply → settle → freeze → `OpenRoom` → Play → `Begin` → unfreeze |
| Restore hangs silently: no crash, no `OpenRoom`, no `Begin` | Work that waits on a frame (async spawn, physics step, streaming) runs inside the freeze — deadlock | Move it into the settle, with state-mutating systems suppressed (CR-010 "Freeze vs suppress") |
| Player stands at the default spawn with nothing restored | Applied before active gameplay was reached, or the reader was still empty | `07 §2.3`; reader readiness `07 §2.2.1`; [11 §7](./11-TROUBLESHOOTING.md) |
| Prior run's inventory, HUD, VFX or post-effects show up in the restored moment | Matched instances (player, singletons, managers) were not reset before the apply | Reset to the new-run baseline, then apply (CR-006) |
| Restores perfectly but the rerun is not a scored replay | Playback room opened with `ludeoId = nullptr` | `OpenRoom(ludeoId)` after the settle (§6.2, §6.11) |
| Game plays under the overlay | Pause/Resume notifications not registered or handler only blocks input | Register both at session creation; freeze the tick (CR-011) — overlay pause/resume is cloud only, so test via a debug hook locally (the end-of-Ludeo pause does arrive locally) |
| Restored Ludeo loads but input is dead | A stale freeze bit or input hold carried over from a previous play | [11 §8](./11-TROUBLESHOOTING.md); reset the bits in `EndCurrentLudeo()` and at the commit |
| Second Ludeo in one session hangs, opens a second room, or inherits the first one's state | The first play was not torn down at the commit, or an old restore's continuation still ran | `EndCurrentLudeo()` first, new restore only after the close completes; restore generation (CR-010 step 3) |
| A notification (usually `RoomReady`) never arrives; log shows `unknown event_name` | SDK build too old for the backend | Update the SDK and rebuild clean ([11 §9](./11-TROUBLESHOOTING.md)) |

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

