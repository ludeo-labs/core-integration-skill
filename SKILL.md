---
name: ludeo-integration
description: Integrate the Ludeo SDK into a C++, Unity, or Unreal game. Sets up the build with conditional compilation, wires the SDK lifecycle, maps and implements game actions, maps and tracks game objects, and verifies the integration. Use when the user asks to integrate, install, add, set up, or wire up Ludeo into their game.
metadata:
  version: 0.0.0
---

# Ludeo SDK Integration

**Skill version:** 0.0.0 · Compare against the [latest release](https://github.com/ludeo-labs/core-integration-skill/releases/latest) to confirm your installed copy is current. If older, run `npx skills update ludeo-integration` (then start a fresh agent session — `SKILL.md` is cached per session).

This skill walks the agent through integrating the Ludeo SDK into a game project, from build configuration to action mapping and runtime verification.

## When to use

Activate this skill when the user says any of:

- "Integrate Ludeo into my game"
- "Set up the Ludeo SDK"
- "Add Ludeo action tracking"
- "Build my game with the Ludeo SDK"
- "Wire up Ludeo lifecycle"

## Workflow

The integration is a sequential 15-phase workflow (phase 0 through phase 12, including phases 2b and 2c). Phases 0–9 build the **capture** (tracking) side; phases 10–12 add **state restoration**, which is what turns a capture into a playable Ludeo. State restoration is split into a plan (10), the player-flow/lifecycle wiring (11), and the two-pass data reconstruction (12) — 11 builds the apply lifecycle with the read-back stubbed, then 12 fills it. Always start at phase 0 unless the user explicitly says they have already completed earlier phases. Complete one phase at a time and confirm with the user before advancing.

| Phase | File | Purpose |
| --- | --- | --- |
| 0 | `references/0-build-game-with-sdk.md` | Build environment, conditional compilation, baseline + SDK builds |
| 1 | `references/1-map-game-code.md` | Produce CODE_MAP of game architecture |
| 2 | `references/2-find-sdk-integration-points.md` | Identify where SDK calls go |
| 2b | `references/2b-create-tdd.md` | Produce Technical Design Document (architecture, strategy, risks) |
| 2c | `references/2c-classify-save-system.md` | Classify save system (group + per-entity reconciliation/manual matrix); required by phases 8–9 |
| 3 | `references/3-plan-sdk-lifecycle.md` | Plan lifecycle wiring |
| 4 | `references/4-implement-sdk-lifecycle.md` | Implement lifecycle wiring |
| 5 | `references/5-compile-and-fix.md` | Compile, fix, verify |
| 6 | `references/6-map-game-actions.md` | Find action points in game code |
| 7 | `references/7-implement-game-actions.md` | Insert action calls |
| 8 | `references/8-map-game-objects.md` | Discover trackable objects & properties |
| 9 | `references/9-implement-object-tracking.md` | Wire object registration & capture |
| 10 | `references/10-plan-state-restoration.md` | Plan the two-pass restoration flow (inverse of tracking) → `RESTORATION_PLAN.md` |
| 11 | `references/11-implement-restoration-flow.md` | Implement the player-flow/lifecycle half (inverse of `/4`): `LudeoSelected` handler, freeze (CR-010), `GetLudeo`+`OpenRoom` race, single-fire apply gate, `RoomReady → Begin` resume, overlay pause/resume (CR-011). Calls the read-back as a **stub**. |
| 12 | `references/12-implement-state-reconstruction.md` | Fill the data half (inverse of `/9`): real `RestoreTwoPass`/`RestoreEnvironment`, reader-side scope, two-pass `DataReader` reads, references, deferred queue, environment. |

## Important rules

- **One phase at a time.** Get user confirmation before advancing to the next phase.
- **Every code-writing phase ends with a rebuild + run gate (hard requirement).** Phases 4, 7, 9, 11, and
  12 edit source, so each ends by requiring the integrator to (1) rebuild clean (with `LUDEO_SDK_ENABLED`
  on, and off if a no-SDK build ships) and (2) run the game to confirm it still works. The agent reads
  build/run logs where it can but cannot truly verify either step — beyond the logs it relies on the
  integrator's word. Do not advance a phase until they confirm both (or explicitly skip). The
  build-and-fix loop lives in `phase 5`; the gate cites it rather than repeating it.
- **Paths inside workflow files are relative to the workflow file itself.** A workflow at `references/N-*.md` says `ludeo-integration-docs/<file>.md` to reach the docs folder, which sits next to the workflow file inside `references/`.
- **Critical requirements** live in `references/ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`. Review them before phase 0.
- **Track objects as attributes by default, not blobs.** The SDK supports both attribute and blob state storage/reconstruction; Ludeo strongly prefers attribute integrations. When mapping and tracking objects (phases 8–9), capture discrete typed attributes by default and do **not** ask the user which to use. Use blob/serialized storage only when the user explicitly asks or an entity is genuinely opaque/unmappable — see `references/ludeo-integration-docs/06-TRACKING-PATTERNS.md §1.4`.
- **The agent writes outputs into the game's repo**, not into this skill. For example, `ludeo-integration-plan/CODE_MAP.json` is created at the game project root.
- **Fresh session recommended.** Each phase produces a lot of context. If a phase has been running long, suggest the user start a fresh agent session for the next phase.

## Reference material

- `references/ludeo-integration-docs/` — primary integration guides (build, lifecycle, tracking, API reference, research templates, game-pattern playbooks).
- `references/utilities/` — supporting docs (master integration plan, PM guide, prompt prototype). Optional reading; the workflows reference what they need.

## Start here

Read `references/0-build-game-with-sdk.md` and follow it.
