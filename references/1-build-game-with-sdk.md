# Phase 1 — Build Game with SDK

Set up the Ludeo SDK build environment, create directory structure, configure build system, and verify the game compiles **without the SDK first**, then **with the SDK enabled**.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 1 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 1** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## 📦 Ludeo SDK Location

> **REQUIRED:** This command needs the Ludeo SDK distribution.
>
> If not specified, the agent will:
> 1. **Clone the latest release** from `https://github.com/EdgeGamingGG/ludeo-sdk-releases`
> 2. If the clone fails (no network, no access, git error), **ask you** to clone it manually and provide the path
>
> You can specify upfront: "SDK is at `C:\SDKs\LudeoCoreSDK_1_2_3`"

## 📚 Context Files

**Action Required:** You must read the following file to understand the build requirements. Do not assume it is in context. The doc lives inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/04-BUILD-INTEGRATION.md` - Complete build setup guide

## Your Task

Follow the comprehensive guide in `ludeo-integration-docs/04-BUILD-INTEGRATION.md` to:
0. **Prompt user to select target operating system** (Windows/Linux/macOS)
1. Detect build system and project structure
2. Locate or prompt for Ludeo SDK files (for selected OS only) - **check parent folder of game root first**
3. Create required directory structure
4. Generate stub for `LudeoConfig.h` with game-adapted logging macros
5. Modify build files to integrate SDK (for selected OS only)
6. **Build game WITHOUT SDK first** (verify baseline build works)
7. **Build game WITH SDK enabled** (verify SDK integration works)
8. Verify both builds succeed (for selected OS only)

**⚠️ IMPORTANT:** Build for **Current operating system only**. Do not attempt to build for multiple platforms.

**⚠️ IMPORTANT:** Focus on **Debug / Development** build configurations first. Release builds come later — do not attempt Release until Debug/Development is working end-to-end.

## Reference Documentation

**Primary Guide:** `ludeo-integration-docs/04-BUILD-INTEGRATION.md`

**Key Sections:**
- Section 2.0: Operating System Selection (⭐ FIRST STEP)
- Section 2: Agent Automation Guide (detection strategies)
- Section 3: Directory Structure
- Section 4: Configuration Header (LudeoConfig.h)
- Section 5-7: Build System Integration (CMake/VS/Makefile)
- Section 8: Verification

**Critical Requirements:** `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`
- CR-001: Macro-based conditional compilation is MANDATORY

## Workflow

### Step 0a: Create Integration Branch ⭐ **VERY FIRST STEP**
Before making any changes to the game project, create a dedicated branch:
```bash
git checkout -b feature/ludeosdk-integration-#1
```
- If a branch with that name already exists, increment the number (`#2`, `#3`, etc.)
- This lets the user easily discard the integration attempt by deleting the branch
- **All subsequent steps happen on this branch**
- **Create the state file** `ludeo-integration-plan/integration.json` ([`state-file-schema.md`](state-file-schema.md))
  with `schemaVersion`, `gameTitle`, every step `not_started`, and step `1` `in_progress`. If it already exists, this
  is a resumed integration — read it instead (`SKILL.md` → **Start here**).

### Step 0b: Select Operating System
Follow **Section 2.0** of `04-BUILD-INTEGRATION.md`:
- Prompt user to choose target OS: Windows, Linux, or macOS
- Store selected OS for all subsequent steps
- **CRITICAL:** Build only for the selected OS, not multiple platforms

