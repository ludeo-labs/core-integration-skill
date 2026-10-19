# Phase 5 — Tracking & Restore (orchestrated wave loop)

> **This is the phase-5 entry point.** Phase 5 is one logical phase run as a **wave loop**: phase 4's census + wave
> plan is implemented **one wave at a time**, each wave proven by a human at its own restore gate before the next
> widens scope. Inside a wave the work is single-task briefs: **deep-scope** (task 0) → **capture** (task 1) →
> **restore plan** (task 2) → **restore flow** (task 3, **wave 1 only**) → **state reconstruction** (task 4). Run it
> per [`orchestration.md`](orchestration.md): one task at a time, state passed by file, every gate run by you.

## 1. Goal / Purpose

Turn the approved census + wave plan into a working capture-and-replay loop, wave by wave. **Wave 1** proves the
whole round trip on the **restorable spine plus the must-have set** — the world/session entry identity, the player,
the time-base, and the few collections the moment is visibly wrong without (`06 §1.5`): register and capture, plan the
restore, build the restore flow once (`07 §2.1`), and fill the two-pass read-back. **Each later wave widens the
tracked set** and re-runs capture and reconstruction for the added types, ending in the same restore gate.
**Deliverable:** a captured Ludeo that plays back and **visibly restores the moment** — first for wave 1 (the gate
for phase 6), then for every wave in the plan.

## 2. Inputs (Input Contract)

- [ ] **Phase 3 complete** — `LudeoManager`, the session lifecycle and the `OpenRoom → AddPlayer → RoomReady → Begin`
      chain build and run (`3-lifecycle-orchestrator.md`).
- [ ] **Phase 4 Part A complete** — `ludeo-integration-plan/OBJECT_TRACKING.md` has the census and wave plan
      (`## Wave Rollout`, `## Object Type Census`, `## Codebase Pattern Summary`), and the user **approved** it. The
      per-entity detail is **not** there yet — task 0 appends it per wave.
- [ ] **A goal on the debug environment**, so each wave can cut a test Ludeo (`5b-implement-object-tracking.md`
      prerequisite 4; `ludeo-studio-mcp.md`).
- [ ] The state file (`integration.json`) — its `wave` block says where the loop is (`state-file-schema.md`).

## 3. Steps

### The wave loop

Read `## Wave Rollout` from `OBJECT_TRACKING.md` → an ordered list of waves. Then, for each wave in order:

```
for N in waves:
    task 0  deep-scope(N)     5a  -> append wave N's entity blocks            → GATE 0: user approves the rows
    task 1  capture(N)        5b  -> register + capture N's types (additive)  → GATE 1: build + run + capture a Ludeo
    task 2  restore-plan(N)   5c  -> append wave N's RESTORATION_PLAN rows    → GATE 2: user approves the rows
    if N == 1:
        task 3  restore-flow  5d  -> the restore flow, read-back stubbed      → GATE 3: flow smoke test   # ONCE
    task 4  reconstruct(N)    5e  -> fill wave N's read-back (additive)       → GATE 4: wave N restores
    ask: "wave N restores — widen to wave N+1?"                               # confirm before widening
```

| # | Task | Brief | Cadence | Produces | Gate (yours) |
|---|------|-------|---------|----------|--------------|
| 0 | Deep-scope the wave | [`5a-deep-scope-wave.md`](5a-deep-scope-wave.md) | per wave | wave N's `## Entity` blocks appended to `OBJECT_TRACKING.md` | user reviews and approves wave N's rows |
| 1 | Capture | [`5b-implement-object-tracking.md`](5b-implement-object-tracking.md) | per wave, additive | registration + capture for N's types | **agent builds** (SDK on and off) **and captures** with the harness's `capture` scenario (`agent-test-harness.md`) a moment containing wave N's attributes; the integrator turns it into a Ludeo and sends the id; registration in the log, no `Expected type` / result errors |
| 2 | Plan the restore | [`5c-plan-state-restoration.md`](5c-plan-state-restoration.md) | per wave, append | wave N's rows in `RESTORATION_PLAN.md` | user reviews and approves the rows |
| 3 | Restore flow | [`5d-implement-restoration-flow.md`](5d-implement-restoration-flow.md) | **once, wave 1** | the `LudeoSelected` → validate → commit → apply → settle → `OpenRoom` → `Begin` flow, read-back stubbed | `5d` Step 6: the captured level held frozen behind the overlay before Play, instant resume on Play, a bad selection ignored (replay→replay is checked at gate 4) |
| 4 | Reconstruction | [`5e-implement-state-reconstruction.md`](5e-implement-state-reconstruction.md) | per wave, additive | wave N's types read back in `RestoreTwoPass` / `RestoreEnvironment` / `ApplyDeferred` | `5e` Step 7 for wave N's **cumulative** set, plus the checks below |

