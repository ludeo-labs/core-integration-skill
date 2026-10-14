---
name: ludeo-integration
description: Integrate the Ludeo SDK into a game built on a proprietary C++ engine (CMake, Visual Studio, or Makefile). Sets up the build with conditional compilation, wires the SDK lifecycle, maps and tracks game objects, restores state for playable Ludeos, and maps and implements game actions. Use when the user asks to integrate, install, add, set up, or wire up Ludeo into a C++ game. Do NOT use for Unity (use ludeo-unity-integration) or Unreal (use ludeo-unreal-integration).
metadata:
  version: 1.2.0
---

# Ludeo SDK Integration

**Skill version:** 1.2.0 · Compare against the [latest release](https://github.com/ludeo-labs/core-integration-skill/releases/latest) to confirm your installed copy is current. If older, run `npx skills update ludeo-integration` (then start a fresh agent session — `SKILL.md` is cached per session).

This skill walks the agent through integrating the Ludeo SDK into a game project, from build configuration to action mapping and runtime verification.

> **Scope: proprietary C++ engines.** This is the skill for a game with its own engine and a
> CMake / Visual Studio / Makefile build, using the SDK's C API directly. **Unity and Unreal have
> their own skills** — `ludeo-unity-integration` and `ludeo-unreal-integration` — which install a
> real engine plugin and speak that engine's idioms. Do not hand-roll a plugin here.

## When to use

Activate this skill when the user says any of:

- "Integrate Ludeo into my game"
- "Set up the Ludeo SDK"
- "Add Ludeo action tracking"
- "Build my game with the Ludeo SDK"
- "Wire up Ludeo lifecycle"

**First, confirm the engine.** If the project has `Assets/` + `ProjectSettings/` (Unity) or a
`*.uproject` + `Source/` (Unreal), stop and point the user at that engine's skill.

## Workflow

The integration runs as seven sequential phases, numbered the same way as the Unity and Unreal skills
so that a phase number means the same thing in every engine. **Phases 3, 5 and 6 are orchestrated**: each is one
logical phase made of single-task briefs, entered through its orchestrator file, which hands out one task at a time,
passes state by file and runs every gate itself ([`references/orchestration.md`](references/orchestration.md)).
**Phase 5 runs as a wave loop**: phase 4's census assigns every tracked type to a wave; wave 1 proves the full
capture → replay round trip on the restorable spine, and each later wave widens the tracked set, each ending in its
own restore gate.

The order is **1** build with the SDK → **2** map the code → **3** SDK lifecycle → **4** map objects
→ **5** tracking & restore → **6** actions → **7** verify & upload. Phases 1–5 build the **capture**
side and then turn a capture into a playable Ludeo; **actions come last** of the integration work,
once the player flow is proven, because an action that fires into a flow you cannot yet replay cannot
be verified. Phase 7 then gets the build onto the Ludeo platform.

Where to start is decided by the state file, not assumed — see **Start here**. Complete one phase at a time and confirm with the user before advancing. Report each phase's start and
finish from this top level, per **Reporting progress** in
[`references/ludeo-studio-mcp.md`](references/ludeo-studio-mcp.md), and tell any subagent you dispatch not
to call `ludeo-mcp` tools.

| Phase | File | Purpose |
| --- | --- | --- |
| 1 | `references/1-build-game-with-sdk.md` | State file, MCP servers, Ludeo environments, build environment, conditional compilation, baseline + SDK builds, then the kickoff intake (`references/know-your-game.md`) |
| 2 | `references/2-map-game-code.md` | Produce CODE_MAP of game architecture |
| 3 | `references/3-lifecycle-orchestrator.md` | **Phase 3 entry point** — runs tasks 1–6 and their gates |
| 3 · task 1 | `references/3a-find-sdk-integration-points.md` | Identify where SDK calls go |
| 3 · task 2 | `references/3b-create-tdd.md` | Produce Technical Design Document (architecture, strategy, risks) |
| 3 · task 3 | `references/3c-plan-sdk-lifecycle.md` | Plan lifecycle wiring |
| 3 · task 4 | `references/3d-implement-sdk-lifecycle.md` | Implement lifecycle wiring |
| 3 · task 5 | `references/3e-compile-and-fix.md` | Compile, fix, verify |
| 3 · task 6 | `references/3f-classify-save-system.md` | Classify save system (group + per-entity reconciliation/manual matrix); required by phase 4 and phase 5 · task 1 |
| 4 | `references/4-map-game-objects.md` | **Part A** (here): census of every trackable type, load-bearing flags, wave plan → approved. **Part B**: the per-wave deep scope, run by phase 5 · task 0 |
| 5 | `references/5-tracking-restore-orchestrator.md` | **Phase 5 entry point** — the wave loop: tasks 0–4 per wave (task 3 once, in wave 1), each with its gate; confirm before widening |
| 5 · task 0 | `references/5a-deep-scope-wave.md` | **Per wave:** run phase 4 Part B for this wave's types → append their entity blocks |
| 5 · task 1 | `references/5b-implement-object-tracking.md` | **Per wave (additive):** wire object registration & capture for this wave's types |
| 5 · task 2 | `references/5c-plan-state-restoration.md` | **Per wave (append):** plan the two-pass restoration (inverse of tracking) → `RESTORATION_PLAN.md` |
| 5 · task 3 | `references/5d-implement-restoration-flow.md` | **Once, in wave 1:** implement the player-flow/lifecycle half (inverse of `phase 3 · task 4`): `LudeoSelected` handler that validates via `GetLudeo` before disturbing anything, then builds the moment before Play (CR-010): reach active gameplay → apply held → settle → `OpenRoom(ludeoId)`; `RoomReady` (the Play click) → `Begin` → unfreeze; overlay pause/resume (CR-011). Calls the read-back as a **stub**. |
| 5 · task 4 | `references/5e-implement-state-reconstruction.md` | **Per wave (additive):** fill the data half (inverse of `phase 5 · task 1`): real `RestoreTwoPass`/`RestoreEnvironment`, reader-side scope, two-pass `DataReader` reads, references, deferred queue, environment. |
| 6 | `references/6-actions-orchestrator.md` | **Phase 6 entry point** — map → approve → implement → run both flows → Global Triggers and goals. Starts once phase 5's wave 1 is green |
| 6 · task 1 | `references/6a-map-game-actions.md` | Find action points in game code |
| 6 · task 2 | `references/6b-implement-game-actions.md` | Insert action calls |
| 7 | `references/7-upload-build.md` | Verify the Release build (release guard, shipped `ludeo.ini`, self-contained launch), upload it with the `ludeo` CLI, poll to `success`, then assign it to the target environment — **upload and assign only on explicit user confirmation** |

## Important rules

- **One phase at a time.** Get user confirmation before advancing to the next phase.
- **Keep the state file current.** When a step's work begins, set `current` to its id and the step `in_progress` in
  `ludeo-integration-plan/integration.json`; set it `completed` only once its exit gate passes (`skipped` if the user
  explicitly skips it — record why). Before a session ends mid-step, note where in the step you stopped (`note`); record user decisions and code findings as they happen,
  and read the intake fields a step depends on before it starts (`references/state-file-schema.md`). Preserve fields
  you don't recognise — never rewrite the file from the template.
- 🛑 **Never upload or assign a build without explicit user confirmation.** Phase 7 publishes to Ludeo's
  cloud and changes what an environment serves — outward-facing and not trivially reversible. Present the
  fully-resolved command after a clean `--dry-run` and stop; a clean dry-run is not approval, and approving
  the upload is not approving the assignment.
- **Studio Lab writes follow `references/ludeo-studio-mcp.md` — reads free, writes confirmed.** Beta version
  names and invites need an explicit go-ahead; goals, constraints and Global Triggers are created without one
  but **never on Production**, and reported line by line. Gate every step on the exact tool being in your tool
  list, and fall back to asking the user when it isn't.
- **Every code-writing task ends with a rebuild + run gate (hard requirement).** Phase 3 · task 4,
  phase 5 · tasks 1, 3 and 4, and phase 6 · task 2 edit source, so each ends with (1) a clean rebuild
  (with `LUDEO_SDK_ENABLED` on, and off if a no-SDK build ships) and (2) a run of the game to confirm it
  still works. **The agent runs the build itself** — CMake / MSBuild / make work headless — and reads the
  log; "the agent can't see the game" means it can't *play* it, not that it can't build it. Only the run
  needs the integrator — whoever the intake recorded in `runnability.runsTheGame` — and beyond the run log the agent
  relies on their word. If the build can't run
  here (toolchain missing, IDE-only or license-gated build), say so and ask. Do not advance until the
  build passes and the integrator confirms the run (or explicitly skips). The build-and-fix loop lives in
  `phase 3 · task 5`; the gate cites it rather than repeating it.
- **Paths inside workflow files are relative to the workflow file itself.** A workflow at `references/N-*.md` says `ludeo-integration-docs/<file>.md` to reach the docs folder, which sits next to the workflow file inside `references/`.
- **Critical requirements** live in `references/ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`. Review them before phase 1.
- **Track objects as attributes by default, not blobs.** The SDK supports both attribute and blob state storage/reconstruction; Ludeo strongly prefers attribute integrations. When mapping and tracking objects (phase 4 and phase 5 · task 1), capture discrete typed attributes by default and do **not** ask the user which to use. Use blob/serialized storage only when the user explicitly asks or an entity is genuinely opaque/unmappable — see `references/ludeo-integration-docs/06-TRACKING-PATTERNS.md §1.4`.
- **The agent writes outputs into the game's repo**, not into this skill. For example, `ludeo-integration-plan/CODE_MAP.json` is created at the game project root.
- **Fresh session recommended.** Each phase produces a lot of context. If a phase has been running long, suggest the user start a fresh agent session for the next phase.

## Reference material

- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking, API reference, research templates, game-pattern playbooks).
- `references/state-file-schema.md` — `ludeo-integration-plan/integration.json`: where the integration is, what
  was decided, the intake answers, the Ludeo platform record. Read it at the start of every session.
