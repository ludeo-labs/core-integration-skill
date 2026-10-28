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

> **Reset matched instances to a clean baseline before the apply** (Player Flow only — Creator Flow starts from the
> game's own fresh run). Pass 1 *spawns* fresh objects, but anything the restore **matches instead of spawns** — the
> player, singletons and managers that survive a level load, scene-placed objects — is the same live object the
> previous run left behind. The apply overwrites only the captured attributes, so uncaptured state leaks into the
> restored moment: gameplay state (inventory, ammo, buffs, cooldowns, status flags) **and** visual state (HUD and score
> readouts, live particle/VFX emitters, damage numbers, camera shake, post-processing from a prior buff). Reset each
> matched instance to its new-run baseline at the top of its apply, *then* apply the snapshot. Same cause as the stale
> freeze bits in CR-011 (a long-lived object carrying the last run), different victim. Details: [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md).

→ **See:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) Section 9.3

---

### 🔴 **CR-007: EndGameplaySession() MUST Be Called on ALL Exit Paths**

> **⚠️ THIS IS THE #1 CAUSE OF BROKEN INTEGRATIONS**
>
> Missing even ONE exit path means Ludeos won't be created for that scenario.

**Every way to leave active gameplay MUST call `ludeo_GameplaySession_End()`.**

> **Player Flow exception — the game's own end does NOT end a Ludeo.** While a selected Ludeo is playing, the
> backend owns its end (timer, goal, constraint). A natural match/race/level end, an intermission, a map vote, a
> game-over screen or a death the game would answer with a restart is **not** an exit path: the game **holds the
> world** (frozen or idling on its end screen), keeps the room open, blocks anything that would load another level
> or open a Creator room, and waits for the backend's `PauseGameRequest` (`05 §6.11`). The hold is **not a pause**:
> it must not send `PauseLudeo` (that stops the objective timer and the backend never ends the Ludeo) — freeze through
> a freeze-only path, never through the game's pause primitive. Only the game's own
> interrupts end a playback session — a validated mid-run `LudeoSelected`, `BackToMenuRequest`, quit, or an error —
> always with `isAbort=true`. Rows marked *Creator Flow* below apply to recording sessions only.

**🚨 AUDIT ALL OF THESE (common exit paths):**

| Exit Path | Example | Must Call EndGameplaySession |
|-----------|---------|------------------------------|
| Level complete / win | `OnLevelComplete()` | ✅ YES — *Creator Flow*. ❌ NO in Player Flow: hold the world until the backend ends the Ludeo |
| Level failed / loss | `OnPlayerDied()`, `OnGameOver()` | ✅ YES — *Creator Flow*. ❌ NO in Player Flow: hold the world until the backend ends the Ludeo |
| Player quits to menu | `OnQuitToMenu()`, `OnEscapePressed()` | ✅ YES |
| Player quits to desktop | `OnQuitGame()`, `OnAltF4()` | ✅ YES |
| Level restart | `OnRestartLevel()` | ✅ YES — *Creator Flow*. In Player Flow block the game's own restart (a key on the end screen must not reload the level) |
| Network disconnect | `OnDisconnected()` | ✅ YES (multiplayer) |
| Error recovery | `OnFatalError()` | ✅ YES |
| Mid-run `LudeoSelected` — a **validated** selection while a Ludeo is playing or still restoring (another Ludeo from the overlay, "play again") | `CommitAndRestore()` → `EndCurrentLudeo()` | ✅ YES — `isAbort=true` (only if `Begin` ran) → `RemovePlayer` → `CloseRoom`, then reset the `Begin` gates and the freeze bits (the CR-011 bit only if no overlay is actually open) **before** the new restore starts (CR-010 step 3, `07 §2.1`). **Not** in `OnLudeoSelected()` — an unvalidated selection touches nothing |
| Overlay "back to menu" | `OnBackToMenuRequestCallback()` (`BackToMenuRequest`) | ✅ YES — `isAbort=true` via `EndCurrentLudeo()`, then navigate to the menu (`05 §6.11`) |

