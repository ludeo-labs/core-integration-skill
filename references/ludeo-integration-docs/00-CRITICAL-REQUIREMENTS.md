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

### 🔴 **CR-010: Build the Restored Moment BEFORE Play — Validate, Load, Apply Held, Settle, Then Open the Room**

> **⚠️ THE #1 RESTORATION FAILURE:** "loads the right map, but the game keeps running and the restored state is wrong" — and its UX twin, "the viewer presses Play on a menu, then watches the level assemble."

`RoomReady` is **the viewer pressing Play** — the platform withholds it until then — not "the room is ready". So the
restored moment must be **fully built, settled and frozen behind the overlay before the Play button appears**, and
Play must only resume it. The selection is **validated before anything is disturbed**, the apply runs **frozen** so
nothing overwrites the snapshot as it lands, and `Begin` (which starts SDK recording of the playback) comes last.

**Sequence (mirrors `07 §2.1`):**

1. `LudeoSelected` fires → marshal off the SDK thread, stash the id as a **candidate**, dispatch `GetLudeo(id)`.
   **No teardown, no freeze, no `OpenRoom` yet.**
2. **Validate** in the `GetLudeo` callback: `resultCode != Success` → ignore the selection. Empty reader (early cycle)
   → wait for a later cycle; timeout → ignore. Populated reader (`GetObjectsInfo` Success && `objectsCount > 0`, `07
   §2.2.1`) → read the **entry identity** and check this integration can play it; if not, ignore. Ignoring is safe
   because nothing has been touched — a running Ludeo or the menu carries on.
3. **Commit:** `SetRestoring(true)` (arms the start-of-run skips before the load fires them) → if a run is live,
   `EndCurrentLudeo` (interrupt = `End(isAbort=true)` → `RemovePlayer` → `CloseRoom`; start the new play only once the
   close completes) → restoration **hold** on: input off, start-of-run mechanisms skipped. The sim runs as much as
   the game's own load path needs.
4. **Reach active gameplay** on the captured level (load it / boot the run; generic level if the game has no rooms)
   and wait for the game's native spawn to finish.
5. **Freeze → apply** (`SetCurrent` → Pass 1 + Pass 2 + environment) **→ settle** ~0.5 s with time running and input
   still off (teleports, controllers, pooled spawns and deferred properties take) **→ freeze again** →
   `SetRestoring(false)`.
6. **`OpenRoom(ludeoId)`** (Player Flow — `nullptr` would record a NEW Ludeo, `05 §6.2`) → `AddPlayer` →
   `OnPlayerAdded`. The finished moment is now on screen, frozen, behind the overlay.
7. **`RoomReady`** (the viewer pressed Play) → `TryBeginGameplaySession()` → `Begin` → **unfreeze**. `Begin` needs
   `player_added`, `room_ready` and `applied`; the callbacks can arrive in either order (`05 §6.6`).

