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

This skill has an **institutional memory** in `learnings/` — sanitized lessons from prior integrations. **Load the
relevant learnings at the start of every phase, and capture new ones the moment you discover them** — see
**Learnings** below; it is not optional.

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

The integration runs as eight sequential phases, numbered the same way as the Unity and Unreal skills
so that a phase number means the same thing in every engine. **Phases 3, 5 and 6 are orchestrated**: each is one
logical phase made of single-task briefs, entered through its orchestrator file, which hands out one task at a time,
passes state by file and runs every gate itself ([`references/orchestration.md`](references/orchestration.md)).
**Phase 5 runs as a wave loop**: phase 4's census assigns every tracked type to a wave; wave 1 proves the full
capture → replay round trip on the restorable spine, and each later wave widens the tracked set, each ending in its
own restore gate.

The order is **1** build with the SDK → **2** map the code → **3** SDK lifecycle → **4** map objects
→ **5** tracking & restore → **6** actions → **7** verify & upload → **8** polish & expansion. Phases 1–5 build the **capture**
side and then turn a capture into a playable Ludeo; **actions come last** of the integration work,
once the player flow is proven, because an action that fires into a flow you cannot yet replay cannot
be verified. Phase 7 then gets the build onto the Ludeo platform, and phase 8 checks what Ludeo could still
capture, widens coverage as new waves through phases 4–6 if the user wants it, polishes, re-uploads and finalizes.

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
| 8 | `references/8-polish.md` | Gap check → recommend → (opt-in) append new waves and re-enter phase 5 as data-only waves (task 3 skipped), new actions through phase 6 → cosmetic/timing polish and earlier bugs → re-upload through phase 7 → record completion in the TDD |

## Important rules

- **One phase at a time.** Get user confirmation before advancing to the next phase.
- **Keep the state file current.** When a step's work begins, set `current` to its id and the step `in_progress` in
  `ludeo-integration-plan/integration.json`; set it `completed` only once its exit gate passes (`skipped` if the user
  explicitly skips it — record why). Before a session ends mid-step, note where in the step you stopped (`note`); record user decisions and code findings as they happen,
  and read the intake fields a step depends on before it starts (`references/state-file-schema.md`). Preserve fields
  you don't recognise — never rewrite the file from the template.
- **Version control goes through the VCS contract** (`references/vcs/README.md`): git, SVN or Perforce, detected in
  phase 1 and recorded in `integration.json → vcs.type`. Load `references/vcs/<type>.md` before any file write; call
  its operations by name — never hardcode `git`. **Under Perforce, open a file before writing it** (`ensure_editable`:
  the Perforce MCP `edit` / `add` tool, or `p4 edit` / `p4 add`) — a p4 workspace is read-only, so every write fails
  otherwise, the plan files and the state file included. After each phase's gate, `checkpoint` per
  `vcs.commitPolicy`, staging only the files that phase touched.
- **Never run a destructive VCS command speculatively** — confirm state with two independent checks first
  (`guard_destructive` in the loaded `references/vcs/<type>.md`): `git reset --hard` / `git clean` / `git checkout --`,
  `svn revert -R` / `svn cleanup --remove-unversioned`, `p4 revert` / `p4 sync -f`.
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
  still works. **The agent runs both itself** — CMake / MSBuild / make work headless, and the run goes through
  the **agent test harness** ([`references/agent-test-harness.md`](references/agent-test-harness.md)): the
  game's own launch arguments, console and bots first, a small test-only harness module where those don't
  reach, OS-level input only for the overlay. The agent reads the log and the run's `result.json` and **opens
  the screenshots**; it never declares a run passed by inspection of code. Do not advance until the build passes
  and the run passes. The build-and-fix loop lives in `phase 3 · task 5`; the gate cites it rather than
  repeating it.
- **Don't ask the integrator to play.** A gate that seems to need someone at the keyboard is a harness gap —
  build the lever. The integrator plays only when they chose to (`intake.runnability.runsTheGame:
  "integrator"`), or for one named check the harness provably can't make (say what you tried). What stays with
  them: turning a captured moment into a Ludeo (send the moment, get the id back — batch several), the wave
  sign-off from the evidence bundle, approvals, and upload / assign. If the game can't run on this machine at all
  (license-gated, hardware), say so in phase 1.