**Wave 1 runs the whole pipeline. Waves ≥ 2 are data-only** — deep-scope → capture → restore-plan → reconstruct;
they **skip task 3**, because the flow is moment-agnostic plumbing built once. **Phase 6 may start once wave 1 is
green** — it doesn't wait for every wave. Record each wave's progress in the state file's `wave` block, and each
task's status under its step id (`5a`–`5e`) for the current wave.

### Capture before replay

Tasks 3 and 4 can't be verified without a **real captured Ludeo** — you can't replay what was never captured. So
each wave's task-1 gate is not "capture builds and runs": **at least one real capture containing that wave's
attributes — ideally two**, for the replay-twice check. The agent makes them with the harness's `capture` scenario
([`agent-test-harness.md`](agent-test-harness.md)), then asks the integrator for one thing only: turn *these* named
moments into Ludeos and send back the ids (one ask for both). Track them in `LUDEOS.md`.

- **Re-capture every wave.** Each wave adds attributes to the capture schema, which **invalidates Ludeos captured
  in earlier waves** (`07 §2.2` corollary). The Ludeo used at a wave's gate 4 must contain that wave's attributes —
  never a stale earlier capture. Same after any in-wave capture fix.
- **Capture mid-run, not at a level's origin.** A capture taken at the very start of a level can sit at the
  engine's spawn origin, where absolute positions restore correctly even when the world's spatial frame is rebuilt
  differently elsewhere — masking the bug (`game-patterns/procedural-world.md` §3).

### Gate 4 — what "wave N restores" means

All of these, on a Ludeo captured mid-run with wave N's attributes:

- **The cumulative set restores** — `5e` Step 7: the frozen frame behind the overlay is the captured moment for
  everything waves 1…N track; two-pass counts non-zero; cross-references resolved.
- **Placement sanity** — from the `replay` run's screenshots, which you open and look at: does anything sit in
  empty space, fall through the floor, or appear far from the level's geometry? A yes is a displaced-world-frame
  bug. If the screenshots can't show it (a camera that can't see the restored entities), add a sampler check
  against the level's geometry, or list it as an open item for the sign-off.
- **Replay twice** in one session — the second Ludeo's state shows, nothing leaks from the first (`07 §2.6`).
- **Evidence bundle, then sign-off** — the integrator answers *"wave N restores — widen?"* from the bundle
  (`agent-test-harness.md` → *The wave sign-off*), not by replaying it.