```cpp
// ✅ 1. LudeoSelected — validate first; touch nothing else.
void LudeoManager::OnLudeoSelected(const LudeoSessionLudeoSelectedCallbackParams* data) {
    if (m_candidate_ludeo_id == data->ludeoId) return;   // repeated fire for the same Ludeo — dispatch once
    m_candidate_ludeo_id = data->ludeoId;
    m_candidate_reader = nullptr; m_candidate_deadline = Now() + kRestoreTimeout;
    GetLudeoAsync(m_candidate_ludeo_id);                 // read-only: commits to nothing
}

// ✅ 2. Validate. May fire REPEATEDLY; early cycles return Success + an EMPTY reader.
void LudeoManager::OnGetLudeoCallback(const LudeoSessionGetLudeoCallbackParams* data) {
    if (data->resultCode != LudeoResult::Success) { IgnoreSelection("GetLudeo failed"); return; }
    if (!ReaderIsPopulated(data->dataReader) || m_candidate_reader) return;   // empty cycle, or already accepted
    const EntryId entry = ReadEntryIdentity(data->dataReader);               // start_mode / room_x / room_y …
    if (!CanPlay(entry)) { IgnoreSelection("cannot play this Ludeo"); return; }  // version skew / unknown level
    m_candidate_reader = data->dataReader;
    CommitAndRestore(entry);
}

// ✅ Readiness gate: Success is not enough — the reader must actually hold objects (07 §2.2.1).
bool ReaderIsPopulated(LudeoHDataReader reader) {
    LudeoDataReaderGetObjectsInfoParams p = {}; p.apiVersion = LUDEO_DATAREADER_GETOBJECTSINFO_API_LATEST;
    LudeoObjectsInfo* info = nullptr;
    bool ok = ludeo_DataReader_GetObjectsInfo(reader, &p, &info) == LudeoResult::Success
              && info && info->objectsCount > 0;
    if (info) ludeo_ObjectsInfo_Release(info);    // pair every GetObjectsInfo with a Release
    return ok;
}

// ✅ 3–4. Commit, tear down if needed, hold, reach active gameplay.
void LudeoManager::CommitAndRestore(const EntryId& entry) {
    SetRestoring(true);                                   // arm start-of-run skips BEFORE the load fires them
    m_pending_ludeo_id = m_candidate_ludeo_id; m_pending_reader = m_candidate_reader;
    m_room_ready = m_player_added = m_applied = false;
    auto restore = [this, entry] {
        GameSimulation::Get().SetRestorationHold(true);   // input off, start-of-run mechanisms skipped
        ReachActiveGameplay(entry, [this] { ApplyHeld(); });  // game's own load path; callback once native spawn is done
    };
    if (IsLudeoActive()) EndCurrentLudeo(restore);        // async: start the new play only once the close completed
    else restore();
}

// ✅ 5. Apply frozen, settle with input off, freeze again.
void LudeoManager::ApplyHeld() {
    GameSimulation::Get().SetRestorationFreeze(true);     // nothing may overwrite the snapshot while it lands
    ludeo_DataReader_SetCurrent(m_pending_reader);
    StateAdapter::Get().RestoreTwoPass(m_pending_reader);
    StateAdapter::Get().RestoreEnvironment(m_pending_reader);
    m_pending_reader = nullptr;                           // one-shot
    GameSimulation::Get().Settle(0.5f, [this] {           // time runs, input stays off
        GameSimulation::Get().SetRestorationFreeze(true); // hold the finished moment
        SetRestoring(false);                              // restore window closes (NOT the whole replay — 07 §2.3)
        m_applied = true;
        OpenRoom(m_pending_ludeo_id);                     // 6. ludeoId set ⇒ Player Flow; → AddPlayer → OnPlayerAdded
    });
}

// ✅ 7. RoomReady = the viewer pressed Play.
void LudeoManager::OnRoomReadyCallback(const LudeoSessionRoomReadyCallbackParams*) {
    m_room_ready = true;
    TryBeginGameplaySession();
}

void LudeoManager::TryBeginGameplaySession() {          // also called from OnPlayerAddedCallback
    if (!(m_player_added && m_room_ready && m_applied)) return;
    BeginGameplaySession();                               // SDK records from the restored state
    GameSimulation::Get().SetRestorationFreeze(false);    // Play resumes exactly the moment the viewer chose
    GameSimulation::Get().SetRestorationHold(false);
}

// ✅ Per-frame fallback — bound the readiness wait; still pre-commit, so nothing to undo.
void LudeoManager::Update() {
    if (!m_candidate_ludeo_id.empty() && !m_candidate_reader && Now() > m_candidate_deadline)
        IgnoreSelection("Ludeo never populated");
}
```

**Forbidden:**
```cpp
// ❌ Tearing down, freezing or opening the room before GetLudeo validated the selection — a bad selection
//    must be a no-op; on a cloud VM nobody can recover a session torn down for nothing.
// ❌ Loading the level or applying state on RoomReady — RoomReady is the Play click; the viewer would press Play
//    on a menu and then watch the moment assemble.
// ❌ Unfreezing before the apply — live sim frames overwrite values as they land. Writes that need frames go
//    in the settle (or the deferred queue, 07 §6), not in an unpause before the apply.
// ❌ Opening the room before the moment is settled — the Play button can appear over a half-built level.
// ❌ Calling Begin BEFORE the apply — the SDK records playback from default state.
// ❌ Pausing only input while the simulation tick keeps running.
// ❌ Waiting on ludeo_GameplaySession_AddNotifyPlayerReady — that notification DOES NOT EXIST.
// ❌ Treating ResumeGameRequest as the post-restore resume — that is the MID-PLAY resume (CR-011).
```

