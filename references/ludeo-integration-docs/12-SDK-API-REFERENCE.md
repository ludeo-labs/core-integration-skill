# 12-SDK-API-REFERENCE.md - Ludeo SDK API Reference Hub

> **Official Documentation:** https://api-docs.ludeo.com/docs/core/topics.html  
> **Developer Guides:** https://docs.ludeo.com/  
> **Purpose:** Quick reference and integration-focused API guidance

**Last Updated:** December 2025

---

## 📚 **Official Documentation Links**

### Primary Resources
- **API Reference:** https://api-docs.ludeo.com/docs/core/topics.html
- **Getting Started:** https://docs.ludeo.com/docs/core/pages/GettingStarted
- **Session Activation:** https://docs.ludeo.com/docs/core/pages/SessionActivation
- **Gameplay Session:** https://docs.ludeo.com/docs/core/pages/HandlingGameplaySession
- **Track Gameplay:** https://docs.ludeo.com/docs/core/pages/TrackGameplay
- **Restore Gameplay:** https://docs.ludeo.com/docs/core/pages/RestoreGameplay
- **Testing Locally:** https://docs.ludeo.com/docs/core/pages/developer-tools/TestingLudeosLocally

---

## 🎯 **Task-Based API Navigation**

### "I need to initialize the SDK"
**Functions:**
- `ludeo_Initialize()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Initialize)
- `ludeo_Session_Create()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Session_Create)
- `ludeo_Shutdown()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Shutdown)

**Guide:** [Session Activation](https://docs.ludeo.com/docs/core/pages/SessionActivation)  
**Our Docs:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md)

---

### "I need to activate a Ludeo Session"
**Functions:**
- `ludeo_Session_Activate()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Session_Activate)

**Parameters to note:**
- `windowHandle` - REQUIRED for video/overlay (see our notes below)
- `apiKey` - Your Ludeo API key
- `gameVersion` - Current game version string

**Integration Notes:**
- Async operation - requires callback
- Call ONCE when game loads, not per level
- Window handle is platform-specific (see Platform Notes below)

**Guide:** [Session Activation](https://docs.ludeo.com/docs/core/pages/SessionActivation)  
**Our Docs:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md#62-sdk-initialization)

---

### "I need to start gameplay tracking"
**Functions:**
- `ludeo_Session_OpenRoom()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Session_OpenRoom)
- `ludeo_Room_AddPlayer()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Room_AddPlayer)
- `ludeo_GameplaySession_Begin()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_GameplaySession_Begin)

**Sequence:**
1. OpenRoom (when match/level starts) → Returns DataWriter
2. AddPlayer (from OpenRoom callback) → Returns GameplaySession handle
3. Begin (when BOTH: player added AND RoomReady notification received) → Tracking active

**Note:** Register `ludeo_Session_AddNotifyRoomReady()` upon session creation to receive RoomReady notifications.

**Guide:** [Gameplay Session](https://docs.ludeo.com/docs/core/pages/HandlingGameplaySession)  
**Our Docs:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md#7-gameplay-session-management)

---

### "I need to track object state"
**Functions:**
- `ludeo_DataWriter_CreateObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_CreateObject)
- `ludeo_DataWriter_DestroyObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_DestroyObject)
- `ludeo_DataWriter_SetCurrent()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetCurrent)
- `ludeo_DataWriter_EnterObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_EnterObject)
- `ludeo_DataWriter_LeaveObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_LeaveObject)

**Set Functions (by type):**
- `ludeo_DataWriter_SetFloat()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetFloat)
- `ludeo_DataWriter_SetInt32()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetInt32)
- `ludeo_DataWriter_SetUInt64()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetUInt64)
- `ludeo_DataWriter_SetBool()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetBool)
- `ludeo_DataWriter_SetVec3Float()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetVec3Float)
- `ludeo_DataWriter_SetVec4Float()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetVec4Float)
- `ludeo_DataWriter_SetString()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SetString)

**Integration Notes:**
- Use attribute NAMES (strings), not IDs
- Always pair Enter/Leave (use RAII helper)
- Check return values (CreateObject can fail)

**Guide:** [Track Gameplay](https://docs.ludeo.com/docs/core/pages/TrackGameplay)  
**Our Docs:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md), [08-CODE-PATTERNS.md](./08-CODE-PATTERNS.md)

---

### "I need to track gameplay actions"
**Functions:**
- `ludeo_DataWriter_SendAction()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataWriter_SendAction)