- **Play it to completion**, not just the first frame — the harness drives the moment to its win or lose condition
  (the game's own bots / AI, dev commands, or scripted input). Win
  conditions ride on derived counters (alive enemies, objectives left — `07 §11.2`) that a first-frame check can't
  see. For a state-heavy wave, add a temporary **heartbeat** log — redundant state vs ground truth every few seconds
  (e.g. "enemies remaining" vs the actual alive count) — and remove it once the wave is green.

### Guardrail — widening is for breadth, not backfilling

If a wave-N gate fails because state **owned by an earlier, already-green wave** is wrong or missing, that is not a
wave-N fix. Re-open the earlier wave — re-run its task 0 / task 1 for the missing state, re-verify **its** gate —
then resume wave N. Never patch the symptom forward into the current wave.

## 4. Questions to ask the human

Relay what the workers surface; don't invent your own. Expected ones:
- **Task 0:** an unresolved stable key; an entity whose "reconciliation" path actually serializes an opaque blob
  (treat as manual); a load-bearing cross-wave reference that should reshape the wave plan (back to the phase-4
  census gate).
- **Task 2:** the native-spawn-done signal; disagreements between this wave's rows and the save-system matrix.
- **Gate 0 / gate 2:** approve wave N's rows.
- **Gate 1:** a clean run and a **captured** Ludeo with wave N's attributes, captured mid-run, and a second one.
- **Gate 3 (wave 1):** the `5d` Step 6 smoke test.
- **Gate 4:** the checks above.
- **End of each wave:** "wave N restores — widen to wave N+1?"

## 5. Patterns to apply

- **Prove the round trip early, on a small set** (`06 §1.5`) — the riskiest question (does a Ludeo round-trip at
  all?) is answered on wave 1's spine, not once against the whole game.
- **One-time flow, per-wave data** — the restore flow (task 3) is built once; only capture (task 1) and the
  read-back (task 4) grow, **additively**. Never re-wire the flow or edit a green wave's capture or read-back for a
  later wave.
- **The mirror principle** (`07 §1.1`) — the restore is the row-for-row inverse of capture for the wave's types:
  same `objectType`s, same attribute names, same stable ids.
- **Capture is Creator-Flow only; actions fire in both flows** (`06 §7`).

## 6. Output Contract

Accumulated across the waves (each brief owns its own contract):
- `OBJECT_TRACKING.md` — per-wave `## Entity` blocks appended (task 0).
- Capture code — registration and capture for each wave's types, growing per wave (task 1).
- `RESTORATION_PLAN.md` — rows appended per wave (task 2).
- The restore flow — built once in wave 1 (task 3).
- `RestoreTwoPass` / `RestoreEnvironment` / `ApplyDeferred` — growing per wave (task 4).
- **A human-verified captured Ludeo that restores — per wave.**

## 7. ✅ Success Criteria

**Every wave N:**
- [ ] Wave N's rows approved (gate 0) and mirrored in `RESTORATION_PLAN.md` (gate 2).
- [ ] Capture proven at runtime for N's types and a Ludeo **including N's attributes** captured mid-run (gate 1).
- [ ] The cumulative set restores, placement is sane, replay-twice is clean, and the moment plays to completion
      (gate 4).

**Wave 1 additionally:**
- [ ] The restore flow passes `5d` Step 6 on a real captured Ludeo (gate 3).
- [ ] Player Flow is proven before phase 6 starts.

**Phase complete:**
- [ ] Every wave in `## Wave Rollout` has passed gate 4, or a remaining wave is explicitly deferred with the user's
      sign-off (recorded in the state file's `decisions`).

## 8. Common Mistakes

- **Implementing the whole plan in one pass** instead of wave by wave — loses the early round-trip proof and the
  small, debuggable gates.
- **Re-running task 3 every wave** — it runs once, in wave 1.
- **Editing a green wave's capture or read-back when adding a later wave** — waves are additive.
- **Testing a wave against a stale earlier capture** — every wave needs a re-capture.
- **Patching earlier-wave state forward** into the current wave — re-open the earlier wave.
- **Declaring a wave done by inspection** — the gate is a human watching that wave's Ludeo restore.

## Related / Next

- Briefs: `5a` (task 0), `5b` (task 1), `5c` (task 2), `5d` (task 3, once), `5e` (task 4).
- `4-map-game-objects.md` — Part A produces the census and wave plan; Part B is the per-wave deep-scope procedure
  task 0 runs.
- **Re-entered from phase 8** (`8-polish.md` Step 3) for appended waves — run as waves ≥ 2 (task 3 skipped); when they
  are green, return to `8-polish.md`.
- **Next:** `6-actions-orchestrator.md`, once wave 1 is green.