### Step 0c: Connect the MCP servers
`sdk-docs` (SDK documentation search) and **`ludeo-mcp`** (Studio Lab automation) are used from Step 0d
onward, and a newly added server only connects in a fresh session — so wire up anything missing **before**
the steps below. Copy the entries from `<skill-base-dir>/config/mcp_config.template.json` into the project's
`.mcp.json` (or `claude mcp add`); `sdk-docs` needs `X-User-Name` set to the user's Ludeo username.
- `ludeo-mcp` signs in with OAuth — the user logs in with their Studio Lab account when the client prompts;
  no token goes in the file. Match the `ludeo-mcp` prefix, or look for `list_game_environments` in your tool
  list; a server listed without that tool isn't signed in yet — ask the user to sign in (Claude Code: `/mcp` →
  Authenticate) before any fallback. Only `ludeo-mcp-staging` connected doesn't count — see
  [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md) → Setup.
- **If you added a server, stop and ask the user to restart the session**; phase 1 re-runs from here.
- Both servers are optional. If one can't be connected, say which fallback you're on and carry on.

### Step 0d: Ludeo environments, and who is in them
Policy and touchpoints: [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md) — **reads free, writes confirmed**.
Record everything below in the state file's `ludeoPlatform` block ([`state-file-schema.md`](state-file-schema.md));
if it is already filled, read it and update it. Once (a) records the Game ID, start **Reporting progress** there (`sdk_set_up` · `started`).
- **(a) Environments.** Ask the user for the Studio Lab **Game ID** (Studio Lab → **Game Options → Info**;
  the game **version** uuid, not the backend `gameId`) — phase 7 needs it either way. If
  `list_game_environments` is in your tool list, list the environments with it; otherwise ask which exist and
  what Beta Version Name each carries. Record the Game ID and **all** environments. A game normally has several
  and an integration may target more than one, so which one a write is for is asked at the point of writing,
  not here.
- **(b) The integrator's membership — always a question.** No tool reports it. For each recorded environment,
  ask: *"Has your Steam account been added to <environment>? Ludeo creation silently fails without it —
  highlights record but can't convert to Ludeos."* If they don't know, or the answer is no, point them at
  Studio Lab → Environments → Users management. Record the answer, never off the back of a tool call, and ask
  again whenever the target environment changes.
- **(c) Anyone else.** Ask: *"anyone else on your team who needs to capture — teammates, QA?"* — and in which
  environment. If `invite_users_to_environment` is in your tool list, invite them (a **write** — show
  `environment · every invitee's email` and wait for a go-ahead); otherwise ask the user to invite them in
  Studio Lab. Default: just them.

### Step 1: Detect Build System
Follow **Section 2.1** of `04-BUILD-INTEGRATION.md`:
- Check for CMakeLists.txt, .sln, or Makefile
- If you find `*.uproject`/`Source/*.Build.cs` (Unreal) or `Assets/`+`ProjectSettings/` (Unity),
  stop and switch to that engine's skill — this one is for proprietary C++ engines
- Report detected build system and primary build file

### Step 2: Obtain the SDK
Follow **Section 2.2** of `04-BUILD-INTEGRATION.md`:
- **Clone the latest release** of the SDK from `https://github.com/EdgeGamingGG/ludeo-sdk-releases`:
  ```bash
  git clone https://github.com/EdgeGamingGG/ludeo-sdk-releases.git
  ```
  - If the repo uses tagged releases, check out the latest release tag after cloning
  - **On failure** (no network, no access, git error): stop and **ask the user** to clone the repo manually and provide the local SDK path
- Extract version from directory name
- Verify SDK structure **for selected OS only** (Include/, Lib/, Bin/)
- Verify DLL/SO files are real binaries (> 1MB), not Git LFS pointer files (~130 bytes) — if pointer-sized, the SDK was checked out without its LFS binaries; run `git lfs pull` (or ask the user to re-provide a complete SDK)
- **Use the latest release, and record which one.** An SDK build that is too old for the current Ludeo backend fails silently — a notification such as `RoomReady` just never fires, often with an `unknown event_name` warning in the log (`11-TROUBLESHOOTING.md §9`). If the user supplies an SDK, ask where it came from and how old it is. At the first SDK-enabled run (Step 10), note the SDK's version line from the log (`LudeoSDK v…`, git hash, build date) in the integration notes.

