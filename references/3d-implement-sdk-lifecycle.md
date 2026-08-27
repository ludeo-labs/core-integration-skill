# Phase 3 · Task 4 — Implement SDK Lifecycle

Execute the SDK lifecycle implementation plan: create all Ludeo files and modify game hook points. Does NOT compile - that's `phase 3 · task 5`.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 3 · task 4 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 3 · task 4** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## 📚 Context Files

**Action Required:** You must read the following files for critical rules and lifecycle flow. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules (async callbacks, tick)
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle and callback flow

## Prerequisites

- `phase 1` completed (build system configured)
- `phase 3 · task 2` completed (TDD exists at `ludeo-integration-plan/TDD_<GameName>.md`)
- `phase 3 · task 3` completed (plan exists at `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md`)

## Your Task

### 1. Load Implementation Plan

Read `ludeo-integration-plan/TDD_<GameName>.md` first — it contains the architecture decisions, risk assessment, and integration key concepts that inform this implementation.

Find `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md` and extract:
- New files to create (paths + full content)
- Existing files to modify (locations + code snippets)
- Implementation order

If not found, check game root for `SDK_LIFECYCLE_PLAN*.md` or ask user.

### 1.1 Choose Authentication Mode & Gather Configuration

**IMPORTANT: Before creating any files, ask the user THREE questions in this order:**

**Question 1: Choose Authentication Mode (ASK THIS FIRST)**

> **"Which Steam authentication mode should I use?"**
> 
> - **Explicit** - You provide Steam credentials for Ludeo to authenticate via Steam
> - **Implicit** (default) - Ludeo initializes Steam and uses the running Steam client
> 
> _(Both modes will be implemented in the code. Your choice sets the default configuration.)_

**Based on the user's answer:**
- If **Explicit** chosen: Configure `LudeoAuthMode::Explicit` as default, then ask Questions 2 & 3
- If **Implicit** chosen or skipped: Configure `LudeoAuthMode::Implicit` as default, then ask Question 2 only

**Question 2: API Key (ALWAYS ASK)**

> **"What Ludeo API key should I configure?"**
> 
> _(If you don't have one yet, I'll use `YOUR_API_KEY_HERE` as a placeholder.)_

**Question 3: Explicit Auth Credentials (ONLY IF Explicit mode chosen in Question 1)**

> **"What Steam user ID should I use for explicit authentication?"**
> 
> _(If you don't have one yet, I'll use `STEAM_USER_ID_HERE` as a placeholder.)_

> **"What Steam branch name should I configure?"**
> 
> _(If you don't have one yet, I'll use `STEAM_BRANCH_HERE` as a placeholder.)_

---

**Configuration Flow Summary:**

1. **Authentication Mode** (Question 1) → Determines which `LudeoAuthMode` is configured as default
2. **API Key** (Question 2) → Always needed, used in both modes
3. **Steam Credentials** (Question 3) → Only if Explicit mode chosen

**Implementation Notes:**
- **Write the collected values into `ludeo.ini` (next to the game executable), NOT into the `LudeoConfig.h` constructor.** The header holds only placeholder fallbacks; the runtime values come from the file. This is so QA / ops / end users can change `apiKey`, `betaBranch`, etc. without rebuilding. See `04-BUILD-INTEGRATION.md §4` for the canonical layout and the key=value parser.
- If the user skips a question, leave the value blank in `ludeo.ini` (or omit the line); the header's placeholder defaults take over.
- **BOTH** auth modes will be implemented in code (if/else structure). User's choice in Question 1 just sets the default `authMode` value in the shipped `ludeo.ini`.
- Wire `LudeoConfig::Instance().LoadFromFile("ludeo.ini")` once at startup, before `Session_Activate` (typically the first line of `LudeoManager::Initialize`). All later reads go through the `GetXxx()` getters — no literal values in the SDK call path.
- The build must copy `ludeo.ini` to the output directory (same as SDK DLLs — see `phase 1` Step 7). Without the file, the game falls back to placeholders and Activate rejects the unset API key.

**Example implementation** (both modes supported — *every* field flows through `LudeoConfig`, no literals in the activation path):
```cpp
// In ActivateSession() - supports both modes
if (config.GetAuthMode() == LudeoAuthMode::Explicit) {
    steamAuthDetails.authId          = config.GetExplicitAuthID().c_str();
    steamAuthDetails.currentBetaName = config.GetBetaBranch().empty()
                                         ? nullptr
                                         : config.GetBetaBranch().c_str();
    steamAuthDetails.authType = LudeoAuthType::Steam;
    params.authDetails = &steamAuthDetails;
} else {
    // Implicit mode - Ludeo handles Steam initialization
    params.authDetails = nullptr;
}
params.apiKey      = config.GetApiKey().c_str();       // ← same config-driven treatment as betaBranch
params.gameVersion = config.GetGameVersion().c_str();
```

**Reference:** See `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` Section 5 (lines 178-256) for detailed authentication documentation.

### 2. Create New Files (in order from plan)

**Backup any existing files first!**

