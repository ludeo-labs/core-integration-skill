# Phase 5 · Task 4 — Implement State Reconstruction

> **Stage:** State Restoration — Data Reconstruction (the inverse of `phase 5 · task 1`'s capture)
> **Run per wave, additively,** by [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md): read back
> wave N's types; never rewrite an earlier, green wave's read-back. The orchestrator's gate 4 adds placement sanity,
> replay-twice and play-to-completion checks to this brief's smoke test.
> **Prerequisite:** `5d-implement-restoration-flow.md` completed (the apply lifecycle and the `RestoreTwoPass`/`RestoreEnvironment` stubs exist and are already called) and `RESTORATION_PLAN.md` approved
> **Inputs:** `RESTORATION_PLAN.md`, `OBJECT_TRACKING.md`, `CODE_MAP.json`
> **Output:** Real `LudeoStateAdapter::RestoreTwoPass` / `RestoreEnvironment`, reader-side object scope + `LUDEO_READ_*` helpers, the per-Ludeo `id_map`, the deferred-property queue, two-pass spawn + property apply + reference resolution, pre-existing reconciliation, environment restore.

This phase fills the **data** half of restoration — the inverse of `phase 5 · task 1`. Where `phase 5 · task 1` created objects with `ludeo_DataWriter_CreateObject` and wrote attributes with `ludeo_DataWriter_Set*`, this command spawns them in Pass 1 and reads attributes back with `ludeo_DataReader_Get*` in Pass 2. **`phase 5 · task 3` already built when/where this runs** — the `LudeoSelected` handler and its validation, the commit, `ApplyHeld()` (frozen apply + settle), and the `RestoreTwoPass`/`RestoreEnvironment`/`ApplyDeferred` stub call sites. Your job is to **fill those stub bodies** — do **not** re-wire `ApplyHeld()`, the call order, the freezes or the settle (those are `phase 5 · task 3`'s contract). Follow the propose-confirm-execute cycle.

## The Seam from `phase 5 · task 3`

`phase 5 · task 3` declared `RestoreTwoPass(reader)`, `RestoreEnvironment(reader)` and `ApplyDeferred()` as stubs and already calls them from `ApplyHeld()` in the correct order — **`SetCurrent → RestoreTwoPass → RestoreEnvironment` while frozen, after the game's native spawn is done; then the ~0.5 s settle, whose first tick calls `ApplyDeferred()`; then a second freeze, `m_applied = true` and `OpenRoom` — all before Play**. This phase replaces the stub bodies with the real implementation. **Leave `ApplyHeld()`, the settle, the freezes, `m_applied` / the `OpenRoom` sequencing, and the validation / entry-identity read / level boot exactly as `phase 5 · task 3` wrote them.** If you find yourself touching the `LudeoSelected` handler, the commit, the overlay registrations, or the wait-for-Play logic, you're in `phase 5 · task 3`'s territory — stop.

`IsRestoring()` is owned by `phase 5 · task 3` (set `true` in the handler, cleared at the end of the apply). This phase only **reads** it — to gate the pre-existing reconciliation path (Step 5) so `phase 5 · task 1`'s batch registration doesn't double-create during a restore.

## Fresh Context Check

This is a sequential workflow — continuing to phase 5 · task 4 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 5 · task 4** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. **Running this task again for the next wave is not a redo** — the wave loop runs it once per wave. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

**From the intake** (`ludeo-integration-plan/integration.json` → `intake`; [`know-your-game.md`](know-your-game.md)) — every `visiblePlayerState.firstFrameRequired` item is **restored, not stubbed**, before
this task completes. The Step 7 smoke test also checks `visiblePlayerState.hudAtFrameZero` on the frozen frame, that
the level does not re-run its opening logic (`scriptedSystems`), and that input unlocks within
`playbackUXBar.maxInputLockMs`; its hand-off asks the user to confirm `playbackUXBar.firstSecondsMustFeel`.

> **REQUIRED:** These must be complete before running this command:
> 1. `phase 3 · task 4` complete — LudeoManager exists and SDK lifecycle works
> 2. `5b-implement-object-tracking.md` complete — `LudeoStateAdapter` and `LudeoCaptureMacros.h` exist, `objectType` strings and stable-ID fields are in code
> 3. `5d-implement-restoration-flow.md` complete — the restore flow, `ApplyHeld()` with its settle, and the `RestoreTwoPass`/`RestoreEnvironment`/`ApplyDeferred` stubs exist and are called; `IsRestoring()` is live
> 4. `5c-plan-state-restoration.md` complete — `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user approved it

`phase 5 · task 1` is a hard prerequisite, not just a recommendation: restoration reuses the **same** `LudeoStateAdapter` and the same `objectType` strings that tracking wrote. You cannot restore what `phase 5 · task 1` didn't capture. `phase 5 · task 3` is a hard prerequisite: without `ApplyHeld()` and the validated, populated reader it hands you, there is nothing to read back into.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. This is the **data** reading list — the LudeoSelected-flow / wait-for-player / overlay sections (`07 §2/§7`) belong to `phase 5 · task 3`, not here.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §3 (two-pass / CR-006), §5 (reconciliation vs manual), §6 (deferred properties), §8 (environment), §9.6 (fail-loud on missing id), §10 (validation checklist). All canonical reconstruction patterns live here.
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §4.3 (the `LudeoStateAdapter` id-map structure you extend), §7.2 (writer-side `ObjectScope` RAII — mirror it for the reader). Restoration is the inverse of these.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-002 (`EnterObject`/`LeaveObject` paired only via the scope), CR-006 (two-pass restoration is mandatory), CR-008 (hold `ObjectsInfo` across both passes, release exactly once).
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **actual restoration API** to emit. Mirror of the DataWriter calls `phase 5 · task 1` used:

  | `phase 5 · task 1` wrote (DataWriter) | `phase 5 · task 4` reads (DataReader) |
  |---|---|
  | `ludeo_DataWriter_CreateObject` | `ludeo_DataReader_GetObjectsInfo` + spawn |
  | `ludeo_DataWriter_SetCurrent` | `ludeo_DataReader_SetCurrent` |
  | `ludeo_DataWriter_EnterObject` / `LeaveObject` | `ludeo_DataReader_EnterObject` / `LeaveObject` |
  | `ludeo_DataWriter_SetFloat/Int32/UInt64/Bool/Vec3Float/Vec4Float/String` | `ludeo_DataReader_GetFloat/GetInt32/GetUInt64/GetBool/GetVec3Float/GetVec4Float/GetString` |

  Getters return **false** when the attribute is absent — handle it, don't write garbage. `ludeo_DataReader_GetObjectsInfo` must be paired with **`ludeo_ObjectsInfo_Release`** (mandatory — leaks otherwise; hold it across both passes and release once, CR-008). Verify any signature you're unsure of against the **cloned headers** (`Include/Ludeo/DataReader.h`, `*Types.h`), not by guessing. *(The async reader-acquisition flow — `LudeoSelected → GetLudeo → DataReader` — is `phase 5 · task 3`'s; by the time `RestoreTwoPass(reader)` runs you already hold a validated, populated reader.)*

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **data** rows (the LudeoSelected-flow / wait-for-player / overlay / playback-end rows are `phase 5 · task 3`'s):
- Per-group strategy (Group 1/2/3) and what existing game machinery restoration reuses
- Per entity: `objectType` string, Pass (1 / 1a / 1b), spawn function, `id_map` key, approach (reconciliation / manual), and the per-property setter + getter type
- Cross-Entity Reference resolution rows
- The Deferred Property Queue (with ordering)
- Pre-existing-object match-vs-spawn decisions
- Environment restore properties + ordering, and the exclusion list

Skip entities with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Build the Shared Reader Infrastructure (replace the `phase 5 · task 3` stubs)

Restoration extends the infrastructure `phase 5 · task 1` created — it does not duplicate it:

1. **`LudeoStateAdapter`** — already owns the `LudeoObjectId ↔ stable game ID` map (06 §4.3). Add the restore data members: the per-Ludeo `id_map` and the deferred queue. Implement the **real bodies** of `RestoreTwoPass(reader)` and `RestoreEnvironment(reader)` — the stubs `phase 5 · task 3` declared. Confirm before adding members/methods to this project-wide class.
2. **Reader-side object scope** — propose a `LeaveObject`-on-destruct RAII type mirroring the writer-side `ObjectScope` in 06 §7.2, plus `LUDEO_READ_*` helpers wrapping the typed getters and the false-return (missing-attribute) check. Put it alongside `LudeoCaptureMacros.h`. Get confirmation, then proceed. Don't hand-pair `EnterObject`/`LeaveObject` — use the scope (CR-002 applies to the reader too).

Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001. The `id_map` is **per-Ludeo**, keyed by `LudeoObjectId`, valued by the native id `phase 4` chose as the stable anchor; discard it after restoration.

### Step 3: Implement Pass 1 — Spawn + Build the ID Map

Inverse of `phase 5 · task 1` Step 3 (Register/CreateObject). In `RestoreTwoPass`:
- `ludeo_DataReader_GetObjectsInfo` to enumerate captured objects; release it with `ludeo_ObjectsInfo_Release` when done (hold it across both passes, release once — CR-008).
- For each object, dispatch on its `objectType` string (**exact match to `OBJECT_TRACKING.md` / `phase 5 · task 1`**) to the plan's spawn function — type-only, no properties yet.
- Record `id_map[LudeoObjectId] = <native id>` using the same stable-ID anchor `phase 5 · task 1` registered.
- If the plan split Pass 1 into 1a/1b, spawn foundational entities first, then dependents (07 §3.4).

### Step 4: Implement Pass 2 — Apply Properties + Resolve References

Inverse of `phase 5 · task 1` Step 5 (per-property captures). Iterate the objects again; for each, enter via the reader scope and:
- **Non-reference properties** — read with the matching `ludeo_DataReader_Get*` for the property's type and apply via the plan's setter, *after* the object exists. Apply the single captured value — this is snapshot reconstruction, **not** a timeline replay.
- **Reference properties** — read the captured stable game ID, resolve through `id_map`, then set. A missing `id_map` entry is a Pass 1 bug — **fail loud, never substitute null** (07 §3.3, §9.6).
- **Deferred properties** — do not apply here; push `(obj, name, value)` onto the deferred queue (Step 6).
- If a getter returns false (attribute absent), follow the plan's policy for that property — don't write a default over real state silently.

> **Apply from this loop — never defer the apply to the spawned entity's own init callback (07 §3.1, §9.14).** Write each value from `RestoreTwoPass`'s own call stack. Do **not** stash the captured data on the freshly-spawned entity and let it pull-and-apply from its constructor / engine spawn hook / first tick: the engine is **not guaranteed to run that callback** (or to run it before `Begin` / before the freeze lifts) for an entity created during the level boot, so the snapshot is silently dropped and the entity sits at its spawn defaults — and self-application breaks two-pass ordering. The signature is a snapshot that restores on the **first** replay but not the **second back-to-back** one. Keep entity creation/activation in the guaranteed-at-spawn callback; keep the **state apply here**; make it **idempotent** so a late callback re-applying is harmless.

### Step 5: Wire Pre-Existing-Object Reconciliation

Inverse of `phase 5 · task 1` Step 6 (batch registration). For each pre-existing entity type in the plan, implement the match-or-spawn decision: match the captured object to the level-placed instance by stable ID and apply properties to it, rather than spawning a duplicate. Run this against the same level-load hook `phase 5 · task 1` used for batch registration, gated by `LudeoManager::Get().IsRestoring()` so the normal batch-registration path (which `phase 5 · task 1` gated with `!IsRestoring()`) does not also fire. *(`IsRestoring()` is set/cleared by `phase 5 · task 3`; here you only read it.)*

> **Streaming worlds:** match by the **persistent world ID** (cell/region + content ID) — never a handle or address, which change every stream cycle — and reconstruct only the loaded neighborhood the Ludeo captured (`ludeo-integration-docs/game-patterns/open-world-tracking.md` §4–§5).

### Step 6: Reconciliation Wiring + Deferred Queue + Environment

- **Reconciliation entities** (inverse of `phase 5 · task 1` Step 7) — for entities the matrix marks **reconciliation**, route Pass 1 through the game's existing load/recreate path (07 §5.1) instead of a manual spawn; Pass 2 then only resolves references the load path didn't. **Manual** entities use the explicit getters from Steps 3–4.
- **Deferred queue** — Pass 2 **queues** the deferred properties; implement `ApplyDeferred()` to drain them in the plan's recorded order (07 §6). `phase 5 · task 3` calls it on the settle's first tick, when frames are running but input is still held — don't drain inside `RestoreTwoPass`, where the world is frozen.
- **Environment restore** — `RestoreEnvironment(reader)` is called by `phase 5 · task 3`'s apply **after** `RestoreTwoPass` (07 §8.2); implement it to apply the world-singleton properties and honor the plan's exclusion list. **Procedural games** (`CODE_MAP.session_boundaries.assembly == "procedural"`): the `RunMetadata` generation inputs are *not* environment — they are the entry identity `phase 5 · task 3` uses to re-drive the generator **before** entities, with its scaling counter set before any Pass 1 spawn; don't re-apply them here after entities (`ludeo-integration-docs/game-patterns/procedural-world.md` §5).

### Step 7: Reconstruction smoke test — re-run `--ludeo=<id>` and verify state (REQUIRED gate)

This is the gate that closes phase 5 · task 4. `phase 5 · task 3`'s Step 6 already proved the flow validates the selection, boots the correct level, holds it frozen behind the overlay before Play, and resumes via `RoomReady → Begin` — with the apply stubbed. Now the stub is filled, so **re-run the same launch-arg flow** (reuse `phase 5 · task 3`'s trigger — `--ludeo=<id>` / `ludeo.ini`) and verify **state is correctly reconstructed**. Do not declare phase 5 · task 4 done by inspection — actually run it.

1. **Launch with the arg from a cold start** — same as `phase 5 · task 3` Step 6, steps 1–3. The level boots and the real `RestoreTwoPass`/`RestoreEnvironment` now run in the held apply, **before** the room opens and before Play.
2. **Verify two-pass restoration completes with non-zero counts.** In the pre-Play log (the apply runs before `OpenRoom`), Pass 1 spawn count + Pass 2 apply count + deferred-queue-drained count match the plan (**non-zero**). A **zero** count is the bug, not a pass — two distinct causes with the same symptom:
   - (a) the apply ran against a **menu / empty game** (level load skipped or routed to the menu — `07 §2`, mistake #12) — this is a **flow** bug, go back to `phase 5 · task 3` Step 4;
   - (b) the apply ran on an **empty / not-yet-populated reader** (`objectsCount == 0` on an early `GetLudeo` cycle — `07 §2.2.1`, mistake #13, `11-TROUBLESHOOTING §7`) — validation should have ignored that selection, so this is a **flow** bug: go back to `phase 5 · task 3` Step 2.
   Log `GetObjectsInfo`'s `objectsCount` to tell them apart. If counts are non-zero but *wrong*, that's a reconstruction bug — stay here.
3. **No `Expected type` lines** (no attribute type-lock mismatches — `11-TROUBLESHOOTING §1`). A mismatch means the getter type doesn't match the `phase 5 · task 1` setter type for that attribute — fix the getter, not the capture (unless `phase 5 · task 1` is genuinely wrong).
4. **Confirm a cross-entity reference restored correctly** (two-pass exercised) — the resolved target is the right live instance, no fail-loud `id_map` miss.
5. **Restore a second Ludeo back-to-back without quitting** — trigger restore again (another `--ludeo=<id>` / re-inject) in the same process and confirm the **second** Ludeo's state reconstructs fully. Freshly-spawned entities appearing at their spawn defaults (frozen, un-applied) on the **second** replay but not the first is the dropped-init-callback signature (`07 §3.1`, §9.14): the apply was hung on the entity's own init callback, which the engine skipped for entities created during the second level boot. The fix is to apply from the Pass-2 driver loop (Step 4), not to re-add an entity-side apply channel. *(Re-entry teardown itself is `phase 5 · task 3`'s; here you're verifying the **apply** survives a second restore.)*
6. **Confirm the moment before and after Play from the harness evidence** — the `replay` scenario
   ([`agent-test-harness.md`](agent-test-harness.md) → *What a pass must show*). Open the screenshots and read the
   samples:
   - **Before** Play: the frozen frame behind the overlay is the captured mid-level moment — player at the captured
     position with the captured health / inventory / state. **Not** a level-start cinematic, **not** a default spawn
     point, **not** a loading cover (07 §9.11). Compare the sampled values with the Ludeo's recorded ones.
   - **After** Play: the game resumes **instantly** from that frame — no load, no snap; the restored state survives
     the sampled seconds (no respawn / teleport / scripted reset clobbers it); the clock advances without drift.

Step 6 must pass on the harness evidence before declaring phase 5 · task 4 done. If state restores wrong, flag against `07 §10` and go back to the relevant step — do not move on.

**If the game crashes during steps 1–4:** do **not** retry blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame, then classify against `11-TROUBLESHOOTING §6` — for this phase the likely culprits are **`EnterObject`/`LeaveObject` mismatch** (didn't use the scope), **stale `id_map` deref**, **pointer-as-reference**, or **use-after-`ObjectsInfo_Release`**. Fix at the root — don't paper over with null checks or try/catch — then rerun from step 1.

**Iteration discipline — Step 7 is a loop gate, not a one-shot:**

- **Iterate until it passes.** After every failure, make a fix and rerun from step 1. Do not advance by inspection.
- **Propose-confirm-execute every fix.** No autonomous code changes between iterations.
- **Fix at the root each iteration.** Don't add try/catch, null checks, or symptom-masking. If a mapping is missing, the fix belongs in `phase 4`/`phase 5 · task 1`, not a workaround here.
- **Stop iterating and escalate to the user when ANY of these holds:** the same failure recurs after a fix; three distinct attempts haven't resolved it; an iteration sprawls across many files without isolating the cause; or an iteration's investigation has run unusually long with no convergence.
- **When escalating, hand the user a clear summary:** what failed (stack / log lines), the theories tried, what changed in each attempt, what's still unknown — then stop and wait for guidance.

### Summary

```
## State Reconstruction Implementation Summary

**Infrastructure extended/created:**
- LudeoStateAdapter — restore methods filled (RestoreTwoPass, RestoreEnvironment, id_map, deferred queue)
- Reader-side object scope + LUDEO_READ_* helpers — created / already existed

**Entities restored:** X / Y total   (Pass 1a: A, 1b: B)
**Properties applied:** immediate P, deferred Q
**References resolved via id_map:** R   **Fail-loud on miss:** yes
**Pre-existing match-vs-spawn sites:** Z
**Reconciliation entities:** M   **Manual entities:** N
**Environment:** restored after entities, exclusions honored
**Skipped (open questions / low confidence):** S

### Files Modified
- <file 1>
- <file 2>
...

### Next
1. Run `3e-compile-and-fix.md` to verify clean compile both with and without LUDEO_SDK_ENABLED
2. Re-run the launch-arg smoke test (Step 7) and confirm non-zero two-pass counts + correct first frame
3. Walk the 07 §10 validation checklist
```

## Important Notes

- **Restoration is the inverse of tracking.** Every spawn/getter here mirrors a `phase 5 · task 1` create/setter. Same `LudeoStateAdapter`, same `objectType` strings, same stable-ID anchor — if a mapping is missing, the fix belongs in `phase 4`/`phase 5 · task 1`, not a workaround here.
- **Don't touch the flow.** `ApplyHeld()`, the settle, the freezes, the `LudeoSelected` handler and commit, overlay registrations, and entry-identity/level-boot are `phase 5 · task 3`'s. This phase only fills `RestoreTwoPass`/`RestoreEnvironment`/`ApplyDeferred` and the infra they use.
- **Two-pass is mandatory (CR-006).** Pass 1 spawns all objects; Pass 2 applies properties and resolves references. Never single-pass.
- **Fail loud on missing IDs.** A Pass 2 `id_map` miss is a Pass 1 bug — never substitute null (07 §3.3, §9.6).
- **Snapshot, not replay.** Apply each captured value once; do not replay per-tick history.
- **Release `ObjectsInfo`.** `ludeo_DataReader_GetObjectsInfo` must be paired with `ludeo_ObjectsInfo_Release` — hold it across both passes, release exactly once (CR-008).
- **Bracket reads with `IsRestoring()` (read-only here).** It's the switch (`phase 5 · task 3` owns it) that stops `phase 5 · task 1`'s **state-write** paths (batch registration, per-tick capture, `Set*`) from double-creating / overwriting during a restore. **Action sends (`SendAction` / `LUDEO_ACTION`) are NOT gated** — they fire in both Creator and Player Flow so the SDK can score the Ludeo's win/fail conditions during playback (`06 §7`, `07 §2.3`).
- **Restoration is the authority over a repopulated level (07 §9.10).** Loading the level (in `phase 5 · task 3`'s restore flow) spawns its **default** content and runs the game's own init — the world is **not** empty. Reconcile captured objects to placed instances (Step 5, don't blind-spawn duplicates). `phase 5 · task 3` calls your apply only after the game's native spawn is done, and **frozen**, so the live sim can't run over it — the "right map, wrong state" failure.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001). `EnterObject`/`LeaveObject` paired only via the scope (CR-002).
- Do not modify game logic — only add SDK-driven restoration. If a hook site doesn't exist, propose adding it as a separate, named change first.

## Related Commands

- `5b-implement-object-tracking.md` — the inverse: emits the capture code this command reads back (run FIRST, hard prerequisite)
- `5c-plan-state-restoration.md` — produces the `RESTORATION_PLAN.md` this command consumes
- `5d-implement-restoration-flow.md` — built the apply lifecycle + the `RestoreTwoPass`/`RestoreEnvironment` stubs this phase fills (run SECOND, hard prerequisite)
- `3e-compile-and-fix.md` — run after to verify compilation

## ✅ Exit gate — rebuild + run (REQUIRED — do not finish without it)

This phase edited source files, so it is **not done** until the game still builds and runs. **The agent runs the build itself** (CMake / MSBuild / make work headless) and reads the
log, and **runs the game itself** through the agent test harness ([`agent-test-harness.md`](agent-test-harness.md)):

1. **Rebuild — the agent, not the integrator.** **Rebuild** and confirm a **clean build with `LUDEO_SDK_ENABLED=1` and `=0`** — run the build-and-fix
   loop in `3e-compile-and-fix.md` and read the build log.
2. **Run the game and confirm state restores correctly** — re-run the launch-arg smoke test (Step 7):
   verify non-zero two-pass counts, no type-lock mismatch, the correct first frame, and that a
   cross-entity reference restores correctly (two-pass exercised). Walk the validation checklist in
   `07-RESTORATION-PATTERNS.md §10`. This is the payoff check: a playable Ludeo that reconstructs the
   captured moment.

The agent verifies both itself — show the build command and its result, and the harness run (scenario
`replay`): its command, `result.json`'s verdict, the log lines that prove it, and the screenshots you opened.
If it cannot build here (toolchain missing, IDE-only or license-gated build), say so and ask the integrator to
build. **Do not move on until the build and the run both pass.** Only when `intake.runnability.runsTheGame` is
`"integrator"` (or this check is in `integratorPlays`) does the integrator run it, and then beyond the log the
agent relies on their word.

Once the run passes, hand back to the phase-5 orchestrator for gate 4's remaining checks and the
"widen to the next wave?" question. After **wave 1** is green the player flow is proven — phase 6
(`6-actions-orchestrator.md`) may start: actions come last precisely because they can only be verified
against a flow that already replays.