### Step 3: Detect Target Name and Source Structure
Follow **Sections 2.3 and 2.5** of `04-BUILD-INTEGRATION.md`:
- Parse build file for target name (CMake: `add_executable()`, VS: project name, Makefile: `TARGET`)
- Detect source directory (`src/`, `Source/`, etc.)
- Determine where to create `src/core/ludeo/` (or equivalent)

### Step 4: Detect Logging System
Follow **Section 2.4** of `04-BUILD-INTEGRATION.md`:
- Search source files for logging patterns (`LogInfo`, `UE_LOG`, `printf`, etc.)
- Identify logging system type
- Generate adapted logging macros for `LudeoConfig.h`

### Step 5: Create Directory Structure
Follow **Section 3** of `04-BUILD-INTEGRATION.md`:
- Create `src/core/ludeo/` (or wherever the engine keeps core subsystems)
- Verify SDK in `external/ludeo/LudeoCoreSDK_X_X_X/` (or update build config if elsewhere)

### Step 6: Generate Stub LudeoConfig.h
Follow **Section 4** of `04-BUILD-INTEGRATION.md`:

> **Note:** This creates a **stub** LudeoConfig.h for build verification only.
> The full version (with LudeoManager integration) will be created by `phase 3 · task 4`.

- Create `src/core/ludeo/LudeoConfig.h` (or game-appropriate path) with:
  - Conditional compilation macros (`LUDEO_SDK_ENABLED`, `LUDEO_CODE`, `LUDEO_INCLUDE`)
  - Type definitions (fallback types when SDK disabled)
  - Logging macros adapted to detected logging system
  - **NO actual SDK calls** - just the scaffolding to verify build system works

### Step 7: Modify Build Files
Follow the appropriate section based on build system:
- **CMake:** Section 5 - Add SDK option, configure target **for selected OS only**, link libraries, copy DLL/SO
- **Visual Studio:** Section 6 - Create property sheet or modify project settings **for selected OS only**
- **Makefile:** Section 7 - Add SDK variables and build rules **for selected OS only**

If the build system turns out to be Unity or Unreal, stop — those engines have their own skills
(`ludeo-unity-integration`, `ludeo-unreal-integration`) which install a real engine plugin. Do not
hand-roll one here.

**IMPORTANT:** 
- Create backups of original build files before modifying!
- Configure **only** for the OS selected in Step 0b
- **Copy the third-party runtime DLLs too, not just the Ludeo SDK DLL.** The SDK ships its runtime deps in `<SDK>/ThirdParty/<platform>/<config>/Bin/` (cohtml, libx264, MediaDecoders, HttpServer, RenoirCore, openAL32, v8 family). `copy_directory` the whole folder to the game's output dir alongside the SDK DLL — cherry-picking is the root cause of the "agent shipped a build that crashes on launch with missing cohtml/libx264" failure mode. See `04 §5` for the CMake snippet.

### Step 8: Build Game WITHOUT SDK First (Baseline Verification)
Follow **Section 8.1** of `04-BUILD-INTEGRATION.md`:
- **CRITICAL:** Build with `LUDEO_SDK_ENABLED=OFF` (or equivalent) **BEFORE** building with SDK enabled
- Verify compilation succeeds - this establishes the baseline
- Verify game runs correctly without SDK
- This ensures any build failures later are SDK-related, not pre-existing issues
- If build fails, fix issues before proceeding to SDK-enabled build

### Step 9: Build Game WITH SDK Enabled
Follow **Section 8.1** of `04-BUILD-INTEGRATION.md`:
- Build with `LUDEO_SDK_ENABLED=ON` (or equivalent)
- Verify compilation succeeds
- Verify SDK DLL/SO **and the entire `ThirdParty/<platform>/<config>/Bin/` directory** copied to output (cherry-picking causes missing-DLL crashes on launch — see Step 7)
- Compare with baseline build - should behave identically at runtime
- If build fails, follow **Section 8.3** (Error Handling)