- `references/know-your-game.md` — the kickoff intake (phase 1 Step 11): design, UX and launch decisions that can't
  be read from code, each feeding a check in a later step.
- `references/ludeo-studio-mcp.md` — the `ludeo-mcp` touchpoints (environments, beta version name, invites,
  goals and constraints, Global Triggers, progress reporting) and the read/write policy.

## MCP configuration

The skill ships its MCP server definitions in `config/mcp_config.template.json`; `phase 1` Step 0c wires them
up. **They run on the integrator's machine.** Copy the entries into the agent's MCP config (Claude Code:
`.mcp.json` at the project root, or `claude mcp add`), fill in `X-User-Name` for `sdk-docs`, and start a fresh
session so they connect.

| Server | Hosted endpoint | Purpose | Fallback |
| --- | --- | --- | --- |
| `sdk-docs` | `https://ludeo-mcps-sdk-docs.ludeo.com/mcp` (HTTP, `X-User-Name` header) | **Search the Ludeo SDK documentation** — API reference, signatures, parameter structs, callback chains. Prefer it over guessing at any phase. | Bundled `references/ludeo-integration-docs/` and the SDK headers |
| `ludeo-mcp` | `https://mcp.ludeo.com/mcp` (HTTP, OAuth sign-in) | **Studio Lab platform work** the agent otherwise hands to the user — phase 1 (environments, membership, invites), phase 3 · task 4 (the Beta Version Name that routes local runs), phases 5–6 (goals, Global Triggers), phase 7 (`envId`, trigger check), and progress reporting throughout | Ask the user to do the step in Studio Lab |