**Integration Notes:**
- Use for discrete events (kills, pickups, objectives)
- NOT for continuous state (use Set functions for that)
- Actions enable Ludeo objectives and scoring

**Our Docs:** [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md#7-ludeo-actions-discrete-events)

---

### "I need to restore game state"
**Functions:**
- `ludeo_Session_GetLudeo()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Session_GetLudeo)
- `ludeo_DataReader_SetCurrent()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_SetCurrent)
- `ludeo_DataReader_GetObjectsInfo()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetObjectsInfo)
- `ludeo_DataReader_EnterObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_EnterObject)
- `ludeo_DataReader_LeaveObject()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_LeaveObject)
- `ludeo_ObjectsInfo_Release()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_ObjectsInfo_Release)

**Get Functions (by type):**
- `ludeo_DataReader_GetFloat()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetFloat)
- `ludeo_DataReader_GetInt32()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetInt32)
- `ludeo_DataReader_GetUInt64()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetUInt64)
- `ludeo_DataReader_GetBool()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetBool)
- `ludeo_DataReader_GetVec3Float()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetVec3Float)
- `ludeo_DataReader_GetVec4Float()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetVec4Float)
- `ludeo_DataReader_GetString()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_DataReader_GetString)

**Integration Notes:**
- MUST use two-pass restoration (create objects, then properties)
- MUST release ObjectsInfo when done (avoid memory leak)
- Check return values (Get functions return false if attribute missing)

**Guide:** [Restore Gameplay](https://docs.ludeo.com/docs/core/pages/RestoreGameplay)  
**Our Docs:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md)

---

### "I need to handle LudeoSelected and the overlay (pause/resume)"
**Functions:**
- `ludeo_Session_AddNotifyLudeoSelected()` — a Ludeo was selected (delivers a `ludeoId`; then call `ludeo_Session_GetLudeo`, which is async and hands you the `DataReader` in its callback)
- `ludeo_Session_AddNotifyPauseGameRequest()` — **mid-play** overlay reopened → freeze the simulation
- `ludeo_Session_AddNotifyResumeGameRequest()` — **mid-play** overlay closed → resume. *Not* the post-restore resume (see below).
- `ludeo_Session_AddNotifyBackToMenuRequest()` — return to the main menu / lobby
- `ludeo_Session_AddNotifyMuteRequest()` — mute game audio

**Integration Notes:**
- LudeoSelected can fire at ANY time (even mid-gameplay) — marshal off the SDK notification thread
- Register all of these at **session creation**; they are session-lifetime
- The overlay **drives** pause/resume — the game doesn't poll for it. Pause = freeze the simulation tick, not just input
- **Post-restore resume goes through `RoomReady → Begin`**, not `ResumeGameRequest`. The flow is **synchronous read-then-load**: in the `LudeoSelected` handler the game **freezes the sim**, then dispatches **both** `GetLudeo(ludeoId)` (caches the `DataReader`) and `OpenRoom(ludeoId)` → `AddPlayer` (Player Flow) — `OpenRoom` is called **directly in the handler**, not hung off a level-load hook, and the target level is **unknown** until the reader is in hand. Only `RoomReady` is withheld by the platform until the player presses Play. When it fires (apply gated on reader-cached + `room_ready`, fires once on the last), the game **unpauses → reads the entry identity from the reader → loads that level → applies state → `Begin`** once **both** gates (`player_added` + `room_ready`) are met (`05-LIFECYCLE-MANAGEMENT.md` §6.11; the two callbacks can arrive in either order, §6.6). The SDK does **not** call `OpenRoom`/`AddPlayer` for you on the Play press. `ResumeGameRequest` is for the player reopening/closing the overlay *during* an active playback session.
- **There is no `PlayerReady` notification in this SDK.**

**Our Docs:** [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) §2.4 (overlay control), §7 (wait-for-player); [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) (RoomReady → Begin)

---

### "I need to end gameplay tracking"
**Functions:**
- `ludeo_GameplaySession_End()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_GameplaySession_End)
- `ludeo_Room_Close()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Room_Close)
- `ludeo_Session_Release()` - [API Docs](https://api-docs.ludeo.com/docs/core/topics.html#ludeo_Session_Release)

**Sequence:**
1. End GameplaySession (when gameplay ends)
2. Close Room (when leaving level)
3. Release Session (when game exits)

**Our Docs:** [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md#7-gameplay-session-management)

---

## 🔧 **Integration Notes**

> **For detailed implementation patterns, see:**
> - [00-CRITICAL-REQUIREMENTS.md](./00-CRITICAL-REQUIREMENTS.md) - Mandatory rules (window handle, error handling, async callbacks)
> - [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - Data type mapping, callback patterns

---

## 📖 **Quick Function Reference**

### Initialization & Lifecycle
| Function | Purpose | Sync/Async |
|----------|---------|------------|
| `ludeo_Initialize()` | Initialize SDK | Sync |
| `ludeo_Shutdown()` | Cleanup SDK | Sync |
| `ludeo_Tick()` | Process callbacks | Sync |
| `ludeo_Session_Create()` | Create session handle | Sync |
| `ludeo_Session_Activate()` | Activate Ludeo Session | Async |
| `ludeo_Session_Release()` | Release session | Sync |

### Gameplay Session
| Function | Purpose | Sync/Async |
|----------|---------|------------|
| `ludeo_Session_OpenRoom()` | Open room, get DataWriter | Async |
| `ludeo_Room_AddPlayer()` | Add player, get GameplaySession | Async |
| `ludeo_GameplaySession_Begin()` | Start tracking | Async |
| `ludeo_GameplaySession_End()` | Stop tracking | Async |
| `ludeo_Room_Close()` | Close room | Async |

### Tracking (DataWriter)
| Function | Purpose | Sync/Async |
|----------|---------|------------|
| `ludeo_DataWriter_SetCurrent()` | Set thread-local context | Sync |
| `ludeo_DataWriter_CreateObject()` | Register new object | Sync |
| `ludeo_DataWriter_DestroyObject()` | Unregister object | Sync |
| `ludeo_DataWriter_EnterObject()` | Enter object context | Sync |
| `ludeo_DataWriter_LeaveObject()` | Leave object context | Sync |
| `ludeo_DataWriter_Set*()` | Set attribute value | Sync |
| `ludeo_DataWriter_SendAction()` | Send action event | Sync |

### Restoration (DataReader)
| Function | Purpose | Sync/Async |
|----------|---------|------------|
| `ludeo_Session_GetLudeo()` | Fetch Ludeo data | Async |
| `ludeo_DataReader_SetCurrent()` | Set thread-local context | Sync |
| `ludeo_DataReader_GetObjectsInfo()` | Get all objects list | Sync |
| `ludeo_DataReader_EnterObject()` | Enter object context | Sync |
| `ludeo_DataReader_LeaveObject()` | Leave object context | Sync |
| `ludeo_DataReader_Get*()` | Get attribute value | Sync |
| `ludeo_ObjectsInfo_Release()` | Release objects list | Sync |

### Notifications
| Function | Purpose | Sync/Async |
|----------|---------|------------|
| `ludeo_Session_AddNotifyLudeoSelected()` | Register LudeoSelected handler | Sync |
| `ludeo_Session_AddNotifyPauseGameRequest()` | Overlay requests pause → freeze sim | Sync |
| `ludeo_Session_AddNotifyResumeGameRequest()` | Overlay requests resume (post-restore resume) | Sync |
| `ludeo_Session_AddNotifyBackToMenuRequest()` | Overlay requests return to menu | Sync |
| `ludeo_Session_AddNotifyMuteRequest()` | Overlay requests mute | Sync |

---

## 🔗 **Related Documentation**

**Our Integration Guides:**
- [03-SDK-FUNDAMENTALS.md](./03-SDK-FUNDAMENTALS.md) - Core concepts
- [05-LIFECYCLE-MANAGEMENT.md](./05-LIFECYCLE-MANAGEMENT.md) - Session management
- [06-TRACKING-PATTERNS.md](./06-TRACKING-PATTERNS.md) - Tracking implementation
- [07-RESTORATION-PATTERNS.md](./07-RESTORATION-PATTERNS.md) - Restoration implementation
- [08-CODE-PATTERNS.md](./08-CODE-PATTERNS.md) - Macro helpers
- [11-TROUBLESHOOTING.md](./11-TROUBLESHOOTING.md) - Common issues

**Official Ludeo Documentation:**
- API Reference: https://api-docs.ludeo.com/docs/core/topics.html
- Developer Guides: https://docs.ludeo.com/

---

**Remember:** 
- Official docs for API signatures and parameters
- Our docs for integration patterns and best practices
- Always check return values
- All async operations need callbacks