### Step 10: Runtime Verification
Follow **Section 8.2** of `04-BUILD-INTEGRATION.md`:
- **First:** Launch game WITHOUT SDK - verify baseline behavior
- **Then:** Launch game WITH SDK enabled - verify no crashes, no DLL errors
- Verify DLL/SO loads (use `dumpbin /DEPENDENTS` or `ldd`)
- Compare behavior - SDK-enabled build should run identically to baseline
- Check for ludeo symbols (`dumpbin /EXPORTS` or `nm`) in SDK-enabled build only
- Record the SDK in the state file's `sdk` block — source, version, path, and the **version line** the SDK logs at
  startup (`LudeoSDK v…`)

### Step 11: Know your game — the kickoff intake
Run [`know-your-game.md`](know-your-game.md) with the user (20–30 minutes): the game and Ludeo profile, visible
player state, game-wide phase state, the playback UX bar, capture timing, scripted systems, the launch model,
runnability, and the game-level save system. Record every answer in `integration.json` → `intake`; record unknowns
in `risks` with the step that must resolve them. Later steps read these answers as pre-flight checks.

Then mark step `1` `completed` in the state file once the build gates above passed and the intake is recorded.

## Success Criteria

- [ ] Integration branch created (`feature/ludeosdk-integration-#N`)
- [ ] MCP servers connected (`sdk-docs`, `ludeo-mcp`) — or the fallback in use named to the user
- [ ] `ludeo-integration-plan/integration.json` exists; its `ludeoPlatform` block records the Game ID, every environment, and the integrator's membership in each
- [ ] Build system detected correctly
- [ ] SDK cloned from public releases repo and verified (or user-provided on clone failure)
- [ ] Directory structure created
- [ ] **Stub** `LudeoConfig.h` generated with correct logging macros
- [ ] Build files modified (backups created)
- [ ] **Game compiles WITHOUT SDK** (`LUDEO_SDK_ENABLED=0`) ✅ **BASELINE VERIFIED**
- [ ] **Game compiles WITH SDK** (`LUDEO_SDK_ENABLED=1`) ✅
- [ ] SDK DLL/SO copied to output directory
- [ ] Game launches successfully WITHOUT SDK (baseline)
- [ ] Game launches successfully WITH SDK (identical behavior)
- [ ] No SDK errors in logs
- [ ] Conditional compilation working correctly
- [ ] SDK source, version and version line recorded in `integration.json` → `sdk`
- [ ] Intake recorded in `integration.json` → `intake`, unknowns listed in `risks`

## Error Handling

If any step fails:
1. Capture error details (message, logs, file paths)
2. Check **Section 8.3** for common issues and solutions
3. Rollback if needed (restore backup files)
4. Report to user what failed and what's needed

## Important Notes

- **Always create the integration branch first** - All work happens on `feature/ludeosdk-integration-#N`
- **Build for ONE OS only** - Prompt user to select OS first (Step 0b)
- **Debug/Development first** - Target Debug/Development build configs only; defer Release builds until Debug/Development is verified working
- **SDK Source:** Clone the latest release from `https://github.com/EdgeGamingGG/ludeo-sdk-releases`; on failure, ask the user to clone it and provide the path
- **Build Order is Critical:** Always build WITHOUT SDK first to establish baseline, then build WITH SDK
- **Always create backups** before modifying build files
- **Verify each step** before proceeding
- **Ask for user confirmation** before major changes
- **Follow Modern CMake practices** (target-specific properties)
- **Conditional compilation is MANDATORY** (CR-001)

## Related Documentation

- **Primary Guide:** `ludeo-integration-docs/04-BUILD-INTEGRATION.md`
- **Critical Requirements:** `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`
- **Next Steps:** `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` (after build setup complete)