- **Paths inside workflow files are relative to the workflow file itself.** A workflow at `references/<N>-*.md` says `ludeo-integration-docs/<file>.md` to reach the docs folder, which sits next to the workflow file inside `references/`.
- **Critical requirements** live in `references/ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`. Review them before phase 1.
- **Track objects as attributes by default, not blobs.** The SDK supports both attribute and blob state storage/reconstruction; Ludeo strongly prefers attribute integrations. When mapping and tracking objects (phase 4 and phase 5 · task 1), capture discrete typed attributes by default and do **not** ask the user which to use. Use blob/serialized storage only when the user explicitly asks or an entity is genuinely opaque/unmappable — see `references/ludeo-integration-docs/06-TRACKING-PATTERNS.md §1.4`.
- **The agent writes outputs into the game's repo**, not into this skill — the one exception is a new learning (**Learnings** below). For example, `ludeo-integration-plan/CODE_MAP.json` is created at the game project root.
- **Fresh session recommended.** Each phase produces a lot of context. If a phase has been running long, suggest the user start a fresh agent session for the next phase.

## Learnings

`learnings/` is the skill's institutional memory: sanitized lessons from prior integrations — on this engine family and
on Unity and Unreal, rewritten for the C API wherever the mechanism transfers. Categories: `architecture/`,
`common-mistakes/`, `engine-quirks/` (engine, toolchain, OS, SDK and cloud behavior the docs don't predict) and
`save-systems/`. Each file is one lesson with frontmatter (`category`, `tier`, `sourceGame`, `phase`, `question`,
`sanitized`).

### Load — at the start of every phase

The corpus grows with every integration; reading every file each phase burns the context the phase's real work needs.
Load it **index-first**:

1. **Read `learnings/INDEX.md` in full.** One line per learning: `path | tier | phase | hook`. The hook is the
   learning's precondition question (or its title when it has none). An index line is a **pointer, not the lesson** —
   never cite or apply a learning from its index line alone.
2. **Read the full body of every entry whose `phase` matches the current phase**, regardless of tier. Phase tags are
   conservative, so this is the floor, not the whole job.
3. **Scan every other hook against what you know about this project** (boots straight to gameplay or through menus?
   pooled objects? no save system? streamed world? which build system?) and read the body of anything plausibly
   relevant. **Err toward reading** — a body read is cheap; wrongly skipping a learning is how integrations break.
4. **Re-query the index mid-phase.** When you hit a new topic (restore ordering, pooled spawns, action emission,
   overlay pause…), grep the index for it and read the matches before improvising.
5. **Cross-check completeness:** compare the index's `Total:` with the number of `*.md` files under `learnings/`
   (minus `INDEX.md`). If files exist that the index misses, read them too — the index is stale; regenerate it
   (`node scripts/generate-learnings-index.mjs`) or append the missing lines by hand.

When you dispatch a worker (`references/orchestration.md`), pass it the paths of the learnings relevant to its task.

**Tier semantics (strict):** `universal` = applies to **every** C++ Ludeo integration with **no** preconditions.
`generalizable` = applies only when a stated precondition holds (the `question` field is that precondition — verify it
in *this* project before applying). `game-specific` = tied to one game; don't reuse it across games.

**Before citing any learning in a decision:** read the full body, identify its precondition, and **verify it holds
here with concrete evidence** (files read, questions answered, runs observed). If the precondition can't be verified,
the learning does not apply — don't cite it. An absolute conclusion ("the ONLY way", "NEVER do X") tagged `universal`
is a red flag — check whether it should be `generalizable` first.

### Capture — on discovery, not at phase end

**Learnings are append-only.** Add new files under `learnings/<category>/` in this skill's directory; never delete or
overwrite an existing one without explicit human approval. Write the learning **before continuing** whenever a fix
took more than one attempt or the root cause wasn't what you assumed; the SDK, engine or environment behaved
differently than the docs implied; the human corrected you; or you found a non-obvious precondition, ordering
requirement or exact API signature. Deferring loses the specifics that make it reusable. Workers report candidate
learnings to the orchestrator, which writes them.

1. **Categorize** (`architecture` / `common-mistakes` / `engine-quirks` / `save-systems`) and **classify the tier**.
2. **Write `learnings/<category>/<slug>.md`** with frontmatter:
   ```yaml
   ---
   category: common-mistakes
   tier: generalizable
   sourceGame: ActionGame     # abstract codename only — see config/learning-policy.json
   phase: 5
   question: "..."            # the precondition to re-check on future integrations (null if universal)
   sanitized: true            # attest you ran the sanitization checklist
   ---
   ```
3. **Register it in the index:** run `node scripts/generate-learnings-index.mjs` (or append the line to
   `learnings/INDEX.md` by hand in the same format). A learning missing from the index is invisible to future phases.
4. **Sanitize before saving — mandatory.** Learnings are read on future integrations *for other clients*; anything
   client-specific that survives leaks one client's code to every other client. Capture the transferable pattern,
   never the client's payload: `sourceGame` is an allowlisted abstract codename (phase 1 Step 0a adds this
   engagement's), client namespaces and class names become neutral role-based names, and Ludeo SDK and public C++
   identifiers stay verbatim. **The test:** could a reader name the client, or copy-paste something that's theirs? If
   yes, it is not sanitized. This applies to **every committed file**, not just `learnings/`. **Full rule and
   checklist: `references/learning-sanitization.md` — read it before writing any learning.**
   `scripts/validate-skill.mjs` enforces the structural parts (codename allowlist, index freshness, client-identifier
   guard).

## Reference material

- `references/learning-sanitization.md` — how to write a learning without leaking client IP (pattern, not payload);
  the pre-save checklist. `config/learning-policy.json` holds the codename allowlist.
- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking, API reference, research templates, game-pattern playbooks).
- `references/migration.md` — resuming an integration started under an older version of this skill.
- `references/vcs/` — the VCS contract (`README.md`) and its git / SVN / Perforce implementations.
- `references/state-file-schema.md` — `ludeo-integration-plan/integration.json`: where the integration is, what
  was decided, the intake answers, the Ludeo platform record. Read it at the start of every session.
