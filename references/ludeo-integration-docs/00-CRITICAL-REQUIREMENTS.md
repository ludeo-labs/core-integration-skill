# 🚨 CRITICAL REQUIREMENTS - Ludeo SDK Integration

> **⚠️ These requirements are MANDATORY for a working integration**
>
> Violating these will result in integration failure, crashes, or completely broken functionality.

**Last Updated:** December 2025  
**Applies to:** All Ludeo SDK integrations

---

## 🔑 **KEY CONCEPT: Ludeo Session vs Gameplay Session**

Understanding this distinction is **essential** before implementing anything:

| Concept | Ludeo Session | Gameplay Session |
|---------|--------------|------------------|
| **What** | SDK connection to Ludeo platform | One playable moment (level, match, mission) |
| **Lifetime** | Entire game runtime | One gameplay instance |
| **Count** | ONE per game launch | MANY per game launch |
| **Created** | `ludeo_Session_Activate()` at startup | `ludeo_Session_OpenRoom()` when level loads |
| **Destroyed** | `ludeo_Session_Release()` at shutdown | `ludeo_GameplaySession_End()` when gameplay ends |

```
Game Launch ──► [Ludeo Session Active] ──► Game Shutdown
                      │
                      ├── Level 1 ──► [Gameplay Session 1] ──► End
                      ├── Level 2 ──► [Gameplay Session 2] ──► End
                      └── Level 3 ──► [Gameplay Session 3] ──► End
```

**→ See:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) for complete lifecycle details

---

## ⚠️ **CRITICAL REQUIREMENTS (Integration Will Not Work Without These)**

### 🔴 **CR-001: Macro-Based Conditional Compilation is MANDATORY**

**ALL** Ludeo SDK integration code **MUST** be wrapped with conditional compilation macros.

**Why:** 
- Allows SDK to be disabled for non-Ludeo builds
- Keeps codebase clean when SDK is disabled
- Prevents compilation errors when SDK is not present

**Required:**
```cpp
#if LUDEO_SDK_ENABLED
    #include <Ludeo/DataWriter.h>
    // SDK code here
#endif

// In game code - use capture macros
LUDEO_CAPTURE_FLOAT(this, "entity", "health", newHealth);
// This macro becomes a no-op when SDK disabled
```

**Forbidden:**
```cpp
// ❌ NEVER do this - pollutes code when SDK disabled
#include <Ludeo/DataWriter.h>  // No guard!
ludeo_DataWriter_SetFloat("health", health);  // No guard!
```

**Validation:**
- [ ] Project compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Project compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No SDK code present in binaries when disabled

---

### 🔴 **CR-002: Context Stack MUST Be Managed Properly**

Always pair `EnterObject` with `LeaveObject`. Use RAII helpers.

**Required:**
```cpp
ludeo_DataWriter_SetCurrent(writer);
if (ludeo_DataWriter_EnterObject(objectId)) {
    ludeo_DataWriter_SetFloat("health", health);
    ludeo_DataWriter_LeaveObject();  // ✅ ALWAYS LEAVE!
}

// Better: Use RAII helper
{
    LudeoCapture::ObjectScope scope(objectId);
    if (scope.IsEntered()) {
        ludeo_DataWriter_SetFloat("health", health);
        // Automatic cleanup
    }
}
```

**Forbidden:**
```cpp
// ❌ Missing LeaveObject - stack corruption!
ludeo_DataWriter_EnterObject(objectId);
ludeo_DataWriter_SetFloat("health", health);
// FORGOT LeaveObject() - WILL BREAK!
```

---

### 🔴 **CR-003: Async Operations REQUIRE Callbacks**

Many SDK operations are **asynchronous** and require callbacks.

**Async Operations:**
- `ludeo_Session_Activate()`
- `ludeo_Session_OpenRoom()`
- `ludeo_Room_AddPlayer()`
- `ludeo_GameplaySession_Begin()`
- `ludeo_GameplaySession_End()`
- `ludeo_Room_Close()`
- `ludeo_Session_GetLudeo()`

