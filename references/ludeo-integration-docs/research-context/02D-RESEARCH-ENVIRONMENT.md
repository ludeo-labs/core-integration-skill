# 02D-RESEARCH-ENVIRONMENT.md - Environment & Context Research

> **Purpose:** Document environment state, non-ludeoable areas, and pause handling  
> **For:** Restoration Agent - implementing state restoration and context management  
> **Prerequisites:** Architecture research complete (02A)

**Last Updated:** December 2025

---

## 📋 **Instructions**

Complete this questionnaire to identify:
- Level/environment metadata to track
- Areas where tracking should be disabled
- Pause and resume handling

**Output:** Create `GAME_ANALYSIS_ENVIRONMENT.md` with your findings.

---

## 🌍 **SECTION 7: Environment and Metadata**

### 7.1 Level/Scene Data

**How are levels represented?**  
[ ] Scene files  
[ ] Level class  
[ ] Config files  
[ ] Procedurally generated  
[ ] Other:

**What data defines a level?**

| Data | Type | Example | How Retrieved |
|------|------|---------|---------------|
| Level ID | string | "level_01" | LevelManager::GetCurrentID() |
| Level Name | string | "Forest Level" | LevelManager::GetCurrentName() |
| Difficulty | int | 2 (0-4) | GameManager::GetDifficulty() |
| Game Mode | enum | Survival | GameManager::GetMode() |
| Seed (if procedural) | uint64 | 12345 | WorldGen::GetSeed() |
| | | | |

**Are levels loaded dynamically or pre-loaded?**  

**What metadata is needed to restore the correct level?**
1. 
2. 
3. 

---

### 7.2 Camera System

**Camera type:**  
[ ] First-person  
[ ] Third-person  
[ ] Top-down  
[ ] Side-scrolling  
[ ] Multiple cameras  
[ ] Other:

**Camera properties to track:**

| Property | Type | Getter Function | Track? |
|----------|------|-----------------|--------|
| position | Vec3 | Camera::GetPosition() | Yes |
| rotation | Quat | Camera::GetRotation() | Yes |
| fov | float | Camera::GetFOV() | Maybe |
| target | Vec3 | Camera::GetTarget() | Maybe |
| mode | enum | Camera::GetMode() | If multiple modes |
| | | | |

**Where is camera state updated?**  

---

### 7.3 World State

**What defines world/environment state?**