If a server is not detected, set it up from the template before relying on its fallback, and tell the user
which fallback you're using.

## Start here

At the start of **every** session, look for `ludeo-integration-plan/integration.json` in the game's repo
([`references/state-file-schema.md`](references/state-file-schema.md)). It lives on the integration branch, so if the
current branch doesn't have it, check for an existing integration branch first (`git branch --list
'feature/ludeosdk-integration-*'`) and ask the user whether to resume that one before starting anything new.

- **It exists** → read it. Resume at `current`: a step `in_progress` continues where it stopped (re-read that
  phase file, its inputs and the step's `note` first); a `completed` or `skipped` step advances to the next one in the
  table above. In phase 5, resume at `wave.reopened` if set, else `wave.current`, at that wave's first unfinished task
  (`5a`–`5e`). **If any `wave.plan` entry is neither `green` nor `deferred`, phase 5 isn't done** — after phase 6 (which
  may start once wave 1 is green), return to phase 5's next wave before phase 7. Read the
  `risks` aimed at the step you're about to run. Tell the user in one line where you're resuming and why.
- **It doesn't exist, but plan files do** (`ludeo-integration-plan/CODE_MAP.json`, `OBJECT_TRACKING.md`,
  `RESTORATION_PLAN.md`, `GAME_ACTIONS_MAP.md`, `LUDEO_PLATFORM.md`, …) — an integration started before the state
  file existed. Create the state file, infer each step's status from its evidence (the table in
  `references/state-file-schema.md` → **Migrating**), fold `LUDEO_PLATFORM.md` into `ludeoPlatform` with the value
  mapping given there (then delete it), show the user the inferred status and confirm it
  before resuming. Run the intake (`references/know-your-game.md`) if `intake` is empty — its answers gate later
  steps.
- **Neither** → a new integration: read `references/1-build-game-with-sdk.md` and follow it.

Never re-run a `completed` step unless the user asks; if they do, set it back to `in_progress` first.