**Required:**
```cpp
// ✅ Async call with callback - returns void, NOT LudeoResult
ludeo_Session_Activate(
    m_session_handle, &params, this, OnSessionActivatedCallback);
// Operation started - success/failure ONLY reported via callback

// Callback handles completion - THIS is where you check result
void OnSessionActivatedCallback(const LudeoSessionActivateCallbackParams* data) {
    if (data->resultCode == LudeoResult::Success) {
        // NOW it's activated
    } else {
        LogError("Activation failed: %d", data->resultCode);
    }
}
```

**Forbidden:**
```cpp
// ❌ Treating async as sync - WILL NOT WORK
// These functions return void, NOT LudeoResult!
ludeo_Session_Activate(...);
// Cannot check result here - must wait for callback!
```

---

### 🔴 **CR-004: Window Handle MUST Be Provided**

SDK requires native window handle for video capture and overlay. **Session Activation must occur AFTER graphics initialization** - the window must exist first.

**Required:**
```cpp
auto params = Ludeo::create<LudeoSessionActivateParams>();
params.windowHandle = GetGameWindowHandle();  // ✅ REQUIRED!
params.apiKey = m_api_key.c_str();
// ... other params

ludeo_Session_Activate(m_session_handle, &params, this, OnSessionActivatedCallback);
```

**Platform-Specific:**
- **Windows:** `HWND` handle
- **Linux:** X11 or Wayland window handle
- **Engine-specific:** Use engine's window API

**Validation:**
- [ ] Window handle obtained correctly per platform
- [ ] Handle provided during Session activation
- [ ] Video capture works (check Ludeo platform)

---

### 🔴 **CR-005: ludeo_Tick() MUST Be Called Every Frame**

SDK requires `ludeo_Tick()` to process callbacks and internal operations.

**Required:**
```cpp
void GameLoop::Update() {
    // Game logic...
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Instance().Tick();  // ✅ Every frame!
#endif
    
    // Rendering...
}
```

**Rules:**
- Call once per frame
- Call on consistent thread (usually main thread)
- Don't skip frames

**Forbidden:**
```cpp
// ❌ Calling irregularly or skipping
if (someCondition) {
    LudeoManager::Instance().Tick();  // WRONG - must be every frame!
}
```

---

### 🔴 **CR-006: Two-Pass Restoration is MANDATORY**

Restoration MUST use two passes to handle object relationships correctly.

**Required:**
```cpp
// ✅ PASS 1: Create all objects (minimal data)
for (each object in DataReader) {
    GameObject* obj = CreateGameObject(type, position, id);
    restored_objects[ludeo_id] = obj;
}

// ✅ PASS 2: Restore properties and relationships
for (each restored object) {
    RestoreProperties(obj);  // Now references can be resolved
}
```

**Why Critical:**
- Pass 1 creates all objects so they exist
- Pass 2 can resolve references because objects exist
- Single-pass fails when object B references object A that doesn't exist yet

**Forbidden:**
```cpp
// ❌ Single-pass - will fail on relationships
for (each object) {
    CreateAndFullyRestore(object);  // Relationships break!
}
```

→ **See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) Section 9.3

---

### 🔴 **CR-007: EndGameplaySession() MUST Be Called on ALL Exit Paths**

> **⚠️ THIS IS THE #1 CAUSE OF BROKEN INTEGRATIONS**
>
> Missing even ONE exit path means Ludeos won't be created for that scenario.

**Every way to leave active gameplay MUST call `ludeo_GameplaySession_End()`.**

**🚨 AUDIT ALL OF THESE (common exit paths):**