- `references/know-your-game.md` — the kickoff intake (phase 1 Step 11): design, UX and launch decisions that can't
  be read from code, each feeding a check in a later step.
- `references/agent-test-harness.md` — how the agent runs, captures, replays and fires actions itself: the
  cheapest-lever ladder, the test-only harness module, the scenarios each gate runs, what a pass must show.
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
current branch doesn't have it, look for an existing integration first — `git branch --list
'feature/ludeosdk-integration-*'`, `svn ls ^/branches`, or the Perforce streams / pending changelists named for the
integration — and ask the user whether to resume that one before starting anything new. Once the state file is read,
load `references/vcs/<vcs.type>.md` before writing anything.

- **It exists** → read it. Resume at `current`: a step `in_progress` continues where it stopped (re-read that
  phase file, its inputs and the step's `note` first); a `completed` or `skipped` step advances to the next one in the
  table above. In phase 5, resume at `wave.reopened` if set, else `wave.current`, at that wave's first unfinished task
  (`5a`–`5e`). **If any `wave.plan` entry is neither `green` nor `deferred`, phase 5 isn't done** — after phase 6 (which
  may start once wave 1 is green), return to phase 5's next wave before phase 7. With `current` at `8`: if `wave.reopened` is set, or any `wave.plan`
  entry is neither `green` nor `deferred`, resume phase 5 at `wave.reopened`, else at that entry (task 3 is skipped),
  then return to phase 8 where `steps.8.note` says. `8` `completed` → the integration is done at the agreed scope; say
  so, and offer another phase-8 pass (set `steps.8` back to `in_progress`) only if the user wants to widen further. Read the
  `risks` aimed at the step you're about to run. Tell the user in one line where you're resuming and why.
- **It doesn't exist, but plan files do** (`ludeo-integration-plan/CODE_MAP.json`, `OBJECT_TRACKING.md`,
  `RESTORATION_PLAN.md`, `GAME_ACTIONS_MAP.md`, `LUDEO_PLATFORM.md`, …) — an integration started under an older
  version of this skill (the v1.x 15-phase layout, or v2 before the state file). Follow `references/migration.md`:
  map it to the current steps, infer each step's status from evidence, re-open the work older versions built
  differently (the pre-CR-010 restore flow, per-area non-ludeoable actions, …), create the state file, and show the
  user the inferred status and the re-check list before resuming. A state file missing newer fields (`vcs`, `wave`,
  `steps.8`) is completed the same way.
- **Neither** → a new integration: read `references/1-build-game-with-sdk.md` and follow it.

Never re-run a `completed` step unless the user asks; if they do, set it back to `in_progress` first. The exception is
phase 8, which routes back through `6a`, `6b` and `7`: those keep `current` at `8` and stay `completed`, and
`steps.8.note` records which one is in progress and where, so a resumed session re-enters it from there (`5a`–`5e`
follow the `wave` rules).