| State Component | Type | Track? | Getter Function |
|----------------|------|--------|-----------------|
| Game time / elapsed | float | Yes | GameTime::GetElapsed() |
| Is paused | bool | No (don't restore as paused) | GameManager::IsPaused() |
| Weather type | enum | Maybe | WeatherSystem::GetWeather() |
| Time of day | float | Maybe | DayNightCycle::GetTime() |
| Music state | enum | Maybe | AudioManager::GetMusicState() |
| Random seed | uint64 | If determinism needed | Random::GetSeed() |
| | | | |

**Environmental objects that change state:**

| Object Type | States | How to Track |
|-------------|--------|--------------|
| Doors | open/closed | Track as object attribute |
| Destructibles | intact/destroyed | Track existence or attribute |
| Switches | on/off | Track as object attribute |
| | | |

---

### 7.4 Audio/Music (Optional)

**Does audio/music state affect gameplay experience?** [ ] Yes [ ] No

**If yes:**

| Audio Element | Why Important | How to Track |
|---------------|---------------|--------------|
| Music track | Sets mood | AudioManager::GetCurrentTrack() |
| Combat intensity | Dynamic music | AudioManager::GetIntensity() |
| | | |

---

## ⏸️ **SECTION 8: Non-Ludeoable Areas & Pause Handling**

### 8.1 Non-Ludeoable Areas

**Which in-gameplay segments should never become a Ludeo?** These are **backend-controlled**, not a local capture gate: tracking keeps running through them, and you mark their boundaries with the standard `StartNoneLudeable`/`StopNoneLudeable` actions, connected to a Non-Ludeoable Area Global Trigger (`06 §7.3`, `phase 6`). Do **not** build an `IsLudeoableArea()` check or stop tracking — record the boundary hooks so `phase 6` can emit the actions.

| Area | Enter hook (file:function) — emits `StartNoneLudeable` | Exit hook(s) (file:function) — emit `StopNoneLudeable` on every path |
|------|----------------------------|----------------------------|
| Death / respawn screen, killcam | | |
| Game over / "you failed" screen | | |
| Scoreboard, intermission, results screen | | |
| Map vote, start countdown | | |
| Pause menu (also `PauseLudeo`, nested) | | |
| Console, loading over a live level, cutscene, replay viewer, spectate | | |
| Shop / stall | | |
| NPC dialogue | | |
| In-game menu | | |
| Tutorial | | |
| Safe zone / hub | | |

> The rule (`06 §7.3`): every span where live gameplay is paused, suspended or disabled while a UI screen is open is non-ludeoable. Main menu, lobby, and loading **between** sessions are not — they sit outside any gameplay session, so nothing tracks them and no action is needed. A loading screen over a live level and a cutscene **are** non-ludeoable; when they freeze the sim they also take the local capture-hygiene pause (§8.2) and `PauseLudeo`, with the non-ludeoable span nested inside.

---

### 8.2 Cutscenes

**Does the game have cutscenes?** [ ] Yes [ ] No

**If yes:**

**How are cutscenes triggered?**  
Function/Event:  

**Cutscene start function:**  
**Cutscene end function:**  

**Should cutscenes pause Ludeo tracking?** [ ] Yes [ ] No

**Should cutscenes be skipped during restoration?** [ ] Yes [ ] No

**How to skip cutscenes programmatically:**  

---

### 8.3 Pause and Resume Tracking

**What events cause gameplay to pause?**  
[ ] Pause menu  
[ ] Phone call / loss of focus  
[ ] Alt-Tab / minimize  
[ ] Dialogue / conversation  
[ ] Inventory screen  
[ ] Map screen  
[ ] Orders/build queue  
[ ] Other:

> Note: dialogue, inventory, map, and shop screens are usually **non-ludeoable areas** (§8.1), handled by `StartNoneLudeable`/`StopNoneLudeable` — not tracking pauses. Only flag something here if it freezes the simulation (true pause) or is a cutscene; those pause local tracking **and** emit `PauseLudeo`/`ResumeLudeo` (06 §7.3) — the action is what stops the objective timer — **and** open a nested `StartNoneLudeable` span, since a UI screen is up.

**How to detect when game is truly paused vs just UI overlay?**  
Check:  

**Should Ludeo tracking pause when game pauses?** [ ] Yes [ ] No

**Pause tracking hook:**  
Function:  
File:  

**Resume tracking hook:**  
Function:  
File:  

---

### 8.4 Tracking State Decision Tree

```
Is the game truly paused (sim frozen) or in a cutscene?
├─ Yes → Pause tracking (local capture hygiene; resume after) AND emit PauseLudeo / ResumeLudeo
│         AND StartNoneLudeable / StopNoneLudeable nested inside (06 §7.3)
│
└─ No → Is any UI screen suspending play (death, scoreboard, results, countdown, menu, …),
        or is this a shop / NPC dialogue / tutorial / safe zone?
    ├─ Yes → KEEP TRACKING. Do not stop tracking or end the session.
    │         Emit StartNoneLudeable / StopNoneLudeable; the backend excludes the window (06 §7.3).
    │
    └─ No → Track normally
```

---

### 8.5 Restoration Context

**When restoring a Ludeo, what environment setup is needed?**

1. Load correct level: `LevelManager::Load(level_id)`
2. Set difficulty: `GameManager::SetDifficulty(difficulty)`
3. Set game mode: `GameManager::SetMode(mode)`
4. Set time of day: (if applicable)
5. Set weather: (if applicable)
6. Skip intro/cutscene: (if applicable)
7. Other:

**Order matters?** [ ] Yes [ ] No

**If yes, correct order:**
1. 
2. 
3. 

---

## ✅ **Environment Research Checklist**

Before moving to implementation:

- [ ] Level metadata documented
- [ ] Camera properties identified
- [ ] World state components listed
- [ ] Non-ludeoable areas identified with enter/exit boundary hooks (for actions, not a local gate)
- [ ] Pause primitive and its callers recorded (incl. the SDK overlay pause) for `PauseLudeo`/`ResumeLudeo`; Global Triggers noted as a follow-up
- [ ] Cutscene handling planned
- [ ] Pause/resume hooks identified
- [ ] Restoration context requirements documented

---

## 🔗 **Related Documentation**

- [../07-RESTORATION-PATTERNS.md](../07-RESTORATION-PATTERNS.md) - Restoration implementation
- [../06-TRACKING-PATTERNS.md](../06-TRACKING-PATTERNS.md) - Pause tracking (Section 8)
- [../00-CRITICAL-REQUIREMENTS.md](../00-CRITICAL-REQUIREMENTS.md) - Mandatory rules

---

**Next:** After completing environment research, proceed to restoration implementation using [../07-RESTORATION-PATTERNS.md](../07-RESTORATION-PATTERNS.md)