| Exit Path | Example | Must Call EndGameplaySession |
|-----------|---------|------------------------------|
| Level complete / win | `OnLevelComplete()` | ✅ YES |
| Level failed / loss | `OnPlayerDied()`, `OnGameOver()` | ✅ YES |
| Player quits to menu | `OnQuitToMenu()`, `OnEscapePressed()` | ✅ YES |
| Player quits to desktop | `OnQuitGame()`, `OnAltF4()` | ✅ YES |
| Level restart | `OnRestartLevel()` | ✅ YES |
| Network disconnect | `OnDisconnected()` | ✅ YES (multiplayer) |
| Error recovery | `OnFatalError()` | ✅ YES |
| LudeoSelected interrupt | `OnLudeoSelected()` | ✅ YES (if gameplay active) |

**Required Pattern:**
```cpp
// ✅ CORRECT - Centralized exit point
void EndCurrentGameplay(bool isAbort) {
#if LUDEO_SDK_ENABLED
    if (LudeoManager::Instance().IsGameplayActive()) {
        LudeoManager::Instance().EndGameplaySession(isAbort);
    }
#endif
}

// Hook into EVERY exit path:
void OnLevelComplete() { EndCurrentGameplay(false); /* ... */ }
void OnPlayerDied()    { EndCurrentGameplay(false); /* ... */ }
void OnQuitToMenu()    { EndCurrentGameplay(true);  /* ... */ }
void OnRestartLevel()  { EndCurrentGameplay(true);  /* ... */ }
void OnQuitGame()      { EndCurrentGameplay(true);  /* ... */ }
```

**Forbidden:**
```cpp
// ❌ WRONG - Only hooking "normal" exits
void OnLevelComplete() {
    LudeoManager::Instance().EndGameplaySession(false);  // ✅ Good
}
// But forgot OnQuitToMenu(), OnRestartLevel(), etc. - ❌ BROKEN!
```

**Validation Checklist:**
- [ ] List ALL functions that exit gameplay state
- [ ] Each one calls `EndGameplaySession()` (directly or via helper)
- [ ] Test: quit mid-level → Ludeo still created
- [ ] Test: restart level → Ludeo still created
- [ ] Test: disconnect (multiplayer) → Ludeo still created

---

### 🔴 **CR-008: Release ObjectsInfo After Use**

Always release ObjectsInfo to avoid memory leaks.

**Required:**
```cpp
LudeoObjectsInfo* objects_info = nullptr;
LudeoResult result = ludeo_DataReader_GetObjectsInfo(reader, &params, &objects_info);

if (result == LudeoResult::Success) {
    // Use objects_info...
    
    // ✅ CRITICAL: Release when done!
    ludeo_ObjectsInfo_Release(objects_info);
}
```

**Why Critical:**
- Memory leak if not released
- SDK allocates this memory, you must free it

---

### 🔴 **CR-009: Callback-Driven Operations are NOT Game Integration Points**

> **⚠️ Common AI/Developer Mistake:** Trying to call these from game event handlers.

Some SDK operations are **triggered by SDK callbacks**, NOT by game events.

**🎮 Game Code Integration Points (YOU call these):**
| Operation | When to Call | From Where |
|-----------|--------------|------------|
| `ludeo_Initialize()` | Game startup | Main init |
| `ludeo_Session_Activate()` | After init | Startup sequence |
| `ludeo_Session_OpenRoom()` | Level loading **starts** | Level loader |
| `ludeo_GameplaySession_End()` | Gameplay ends | All exit paths |
| `ludeo_Shutdown()` | Game exit | Shutdown sequence |

**📞 Callback-Driven (SDK calls these via callbacks - DO NOT call from game code):**
| Operation | Triggered By | Called From |
|-----------|--------------|-------------|
| `ludeo_Room_AddPlayer()` | Room opened | `OnRoomOpenedCallback` |
| `ludeo_GameplaySession_Begin()` | Player added + Room ready | `TryBeginGameplaySession()` helper |
| `ludeo_Room_RemovePlayer()` | Gameplay ended | `OnGameplayEndedCallback` |
| `ludeo_Room_Close()` | All players removed | `OnPlayerRemovedCallback` |