**Required Pattern:**
```cpp
// ✅ CORRECT - Centralized exit point. gameOwnEnd = the game ended the level/match by itself
// (complete, died, game over, restart) rather than the player leaving it.
void EndCurrentGameplay(bool isAbort, bool gameOwnEnd = false) {
#if LUDEO_SDK_ENABLED
    auto& ludeo = LudeoManager::Instance();
    if (gameOwnEnd && ludeo.IsPlayerFlow()) {
        ludeo.HoldForBackendEnd();   // a Ludeo is playing: the backend ends it (05 §6.11) — no End here
        return;                      // the caller must also skip its own restart / next-level step
    }
    if (ludeo.IsGameplayActive()) {
        ludeo.EndGameplaySession(isAbort);
    }
#endif
}

// Hook into EVERY exit path:
void OnLevelComplete() { EndCurrentGameplay(false, true); /* ... */ }
void OnPlayerDied()    { EndCurrentGameplay(false, true); /* ... */ }
void OnQuitToMenu()    { EndCurrentGameplay(true);        /* ... */ }
void OnRestartLevel()  { EndCurrentGameplay(true, true);  /* ... */ }
void OnQuitGame()      { EndCurrentGameplay(true);        /* ... */ }
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
- [ ] Each one calls `EndGameplaySession()` (directly or via helper) — in Creator Flow; in Player Flow the game's own ends hold for the backend instead, and only interrupts call it
- [ ] Test: replay a Ludeo through the game's own end (match/race/level ends before the timer) → the game holds, no restart or next level, and the backend ends the Ludeo on its timer
- [ ] Test: quit mid-level → Ludeo still created
- [ ] Test: restart level → Ludeo still created
- [ ] Test: disconnect (multiplayer) → Ludeo still created
- [ ] Test: overlay "back to menu" mid-playback, and picking a second Ludeo mid-playback → the first one is ended (`isAbort=true`) and its room closed before anything else starts

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

Some SDK operations are **triggered by SDK callbacks**, NOT by game events. And when a callback triggers the next
SDK call, it **queues** it (`LudeoManager::QueueOperation`, `03 §8.3`) rather than calling it inline — an SDK call
issued from inside a callback's dispatch has crashed the process at session-end teardown.

**🎮 Game Code Integration Points (YOU call these):**
| Operation | When to Call | From Where |
|-----------|--------------|------------|
| `ludeo_Initialize()` | Game startup | Main init |
| `ludeo_Session_Activate()` | After init | Startup sequence |
| `ludeo_Session_OpenRoom()` | Level loading **starts** — Creator Flow only; skip while `IsRestoring()` (Player Flow opens its room after the restore settles, CR-010) | Level loader |
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

1. `LudeoSelected` fires → marshal off the SDK thread. If this id is already validating or restoring, return. Otherwise
   stash it as a **candidate** and dispatch `GetLudeo(id)`, tagged with the id. **No teardown, no freeze, no `OpenRoom`.**
2. **Validate** in the `GetLudeo` callback (drop callbacks for anything but the current candidate):
   `resultCode != Success` → ignore the selection. Empty reader (early cycle) → wait for a later cycle; timeout →
   ignore. Populated reader (`GetObjectsInfo` Success && `objectsCount > 0`, `07 §2.2.1`) → read the **entry identity**
   and check this integration can play it; if not, ignore. Ignoring clears the candidate and nothing else — a running
   Ludeo or the menu carries on.
3. **Commit:** if a Ludeo is playing **or an earlier restore is still in progress**, `EndCurrentLudeo` **first**
   (`End(isAbort=true)` if `Begin` ran → `RemovePlayer` → `CloseRoom`; continue only once the close completes). The
   new id and reader are held **by value** through it. **Then** `SetRestoring(true)` (arms the start-of-run skips before
   the load fires them), set the pending id/reader, reset the `Begin` gates and freeze bits, bump the restore
   generation, and turn the input **hold** on. The sim runs as much as the game's own load path needs.
4. **Reach active gameplay** on the captured level (load it / boot the run; generic level if the game has no rooms)
   and wait for the game's native spawn to finish. The Creator-Flow "`OpenRoom` when the level starts loading" hook
   (CR-009) must skip while `IsRestoring()` — this load must not open an unscored room.
5. **Freeze → apply** (`SetCurrent` → Pass 1 + Pass 2 + environment) **→ settle** ~0.5 s with time running and input
   still off — the deferred-property queue (`07 §6`) drains on its first tick — **→ freeze again** →
   `SetRestoring(false)`.
6. **`OpenRoom(ludeoId)`** (Player Flow — `nullptr` would record a NEW Ludeo, `05 §6.2`) → `AddPlayer` →
   `OnPlayerAdded`. The finished moment is now on screen, frozen, behind the overlay.
7. **`RoomReady`** (the viewer pressed Play) → `TryBeginGameplaySession()` → `Begin` → **unfreeze** and release the
   input hold. `Begin` needs `player_added`, `room_ready` and `applied`; the callbacks can arrive in either order
   (`05 §6.6`).

```cpp
// These handlers assume form (a) of 03 §8.3: the function registered with the SDK copies what it needs and queues
// the handler, so each body below runs on the next Tick, outside the SDK's dispatch, and may call the SDK directly.
// With form (b), wrap each SDK call these bodies make in QueueOperation instead.

