# 02A-RESEARCH-ARCHITECTURE.md - Game Architecture Research

> **Purpose:** Analyze game architecture to identify SDK lifecycle integration points  
> **For:** Lifecycle Agent - finding where to initialize, tick, and manage sessions  
> **Prerequisites:** None - this is the starting point

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify **🎮 Game Code Integration Points** only:
- Where to initialize and shutdown the SDK
- Where to call `ludeo_Tick()` every frame
- Where to activate Ludeo Session
- Where to open Rooms (when level loading **starts**)
- Where to end Gameplay Sessions (**ALL** exit paths)

> **⚠️ Note:** Some SDK operations are **callback-driven** (AddPlayer, BeginGameplaySession, RemovePlayer, CloseRoom). Do NOT search for locations for these - they are implemented inside LudeoManager callbacks. See Section 3.2 for details.

**Output:** Create `GAME_ANALYSIS_ARCHITECTURE.md` with your findings.

---

## 🎮 **SECTION 1: Game Overview**

### Basic Information

**Game Name:**  
**Genre:**  
**Platform(s):**  
**Engine/Framework:**  
**Language(s):**  
**Build System:**  

**Single-player, Multiplayer, or Hybrid:**  
**Estimated Codebase Size (lines):**  
**Key Dependencies:**  

---

## 🏗️ **SECTION 2: Game Architecture**

### 2.1 Game Loop and Entry Point

**Main entry point file:**  
**Game loop location:**  
**Approximate frame rate/tick rate:**  

**Game loop structure:**
```cpp
// Pseudo-code or actual code snippet
while (game_running) {
    // Input handling?
    // Update logic?
    // Rendering?
    // Where would SDK Tick() go?
}
```

**Where should `ludeo_Tick()` be called?**  
File:  
Function:  
Line (approximate):  

---

### 2.2 Initialization and Shutdown

**Game initialization function(s):**  
**Where does initialization happen?** (file:line)  

**What gets initialized?** (in order)
1. 
2. 
3. 

**→ For SDK Initialize location, see Section 3.2**

**Game shutdown function(s):**  
**Where does cleanup happen?** (file:line)  

**→ For SDK Shutdown location, see Section 3.2**  

---

### 2.3 State Machine

**Does the game use a state machine?** [ ] Yes [ ] No

**If yes, where is it implemented?**  

**What states exist?** (Document ALL states)

| State Name | Description | Entry Function | Exit Function |
|------------|-------------|----------------|---------------|
| MainMenu | Main menu screen | | |
| Loading | Level/Match loading | | |
| Playing | Active gameplay | | |
| Paused | Game paused | | |
| GameOver | End screen | | |
| | | | |

**State transition diagram:**
```
[Draw ASCII state diagram if possible]
MainMenu → Loading → Playing → GameOver → MainMenu
                       ↓
                     Paused
```

---

### 2.4 Multiplayer Architecture (if applicable)

**Is this a multiplayer game?** [ ] Yes [ ] No

**If yes:**

**Network architecture:** [ ] Client-Server [ ] Peer-to-Peer [ ] Dedicated Servers [ ] Other:

**Which machine is authoritative for game state?**  
[ ] Server [ ] Client [ ] Hybrid (specify):

**Which side should perform SDK tracking?**  
[ ] Server only [ ] Client only [ ] Both [ ] Per-player

**Which side should perform restoration?**  
[ ] Server [ ] All clients [ ] Other:

---

## 🎬 **SECTION 3: Game Flow and Session Management**

### 3.1 Scene/Level Management

**What system manages scenes/levels?**  
[ ] Engine level/world manager (describe):  
[ ] Streaming / chunk loader (describe):  
[ ] Custom system (describe):

**Scene/Level loading function(s):**  
**File/Class:**  

**How are levels identified?**  
[ ] String ID [ ] Enum [ ] Index [ ] File path [ ] Other:

**Example level identifier:**  

---

### 3.2 Game Code Integration Points

> **⚠️ IMPORTANT:** Only document locations for operations marked 🎮. Operations marked 📞 are callback-driven and should NOT be placed in game code.

Answer with specific **file:function:line** references for 🎮 items only:

---

#### 🎮 SDK Initialize
**SDK Function:** `ludeo_Initialize()`  
**When:** Early in game startup, before window/graphics init  
**Location (file:function:line):**  

---

#### 🎮 Ludeo Session Activation
**SDK Function:** `ludeo_Session_Activate()`  
**When:** During game initialization, after window created  
**Location (file:function:line):**  

---

#### 🎮 Room Open (Level Loading Starts)
**SDK Function:** `ludeo_Session_OpenRoom()`  
**When:** When level/scene **starts** loading (not when ready)  
**Location (file:function:line):**  

---

#### 📞 Player Add - CALLBACK-DRIVEN (Do NOT find location)
**SDK Function:** `ludeo_Room_AddPlayer()`  
**Called from:** `OnRoomOpenedCallback` (not game code)  
**Location:** N/A - implemented in LudeoManager callback handler  

---