**Forbidden:**
```cpp
// ❌ WRONG - Calling callback-driven operations from game code
void Game::OnLevelLoaded() {
    ludeo_mgr.OpenRoom(levelId);
    ludeo_mgr.AddPlayer(playerId);     // ❌ Room not open yet!
    ludeo_mgr.BeginGameplay();          // ❌ Player not added yet!
}
```

**Required:**
```cpp
// ✅ CORRECT - Only OpenRoom from game code, rest via callbacks
void Game::OnLevelLoadStart() {
    ludeo_mgr.OpenRoom(levelId);  // ✅ Only this from game code
    // AddPlayer happens in OnRoomOpenedCallback
    // BeginGameplay happens in TryBeginGameplaySession (after both conditions met)
}
```

**→ See:** [05-LIFECYCLE-MANAGEMENT.md Section 6.1](./05-LIFECYCLE-MANAGEMENT.md#61-overview) for callback flow diagram

---

### 🔴 **CR-010: After a Ludeo Loads, the Game MUST Be PAUSED While the Overlay Awaits the Player**

> **⚠️ THE #1 RESTORATION FAILURE:** "loads the right map, but the game keeps running and the restored state is wrong."

The moment restoration finishes, the game has **not** been handed to the player yet. The Ludeo **overlay** shows the **Play** button and waits for the player. Until the player presses it, the game **MUST be paused — the simulation tick frozen, not merely input suppressed.**

**Why this is mandatory:**
- A running simulation (physics, AI, scripts, the level's own init) **overwrites the state you just restored** — this is the direct cause of "state isn't reconstructed properly."
- The player would otherwise see the game blast past the restored moment in the one frame before they can react.

**The full pause/resume contract — two distinct cases, do not conflate them:**

- **Pause after a Ludeo loads** — set **by the game itself** the moment restoration completes. The player hasn't been handed control yet.
- **Resume after a Ludeo load** — the player presses **Play** on the overlay → the game receives **`RoomReady`** → begin the gameplay session (`ludeo_GameplaySession_Begin`, via the chain `05-LIFECYCLE-MANAGEMENT.md` already documents) → **unpause**. This is the **same** gameplay-session-start mechanism `/4` wired for tracking; playback reuses it.
- **Mid-play overlay open/close** — the player reopens the overlay during an active playback session → `PauseGameRequest` to pause, `ResumeGameRequest` to resume. These do **not** carry the post-restore resume.

```cpp
// ✅ Restoration just finished → FREEZE and wait. Do NOT resume here.
void LudeoManager::OnRestorationComplete() {
    GameSimulation::Get().SetPaused(true);     // freeze the TICK, not just input
    m_playback_state = WaitingForRoomReady;
    // The Ludeo overlay shows the Play button — do NOT draw your own prompt.
}

// ✅ Player pressed Play on the overlay → SDK runs OpenRoom→AddPlayer→RoomReady→Begin
//    (see 05-LIFECYCLE-MANAGEMENT). On RoomReady, begin the gameplay session and UNPAUSE.
//    THIS is the post-restore resume — not ResumeGameRequest.
void OnRoomReadyCallback(const LudeoSessionRoomReadyCallbackParams*) {
    TryBeginGameplaySession();                 // /4's helper (begins when player added + room ready)
    GameSimulation::Get().SetPaused(false);    // unpause as gameplay starts
}

// ✅ MID-PLAY only: overlay reopened → pause; overlay closed → resume.
static void OnPauseGameRequest (const LudeoSessionPauseGameRequestCallbackParams*)  { GameSimulation::Get().SetPaused(true);  }
static void OnResumeGameRequest(const LudeoSessionResumeGameRequestCallbackParams*) { GameSimulation::Get().SetPaused(false); }
```

**Forbidden:**
```cpp
// ❌ Continuing the sim while the overlay waits — restored state is overwritten.
void OnRestorationComplete() { /* no pause; gameplay keeps ticking */ }

// ❌ Pausing only input while the simulation tick keeps running.
// ❌ Waiting on ludeo_GameplaySession_AddNotifyPlayerReady — that notification DOES NOT EXIST.
// ❌ Treating ResumeGameRequest as the post-restore resume — that is the MID-PLAY resume.
//    Post-restore resume goes through RoomReady → Begin (the chain /4 already wired).
```

**Validation:**
- [ ] After a Ludeo loads, the game is **paused (tick frozen)** before the player does anything.
- [ ] The post-Ludeo-load resume is driven by **`RoomReady` → `Begin`** — not a self-built prompt, not `PlayerReady`, not `ResumeGameRequest`.
- [ ] Reopening the overlay mid-playback pauses the game (`PauseGameRequest`); closing it resumes (`ResumeGameRequest`).
- [ ] Restored state is intact at the moment of resume (a running sim didn't overwrite it).

**→ See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.4 (overlay control notifications) and §7 (wait-for-player)

---

## 📊 **Validation Checklist**

Before considering integration complete, verify these critical requirements:

### CR-001: Macro Compilation
- [ ] Compiles with `LUDEO_SDK_ENABLED=1`
- [ ] Compiles with `LUDEO_SDK_ENABLED=0`
- [ ] No SDK symbols in disabled build

### CR-002: Context Stack
- [ ] All `EnterObject` calls have matching `LeaveObject`
- [ ] Using RAII helpers where possible
- [ ] No stack corruption errors

### CR-003: Async Callbacks
- [ ] All async operations have callbacks
- [ ] Not treating async return values as completion
- [ ] Callbacks implemented correctly

### CR-004: Window Handle
- [ ] Window handle obtained correctly
- [ ] Handle provided during Session activation
- [ ] Video capture works

### CR-005: Tick Every Frame
- [ ] `ludeo_Tick()` called once per frame
- [ ] Called on consistent thread
- [ ] Never skipped

### CR-006: Two-Pass Restoration
- [ ] Pass 1 creates all objects
- [ ] Pass 2 restores properties/relationships
- [ ] Object references resolve correctly

### CR-007: All Exit Paths (⚠️ HIGH PRIORITY)
- [ ] Listed ALL functions that exit gameplay
- [ ] Each calls `EndGameplaySession()` (directly or via helper)
- [ ] Tested: quit mid-level → Ludeo created
- [ ] Tested: restart level → Ludeo created
- [ ] Tested: disconnect → Ludeo created (multiplayer)

### CR-008: Resource Release
- [ ] `ludeo_ObjectsInfo_Release()` called after use
- [ ] No memory leaks in valgrind/leak detector

### CR-009: Callback Flow
- [ ] `AddPlayer()` called from `OnRoomOpenedCallback` only
- [ ] `BeginGameplaySession()` called from helper after both conditions met
- [ ] NOT calling callback-driven operations from game event handlers

### CR-010: Paused While Overlay Awaits Player (⚠️ #1 RESTORATION FAILURE)
- [ ] After a Ludeo loads, the game is paused (simulation tick frozen) before the player acts
- [ ] Post-Ludeo-load resume is driven by `RoomReady` → `Begin` (the chain `/4` wired) — not a self-built prompt, not `PlayerReady`, not `ResumeGameRequest`
- [ ] Reopening the overlay mid-playback pauses the game (`PauseGameRequest`); closing it resumes (`ResumeGameRequest`)
- [ ] Restored state is intact at resume (a running sim didn't overwrite it)

---

## 🔗 **Related Documents**

**For lifecycle details:**
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - Complete callback flow and session management

**For best practices and additional guidelines:**
- [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - Error handling, return value checking, API patterns
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Stable IDs, pause tracking, actions implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - LudeoSelected handling, player input flow

**For implementation:**
- [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) - Step-by-step integration workflow
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - When things go wrong

---

**Remember:** These 10 requirements are non-negotiable. Violating them will break your integration.