# Map Game Code - Codebase Structure Analysis

Analyze the game codebase and build a comprehensive structural map for SDK integration planning.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 1 there."
- If this is a fresh conversation, proceed.

## 📚 Context Files

**Action Required:** You must read the following files to understand the requirements and research patterns before starting the analysis. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - SDK constraints (threading, tick requirements) that inform what patterns to find
- `ludeo-integration-docs/02-RESEARCH-TEMPLATE.md` - Research guidance and what to document
- `ludeo-integration-docs/research-context/02A-RESEARCH-ARCHITECTURE.md` - Architecture patterns to find

These files help identify the specific lifecycle patterns needed for SDK integration.

## Analysis Checklist

Execute these searches systematically before writing the CODE_MAP. Skip sections that return no results. All patterns are engine-agnostic — adapt based on what the project structure reveals.

### 1. Project Structure
- List top-level directories and identify source directories
- Count files by extension to understand language mix
- Detect build system:
  - `Glob("**/CMakeLists.txt")`, `Glob("**/*.sln")`, `Glob("**/*.vcxproj")`
  - `Glob("**/*.csproj")`, `Glob("**/*.uproject")`, `Glob("**/Makefile")`
  - `Glob("**/*.Build.cs")`, `Glob("**/premake5.lua")`

### 2. Entry Points
- `Grep("int main\|int wmain\|WinMain\|wWinMain")` in .cpp/.c files
- `Grep("class.*Application\|class.*Program\|class.*Launcher")` in headers

### 3. Core Game Classes
- `Grep("class .*Game\|class .*Manager\|class .*World\|class .*Level\|class .*Scene\|class .*Match\|class .*Session")` in headers
- `Grep("static.*Get\|::Instance\|GetInstance")` — look for singletons and global access patterns

### 4. Lifecycle Hooks
- Init: `Grep("Initialize\|Init(\|Setup\|StartUp\|OnStart")` in source files
- Loop: `Grep("Update\|Tick\|GameLoop\|MainLoop\|RunFrame\|ProcessFrame")` in source files
- Shutdown: `Grep("Shutdown\|Cleanup\|Terminate\|OnQuit\|OnExit")` in source files

### 5. Session / Match Boundaries
- Start: `Grep("StartMatch\|StartGame\|LoadLevel\|LoadScene\|LoadMap\|BeginMatch\|NewGame")` in source files
- End: `Grep("EndMatch\|EndGame\|GameOver\|MatchEnd\|LevelComplete\|ReturnToMenu\|QuitMatch")` in source files

### 6. Event Systems
- `Grep("delegate\|event\|Signal\|Observer\|Listener\|Callback\|Broadcast\|Dispatch\|Subscribe\|Notify")` in headers
- Identify pattern: delegates, observer, message bus, or signal/slot

### 7. Save / Serialization
- `Grep("Save\|Load\|Serialize\|Deserialize\|Archive\|Persist\|Checkpoint")` in source files, excluding test/log files
- Classify: custom binary, JSON, XML, engine-provided, or none

### 8. AI / Bots
- `Grep("class.*AI\|class.*Bot\|class.*NPC\|PathFind\|NavMesh\|Spawn.*Bot\|Spawn.*NPC\|Spawn.*Enemy")` in source files
- Note: whether bots exist, how they spawn, and whether they can be controlled externally

## Your Task

Build a **structural map** of the game codebase for SDK integration planning.

Use the **Analysis Checklist** above to systematically search the codebase. Follow the research guidance in `02-RESEARCH-TEMPLATE.md` and `02A-RESEARCH-ARCHITECTURE.md` for additional context on what to document.

## Output

1. **Create folder:** `ludeo-integration-plan/` in the game's root directory
2. **Save:** `ludeo-integration-plan/CODE_MAP.json` containing:
   - `codebase_summary` - Language, engine, key directories
   - `entry_points` - Main functions with file, line, and call chain
   - `core_classes` - Key classes with files, methods, inheritance
   - `lifecycle_hooks` - Integration points for initialization, main_loop, shutdown
   - `session_boundaries` - Match/level start and end points (distinct from lifecycle_hooks)
   - `event_systems` - Delegate/event/observer patterns found, with pattern type
   - `save_system` - Save system classification (custom binary, JSON, engine-provided, none) and key classes
   - `ai` - Whether AI/bots exist, spawn mechanism, controllability
   - `threading` - Threading model and thread safety notes
   - `build_system` - Build files and dependencies

**Include file paths, function names, and line numbers for all findings.**

## Next Step

After creating `ludeo-integration-plan/CODE_MAP.json`, run `phase 2` to map the structure to Ludeo SDK functions.
