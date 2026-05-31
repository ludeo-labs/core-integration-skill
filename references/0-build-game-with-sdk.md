# Build Game with SDK - Build Environment Setup

Set up the Ludeo SDK build environment, create directory structure, configure build system, and verify the game compiles **without the SDK first**, then **with the SDK enabled**.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 0 there."
- If this is a fresh conversation, proceed.

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
- Section 5-9: Build System Integration (CMake/VS/Makefile/Unity/Unreal)
- Section 10: Verification

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

### Step 0b: Select Operating System
Follow **Section 2.0** of `04-BUILD-INTEGRATION.md`:
- Prompt user to choose target OS: Windows, Linux, or macOS
- Store selected OS for all subsequent steps
- **CRITICAL:** Build only for the selected OS, not multiple platforms

### Step 1: Detect Build System
Follow **Section 2.1** of `04-BUILD-INTEGRATION.md`:
- Check for CMakeLists.txt, .sln, Makefile, Unity, or Unreal Engine
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
- Create `src/core/ludeo/` (or `Source/Core/Ludeo/` for Unreal)
- Verify SDK in `external/ludeo/LudeoCoreSDK_X_X_X/` (or update build config if elsewhere)

### Step 6: Generate Stub LudeoConfig.h
Follow **Section 4** of `04-BUILD-INTEGRATION.md`:

> **Note:** This creates a **stub** LudeoConfig.h for build verification only.
> The full version (with LudeoManager integration) will be created by `phase 4`.

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
- **Unity:** Section 8 - Create plugin structure and configure DLL **for selected OS only**
- **Unreal:** Section 9 - Create plugin and configure Build.cs **for selected OS only**

**IMPORTANT:** 
- Create backups of original build files before modifying!
- Configure **only** for the OS selected in Step 0b
- **Copy the third-party runtime DLLs too, not just the Ludeo SDK DLL.** The SDK ships its runtime deps in `<SDK>/ThirdParty/<platform>/<config>/Bin/` (cohtml, libx264, MediaDecoders, HttpServer, RenoirCore, openAL32, v8 family). `copy_directory` the whole folder to the game's output dir alongside the SDK DLL — cherry-picking is the root cause of the "agent shipped a build that crashes on launch with missing cohtml/libx264" failure mode. See `04 §5` for the CMake snippet.

### Step 8: Build Game WITHOUT SDK First (Baseline Verification)
Follow **Section 10.1** of `04-BUILD-INTEGRATION.md`:
- **CRITICAL:** Build with `LUDEO_SDK_ENABLED=OFF` (or equivalent) **BEFORE** building with SDK enabled
- Verify compilation succeeds - this establishes the baseline
- Verify game runs correctly without SDK
- This ensures any build failures later are SDK-related, not pre-existing issues
- If build fails, fix issues before proceeding to SDK-enabled build

### Step 9: Build Game WITH SDK Enabled
Follow **Section 10.1** of `04-BUILD-INTEGRATION.md`:
- Build with `LUDEO_SDK_ENABLED=ON` (or equivalent)
- Verify compilation succeeds
- Verify SDK DLL/SO **and the entire `ThirdParty/<platform>/<config>/Bin/` directory** copied to output (cherry-picking causes missing-DLL crashes on launch — see Step 7)
- Compare with baseline build - should behave identically at runtime
- If build fails, follow **Section 10.3** (Error Handling)

### Step 10: Runtime Verification
Follow **Section 10.2** of `04-BUILD-INTEGRATION.md`:
- **First:** Launch game WITHOUT SDK - verify baseline behavior
- **Then:** Launch game WITH SDK enabled - verify no crashes, no DLL errors
- Verify DLL/SO loads (use `dumpbin /DEPENDENTS` or `ldd`)
- Compare behavior - SDK-enabled build should run identically to baseline
- Check for ludeo symbols (`dumpbin /EXPORTS` or `nm`) in SDK-enabled build only

## Success Criteria

- [ ] Integration branch created (`feature/ludeosdk-integration-#N`)
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

## Error Handling

If any step fails:
1. Capture error details (message, logs, file paths)
2. Check **Section 10.3** for common issues and solutions
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
