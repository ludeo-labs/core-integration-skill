# Phase 3 — SDK Lifecycle (orchestrated)

> **This is the phase-3 entry point.** Phase 3 is one logical phase made of six single-task briefs. Run it per
> [`orchestration.md`](orchestration.md): one task at a time, state passed by file, every gate run by you.

## 1. Goal / Purpose

Wire the Ludeo SDK's session lifecycle into the game: where each SDK call goes, the technical design, the lifecycle
plan, the code (`LudeoManager`, `LudeoConfig`, `ludeo.ini`, the hooks in game code), a clean build in both
configurations with the game still running, and the save-system classification phase 4 needs. **Deliverable:** the
game builds and runs with the SDK on, a Creator-Flow gameplay session opens and begins, and nothing about the game's
own behaviour changed.

## 2. Inputs (Input Contract)

- [ ] Phase 1 complete — the build works with `LUDEO_SDK_ENABLED` on and off; `integration.json` exists with the
      intake recorded.
- [ ] Phase 2 complete — `ludeo-integration-plan/CODE_MAP.json`.

## 3. Steps

| # | Task | Brief | Reads | Produces | Gate (yours) |
|---|------|-------|-------|----------|--------------|
| 1 | Map integration points | [`3a-find-sdk-integration-points.md`](3a-find-sdk-integration-points.md) | `CODE_MAP.json` | `SDK_INTEGRATION_POINTS.json` | artifact exists and covers every lifecycle hook |
| 2 | Technical design | [`3b-create-tdd.md`](3b-create-tdd.md) | `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`, intake | `TDD_<Game>.md` | artifact exists |
| 3 | Plan the lifecycle | [`3c-plan-sdk-lifecycle.md`](3c-plan-sdk-lifecycle.md) | the above, intake (`launchModel`, `captureTimingRules`) | `SDK_LIFECYCLE_PLAN_<Game>.md` | **user reviews the plan** |
| 4 | Implement the lifecycle | [`3d-implement-sdk-lifecycle.md`](3d-implement-sdk-lifecycle.md) | TDD + plan | `LudeoManager`, `LudeoConfig`, `ludeo.ini`, hooks | — (task 5 is its gate) |
| 5 | **Build + run** | [`3e-compile-and-fix.md`](3e-compile-and-fix.md) | the edited project | clean builds, SDK on and off | **agent builds and fixes, then runs the harness's `smoke` scenario** (`agent-test-harness.md`); the log shows a gameplay session opening and beginning, and the screenshots show gameplay |
| 6 | Classify the save system | [`3f-classify-save-system.md`](3f-classify-save-system.md) | `CODE_MAP.json`, intake `saveSystem` | `GAME_ANALYSIS_SAVE_SYSTEM.md`, `CODE_MAP.save_system.group` | **user confirms** the classification and the per-entity matrix |

Tasks 1–2 can run back to back. Stop at task 3's plan for review before writing code, and don't start task 6 until
task 5's run gate passed — a lifecycle that doesn't run is not a base to classify against.

**Decided here, built later.** The standard trigger actions (`PauseLudeo`/`ResumeLudeo`,
`StartNoneLudeable`/`StopNoneLudeable`) and the SDK-readiness gate (when the intake's launch model needs it —
[`LAUNCH-AND-READINESS.md`](ludeo-integration-docs/LAUNCH-AND-READINESS.md)) are **planned** in task 3: the pause
primitive and the non-ludeoable areas are identified there. The action calls themselves land in phase 6.

## 4. Questions to ask the human

Relay what the workers surface. Expected ones: the auth mode, API key and target environment (`3d` Questions 1–3); a
lifecycle hook with no obvious site; whether the game ships a no-SDK build (decides whether the gate builds both
configurations); the save-system classification (task 6 gate).

## 5. Patterns to apply

- **Callback-driven chain** — `OpenRoom` is the only lifecycle call made from game code on the level-load path; the
  rest is driven by SDK callbacks (CR-009), each issuing its next SDK call from the queue (`03 §8.3`).
- **The room opens on the level-load path; a gameplay condition gates only `Begin`** — under a readiness gate, the
  room waits for the start trigger (`LAUNCH-AND-READINESS.md` §3).
- **Runtime config in `ludeo.ini`**, never literals in the SDK call path (`04 §4`).

## 6. Output Contract

`SDK_INTEGRATION_POINTS.json`, `TDD_<Game>.md`, `SDK_LIFECYCLE_PLAN_<Game>.md`, the lifecycle code and `ludeo.ini`,
clean builds, `GAME_ANALYSIS_SAVE_SYSTEM.md` + `CODE_MAP.save_system.group` — and steps `3a`–`3f` `completed` in the
state file.

## 7. ✅ Success Criteria

- [ ] The game builds with `LUDEO_SDK_ENABLED` on (and off, if a no-SDK build ships), built by the agent.
- [ ] The integrator ran it: the log shows session activation, `OpenRoom`, `AddPlayer`, `RoomReady` and `Begin`, with
      no SDK errors, and the game plays as before.
- [ ] The save system is classified and the user confirmed it.

## 8. Common Mistakes

- **Writing lifecycle code before the plan is reviewed.**
- **Handing the build to the integrator** — the agent builds; only the run needs them.
- **Calling SDK functions inline from inside SDK callbacks** (`03 §8.3`).
- **Gating `OpenRoom` on a gameplay phase** instead of the level-load path.

## Related / Next

- **Next:** phase 4 (`4-map-game-objects.md`) — Part A, the census and wave plan.
