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
so that a phase number means the same thing in every engine. Phases 3, 5 and 6 are each made of
numbered tasks, run in order.

The order is **1** build with the SDK → **2** map the code → **3** SDK lifecycle → **4** map objects
→ **5** tracking & restore → **6** actions → **7** verify & upload. Phases 1–5 build the **capture**
side and then turn a capture into a playable Ludeo; **actions come last** of the integration work,
once the player flow is proven, because an action that fires into a flow you cannot yet replay cannot
be verified. Phase 7 then gets the build onto the Ludeo platform.

Always start at phase 1 unless the user explicitly says they have already completed earlier phases.
Complete one phase at a time and confirm with the user before advancing.

| Phase | File | Purpose |
| --- | --- | --- |
| 1 | `references/1-build-game-with-sdk.md` | Build environment, conditional compilation, baseline + SDK builds |
| 2 | `references/2-map-game-code.md` | Produce CODE_MAP of game architecture |
| 3 · task 1 | `references/3a-find-sdk-integration-points.md` | Identify where SDK calls go |
| 3 · task 2 | `references/3b-create-tdd.md` | Produce Technical Design Document (architecture, strategy, risks) |
| 3 · task 3 | `references/3c-plan-sdk-lifecycle.md` | Plan lifecycle wiring |
| 3 · task 4 | `references/3d-implement-sdk-lifecycle.md` | Implement lifecycle wiring |
| 3 · task 5 | `references/3e-compile-and-fix.md` | Compile, fix, verify |
| 3 · task 6 | `references/3f-classify-save-system.md` | Classify save system (group + per-entity reconciliation/manual matrix); required by phase 4 and phase 5 · task 1 |
| 4 | `references/4-map-game-objects.md` | Discover trackable objects & properties |
| 5 · task 1 | `references/5b-implement-object-tracking.md` | Wire object registration & capture |
| 5 · task 2 | `references/5c-plan-state-restoration.md` | Plan the two-pass restoration flow (inverse of tracking) → `RESTORATION_PLAN.md` |
| 5 · task 3 | `references/5d-implement-restoration-flow.md` | Implement the player-flow/lifecycle half (inverse of `phase 3 · task 4`): `LudeoSelected` handler, freeze (CR-010), `GetLudeo`+`OpenRoom` race, single-fire apply gate, `RoomReady → Begin` resume, overlay pause/resume (CR-011). Calls the read-back as a **stub**. |
| 5 · task 4 | `references/5e-implement-state-reconstruction.md` | Fill the data half (inverse of `phase 5 · task 1`): real `RestoreTwoPass`/`RestoreEnvironment`, reader-side scope, two-pass `DataReader` reads, references, deferred queue, environment. |
| 6 · task 1 | `references/6a-map-game-actions.md` | Find action points in game code |
| 6 · task 2 | `references/6b-implement-game-actions.md` | Insert action calls |
| 7 | `references/7-upload-build.md` | Verify the Release build (release guard, shipped `ludeo.ini`, self-contained, `validate-build`), then upload it with the `ludeo` CLI and poll to `success` — **upload only on explicit user confirmation** |

## Important rules

- **One phase at a time.** Get user confirmation before advancing to the next phase.
- 🛑 **Never upload a build without explicit user confirmation.** Phase 7 publishes to Ludeo's cloud —
  outward-facing and not trivially reversible. Present the fully-resolved command after a clean
  `--dry-run` and stop; a clean dry-run is not approval.
- **Every code-writing task ends with a rebuild + run gate (hard requirement).** Phase 3 · task 4,
  phase 5 · tasks 1, 3 and 4, and phase 6 · task 2 edit source, so each ends by requiring the
  integrator to (1) rebuild clean (with `LUDEO_SDK_ENABLED` on, and off if a no-SDK build ships) and
  (2) run the game to confirm it still works. The agent reads build/run logs where it can but cannot
  truly verify either step — beyond the logs it relies on the integrator's word. Do not advance
  until they confirm both (or explicitly skip). The build-and-fix loop lives in `phase 3 · task 5`;
  the gate cites it rather than repeating it.
- **Paths inside workflow files are relative to the workflow file itself.** A workflow at `references/N-*.md` says `ludeo-integration-docs/<file>.md` to reach the docs folder, which sits next to the workflow file inside `references/`.
- **Critical requirements** live in `references/ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`. Review them before phase 1.
- **Track objects as attributes by default, not blobs.** The SDK supports both attribute and blob state storage/reconstruction; Ludeo strongly prefers attribute integrations. When mapping and tracking objects (phase 4 and phase 5 · task 1), capture discrete typed attributes by default and do **not** ask the user which to use. Use blob/serialized storage only when the user explicitly asks or an entity is genuinely opaque/unmappable — see `references/ludeo-integration-docs/06-TRACKING-PATTERNS.md §1.4`.
- **The agent writes outputs into the game's repo**, not into this skill. For example, `ludeo-integration-plan/CODE_MAP.json` is created at the game project root.
- **Fresh session recommended.** Each phase produces a lot of context. If a phase has been running long, suggest the user start a fresh agent session for the next phase.

## Reference material

- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking, API reference, research templates, game-pattern playbooks).

## Start here

Read `references/1-build-game-with-sdk.md` and follow it.
