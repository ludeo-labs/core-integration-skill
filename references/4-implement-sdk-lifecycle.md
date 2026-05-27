# Implement SDK Lifecycle - Create Files and Modify Hooks

Execute the SDK lifecycle implementation plan: create all Ludeo files and modify game hook points. Does NOT compile - that's `phase 5`.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 4 there."
- If this is a fresh conversation, proceed.

## 📚 Context Files

**Action Required:** You must read the following files for critical rules and lifecycle flow. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules (async callbacks, tick)
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle and callback flow

## Prerequisites

- `phase 0` completed (build system configured)
- `phase 2b` completed (TDD exists at `ludeo-integration-plan/TDD_<GameName>.md`)
- `phase 3` completed (plan exists at `ludeo-integration-plan/SDK_LIFECYCLE_PLAN_<GameName>.md`)

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
- Store all values to inject into `LudeoConfig.h` or config file
- Use placeholders with `// TODO` comments if user skips
- **BOTH** auth modes will be implemented in code (if/else structure)
- User's choice in Question 1 sets which mode is the **default**
- **Always set placeholder values for BOTH modes in LudeoConfig**, even if the user chose Implicit. If Implicit chosen: `authId = "STEAM_USER_ID_HERE"`, `betaBranch = "STEAM_BRANCH_HERE"` (with `// TODO` comments). The Explicit code path must never have empty strings — always placeholders or real values.

**Example implementation** (both modes supported):
```cpp
// In ActivateSession() - supports both modes
if (config.GetAuthMode() == LudeoAuthMode::Explicit) {
    steamAuthDetails.authId = config.GetAuthID().c_str();
    steamAuthDetails.currentBetaName = config.GetBetaBranch().c_str();
    steamAuthDetails.authType = LudeoAuthType::Steam;
    params.authDetails = &steamAuthDetails;
} else {
    // Implicit mode - Ludeo handles Steam initialization
    params.authDetails = nullptr;
}
params.apiKey = "provided-key-here";
```

**Reference:** See `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` Section 5 (lines 178-256) for detailed authentication documentation.

### 2. Create New Files (in order from plan)

**Backup any existing files first!**

> **Note:** `LudeoConfig.h` may already exist as a stub from `phase 0`.
> **Overwrite it** with the full version from the plan.

| File | Purpose |
|------|---------|
| `LudeoConfig.h` | **OVERWRITE** stub with full version - conditional compilation, fallback types, logging macros |
| `LudeoManager.h` | Singleton class declaration, lifecycle methods, callback handlers |
| `LudeoManager.cpp` | Full implementation: singleton, Initialize, ActivateSession, Tick, Shutdown, OpenRoom, EndGameplaySession, all callbacks |

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

### 4. Verification (Pre-Compile)

- [ ] `LudeoConfig.h` stub overwritten with full version
- [ ] `LudeoManager.h` and `LudeoManager.cpp` created
- [ ] All hook points modified per plan
- [ ] All modifications have `#if LUDEO_SDK_ENABLED` guards
- [ ] `.bak` backups exist for all modified files

## Output

Report on completion:
1. List of files created (with paths)
2. List of files modified (with backup paths)
3. Ready for `phase 5`

## Rollback (if needed)

```bash
# Restore backups
mv file.bak file

# Remove new ludeo directory (path from plan)
rm -rf src/core/ludeo/   # or wherever the plan specified
```

## Next Step

Run `phase 5` to build and fix any compilation errors.