> **Note:** `LudeoConfig.h` may already exist as a stub from `phase 1`.
> **Overwrite it** with the full version from the plan.

| File | Purpose |
|------|---------|
| `LudeoConfig.h` | **OVERWRITE** stub with full version - conditional compilation, fallback types, logging macros, `LudeoConfig` class (placeholder defaults; values come from `ludeo.ini`) |
| `LudeoConfig.cpp` | `LudeoConfig::LoadFromFile` — key=value parser (see `04 §4`) |
| `LudeoManager.h` | Singleton class declaration, lifecycle methods, callback handlers |
| `LudeoManager.cpp` | Full implementation: singleton, Initialize (calls `LudeoConfig::LoadFromFile("ludeo.ini")` FIRST), ActivateSession, Tick, Shutdown, OpenRoom, EndGameplaySession, all callbacks |
| `ludeo.ini` | Shipped alongside the executable. Contains the runtime values from Step 1.1. Build must copy it to output (same as DLLs) |

Use the paths specified in the plan (typically `src/core/ludeo/` or similar). Copy code **exactly** from plan.

### 3. Modify Existing Files (from plan)

**Create `.bak` backups before modifying!**

Follow the plan's hook points. Example modifications (actual files vary by game):

| Hook Type | Example Location | Ludeo Call |
|-----------|------------------|------------|
| Init | Game startup | `LudeoManager::Get().Initialize()` |
| Tick | Main loop | `LudeoManager::Get().Tick()` |
| Session start | Level load | `LudeoManager::Get().OpenRoom(levelId)` |
| Session end | Level end/disconnect | `LudeoManager::Get().EndGameplaySession(isAbort)` |
| Shutdown | Game exit | `LudeoManager::Get().Shutdown()` |

**CRITICAL:** Wrap ALL Ludeo code in `#if LUDEO_SDK_ENABLED ... #endif`

### 3.5. Required: Session Notification Registration (enforce, even if the plan is silent)

After session creation and **before** session activation, the LudeoManager **must** register these notifications. They are session-lifetime — register once, not per-Ludeo. **If the plan from `phase 3 · task 3` doesn't include them, add them anyway** — this is a hard requirement, not a plan-driven detail.

| Notification | Required? | If missing, the symptom is… |
|---|---|---|
| `ludeo_Session_AddNotifyLudeoSelected` | ✅ | Player picks a Ludeo and nothing happens — no restoration entry. |
| `ludeo_Session_AddNotifyRoomReady` | ✅ | `GameplaySession_Begin` never fires; tracking never starts; post-Ludeo-load playback never resumes (CR-010). |
| `ludeo_Session_AddNotifyPauseGameRequest` | ✅ | **Game keeps running while the Ludeo overlay covers it — the #1 mid-play failure (CR-011).** |
| `ludeo_Session_AddNotifyResumeGameRequest` | ✅ | Overlay closes mid-play but the game stays paused (or never paused — see above). |
| `ludeo_Session_AddNotifyBackToMenuRequest` | ✅ | Player chooses "back to menu" from the overlay and the game stays in the Ludeo. |
| `ludeo_Session_AddNotifyMuteRequest` | optional | Platform mute requests ignored. |

**Reference for the registration code + handler responsibilities:** `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` "Registering Notifications" (under §4). Copy the registration block verbatim and wire the handlers per the responsibility list there.

### 4. Verification (Pre-Compile)

- [ ] `LudeoConfig.h` stub overwritten with full version
- [ ] `LudeoManager.h` and `LudeoManager.cpp` created
- [ ] All hook points modified per plan
- [ ] All modifications have `#if LUDEO_SDK_ENABLED` guards
- [ ] `.bak` backups exist for all modified files
- [ ] **All five required session notifications registered** (LudeoSelected, RoomReady, PauseGameRequest, ResumeGameRequest, BackToMenuRequest) — §3.5
- [ ] **`OnPauseGameRequestCallback` actually freezes the simulation tick** (not just input) — CR-011

## Output

Report on completion:
1. List of files created (with paths)
2. List of files modified (with backup paths)
3. Ready for `phase 3 · task 5`

## Rollback (if needed)

```bash
# Restore backups
mv file.bak file

# Remove new ludeo directory (path from plan)
rm -rf src/core/ludeo/   # or wherever the plan specified
```

## Next Step — rebuild + run gate (REQUIRED — do not advance without it)

This phase edited source files but **deliberately did not compile** — `phase 3 · task 5` is its exit gate, and it
is **mandatory**, not optional. The integration is **not done** until it builds and runs, and the agent
cannot see a running game, so this falls to the integrator:

1. Run `phase 3 · task 5` — **rebuild and confirm a clean build with `LUDEO_SDK_ENABLED=1`** (and, if used, `=0`);
   fix build errors with phase 3 · task 5's loop and read the build log.
2. **Run the game** — confirm the lifecycle opens a gameplay session (the first end-to-end proof), with
   no SDK errors or crashes in the log.

The agent reads build/run logs where they exist but **cannot truly verify** a clean build or a live run
on its own — beyond the logs it relies on the integrator's word. **Do not advance until the user
confirms both** (or explicitly skips).