#### 📞 Gameplay Begin - CALLBACK-DRIVEN (Do NOT find location)
**SDK Function:** `ludeo_GameplaySession_Begin()`  
**Called from:** `TryBeginGameplaySession()` helper, triggered when both `OnPlayerAddedCallback` AND `OnRoomReadyCallback` have fired  
**Location:** N/A - implemented in LudeoManager callback handler  

---

#### 🎮 Gameplay End (⚠️ CRITICAL - Multiple Locations)
**SDK Function:** `ludeo_GameplaySession_End()`  
**When:** When gameplay ends - **ALL exit paths must be hooked**  

**List ALL functions that end gameplay:**

| Exit Path | Function (file:function:line) |
|-----------|------------------------------|
| Level complete / win | |
| Level failed / loss | |
| Player quits to menu | |
| Player quits to desktop | |
| Level restart | |
| Network disconnect | |
| Error/crash recovery | |

---

#### 📞 Player Remove - CALLBACK-DRIVEN (Do NOT find location)
**SDK Function:** `ludeo_Room_RemovePlayer()`  
**Called from:** `OnGameplayEndedCallback` (not game code)  
**Location:** N/A - implemented in LudeoManager callback handler  

---

#### 📞 Room Close - CALLBACK-DRIVEN (Do NOT find location)
**SDK Function:** `ludeo_Room_Close()`  
**Called from:** `OnPlayerRemovedCallback` (not game code)  
**Location:** N/A - implemented in LudeoManager callback handler  

---

#### 🎮 SDK Shutdown
**SDK Function:** `ludeo_Shutdown()`  
**When:** Game exit, during shutdown sequence  
**Location (file:function:line):**  

---

### 3.3 External Launch Parameters

**Can the game accept launch parameters?** [ ] Yes [ ] No

**If yes, how?**  
[ ] Command line arguments  
[ ] Deep links (URL scheme)  
[ ] Config file  
[ ] Other:

**Where are launch parameters parsed?**  
File:  
Function:  

**Can we add a parameter for LudeoSelected?** [ ] Yes [ ] No

---

### 3.4 LudeoSelected Interrupt Handling

> **Remember:** LudeoSelected can happen AT ANY TIME - menu, gameplay, loading, cutscene, etc.

**Current game state when LudeoSelected might fire:**

| State | How to Interrupt | How to Clean Up |
|-------|------------------|-----------------|
| MainMenu | | Minimal cleanup |
| Loading | Cancel loading? | |
| Playing | End gameplay session | |
| Paused | Close pause menu | |
| Cutscene | Skip/abort cutscene | |
| | | |

**Can the game interrupt current activity from ANY state?** [ ] Yes [ ] No [ ] Needs implementation

**If needs implementation, what's required?**  

---

### 3.5 Wait for Player Flow

**After restoration, can the game pause and wait?** [ ] Yes [ ] No

**Where is game simulation paused/unpaused?**  
Pause function:  
Unpause function:  

**Does the game have a "press to start" or "ready" screen?** [ ] Yes [ ] No

**If yes, where is it implemented?**  

**Where would we hook `OnRoomReadyCallback`?** (It serves dual duty: gameplay-session-start for tracking, and the **post-Ludeo-load resume** — the overlay's Play button arrives as `RoomReady` → `Begin`. There is no `PlayerReady`; `ResumeGameRequest` is the mid-play overlay-closed resume only.)  

---

## ✅ **Architecture Research Checklist**

Before moving to implementation:

### Game Loop & Lifecycle
- [ ] Game loop location identified
- [ ] State machine documented (if exists)

### 🎮 Game Code Integration Points (must have file:function:line)
- [ ] `ludeo_Initialize()` point identified
- [ ] `ludeo_Session_Activate()` point identified
- [ ] `ludeo_Tick()` placement identified (every frame)
- [ ] `ludeo_Session_OpenRoom()` point identified (level loading starts)
- [ ] `ludeo_GameplaySession_End()` - **ALL exit paths identified** (⚠️ critical)
- [ ] `ludeo_Shutdown()` point identified

### 📞 Callback-Driven Operations (confirm NOT in game code)
- [ ] Confirmed: `AddPlayer` will be in `OnRoomOpenedCallback` only
- [ ] Confirmed: `BeginGameplaySession` will be in callback helper only
- [ ] Confirmed: `RemovePlayer` will be in `OnGameplayEndedCallback` only
- [ ] Confirmed: `CloseRoom` will be in `OnPlayerRemovedCallback` only

### Interrupt Handling
- [ ] LudeoSelected interrupt handling planned
- [ ] Wait-for-player flow planned

---

## 🔗 **Related Documentation**

- [../05-LIFECYCLE-MANAGEMENT.md](../05-LIFECYCLE-MANAGEMENT.md) - SDK lifecycle implementation details
- [../03-SDK-FUNDAMENTALS.md](../03-SDK-FUNDAMENTALS.md) - Core SDK concepts
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing architecture research, proceed to lifecycle implementation using [../05-LIFECYCLE-MANAGEMENT.md](../05-LIFECYCLE-MANAGEMENT.md)