**Validation:**
- [ ] A selection that fails `GetLudeo`, never populates, or carries an unplayable entry identity is **ignored** —
      the running Ludeo (or the menu) is untouched.
- [ ] `SetRestoring(true)` runs at the commit, **before** the level load, so start-of-run sequences hit the `07 §9.11`
      gate when they fire.
- [ ] The apply runs **frozen**, followed by a ~0.5 s settle with input off, then a second freeze — all **before**
      `OpenRoom`.
- [ ] `OpenRoom` carries the selected `ludeoId` and is dispatched only after the settle.
- [ ] **Before Play, the captured moment is on screen, frozen**, behind the overlay — not the menu, not a loading cover.
- [ ] On Play (`RoomReady`) nothing loads or is written: `Begin`, then unfreeze. The first live frame continues the
      captured moment.
- [ ] No `PlayerReady` reference anywhere; `ResumeGameRequest` is used only for the mid-play overlay-closed resume (CR-011).

**→ See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.1 (sequence), §2.4 (overlay control notifications) and §7 (wait-for-player)

---

### 🔴 **CR-011: While the Ludeo Overlay Is Active During Playback, the Game MUST Be Paused**

> **⚠️ THE #1 MID-PLAY FAILURE:** "the game keeps running while the overlay covers it — the player sees a game they can't see, playing itself."

Distinct from CR-010 (the restored moment held frozen until `RoomReady`). This is the **ongoing runtime contract**: every time the Ludeo overlay opens during an active playback session, the game must pause; when it closes, the game must resume. The SDK drives both transitions through session-lifetime notifications — register them once at session creation, alongside `LudeoSelected` and `RoomReady` (see [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) "Registering Notifications" and phase 3 · task 4 §3.5). Missing these registrations is the most common cause of the failure.

**Required:**
```cpp
// Overlay opened → FREEZE the simulation tick (not just input)
static void OnPauseGameRequest(const LudeoSessionPauseGameRequestCallbackParams*)
{
    GameSimulation::Get().SetPaused(true);
}

// Overlay closed → resume
static void OnResumeGameRequest(const LudeoSessionResumeGameRequestCallbackParams*)
{
    GameSimulation::Get().SetPaused(false);
}

// Registered ONCE at session creation, with the other AddNotify* calls:
ludeo_Session_AddNotifyPauseGameRequest (session, &p, ctx, OnPauseGameRequest);
ludeo_Session_AddNotifyResumeGameRequest(session, &p, ctx, OnResumeGameRequest);
```

**Forbidden:**
```cpp
// ❌ Notifications not registered at all — the SDK has no way to tell the game to pause.
// ❌ Handler suppresses input only — physics/AI keep mutating the world.
// ❌ Conflated with CR-010 — that is a separate, one-time freeze gated on RoomReady, not the per-overlay-toggle pause.
// ❌ Handler freezes but never reports PauseLudeo — the game stops, the player's objective timer does not.
```

> **Freezing the game does not stop the Ludeo objective timer.** The backend stops the clock only when the
> game sends `PauseLudeo` and a Pause/Resume Global Trigger exists for it (`06 §7.3`). So once actions are
> wired, these handlers must reach the same pause report as every other pause: route them through the game's
> pause primitive, which emits `PauseLudeo`/`ResumeLudeo` once per transition (`phase 6 · task 2` Step 5).
> In `phase 3 · task 4` the handlers only freeze; the report is added in phase 6.

