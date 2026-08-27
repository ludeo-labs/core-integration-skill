# /5e-implement-state-reconstruction — Fill the Two-Pass DataReader Read-Back

> **Stage:** State Restoration — Data Reconstruction (the inverse of `/9`'s capture)
> **Prerequisite:** `/5d-implement-restoration-flow` completed (the apply lifecycle and the `RestoreTwoPass`/`RestoreEnvironment` stubs exist and are already called) and `RESTORATION_PLAN.md` approved
> **Inputs:** `RESTORATION_PLAN.md`, `OBJECT_TRACKING.md`, `CODE_MAP.json`
> **Output:** Real `LudeoStateAdapter::RestoreTwoPass` / `RestoreEnvironment`, reader-side object scope + `LUDEO_READ_*` helpers, the per-Ludeo `id_map`, the deferred-property queue, two-pass spawn + property apply + reference resolution, pre-existing reconciliation, environment restore.

This phase fills the **data** half of restoration — the inverse of `/9`. Where `/9` created objects with `ludeo_DataWriter_CreateObject` and wrote attributes with `ludeo_DataWriter_Set*`, this command spawns them in Pass 1 and reads attributes back with `ludeo_DataReader_Get*` in Pass 2. **`/11` already built when/where this runs** — the `LudeoSelected` handler, the freeze, the single-fire apply gate, and the `RestoreTwoPass`/`RestoreEnvironment` stub call site. Your job is to **fill those stub bodies** — do **not** re-wire the apply gate, the call order, or the freeze (those are `/11`'s contract). Follow the propose-confirm-execute cycle.

## The Seam from `/11`

`/11` declared `RestoreTwoPass(reader)` and `RestoreEnvironment(reader)` as stubs and already calls them from `MaybeApplyRestore()` in the correct order — **`SetCurrent → RestoreTwoPass → RestoreEnvironment`, unpaused, after the level boot, before `Begin`**. This phase replaces the stub bodies with the real two-pass implementation. **Leave the call site, the apply gate (`m_applied`/`m_room_ready`/`m_pending_reader`), the freeze, and the entry-identity-read/level-boot exactly as `/11` wrote them.** If you find yourself touching the `LudeoSelected` handler, the overlay registrations, or the wait-for-player logic, you're in `/11`'s territory — stop.

`IsRestoring()` is owned by `/11` (set `true` in the handler, cleared at the end of the apply). This phase only **reads** it — to gate the pre-existing reconciliation path (Step 5) so `/9`'s batch registration doesn't double-create during a restore.

## Fresh Context Check

This is a sequential workflow — continuing to phase 12 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 12** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `/5b-implement-object-tracking` complete — `LudeoStateAdapter` and `LudeoCaptureMacros.h` exist, `objectType` strings and stable-ID fields are in code
> 3. `/5d-implement-restoration-flow` complete — the apply lifecycle, the `MaybeApplyRestore()` gate, and the `RestoreTwoPass`/`RestoreEnvironment` stubs exist and are called; `IsRestoring()` is live
> 4. `/5c-plan-state-restoration` complete — `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user approved it

`/9` is a hard prerequisite, not just a recommendation: restoration reuses the **same** `LudeoStateAdapter` and the same `objectType` strings that tracking wrote. You cannot restore what `/9` didn't capture. `/11` is a hard prerequisite: without the apply gate and the populated reader it hands you, there is nothing to read back into.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. This is the **data** reading list — the LudeoSelected-flow / wait-for-player / overlay sections (`07 §2/§7`) belong to `/11`, not here.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §3 (two-pass / CR-006), §5 (reconciliation vs manual), §6 (deferred properties), §8 (environment), §9.6 (fail-loud on missing id), §10 (validation checklist). All canonical reconstruction patterns live here.
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §4.3 (the `LudeoStateAdapter` id-map structure you extend), §7.2 (writer-side `ObjectScope` RAII — mirror it for the reader). Restoration is the inverse of these.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-002 (`EnterObject`/`LeaveObject` paired only via the scope), CR-006 (two-pass restoration is mandatory), CR-008 (hold `ObjectsInfo` across both passes, release exactly once).
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **actual restoration API** to emit. Mirror of the DataWriter calls `/9` used:

  | `/9` wrote (DataWriter) | `/12` reads (DataReader) |
  |---|---|
  | `ludeo_DataWriter_CreateObject` | `ludeo_DataReader_GetObjectsInfo` + spawn |
  | `ludeo_DataWriter_SetCurrent` | `ludeo_DataReader_SetCurrent` |
  | `ludeo_DataWriter_EnterObject` / `LeaveObject` | `ludeo_DataReader_EnterObject` / `LeaveObject` |
  | `ludeo_DataWriter_SetFloat/Int32/UInt64/Bool/Vec3Float/Vec4Float/String` | `ludeo_DataReader_GetFloat/GetInt32/GetUInt64/GetBool/GetVec3Float/GetVec4Float/GetString` |

  Getters return **false** when the attribute is absent — handle it, don't write garbage. `ludeo_DataReader_GetObjectsInfo` must be paired with **`ludeo_ObjectsInfo_Release`** (mandatory — leaks otherwise; hold it across both passes and release once, CR-008). Verify any signature you're unsure of against the **cloned headers** (`Include/Ludeo/DataReader.h`, `*Types.h`), not by guessing. *(The async reader-acquisition flow — `LudeoSelected → GetLudeo → DataReader` — is `/11`'s; by the time `RestoreTwoPass(reader)` runs you already hold a validated, populated reader.)*

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **data** rows (the LudeoSelected-flow / wait-for-player / overlay / playback-end rows are `/11`'s):
- Per-group strategy (Group 1/2/3) and what existing game machinery restoration reuses
- Per entity: `objectType` string, Pass (1 / 1a / 1b), spawn function, `id_map` key, approach (reconciliation / manual), and the per-property setter + getter type
- Cross-Entity Reference resolution rows
- The Deferred Property Queue (with ordering)
- Pre-existing-object match-vs-spawn decisions
- Environment restore properties + ordering, and the exclusion list

Skip entities with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Build the Shared Reader Infrastructure (replace the `/11` stubs)

Restoration extends the infrastructure `/9` created — it does not duplicate it:

1. **`LudeoStateAdapter`** — already owns the `LudeoObjectId ↔ stable game ID` map (06 §4.3). Add the restore data members: the per-Ludeo `id_map` and the deferred queue. Implement the **real bodies** of `RestoreTwoPass(reader)` and `RestoreEnvironment(reader)` — the stubs `/11` declared. Confirm before adding members/methods to this project-wide class.
2. **Reader-side object scope** — propose a `LeaveObject`-on-destruct RAII type mirroring the writer-side `ObjectScope` in 06 §7.2, plus `LUDEO_READ_*` helpers wrapping the typed getters and the false-return (missing-attribute) check. Put it alongside `LudeoCaptureMacros.h`. Get confirmation, then proceed. Don't hand-pair `EnterObject`/`LeaveObject` — use the scope (CR-002 applies to the reader too).

Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001. The `id_map` is **per-Ludeo**, keyed by `LudeoObjectId`, valued by the native id `/8` chose as the stable anchor; discard it after restoration.

### Step 3: Implement Pass 1 — Spawn + Build the ID Map

Inverse of `/9` Step 3 (Register/CreateObject). In `RestoreTwoPass`:
- `ludeo_DataReader_GetObjectsInfo` to enumerate captured objects; release it with `ludeo_ObjectsInfo_Release` when done (hold it across both passes, release once — CR-008).
- For each object, dispatch on its `objectType` string (**exact match to `OBJECT_TRACKING.md` / `/9`**) to the plan's spawn function — type-only, no properties yet.
- Record `id_map[LudeoObjectId] = <native id>` using the same stable-ID anchor `/9` registered.
- If the plan split Pass 1 into 1a/1b, spawn foundational entities first, then dependents (07 §3.4).

### Step 4: Implement Pass 2 — Apply Properties + Resolve References

Inverse of `/9` Step 5 (per-property captures). Iterate the objects again; for each, enter via the reader scope and:
- **Non-reference properties** — read with the matching `ludeo_DataReader_Get*` for the property's type and apply via the plan's setter, *after* the object exists. Apply the single captured value — this is snapshot reconstruction, **not** a timeline replay.
- **Reference properties** — read the captured stable game ID, resolve through `id_map`, then set. A missing `id_map` entry is a Pass 1 bug — **fail loud, never substitute null** (07 §3.3, §9.6).
- **Deferred properties** — do not apply here; push `(obj, name, value)` onto the deferred queue (Step 6).
- If a getter returns false (attribute absent), follow the plan's policy for that property — don't write a default over real state silently.

> **Apply from this loop — never defer the apply to the spawned entity's own init callback (07 §3.1, §9.14).** Write each value from `RestoreTwoPass`'s own call stack. Do **not** stash the captured data on the freshly-spawned entity and let it pull-and-apply from its constructor / engine spawn hook / first tick: the engine is **not guaranteed to run that callback** (or to run it before `Begin` / before the freeze lifts) for an entity created during the level boot, so the snapshot is silently dropped and the entity sits at its spawn defaults — and self-application breaks two-pass ordering. The signature is a snapshot that restores on the **first** replay but not the **second back-to-back** one. Keep entity creation/activation in the guaranteed-at-spawn callback; keep the **state apply here**; make it **idempotent** so a late callback re-applying is harmless.

### Step 5: Wire Pre-Existing-Object Reconciliation

Inverse of `/9` Step 6 (batch registration). For each pre-existing entity type in the plan, implement the match-or-spawn decision: match the captured object to the level-placed instance by stable ID and apply properties to it, rather than spawning a duplicate. Run this against the same level-load hook `/9` used for batch registration, gated by `LudeoManager::Get().IsRestoring()` so the normal batch-registration path (which `/9` gated with `!IsRestoring()`) does not also fire. *(`IsRestoring()` is set/cleared by `/11`; here you only read it.)*

### Step 6: Reconciliation Wiring + Deferred Queue + Environment

- **Reconciliation entities** (inverse of `/9` Step 7) — for entities the matrix marks **reconciliation**, route Pass 1 through the game's existing load/recreate path (07 §5.1) instead of a manual spawn; Pass 2 then only resolves references the load path didn't. **Manual** entities use the explicit getters from Steps 3–4.
- **Deferred queue** — after Pass 2 completes, drain the queue in the plan's recorded order (07 §6), before handing control to the player.
- **Environment restore** — `RestoreEnvironment(reader)` is called by `/11`'s apply **after** `RestoreTwoPass` (07 §8.2); implement it to apply the world-singleton properties and honor the plan's exclusion list.

### Step 7: Reconstruction smoke test — re-run `--ludeo=<id>` and verify state (REQUIRED gate)

This is the gate that closes phase 12. `/11`'s Step 6 already proved the flow boots the correct level, freezes before Play, resumes via `RoomReady → Begin`, and pauses under the overlay — with the apply stubbed. Now the stub is filled, so **re-run the same launch-arg flow** (reuse `/11`'s trigger — `--ludeo=<id>` / `ludeo.ini`) and verify **state is correctly reconstructed**. Do not declare phase 12 done by inspection — actually run it.

1. **Launch with the arg from a cold start, press Play** — same as `/11` Step 6, steps 1–3. The level boots; now the real `RestoreTwoPass`/`RestoreEnvironment` run inside the apply.
2. **Verify two-pass restoration completes with non-zero counts.** In the post-Play log, Pass 1 spawn count + Pass 2 apply count + deferred-queue-drained count match the plan (**non-zero**). A **zero** count is the bug, not a pass — two distinct causes with the same symptom:
   - (a) the apply ran against a **menu / empty game** (level load skipped or routed to the menu — `07 §2`, mistake #12) — this is a **flow** bug, go back to `/11` Step 4;
   - (b) the apply ran on an **empty / not-yet-populated reader** (`objectsCount == 0` on an early `GetLudeo` cycle — `07 §2.2.1`, mistake #13, `11-TROUBLESHOOTING §7`) — also **flow**, go back to `/11` Step 2.
   Log `GetObjectsInfo`'s `objectsCount` to tell them apart. If counts are non-zero but *wrong*, that's a reconstruction bug — stay here.
3. **No `Expected type` lines** (no attribute type-lock mismatches — `11-TROUBLESHOOTING §1`). A mismatch means the getter type doesn't match the `/9` setter type for that attribute — fix the getter, not the capture (unless `/9` is genuinely wrong).
4. **Confirm a cross-entity reference restored correctly** (two-pass exercised) — the resolved target is the right live instance, no fail-loud `id_map` miss.
5. **Restore a second Ludeo back-to-back without quitting** — trigger restore again (another `--ludeo=<id>` / re-inject) in the same process and confirm the **second** Ludeo's state reconstructs fully. Freshly-spawned entities appearing at their spawn defaults (frozen, un-applied) on the **second** replay but not the first is the dropped-init-callback signature (`07 §3.1`, §9.14): the apply was hung on the entity's own init callback, which the engine skipped for entities created during the second level boot. The fix is to apply from the Pass-2 driver loop (Step 4), not to re-add an entity-side apply channel. *(Re-entry teardown itself is `/11`'s; here you're verifying the **apply** survives a second restore.)*
6. **Hand off to the player to confirm the post-Play first frame.** Tell the user:
   > "After pressing **Play**, confirm:
   > - The **first visible frame** is the captured mid-level moment — player at the captured position with captured health/inventory/state. **Not** a level-start cinematic, **not** a default spawn point, **not** a fade-in (07 §9.11). (The level loads *on* Play, so a brief load is expected before this frame.)
   > - The restored state survives a few seconds of play (no respawn / teleport / scripted reset clobbers it).
   > - Gameplay proceeds normally without snap-back or drift."

Wait for the player's confirmation on step 6 before declaring phase 12 done. If state restores wrong, flag against `07 §10` and go back to the relevant step — do not move on.

**If the game crashes during steps 1–4:** do **not** retry blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame, then classify against `11-TROUBLESHOOTING §6` — for this phase the likely culprits are **`EnterObject`/`LeaveObject` mismatch** (didn't use the scope), **stale `id_map` deref**, **pointer-as-reference**, or **use-after-`ObjectsInfo_Release`**. Fix at the root — don't paper over with null checks or try/catch — then rerun from step 1.

**Iteration discipline — Step 7 is a loop gate, not a one-shot:**

- **Iterate until it passes.** After every failure, make a fix and rerun from step 1. Do not advance by inspection.
- **Propose-confirm-execute every fix.** No autonomous code changes between iterations.
- **Fix at the root each iteration.** Don't add try/catch, null checks, or symptom-masking. If a mapping is missing, the fix belongs in `/8`/`/9`, not a workaround here.
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
1. Run `/3e-compile-and-fix` to verify clean compile both with and without LUDEO_SDK_ENABLED
2. Re-run the launch-arg smoke test (Step 7) and confirm non-zero two-pass counts + correct first frame
3. Walk the 07 §10 validation checklist
```

## Important Notes

- **Restoration is the inverse of tracking.** Every spawn/getter here mirrors a `/9` create/setter. Same `LudeoStateAdapter`, same `objectType` strings, same stable-ID anchor — if a mapping is missing, the fix belongs in `/8`/`/9`, not a workaround here.
- **Don't touch the flow.** The apply gate, freeze, `LudeoSelected` handler, overlay registrations, and entry-identity/level-boot are `/11`'s. This phase only fills `RestoreTwoPass`/`RestoreEnvironment` and the infra they use.
- **Two-pass is mandatory (CR-006).** Pass 1 spawns all objects; Pass 2 applies properties and resolves references. Never single-pass.
- **Fail loud on missing IDs.** A Pass 2 `id_map` miss is a Pass 1 bug — never substitute null (07 §3.3, §9.6).
- **Snapshot, not replay.** Apply each captured value once; do not replay per-tick history.
- **Release `ObjectsInfo`.** `ludeo_DataReader_GetObjectsInfo` must be paired with `ludeo_ObjectsInfo_Release` — hold it across both passes, release exactly once (CR-008).
- **Bracket reads with `IsRestoring()` (read-only here).** It's the switch (`/11` owns it) that stops `/9`'s **state-write** paths (batch registration, per-tick capture, `Set*`) from double-creating / overwriting during a restore. **Action sends (`SendAction` / `LUDEO_ACTION`) are NOT gated** — they fire in both Creator and Player Flow so the SDK can score the Ludeo's win/fail conditions during playback (`06 §7`, `07 §2.3`).
- **Restoration is the authority over a repopulated level (07 §9.10).** Loading the level (in `/11`'s apply) spawns its **default** content and runs the game's own init — the world is **not** empty. Reconcile captured objects to placed instances (Step 5, don't blind-spawn duplicates) and apply restored values **after** level init settles. The freeze (`/11`) holds until the apply, so the live sim can't run over your apply — the "right map, wrong state" failure.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001). `EnterObject`/`LeaveObject` paired only via the scope (CR-002).
- Do not modify game logic — only add SDK-driven restoration. If a hook site doesn't exist, propose adding it as a separate, named change first.

## Related Commands

- `/5b-implement-object-tracking` — the inverse: emits the capture code this command reads back (run FIRST, hard prerequisite)
- `/5c-plan-state-restoration` — produces the `RESTORATION_PLAN.md` this command consumes
- `/5d-implement-restoration-flow` — built the apply lifecycle + the `RestoreTwoPass`/`RestoreEnvironment` stubs this phase fills (run SECOND, hard prerequisite)
- `/3e-compile-and-fix` — run after to verify compilation

## ✅ Exit gate — rebuild + run (REQUIRED — do not finish without it)

This phase edited source files, so it is **not done** until the game still builds and runs. The agent
cannot see a running game, so this gate falls to the integrator — make the ask explicit and wait:

1. **Rebuild** and confirm a **clean build with `LUDEO_SDK_ENABLED=1` and `=0`** — run the build-and-fix
   loop in `/3e-compile-and-fix` and read the build log.
2. **Run the game and confirm state restores correctly** — re-run the launch-arg smoke test (Step 7):
   verify non-zero two-pass counts, no type-lock mismatch, the correct first frame, and that a
   cross-entity reference restores correctly (two-pass exercised). Walk the validation checklist in
   `07-RESTORATION-PATTERNS.md §10`. This is the payoff check: a playable Ludeo that reconstructs the
   captured moment.

The agent reads build/run logs where they exist but **cannot truly verify** a clean build or a live run
on its own — beyond the logs it relies on the integrator's word, and if they confirm without checking,
that's their call. **Do not declare the integration complete until the user confirms both** (or
explicitly skips).