// ✅ 1. LudeoSelected — validate first; touch nothing else.
void LudeoManager::OnLudeoSelected(const LudeoSessionLudeoSelectedCallbackParams* data) {
    const std::string id = data->ludeoId;
    if (id == m_candidate_ludeo_id || (m_restore_in_progress && id == m_pending_ludeo_id)) return;  // same Ludeo in flight
    m_candidate_ludeo_id = id;                           // "play again" on a finished Ludeo is NOT in flight — it proceeds
    m_candidate_reader = nullptr; m_candidate_deadline = Now() + kRestoreTimeout;
    GetLudeoAsync(id);                                   // read-only; the callback carries the id (clientData) for matching
}

void LudeoManager::IgnoreSelection(const char* why) {   // pre-commit only: clear the candidate, touch nothing else
    LUDEO_LOG("[Ludeo] selection ignored: %s", why);
    m_candidate_ludeo_id.clear(); m_candidate_reader = nullptr; m_candidate_deadline = {};
    m_launching_into_ludeo = false;                    // a preselected launch falls back to the menu (LAUNCH-AND-READINESS §4)
}

// ✅ 2. Validate. May fire REPEATEDLY; early cycles return Success + an EMPTY reader.
void LudeoManager::OnGetLudeoCallback(const LudeoSessionGetLudeoCallbackParams* data, const std::string& forId) {
    if (forId != m_candidate_ludeo_id) return;           // late callback for a selection we've moved past
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

// ✅ 3. Commit — tear down FIRST, then set the new restore's state (held by value through the teardown).
void LudeoManager::CommitAndRestore(const EntryId& entry) {
    const std::string id = m_candidate_ludeo_id; LudeoHDataReader reader = m_candidate_reader;
    m_candidate_ludeo_id.clear(); m_candidate_reader = nullptr;
    auto start = [this, id, reader, entry] { StartRestore(id, reader, entry); };
    if (IsLudeoActive() || m_restore_in_progress) EndCurrentLudeo(start);   // async: start once the close completed
    else start();
}

void LudeoManager::StartRestore(const std::string& id, LudeoHDataReader reader, const EntryId& entry) {
    const uint32_t gen = ++m_restore_generation;          // continuations of an older restore check this and no-op
    m_restore_in_progress = true;
    m_launching_into_ludeo = false;                       // the restore owns the start from here (LAUNCH-AND-READINESS §4)
    SetRestoring(true);                                   // arm start-of-run skips BEFORE the load fires them
    m_pending_ludeo_id = id; m_pending_reader = reader;
    m_room_ready = m_player_added = m_applied = false;
    GameSimulation::Get().ResetRestoreFreezeBits();       // CR-010 bit; CR-011 bit only if no overlay is open
    GameSimulation::Get().SetInputHold(true);             // player input off until Begin
    ReachActiveGameplay(entry, [this, gen] {              // 4. game's own load path; callback once native spawn is done
        if (gen == m_restore_generation) ApplyHeld(gen);
    });
}

// ✅ 5. Apply frozen, settle with input off (deferred queue on its first tick), freeze again.
void LudeoManager::ApplyHeld(uint32_t gen) {
    GameSimulation::Get().SetRestorationFreeze(true);     // nothing may overwrite the snapshot while it lands
    ludeo_DataReader_SetCurrent(m_pending_reader);
    StateAdapter::Get().RestoreTwoPass(m_pending_reader); // queues deferred properties (07 §6)
    StateAdapter::Get().RestoreEnvironment(m_pending_reader);
    m_pending_reader = nullptr;                           // one-shot
    GameSimulation::Get().Settle(0.5f,
        /*onFirstTick*/ [this, gen] { if (gen == m_restore_generation) StateAdapter::Get().ApplyDeferred(); },
        /*onDone*/      [this, gen] {
            if (gen != m_restore_generation) return;
            GameSimulation::Get().SetRestorationFreeze(true);   // hold the finished moment
            SetRestoring(false);                                // restore window closes (NOT the whole replay — 07 §2.3)
            m_applied = true;
            OpenRoom(m_pending_ludeo_id);                       // 6. ludeoId set ⇒ Player Flow; → AddPlayer → OnPlayerAdded
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
    m_restore_in_progress = false;
    GameSimulation::Get().SetRestorationFreeze(false);    // Play resumes exactly the moment the viewer chose
    GameSimulation::Get().SetInputHold(false);
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
- [ ] A selection that validates **while another restore is still in progress** tears that restore down first; its pending load/settle continuations no-op (restore generation), and re-selecting a Ludeo that already finished playing ("play again") is not dropped as a duplicate.
- [ ] `SetRestoring(true)` runs at the commit (after any teardown), **before** the level load, so start-of-run sequences hit the `07 §9.11`
      gate when they fire.
- [ ] The apply runs **frozen**, followed by a ~0.5 s settle with input off, then a second freeze — all **before**
      `OpenRoom`.
- [ ] `OpenRoom` carries the selected `ludeoId` and is dispatched only after the settle.
- [ ] **Before Play, the captured moment is on screen, frozen**, behind the overlay — not the menu, not a loading cover.
- [ ] On Play (`RoomReady`) nothing loads or is written: `Begin`, then unfreeze. The first live frame continues the
      captured moment.
- [ ] No `PlayerReady` reference anywhere; `ResumeGameRequest` is used only for the mid-play overlay-closed resume (CR-011).
- [ ] Nothing that waits on a frame runs inside a freeze — the apply under the freeze is synchronous; frame-dependent work runs in the settle with state-mutating systems suppressed (below).

#### Freeze vs suppress — anything that waits on a frame must not run frozen

The freeze around the apply (step 5) assumes the apply is **synchronous** — `RestoreTwoPass` and `RestoreEnvironment`
finish inside the call. Anything that **waits on a frame** — an async spawn, a physics step, a streamed asset or
level chunk, a navigation rebuild, a "next tick" callback — **deadlocks under a hard freeze**: the frozen engine never
produces the frame it is waiting for. It hangs silently rather than crashing: the settle never completes, `OpenRoom` is
never sent, and `Begin` never fires. The same goes for step 4 — a frozen engine often cannot load a level, which is
why reaching active gameplay runs with only the input hold on.

So the guard depends on the shape of the work:

- **Synchronous writes** (setters, spawn-and-return, the two passes) → **freeze** them, as in step 5.
- **Frame-dependent work** → run it in the **settle**, where time runs, and make **suppression** the overwrite
  guard instead of the freeze: input is already held, and the state-mutating systems that would overwrite the snapshot
  during that work (spawners, cinematics and scripted start-of-run events — `07 §9.11` — and, while the
  frame-dependent work runs, AI and behaviour logic) are gated on `IsRestoring()`, which stays `true` until the
  settle ends. Gating AI here is an addition to `07 §9.11`, needed only for the duration of that work. Extend the settle until that work has finished, bounded like every other restore wait,
  then **freeze** again as usual.

This is the same rule the core order already encodes — writes that need frames go in the settle or the deferred queue
(`07 §6`), never in an unfreeze before the apply. Suppression replaces the freeze **only while that work is running**:
the moment held behind the overlay is still frozen, and `OpenRoom` still waits for the settle.

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
>
> **Only pauses during play are spans.** The CR-010 restore freeze, the input hold and the pre-Play wait are the
> Ludeo's own, not a pause: never report them as `PauseLudeo`/`ResumeLudeo`, and never seed a span from them at
> `Begin` (`phase 6 · task 2`). A Pause at `Begin` followed by a Resume at Play's unfreeze can reach the overlay in
> reverse order and leave its countdown paused — the Ludeo then ends only on a later action, or never.

> ⚠️ **Overlay pause/resume is cloud Player Flow only — those requests never fire in a local build** (and never in
> Creator Flow). The one exception is the backend's **end-of-Ludeo** `PauseGameRequest`, which does arrive in a local
> Player-Flow run and is the local proof that the backend ended the Ludeo. So the overlay half of this contract
> **cannot be exercised locally**: opening the overlay on a local build does not call the handlers, and a
> clean local run is no evidence they work. Locally, verify registration and call the handlers directly from a debug
> hook; the real check is the cloud run after `phase 7`.
>
> **Don't gate the game's own pause key on "is this Player Flow".** A local build replays Ludeos in Player Flow too,
> and there `PauseGameRequest` never arrives — a flow-gated ESC handler leaves the player unable to pause at all. Let
> the game's pause key stand down only **while the overlay is actually open** (the CR-011 overlay bit).

**Validation:**
- [ ] `ludeo_Session_AddNotifyPauseGameRequest` and `ludeo_Session_AddNotifyResumeGameRequest` are both registered at session creation (`phase 3 · task 4` §3.5) — confirm with a log line per registration.
- [ ] **Locally (debug hook):** invoking the pause handler **freezes the simulation tick** (not just input); invoking the resume handler **resumes**; twice in a row behaves the same — handlers are idempotent.
- [ ] **In the cloud (after `phase 7`):** opening the overlay mid-playback freezes the game; closing it resumes.
- [ ] The game's own pause key is gated on the overlay bit, not on Player Flow.
- [ ] After phase 6: the overlay pause sends `PauseLudeo` and its close sends `ResumeLudeo`, once each.
- [ ] No `PauseLudeo`/`ResumeLudeo` is sent around `Begin` or Play for the restore freeze; a replay left idle past its time limit is ended by the backend on time.

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
- [ ] Matched instances (player, singletons, managers that survive a level load) are reset to their baseline before the apply

### CR-007: All Exit Paths (⚠️ HIGH PRIORITY)
- [ ] Listed ALL functions that exit gameplay
- [ ] Each calls `EndGameplaySession()` (directly or via helper)
- [ ] Tested: quit mid-level → Ludeo created
- [ ] Tested: restart level → Ludeo created
- [ ] Tested: disconnect → Ludeo created (multiplayer)
- [ ] Overlay "back to menu" and a validated mid-run `LudeoSelected` both end the active session (`isAbort=true`) and close its room

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
- [ ] Nothing that waits on a frame runs inside a freeze — it runs in the settle with state-mutating systems suppressed (no silent hang before `OpenRoom`)

### CR-011: Paused While Overlay Is Active Mid-Play (⚠️ #1 MID-PLAY FAILURE)
- [ ] `ludeo_Session_AddNotifyPauseGameRequest` and `ludeo_Session_AddNotifyResumeGameRequest` are both registered at session creation
- [ ] The pause handler **freezes the simulation tick** (not just input), the resume handler resumes — checked locally by calling them directly, idempotent across toggles
- [ ] The overlay pause/resume requests only fire in a **cloud** Player-Flow session — the real overlay check happens after `phase 7` (the backend's end-of-Ludeo `PauseGameRequest` does fire locally)
- [ ] The game's own pause key is gated on the overlay bit, not on Player Flow

---

## 🔗 **Related Documents**

**For lifecycle details:**
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - Complete callback flow and session management
- [LAUNCH-AND-READINESS.md](./LAUNCH-AND-READINESS.md) - Games that boot straight into gameplay or launch into a Ludeo: the SDK-readiness gate

**For best practices and additional guidelines:**
- [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - Error handling, return value checking, API patterns
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Stable IDs, pause tracking, actions implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - LudeoSelected handling, player input flow

**For implementation:**
- [01-AI-AGENT-GUIDE.md](./01-AI-AGENT-GUIDE.md) - Step-by-step integration workflow
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - When things go wrong

---

**Remember:** These 11 requirements are non-negotiable. Violating them will break your integration.