**Validation:**
- [ ] `ludeo_Session_AddNotifyPauseGameRequest` and `ludeo_Session_AddNotifyResumeGameRequest` are both registered at session creation (`phase 3 · task 4` §3.5).
- [ ] Opening the Ludeo overlay during an active playback session **freezes the simulation tick** (not just input).
- [ ] Closing the overlay **resumes** the game.
- [ ] Repeated open/close cycles behave the same — handlers are idempotent across multiple toggles.
- [ ] After phase 6: the overlay pause sends `PauseLudeo` and its close sends `ResumeLudeo`, once each.

#### CR-010 and CR-011 are INDEPENDENT — do not collapse them into one `m_paused` boolean

The post-restore freeze (CR-010) and the mid-play overlay pause (CR-011) are different events with different lifecycles, and the game can be in BOTH simultaneously (e.g., the player presses overlay-open during the post-restore wait). Track them as **separate flags** (or a small state machine), not a single shared `m_paused`. The forbidden pattern:

```cpp
// ❌ One flag collapses both sources. ResumeGameRequest unfreezes the still-mid-restoration
//    pause; or RoomReady's unfreeze cancels a player-requested overlay pause.
void SetPaused(bool v) { m_paused = v; engine.SetPaused(v); }
```

Required: each source owns its own bit, and the engine is paused **if any bit is set**:

```cpp
// ✅ Sources are independent; engine paused = ANY bit set
void SetRestorationFreeze(bool v) { m_freeze_restore = v; UpdateEnginePause(); }
void SetOverlayPause     (bool v) { m_freeze_overlay = v; UpdateEnginePause(); }
void UpdateEnginePause() { engine.SetPaused(m_freeze_restore || m_freeze_overlay); }
```

`Begin` on `RoomReady` clears `m_freeze_restore` only; `ResumeGameRequest` clears `m_freeze_overlay` only. The engine stays paused if either source still wants it.

> **The bits must also start clean each Ludeo, not just stay separate.** `LudeoManager` is a long-lived singleton, so a bit left dirty by a prior play carries into the next one. The classic case: the **backend ends a Ludeo via `PauseGameRequest`** (`05 §6.11`) — the game freezes and waits, setting `m_freeze_overlay` — with **no matching `ResumeGameRequest`**. The next `LudeoSelected` restores fine and clears `m_freeze_restore` on `RoomReady`, but the stale `m_freeze_overlay` keeps the tick frozen, so the new Ludeo loads and **never resumes — presenting exactly like dead input.** Reset the bits in `EndCurrentLudeo()` on every exit path (`phase 5 · task 3` Step 5) *and* re-arm them at the commit of a validated selection (`07 §2.1` step 3) — not in the `LudeoSelected` handler itself, which must not disturb anything before validation; don't assume the prior cleanup ran. Diagnostic: [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) §8.

**→ See:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) "Registering Notifications" · [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.4 · CR-010 (restored moment held until Play)

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

### CR-010: Build the Moment Before Play (⚠️ #1 RESTORATION FAILURE)
- [ ] `GetLudeo` validates the selection first; a bad one is ignored and nothing is torn down
- [ ] `SetRestoring(true)` at the commit, before the level load, so `07 §9.11` start-of-run skips engage
- [ ] Order: reach active gameplay → **freeze → apply (Pass 1 + Pass 2 + env) → settle ~0.5 s, input off → freeze** → `OpenRoom(ludeoId)` → `AddPlayer`
- [ ] Before Play, the captured moment is on screen, frozen; on `RoomReady` (Play) only `Begin` → unfreeze
- [ ] No `PlayerReady`; `ResumeGameRequest` only used for mid-play overlay close (CR-011)

### CR-011: Paused While Overlay Is Active Mid-Play (⚠️ #1 MID-PLAY FAILURE)
- [ ] `ludeo_Session_AddNotifyPauseGameRequest` and `ludeo_Session_AddNotifyResumeGameRequest` are both registered at session creation
- [ ] Opening the Ludeo overlay during playback **freezes the simulation tick** (not just input)
- [ ] Closing the overlay **resumes** the game
- [ ] Repeated open/close cycles behave the same (handlers idempotent across toggles)

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

**Remember:** These 11 requirements are non-negotiable. Violating them will break your integration.