# 03-SDK-FUNDAMENTALS.md - Ludeo SDK Core Concepts

> **Purpose:** Foundational knowledge of how Ludeo SDK works  
> **For:** AI agents and developers integrating Ludeo SDK  
> **Read Time:** 15 minutes  
> **When to Load:** Before any implementation work
> **Concepts here, headers win:** this file explains how the SDK thinks. For exact signatures, the cloned SDK headers are the authority (§4.5).

**Last Updated:** December 2025

---

## 📋 **Table of Contents**

1. [What is Ludeo SDK?](#1-what-is-ludeo-sdk)
2. [Core Concepts](#2-core-concepts)
3. [SDK Architecture](#3-sdk-architecture)
4. [API Pattern Overview](#4-api-pattern-overview)
5. [Data Type Mapping](#5-data-type-mapping)
6. [Handle Management](#6-handle-management)
7. [Callback Pattern](#7-callback-pattern)
8. [Threading Model](#8-threading-model)

---

## 1. What is Ludeo SDK?

### Purpose

Ludeo SDK enables games to create **playable moments** - game states that can be:
- **Captured** during gameplay (tracking)
- **Stored** as "Ludeos" on Ludeo platform
- **Shared** with other players
- **Restored** for playback (restoration)

### Key Capabilities

**Tracking:**
- Record game object states
- Track discrete gameplay actions
- Capture environment metadata
- Record player interactions

**Restoration:**
- Recreate complete game state
- Restore all objects and properties
- Replay gameplay moments
- Enable challenges and objectives

**Platform Integration:**
- Cloud storage of Ludeos
- Social sharing features
- Leaderboards and scoring
- Video capture overlay

---

## 2. Core Concepts

### 2.1 Ludeo Session vs Gameplay Session

**Ludeo Session:**
- Activated ONCE when game loads
- Persists throughout game's lifetime
- Released when game shuts down
- Think: "The SDK connection is active"

**Gameplay Session:**
- Created for EACH gameplay instance (level, match, mission)
- Multiple Gameplay Sessions per Ludeo Session
- Begins when gameplay starts, ends when gameplay ends
- Think: "A playable moment"
```
Game Lifecycle:
Launch → [Ludeo Session Active] → Shutdown
           ↓
           Level 1 → [Gameplay Session 1]
           Level 2 → [Gameplay Session 2]
           Level 3 → [Gameplay Session 3]
```

### 2.2 Room

A **Room** is a container for a gameplay instance:
- Created when level/match loads
- Provides the **DataWriter** for tracking
- Multiple players can be in one Room (multiplayer)
- Closed when gameplay ends
```
Room = Container for gameplay
  ├── DataWriter (for tracking)
  ├── Players (one or more)
  └── Gameplay Sessions (one per player)
```

### 2.3 DataWriter vs DataReader

**DataWriter:**
- Used during **tracking** (capture)
- Writes game state to Ludeo platform
- Active during Gameplay Session
- One per Room

**DataReader:**
- Used during **restoration** (playback)
- Reads game state from Ludeo platform
- Obtained when user selects a Ludeo
- Contains snapshot of tracked state
```
Capture:  Game → DataWriter → Ludeo Platform
Playback: Ludeo Platform → DataReader → Game
```

### 2.4 LudeoObjectId

Every tracked game object gets a **LudeoObjectId**:
- Unique identifier within a Ludeo
- Used to organize tracked attributes
- Required for all Set/Get operations
- Type: `uint64_t`
```cpp
LudeoObjectId player_id;      // Player's Ludeo ID
LudeoObjectId enemy_id;       // Enemy's Ludeo ID
LudeoObjectId projectile_id;  // Projectile's Ludeo ID
```

### 2.5 Attributes

**Attributes** are named properties of objects:
- Identified by **string names** (not IDs!)
- Typed (float, int, bool, vec3, etc.)
- Updated via DataWriter during tracking
- Retrieved via DataReader during restoration
```cpp
// Setting attributes (tracking)
ludeo_DataWriter_SetFloat("health", 75.0f);
ludeo_DataWriter_SetVec3Float("position", pos_array);

// Getting attributes (restoration)
float health;
ludeo_DataReader_GetFloat("health", &health);
```

### 2.6 Actions

**Actions** are discrete gameplay events:
- NOT continuous state (use attributes for that)
- Fire once at a moment in time
- Enable Ludeo objectives ("Get 5 kills")
- Enable Ludeo scoring (100 points per kill)
```cpp
// Actions = Events
LUDEO_ACTION("Kill");           // Fired once when enemy killed
LUDEO_ACTION("CollectCoin");    // Fired once when coin collected

// Attributes = Continuous state
LUDEO_CAPTURE_FLOAT(this, "player", "health", 85.0f);  // Updated continuously
```

### 2.7 LudeoSelected Event

**LudeoSelected** occurs when a user selects a Ludeo to play:
- Can happen AT ANY TIME (menu, gameplay, loading, cutscene)
- Game must interrupt current activity
- Game must load appropriate level
- Game must restore state from DataReader
- Game must pause and wait for player input

### 2.8 A Room is NOT a Highlight

The single most common conceptual error is treating a room as "one interesting moment".

- **A Room** is the recording of one **whole gameplay instance** — a level, a match, a run (for open-world games, one
  continuous live run, `05 §6.1`). It opens when that gameplay starts (`05 §6.2`; in Player Flow, after the restore
  settles, `07 §2.1`), **stays open for the entire run**, and closes after `End` → `RemovePlayer`. One room per
  gameplay instance, many per Ludeo Session.
- **A highlight** — a moment that becomes a Ludeo — is cut by the platform **from inside an open room's recording**.
  The game doesn't create highlights. It keeps the room open and recording, and reports actions as they happen (§2.6).

**Why conflating them breaks the integration.** Opening and closing a room around each "moment" (a kill, a boss
phase, a pickup) cuts the run into short, disconnected recordings. Each close ends the recording, so the state
between rooms is never captured and the platform has no continuous run to cut a moment from. Each new room comes with
a new DataWriter, so every tracked object must be created again. Every moment also repeats the whole async chain
(`OpenRoom → AddPlayer → RoomReady → Begin`, then `End → RemovePlayer → Close`), multiplying its failure points
and the CR-007 exit-path surface. The rule: **room boundaries follow gameplay-session boundaries, never moments.**

---

## 3. SDK Architecture

### 3.1 Layered Design
```
┌─────────────────────────────────────┐
│         Your Game Code              │
├─────────────────────────────────────┤
│    Ludeo Integration Layer          │
│  (LudeoManager, Capture Macros)     │
├─────────────────────────────────────┤
│       Ludeo SDK (C API)             │
├─────────────────────────────────────┤
│      Ludeo Platform Services        │
│  (Cloud Storage, Video, Overlay)    │
└─────────────────────────────────────┘
```

### 3.2 Component Separation

**Session Management:**
- Handles SDK lifecycle
- Manages Ludeo Session
- Registers notifications

**Room Management:**
- Creates Rooms for gameplay
- Manages DataWriter access
- Handles player registration

**Tracking:**
- Object registration
- Attribute updates
- Action events

**Restoration:**
- LudeoSelected handling
- DataReader operations
- State recreation

---

## 4. API Pattern Overview

### 4.1 C API with Handles

SDK uses **opaque handle types**:
```cpp
typedef struct LudeoSessionImpl* LudeoHSession;
typedef struct LudeoRoomImpl* LudeoHRoom;
typedef struct LudeoDataWriterImpl* LudeoHDataWriter;
typedef struct LudeoDataReaderImpl* LudeoHDataReader;
typedef struct LudeoGameplaySessionImpl* LudeoHGameplaySession;
```

Handles are:
- Pointers to opaque structs
- Created by SDK functions
- Passed to subsequent operations
- Released when done

### 4.2 Synchronous vs Asynchronous

**Synchronous operations** (return immediately):
```cpp
ludeo_Initialize()              // Init SDK
ludeo_Tick()                    // Process callbacks
ludeo_DataWriter_SetFloat()     // Set attribute
ludeo_DataWriter_EnterObject()  // Enter context
```

**Asynchronous operations** (return `void`, require callbacks):
```cpp
ludeo_Session_Activate()        // Activate Ludeo Session - returns void
ludeo_Session_OpenRoom()        // Open Room - returns void
ludeo_Room_AddPlayer()          // Add player - returns void
ludeo_GameplaySession_Begin()   // Begin gameplay - returns void
ludeo_GameplaySession_End()     // End gameplay - returns void
ludeo_Room_Close()              // Close Room - returns void
ludeo_Session_GetLudeo()        // Fetch Ludeo data - returns void
```

**Critical:** Async operations return `void`, NOT `LudeoResult`! Success/failure is ONLY reported via the callback's `resultCode` parameter. Do NOT try to capture a return value from these functions.
**Critical:** Async operations return immediately. Use callbacks to know when complete!

### 4.3 Parameter Structs

All operations use versioned parameter structs with the `Ludeo::create<>` template:
```cpp
auto params = Ludeo::create<LudeoSessionActivateParams>();
// apiVersion is automatically set by Ludeo::create<>
params.platformUrl = "https://services.ludeo.com";
params.apiKey = "your-api-key";
params.gameVersion = "1.0.0";
params.windowHandle = hwnd;

ludeo_Session_Activate(session, &params, clientData, callback);
```

**Always use `Ludeo::create<>()` - it automatically sets `apiVersion` to the correct version!**

### 4.4 Result Codes

All operations return `LudeoResult`:
```cpp
enum LudeoResult {
    Success = 0,
    InvalidArgument,
    NotReady,
    Timeout,
    NetworkError,
    // ... more
};
```

**Always check return values!**

### 4.5 Concepts Here, Headers Win

These docs teach **concepts and flow**: what the SDK objects are, which call comes when, and which callback drives
which step. They are not the authority on **exact signatures**. Parameter lists, struct field names,
`*_API_LATEST` macro names, enum values, return types (`LudeoBool` vs `LudeoResult`) and callback param shapes can
drift between SDK releases, and the skill clones the **latest** release.

**When the SDK headers (`Include/Ludeo/*.h` in the cloned SDK, `04 §3`) disagree with these docs, the headers are
right.** Write the call the way the header declares it, and treat the doc snippet as a shape to adapt, not code to
paste. The split runs one way only: the headers tell you **how** to call something; the flow docs (`07 §2`, CR-009,
CR-010) tell you **when**, and that order is not something to re-derive from the headers. If a header looks
older than the backend — a notification never arrives, the log shows `unknown event_name` — update the SDK
([11 §9](./11-TROUBLESHOOTING.md)); don't work around it.

---

> **⚠️ Critical SDK Rules:** See [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) for all mandatory rules (macro guards, return value checking, Enter/Leave pairing, etc.)

---

## 5. Data Type Mapping

### 6.1 Type Correspondence

| C++ Type | SDK Set Function | SDK Get Function | Notes |
|----------|------------------|------------------|-------|
| `float` | `SetFloat()` | `GetFloat()` | Single precision |
| `int32_t` | `SetInt32()` | `GetInt32()` | Signed 32-bit |
| `uint32_t` | `SetUInt32()` | `GetUInt32()` | Unsigned 32-bit |
| `uint64_t` | `SetUInt64()` | `GetUInt64()` | For IDs, large values |
| `bool` | `SetBool()` | `GetBool()` | Use `LUDEO_TRUE`/`LUDEO_FALSE` |
| `Vec3` | `SetVec3Float()` | `GetVec3Float()` | Pass `float[3]` array |
| `Vec4/Quat` | `SetVec4Float()` | `GetVec4Float()` | Pass `float[4]` array |
| `const char*` | `SetString()` | `GetString()` | Null-terminated string |

### 6.2 Usage Examples

**Float:**
```cpp
float health = 85.0f;
ludeo_DataWriter_SetFloat("health", health);

// Restoration
float restored_health;
if (ludeo_DataReader_GetFloat("health", &restored_health)) {
    player->SetHealth(restored_health);
}
```

**Integer:**
```cpp
int32_t score = 1500;
ludeo_DataWriter_SetInt32("score", score);

// Restoration
int32_t restored_score;
if (ludeo_DataReader_GetInt32("score", &restored_score)) {
    player->SetScore(restored_score);
}
```

**Boolean:**
```cpp
bool is_dead = true;
ludeo_DataWriter_SetBool("is_dead", is_dead ? LUDEO_TRUE : LUDEO_FALSE);

// Restoration
LudeoBool restored_dead;
if (ludeo_DataReader_GetBool("is_dead", &restored_dead)) {
    bool is_dead = (restored_dead == LUDEO_TRUE);
    player->SetDead(is_dead);
}
```

**Vec3 (Position):**
```cpp
Vec3 position = player->GetPosition();
float pos[3] = {position.x, position.y, position.z};
ludeo_DataWriter_SetVec3Float("position", pos);

// Restoration
float restored_pos[3];
if (ludeo_DataReader_GetVec3Float("position", restored_pos)) {
    player->SetPosition(Vec3(restored_pos[0], restored_pos[1], restored_pos[2]));
}
```

**Vec4 (Quaternion):**
```cpp
Quat rotation = player->GetRotation();
float rot[4] = {rotation.x, rotation.y, rotation.z, rotation.w};
ludeo_DataWriter_SetVec4Float("rotation", rot);

// Restoration
float restored_rot[4];
if (ludeo_DataReader_GetVec4Float("rotation", restored_rot)) {
    player->SetRotation(Quat(restored_rot[0], restored_rot[1], restored_rot[2], restored_rot[3]));
}
```

**String:**
```cpp
const char* name = "PlayerOne";
ludeo_DataWriter_SetString("name", name);

// Restoration
char restored_name[256];
if (ludeo_DataReader_GetString("name", restored_name, sizeof(restored_name))) {
    player->SetName(restored_name);
}
```

**Uint64 (IDs):**
```cpp
uint64_t owner_id = entity->GetOwnerID();
ludeo_DataWriter_SetUInt64("owner_id", owner_id);

// Restoration
uint64_t restored_owner_id;
if (ludeo_DataReader_GetUInt64("owner_id", &restored_owner_id)) {
    Player* owner = PlayerManager::Get().FindByID(restored_owner_id);
    entity->SetOwner(owner);
}
```

---

## 6. Handle Management

### 7.1 Handle Lifecycle

**Handles are created and managed by SDK:**
```cpp
// Session
LudeoHSession session = nullptr;
ludeo_Session_Create(&params, &session);  // SDK creates
// ... use session
ludeo_Session_Release(session);           // SDK releases

// DataWriter (obtained from Room callback)
LudeoHDataWriter writer = nullptr;
// SDK provides in OpenRoom callback
void OnRoomOpened(const LudeoSessionOpenRoomCallbackParams* data) {
    writer = data->dataWriter;  // SDK gives us the handle
}

// DataReader (obtained from GetLudeo callback)
LudeoHDataReader reader = nullptr;
void OnLudeoDataReceived(const LudeoSessionGetLudeoCallbackParams* data) {
    reader = data->dataReader;  // SDK gives us the handle
}
```

### 7.2 Handle Storage

**Store handles in manager class:**
```cpp
class LudeoManager {
private:
    LudeoHSession m_session_handle = nullptr;
    LudeoHRoom m_room_handle = nullptr;
    LudeoHGameplaySession m_gameplay_session_handle = nullptr;
    LudeoHDataWriter m_data_writer = nullptr;
    LudeoHDataReader m_data_reader = nullptr;
    
public:
    LudeoHDataWriter GetDataWriter() const { return m_data_writer; }
    LudeoHDataReader GetDataReader() const { return m_data_reader; }
};
```

### 7.3 Handle Validity

**Always check handles before use:**
```cpp
LudeoHDataWriter writer = LudeoManager::Instance().GetDataWriter();
if (writer == nullptr) {
    return;  // Not ready for tracking
}

// Safe to use
ludeo_DataWriter_SetCurrent(writer);
```

---

## 7. Callback Pattern

### 8.1 Callback Function Signature

All callbacks follow this pattern:
```cpp
void MyCallback(const LudeoXxxCallbackParams* data)
{
    // Check result
    if (data->resultCode != LudeoResult::Success) {
        LogError("Operation failed: %d", data->resultCode);
        return;
    }
    
    // Access singleton instance
    LudeoManager& mgr = LudeoManager::Instance();
    
    // Handle success
    // ...
}
```

### 8.2 Singleton Callback Pattern

LudeoManager is a singleton, so callbacks access it via `LudeoManager::Instance()`:
```cpp
class LudeoManager {
public:
    static LudeoManager& Get();  // Singleton accessor
    
    void ActivateSession() {
        auto params = Ludeo::create<LudeoSessionActivateParams>();
        // apiVersion is automatically set by Ludeo::create<>
        // ... other params
        
        ludeo_Session_Activate(
            m_session_handle,
            &params,
            nullptr,                       // clientData not needed for singleton
            OnSessionActivatedCallback
        );
    }
    
private:
    static void OnSessionActivatedCallback(
        const LudeoSessionActivateCallbackParams* data)
    {
        if (data->resultCode != LudeoResult::Success)
        {
            LogCallbackError("Session activation", data->resultCode);
            return;
        }
        
        // Access singleton directly - no clientData cast needed
        LudeoManager& mgr = LudeoManager::Instance();
        mgr.m_session_active = true;
    }
    
    bool m_session_active = false;
    LudeoHSession m_session_handle = nullptr;
};
```

**Pattern:** Callbacks are `static` and access the singleton via `LudeoManager::Instance()`.

### 8.3 Common Callbacks

| Operation | Callback Type | Data Available |
|-----------|---------------|----------------|
| Session Activate | `LudeoSessionActivateCallback` | `resultCode` |
| Open Room | `LudeoSessionOpenRoomCallback` | `room`, `dataWriter` |
| Add Player | `LudeoRoomAddPlayerCallback` | `gameplaySession` |
| Begin Gameplay | `LudeoGameplaySessionBeginCallback` | `resultCode` |
| End Gameplay | `LudeoGameplaySessionEndCallback` | `resultCode` |
| Close Room | `LudeoRoomCloseCallback` | `resultCode` |
| Get Ludeo | `LudeoSessionGetLudeoCallback` | `dataReader` |
| Ludeo Selected | `LudeoSessionLudeoSelectedCallback` | `ludeoId` |
| Pause Game Request | `LudeoSessionPauseGameRequestCallback` | `clientData` |
| Resume Game Request | `LudeoSessionResumeGameRequestCallback` | `clientData` |
| Back To Menu Request | `LudeoSessionBackToMenuRequestCallback` | `clientData` |
| Mute Request | `LudeoSessionMuteRequestCallback` | `clientData` |

---

## 8. Threading Model

### 8.1 SDK Thread Safety

**SDK operations are NOT inherently thread-safe.**

Call SDK functions from a **consistent thread** (typically main thread).

### 8.2 Tick Requirement

**`ludeo_Tick()` MUST be called once per frame on the same thread:**
```cpp
void GameLoop::Update() {
    // Game logic
    
#if LUDEO_SDK_ENABLED
    LudeoManager::Instance().Tick();  // Process callbacks
#endif
    
    // Rendering
}
```

### 8.3 Thread-Safe Integration

**Queue SDK operations — from other threads, and from inside SDK callbacks.** Never issue an SDK call from
*inside* an SDK callback's dispatch (e.g. `ludeo_Room_Close` from the `GameplaySession_End` callback, or
`ludeo_Session_GetLudeo` straight from the `LudeoSelected` notification): the SDK may still be reacting to the same
event — tearing down its video encoder at session end, for instance — and a call landing on that same tick has been
seen to end the process with a native `abort()` and no log. Queue the next call instead; it runs on the next `Tick`,
outside the dispatch. Audit **every** callback that issues an SDK call, not just teardown — the chain
`OnRoomOpened → AddPlayer → OnPlayerAdded / OnRoomReady → Begin → … → End → RemovePlayer → Close` included.
(Synchronous quit paths, where there is no next tick, are the exception — see 05 §7.)
```cpp
class LudeoManager {
    std::mutex m_queue_mutex;
    std::vector<std::function<void()>> m_pending_operations;
    
public:
    // Called from any thread
    void QueueOperation(std::function<void()> op) {
        std::lock_guard<std::mutex> lock(m_queue_mutex);
        m_pending_operations.push_back(std::move(op));
    }
    
    // Called from main thread during Tick
    void Tick() {
        ProcessQueue();  // Execute queued operations
        ludeo_Tick();    // SDK tick
    }
    
private:
    void ProcessQueue() {
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

// Usage from any thread
LudeoManager::Instance().QueueOperation([this]() {
    LUDEO_CAPTURE_FLOAT(this, "entity", "health", m_health);
});

// Usage from inside an SDK callback: issue the NEXT SDK call from the queue, not inline
void OnGameplayEndedCallback(const LudeoGameplaySessionEndCallbackParams* data) {
    LudeoManager::Instance().QueueOperation([] { RemovePlayerFromRoom(player_id); });
}
```

---

## 📚 **Related Documentation**

**For detailed API signatures:**
- [12-SDK-API-REFERENCE.md](./12-SDK-API-REFERENCE.md) - Links to official API docs

**For implementation guidance:**
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - SDK lifecycle integration
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Tracking implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - Restoration implementation
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Macro helpers and patterns

**For requirements:**
- [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Must-follow rules

**For troubleshooting:**
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - Common errors and solutions

---

**Key Takeaways:**
1. Use attribute names (strings), not IDs
2. Async operations need callbacks
3. Always pair Enter/Leave (use RAII helpers)
4. Release resources when done
5. One room spans a whole gameplay instance — never one room per highlight (§2.8)
6. Concepts here, headers win on exact signatures (§4.5)

→ **For mandatory rules (error handling, macro guards, etc.):** See [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md)