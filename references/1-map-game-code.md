# Map Game Code - Codebase Structure Analysis

Analyze the game codebase and build a comprehensive structural map for SDK integration planning.

## 🚦 Fresh Context Check

This is a sequential workflow — running phase 1 right after phase 0 in the **same session is normal**; do **not** stop just because earlier phases ran here. Only stop if **phase 1 itself** was already completed in this conversation (a `CODE_MAP.json` already exists) and you're about to regenerate it — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## 📚 Context Files

**Action Required:** You must read the following files to understand the requirements and research patterns before starting the analysis. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - SDK constraints (threading, tick requirements) that inform what patterns to find
- `ludeo-integration-docs/02-RESEARCH-TEMPLATE.md` - Research guidance and what to document
- `ludeo-integration-docs/research-context/02A-RESEARCH-ARCHITECTURE.md` - Architecture patterns to find

These files help identify the specific lifecycle patterns needed for SDK integration.

## Analysis Checklist

Execute these searches systematically before writing the CODE_MAP. Skip sections that return no results. All patterns are engine-agnostic — adapt based on what the project structure reveals.

> **Triage for large codebases.** Big projects can return hundreds of hits for a single pattern (e.g. `Serialize`, `class .*Manager`). Do **not** record them all. Map the **relevant subset**: entry point(s), the central game/loop class, the state machine, the save/state system, and the entity types that will be captured/restored. Anchor on those, follow references outward, and stop when the structural picture is complete — the CODE_MAP is a planning map, not an exhaustive inventory.

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

> **🛑 Classification gate.** If your classification (next bullet) lands on **single-streaming-world**, **state-machine-driven**, **event-dispatch-driven**, or any hybrid that lacks per-level scenes — **stop and read `ludeo-integration-docs/game-patterns/open-world.md` before continuing this section.** That file is the doctrine for what to record in `session_boundaries` and what phase 3 will consume. The detailed trigger + required sub-structure is the last bullet of this section; this notice exists so you don't miss it by skimming.

- **First, identify how the game actually models a session** — don't assume match/level. Use `ludeo-integration-docs/research-context/02A-RESEARCH-ARCHITECTURE.md` §2.3 (State Machine) and §3.1 (Scene/Level Management) to classify: scene/level-driven, state-machine-driven, event-dispatch-driven, single-streaming-world, or hybrid. Trust that classification over the keyword greps below — for state-machine games (no `StartMatch`-style keywords), the session boundary lives in state transitions, not in named functions.
- **State-machine probe** (run if `02A` §2.3 says yes, or if the keyword greps below come up empty): `Grep("enum .*State\|ChangeState\|CurrentState\|GameState\|StateMachine\|TransitionTo")` in source files. Walk the resulting state graph to find the states that bracket gameplay — those are the session boundaries.
- **Keyword probe** (works for match/level-centric games; misses state-machine ones):
  - Start: `Grep("StartMatch\|StartGame\|LoadLevel\|LoadScene\|LoadMap\|BeginMatch\|NewGame")` in source files
  - End: `Grep("EndMatch\|EndGame\|GameOver\|MatchEnd\|LevelComplete\|ReturnToMenu\|QuitMatch")` in source files
- **If the project has no per-level scenes** (single streaming world, state-machine-driven, sandbox, MMO, open-world RPG, etc.) — read `ludeo-integration-docs/game-patterns/open-world.md` before producing the CODE_MAP, and emit `session_boundaries` with the sub-structure below. This is the artifact phase 4 will consume; without it, the lifecycle agent has no canonical "where does the Gameplay Session begin / end" answer and falls back to asking the integrator.

### 6. Event Systems
- `Grep("delegate\|event\|Signal\|Observer\|Listener\|Callback\|Broadcast\|Dispatch\|Subscribe\|Notify")` in headers
- Identify pattern: delegates, observer, message bus, or signal/slot

### 7. Save / Serialization — and the existing state-capture system (your tracking/restoration backbone)
- `Grep("Save\|Load\|Serialize\|Deserialize\|Archive\|Persist\|Checkpoint")` in source files, excluding test/log files. Also check for third-party serializers (e.g. FullSerializer/`fsObject`, Odin, MessagePack, Protobuf).
- Classify: custom binary, JSON, XML, third-party, engine-provided, or none.
- **Most important:** if the game already has a **per-object state capture/restore system** (a serialize/restore interface + a registry/manager + an object-type list), treat it as the **backbone for object tracking and restoration**, not just a format to classify. It usually maps almost 1:1 to Ludeo state objects, objectType buckets, and the stable-key attribute — record its interface, manager, and type enum prominently in the CODE_MAP.

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
   - `session_boundaries` - Match/level start and end points (distinct from lifecycle_hooks). **When the project has no per-level scenes** (open-world / streaming / sandbox / state-machine-driven), use this sub-structure (see `ludeo-integration-docs/game-patterns/open-world.md`):
     - `model` — one-line classification (e.g. `"state-machine + event-dispatch; single streaming world"`)
     - `start_sites[]` — each `{ trigger, file, line, meaning }` for events that begin a live run (new game / load save / etc.)
     - `exit_sites[]` — each `{ trigger | state, file, line, ludeo: "End" | "Abort" | "End/Abort" }` for events that end a run (death, return-to-menu, quit, load-different-save-while-in-game)
     - `pause_overlay[]` — the game's pause primitive(s) to wire to `PauseGameRequest` / `ResumeGameRequest` ([CR-011](ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md))
   - `event_systems` - Delegate/event/observer patterns found, with pattern type
   - `save_system` - Format classification (custom binary, JSON, XML, third-party, engine-provided, none) **and** the existing per-object state-capture system (interface, registry/manager, object-type list, stable id) flagged as the tracking/restoration backbone
   - `ai` - Whether AI/bots exist, spawn mechanism, controllability
   - `threading` - Threading model and thread safety notes
   - `build_system` - Build files and dependencies

**Include file paths, function names, and line numbers for all findings.**

## Next Step

After creating `ludeo-integration-plan/CODE_MAP.json`, run `phase 2` to map the structure to Ludeo SDK functions.
