# /11-implement-state-restoration — Build LudeoStateAdapter + LudeoSelected Handling

> **Stage:** State Restoration — Implementation
> **Prerequisite:** `/10-plan-state-restoration` completed and `RESTORATION_PLAN.md` approved
> **Inputs:** `RESTORATION_PLAN.md`, `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`
> **Output:** `LudeoStateAdapter` restore path wired into the game, `LudeoSelected` interrupt handling, two-pass restoration code, deferred-property queue, environment restore, wait-for-player flow

Read the approved `RESTORATION_PLAN.md` and emit the restoration code — the **inverse of `/9`**. Where `/9` created objects with `ludeo_DataWriter_CreateObject` and wrote attributes with `ludeo_DataWriter_Set*`, this command spawns them in Pass 1 and reads attributes back with `ludeo_DataReader_Get*` in Pass 2. Follow the propose-confirm-execute cycle.

## Fresh Context Check

**Before proceeding, verify this is a fresh chat:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. Please open a new Agent window (Ctrl+Shift+I / Cmd+Shift+I) and run `/11-implement-state-restoration` there for best results."
- If this is a fresh conversation, proceed.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `/9-implement-object-tracking` complete — `LudeoStateAdapter` and `LudeoCaptureMacros.h` exist, `objectType` strings and stable-ID fields are in code
> 3. `/10-plan-state-restoration` complete — `ludeo-integration-plan/RESTORATION_PLAN.md` exists
> 4. User has reviewed and approved the plan

`/9` is a hard prerequisite, not just a recommendation: restoration reuses the **same** `LudeoStateAdapter` and the same `objectType` strings that tracking wrote. You cannot restore what `/9` didn't capture.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §2 (LudeoSelected flow), §3 (two-pass / CR-006), §5 (reconciliation vs manual), §6 (deferred properties), §7 (wait-for-player), §8 (environment). All canonical restoration patterns live here.
- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` — §4.3 (the `LudeoStateAdapter` id-map structure you extend), §7.2 (writer-side `ObjectScope` RAII — mirror it for the reader). Restoration is the inverse of these.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-006 (two-pass restoration is mandatory), **CR-010 (the game MUST be paused — simulation frozen — while the overlay awaits the player after a Ludeo loads; resume comes via `RoomReady → Begin`, the gameplay-session-start chain `/4` wired in `05-LIFECYCLE-MANAGEMENT.md`; `ResumeGameRequest` is mid-play only)**.
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **actual restoration API** to emit. Mirror of the DataWriter calls `/9` used:

  | `/9` wrote (DataWriter) | `/11` reads (DataReader) |
  |---|---|
  | `ludeo_DataWriter_CreateObject` | `ludeo_DataReader_GetObjectsInfo` + spawn |
  | `ludeo_DataWriter_SetCurrent` | `ludeo_DataReader_SetCurrent` |
  | `ludeo_DataWriter_EnterObject` / `LeaveObject` | `ludeo_DataReader_EnterObject` / `LeaveObject` |
  | `ludeo_DataWriter_SetFloat/Int32/UInt64/Bool/Vec3Float/Vec4Float/String` | `ludeo_DataReader_GetFloat/GetInt32/GetUInt64/GetBool/GetVec3Float/GetVec4Float/GetString` |

  Reader setup is **async, and the reader is delivered in a callback** — not a synchronous chain: `LudeoSelected` (gives a `ludeoId`) → `ludeo_Session_GetLudeo(ludeoId)` *(async)* → its completion callback hands you `LudeoSessionGetLudeoCallbackParams::dataReader` (when `resultCode == Success`) → `ludeo_DataReader_SetCurrent` → `ludeo_DataReader_GetObjectsInfo` (iterate) → **`ludeo_ObjectsInfo_Release`** (mandatory — leaks otherwise). **This exact two-callback flow is spelled out in `07-RESTORATION-PATTERNS.md §2` — emit it from there; don't re-derive it from the headers.** Notifications: `ludeo_Session_AddNotifyLudeoSelected` (interrupt) plus the overlay control set `ludeo_Session_AddNotifyPauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` (mid-play pause/resume/menu — see Step 3 and 07 §2.4). **There is no `ludeo_GameplaySession_AddNotifyPlayerReady`.** The **post-restore resume** is delivered via `RoomReady → Begin` (the chain `/4` wired in `05-LIFECYCLE-MANAGEMENT.md`); `ResumeGameRequest` is the mid-play overlay-closed resume only. Getters return **false** when the attribute is absent — handle it, don't write garbage. Verify any signature you're unsure of against the **cloned headers** (`Include/Ludeo/Session.h`, `DataReader.h`, `*Types.h`), not by guessing.

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract:
- Per-group strategy (Group 1/2/3) and what existing game machinery restoration reuses
- The LudeoSelected interrupt flow (hooks for tear-down + level load)
- Per entity: `objectType` string, Pass (1 / 1a / 1b), spawn function, `id_map` key, approach (reconciliation / manual), and the per-property setter + getter type
- Cross-Entity Reference resolution rows
- The Deferred Property Queue (with ordering)
- Pre-existing-object match-vs-spawn decisions
- Environment restore properties + ordering, and the exclusion list
- Wait-for-player mechanism

Skip entities with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Ensure Shared Infrastructure Exists

Restoration extends the infrastructure `/9` created — it does not duplicate it:

1. **`LudeoStateAdapter`** — already owns the `LudeoObjectId ↔ stable game ID` map (06 §4.3). Add the restore surface: `RestoreTwoPass(reader)`, `RestoreEnvironment(reader)`, the per-Ludeo `id_map`, and the deferred queue. Confirm before adding methods to this project-wide class.
2. **Reader-side object scope** — propose a `LeaveObject`-on-destruct RAII type mirroring the writer-side `ObjectScope` in 06 §7.2, plus `LUDEO_READ_*` helpers wrapping the typed getters and the false-return (missing-attribute) check. Put it alongside `LudeoCaptureMacros.h`. Get confirmation, then proceed. Don't hand-pair `EnterObject`/`LeaveObject` — use the scope (CR-002 applies to the reader too).

Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001.

### Step 3: Wire the LudeoSelected Interrupt Handler

This is the entry point — the inverse of the session lifecycle entry `/4` wired. Per 07 §2:
- Register the handler via `ludeo_Session_AddNotifyLudeoSelected` (at session creation, next to the other notify registrations).
- **Also register the overlay control notifications (07 §2.4) in the same place — these are what pause the game while the Ludeo overlay is up, and they are the most-forgotten piece because they are not on the restore call path:**
  - `ludeo_Session_AddNotifyPauseGameRequest` → **pause/freeze the simulation** (not just input).
  - `ludeo_Session_AddNotifyResumeGameRequest` → **resume** (mid-play overlay close only — the post-restore resume goes through `RoomReady → Begin`, see Step 8).
  - `ludeo_Session_AddNotifyBackToMenuRequest` → tear down the current Ludeo, return to menu.
  - Optionally `ludeo_Session_AddNotifyMuteRequest` → mute audio.
  These are **session-lifetime** (register once at session creation; if `/4` created the session, add them where the other `AddNotify*` calls live). **The post-restore resume goes through `RoomReady → Begin` — the same chain `/4` already wired for tracking-start (`05-LIFECYCLE-MANAGEMENT.md`); playback reuses it. Do not wire pause/resume to `ludeo_GameplaySession_AddNotifyPlayerReady` — that notification does not exist in this SDK — and do not treat `ResumeGameRequest` as the post-restore resume (it's only the mid-play overlay-closed resume).**
- In the handler: **marshal off the SDK notification thread immediately** (queue to main thread — never block it), then run the plan's interrupt flow: tear down any active gameplay session and room (the SDK `Session` stays alive), cancel in-flight transitions, suppress non-restoration input, read the level id from Ludeo metadata, load it, block until loaded.
- **Set `LudeoManager` restoration state `true` *before* the level loads.** `/9` left an `IsRestoring()` seam (`m_is_restoring`, default `false`) and gated batch registration with `!IsRestoring()`. Flip it to `true` at the very start of this flow — before the level-load hook fires — so `/9`'s `OnLevelLoadComplete` batch registration is suppressed and the match-or-spawn reconciliation in Step 6 (gated on `IsRestoring()`) is the path that runs. If you skip this, both fire and pre-existing objects are double-created. Add the setter on `LudeoManager` (e.g. `void SetRestoring(bool)`), since `/9` only emitted the read-only stub.
- Acquire the reader — **`ludeo_Session_GetLudeo` is async and does not return it.** Pass the `ludeoId` from the `LudeoSelected` callback; the `DataReader` is delivered in `GetLudeo`'s completion callback (`LudeoSessionGetLudeoCallbackParams::dataReader`, only when `resultCode == Success`). From that callback — marshalled to the main thread — call `ludeo_DataReader_SetCurrent(dataReader)` then `LudeoStateAdapter::RestoreTwoPass(dataReader)`. The full two-callback flow (`LudeoSelected → GetLudeo → reader`) is in `07 §2`; emit it from there rather than re-deriving it from the SDK headers.

Show each insertion as propose-confirm-execute. If a tear-down or level-load hook the plan named doesn't exist, propose adding it as a separate, named change first.

### Step 3.5: Local-testing hook — launch-arg Ludeo id

So devs can exercise restoration **without going through the Ludeo overlay**, add a launch argument that synthesizes a `LudeoSelected` for the handler wired in Step 3. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader` (07 §2). **Do not fake the `DataReader`** or short-circuit `GetLudeo`.

Implementation:
- **Parse the arg at startup** using the game's existing arg conventions — `--ludeo=<id>` (POSIX-style), `-ludeo <id>` (Unreal's `FParse::Value`), proprietary command-line table, etc. Match the engine; don't prescribe a format.
- **Stash the id** on `LudeoManager` (e.g. `m_pending_local_ludeo_id`); don't act on it during early init.
- **Dispatch once the session is ready** — after `ludeo_Session_Activate` succeeds and Step 3's `AddNotifyLudeoSelected` is registered (earlier, `GetLudeo` can't be called and the chain has nothing to drive). Cleanest hook: the session-activation success callback, or a one-shot check on the first `ludeo_Tick` after activation. Dispatch by invoking the same handler the SDK calls (e.g. `OnLudeoSelected(ludeoId)` helper), then clear the stash so it fires once.
- Wrap in `#if LUDEO_SDK_ENABLED` (CR-001). The arg is a no-op when `LUDEO_SDK_ENABLED=0`.

Result: launching the game with `--ludeo=<id>` (or engine-equivalent) runs the full restoration flow end-to-end — `LudeoSelected → GetLudeo → DataReader → restore → wait-for-player → RoomReady → Begin` — without needing the platform overlay.

### Step 4: Implement Pass 1 — Spawn + Build the ID Map

Inverse of `/9` Step 3 (Register/CreateObject). In `RestoreTwoPass`:
- `ludeo_DataReader_GetObjectsInfo` to enumerate captured objects; release it with `ludeo_ObjectsInfo_Release` when done.
- For each object, dispatch on its `objectType` string (**exact match to `OBJECT_TRACKING.md` / `/9`**) to the plan's spawn function — type-only, no properties yet.
- Record `id_map[LudeoObjectId] = <native id>` using the same stable-ID anchor `/9` registered.
- If the plan split Pass 1 into 1a/1b, spawn foundational entities first, then dependents (07 §3.4).

### Step 5: Implement Pass 2 — Apply Properties + Resolve References

Inverse of `/9` Step 5 (per-property captures). Iterate the objects again; for each, enter via the reader scope and:
- **Non-reference properties** — read with the matching `ludeo_DataReader_Get*` for the property's type and apply via the plan's setter, *after* the object exists. Apply the single captured value — this is snapshot reconstruction, **not** a timeline replay.
- **Reference properties** — read the captured stable game ID, resolve through `id_map`, then set. A missing `id_map` entry is a Pass 1 bug — **fail loud, never substitute null** (07 §3.3, §9.6).
- **Deferred properties** — do not apply here; push `(obj, name, value)` onto the deferred queue (Step 7).
- If a getter returns false (attribute absent), follow the plan's policy for that property — don't write a default over real state silently.

### Step 6: Wire Pre-Existing-Object Reconciliation

Inverse of `/9` Step 6 (batch registration). For each pre-existing entity type in the plan, implement the match-or-spawn decision: match the captured object to the level-placed instance by stable ID and apply properties to it, rather than spawning a duplicate. Run this against the same level-load hook `/9` used for batch registration, gated by `LudeoManager::Get().IsRestoring()` so the normal batch-registration path (which `/9` gated with `!IsRestoring()`) does not also fire.

### Step 7: Reconciliation Wiring + Deferred Queue + Environment

- **Reconciliation entities** (inverse of `/9` Step 7) — for entities the matrix marks **reconciliation**, route Pass 1 through the game's existing load/recreate path (07 §5.1) instead of a manual spawn; Pass 2 then only resolves references the load path didn't. **Manual** entities use the explicit getters from Steps 4–5.
- **Deferred queue** — after Pass 2 completes, drain the queue in the plan's recorded order (07 §6), before handing control to the player.
- **Environment restore** — call `RestoreEnvironment(reader)` **after** entity restoration (07 §8.2); apply the world-singleton properties; honor the plan's exclusion list.

### Step 8: Wait-For-Player + Summary

- **Wait-for-player** (07 §7, **CR-010**) — the instant restoration finishes, the game **MUST be paused: freeze the simulation tick, not just input**, and stay frozen while the overlay waits for the player. Nothing in the world may advance during this wait — a running sim overwrites the restored state. **Resume is the gameplay-session-start chain, reused:** when the player presses Play on the Ludeo overlay, the SDK runs `OpenRoom → AddPlayer → RoomReady → Begin` — the same chain `/4` already wired for tracking-start (see `05-LIFECYCLE-MANAGEMENT.md`). In your existing `OnRoomReadyCallback`, call `TryBeginGameplaySession()` and **unpause**. Do **not** wire resume to `ludeo_GameplaySession_AddNotifyPlayerReady` (it does not exist in this SDK) and do **not** treat `ResumeGameRequest` as the post-restore resume (that's the mid-play overlay-closed resume). Don't draw your own "press to begin" prompt unless the game genuinely needs one — the overlay owns that UI. Reuse the game's pause system if it has one; build a minimal tick-freeze if not (common for Group 3). **At the `RoomReady`/`Begin` resume, clear restoration state (`SetRestoring(false)`)** so later level loads register objects normally again — restoration is over once the player takes control.
- **Summary:**

```
## State Restoration Implementation Summary

**Infrastructure extended/created:**
- LudeoStateAdapter — restore methods added (RestoreTwoPass, RestoreEnvironment, id_map, deferred queue)
- Reader-side object scope + LUDEO_READ_* helpers — created / already existed

**LudeoSelected handler:** wired at <file:line>, marshals off notification thread: yes
**Entities restored:** X / Y total   (Pass 1a: A, 1b: B)
**Properties applied:** immediate P, deferred Q
**References resolved via id_map:** R   **Fail-loud on miss:** yes
**Pre-existing match-vs-spawn sites:** Z
**Reconciliation entities:** M   **Manual entities:** N
**Environment:** restored after entities, exclusions honored
**Wait-for-player:** pauses simulation: yes   resume control: <button>
**Skipped (open questions / low confidence):** S

### Files Modified
- <file 1>
- <file 2>
...

### Next
1. Run `/5-compile-and-fix` to verify clean compile both with and without LUDEO_SDK_ENABLED
2. Trigger LudeoSelected from the main menu and mid-gameplay; confirm clean restoration both paths
3. Walk the 07 §10 validation checklist
4. Run **Step 9** (Local Smoke Test) — required before declaring phase 11 done.
```

### Step 9: Local smoke test — run with `--ludeo=<id>` and verify load + pause (REQUIRED gate)

This is the gate that closes phase 11. With Step 3.5 wired and the rest of the restore path in place, **run the game with the launch arg** and **verify it pauses with the Ludeo loaded** before handing off to the player. Do not declare phase 11 done by inspection — actually run it.

1. **Launch the game with the arg.** Use any captured ludeo id from `/9` testing. Form depends on the engine (`--ludeo=<id>`, `-ludeo <id>`, etc., per Step 3.5).
2. **Verify the Ludeo loads properly.** Inspect the session/restoration log:
   - `LudeoSelected` (synthesized by Step 3.5) fires with the expected `ludeoId`.
   - `GetLudeo` completion callback fires with `resultCode == Success` and a non-null `dataReader`.
   - Two-pass restoration completes — Pass 1 spawn count + Pass 2 apply count + deferred queue drained match the plan.
   - No `Expected type` lines (no attribute type-lock mismatches — `11-TROUBLESHOOTING §1`).
3. **Verify the game is paused (CR-010).** Simulation tick frozen, the level is loaded and populated with restored state, the Ludeo overlay shows the Play button. Nothing in the world advances — no physics, no AI, no scripted ticks.
4. **Hand off to the player and stop.** Tell the user:
   > "The Ludeo is loaded and the game is paused. Click **Play** on the overlay, then confirm the restored state matches the captured moment (entity positions, values, references), the game receives `RoomReady` and unpauses, and gameplay proceeds without snap-back or drift."

   Wait for the player's confirmation before declaring phase 11 done. If any of steps 2, 3, or the player's visual check fails, flag the failure against `07 §10` / CR-010 and go back to the relevant earlier step — do not move on.

**If the game crashes during steps 1–3:** do **not** retry the launch blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame and the thread it crashed on, then classify against `11-TROUBLESHOOTING §6` (null `DataReader` deref, wrong-thread SDK call, `EnterObject`/`LeaveObject` mismatch, stale `id_map` deref, pointer-as-reference, use-after-`ObjectsInfo_Release`, SDK call before `Activate`). Fix at the root — don't paper over with null checks or try/catch — then rerun the full smoke test from step 1.

**Iteration discipline — Step 9 is a loop gate, not a one-shot:**

- **Iterate until it passes.** After every failure (crash or wrong-behavior), make a fix and rerun the full smoke test from step 1. Do not advance to "phase 11 done" by inspection.
- **Propose-confirm-execute every fix.** No autonomous code changes between iterations — each fix is shown to the user, approved, then applied.
- **Fix at the root each iteration.** Don't add try/catch, null checks, or symptom-masking to make the test pass — that paper-mâchés the failure into production. If you're tempted, escalate instead.
- **Stop iterating and escalate to the user when ANY of these holds:**
  - The **same failure mode recurs** after a fix attempt — the root cause was misidentified; further blind iteration just digs the hole.
  - **Three distinct attempts** on the same failure haven't resolved it (different theories tried, still failing).
  - A single iteration **sprawls across many files** without isolating the cause — you're guessing, not diagnosing; narrow scope first.
  - A single iteration's investigation or fix has run **unusually long** with no convergence — sunk-cost gate; reassess.
- **When escalating, hand the user a clear summary:** what failed (stack / log lines), the theories tried, what was changed in each attempt, what's still unknown — then stop and wait for guidance. Do **not** silently declare done.

## Important Notes

- **Restoration is the inverse of tracking.** Every spawn/getter here mirrors a `/9` create/setter. Same `LudeoStateAdapter`, same `objectType` strings, same stable-ID anchor — if a mapping is missing, the fix belongs in `/8`/`/9`, not a workaround here.
- **Propose-confirm-execute** for every change. Extending `LudeoStateAdapter` and adding the reader scope are project-wide — get explicit approval.
- **Two-pass is mandatory (CR-006).** Pass 1 spawns all objects; Pass 2 applies properties and resolves references. Never single-pass.
- **Fail loud on missing IDs.** A Pass 2 `id_map` miss is a Pass 1 bug — never substitute null.
- **Snapshot, not replay.** Apply each captured value once; do not replay per-tick history.
- **Release `ObjectsInfo`.** `ludeo_DataReader_GetObjectsInfo` must be paired with `ludeo_ObjectsInfo_Release`.
- **Bracket restoration with `IsRestoring()`.** Set it `true` before the level loads and `false` on player resume — it's the switch that stops `/9`'s batch registration from double-creating pre-existing objects during a restore.
- **The overlay drives pause/resume — register it (07 §2.4).** `PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` are session-lifetime notifications the game must register at session creation. Their job is **mid-play overlay open/close**: pause when the overlay reopens, resume when it closes. Skipping them is the "loads the right map but never pauses while the overlay is up" failure. The **post-restore resume is separate** — it comes through `RoomReady → Begin` (the chain `/4` wired). There is no `PlayerReady`.
- **Restoration is the authority over a repopulated level (07 §9.10).** Loading the level spawns its **default** content and runs the game's own init — the world is **not** empty. Reconcile captured objects to placed instances (Step 6, don't blind-spawn duplicates), apply restored values **after** level init settles, and keep the simulation **frozen** (Step 8) until `ResumeGameRequest`. If the live sim or the level's default init runs over your apply, the restored snapshot is silently overwritten — the "right map, wrong state" failure.
- **Never block the SDK notification thread.** `LudeoSelected` arrives on the SDK's thread — marshal immediately.
- **Environment after entities; pause simulation, not just input.**
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001). `EnterObject`/`LeaveObject` paired only via the scope (CR-002).
- Do not modify game logic — only add SDK-driven restoration. If a hook site doesn't exist, propose adding it as a separate, named change first.

## Related Commands

- `/9-implement-object-tracking` — the inverse: emits the capture code this command reads back (run FIRST, hard prerequisite)
- `/10-plan-state-restoration` — produces the `RESTORATION_PLAN.md` this command consumes (run SECOND)
- `/5-compile-and-fix` — run after to verify compilation

## Next Steps

After running this command:
1. Run `/5-compile-and-fix` with `LUDEO_SDK_ENABLED=1` and `=0`
2. **Local trigger:** launch the game with `--ludeo=<id>` (or engine-equivalent) and verify the full chain runs end-to-end without the platform overlay (Step 3.5)
3. Receive LudeoSelected at the main menu — verify clean restoration + wait-for-player
4. Receive LudeoSelected mid-gameplay — verify gameplay session + room tear-down then clean restoration
5. Confirm a cross-entity reference restores correctly (two-pass exercised)
6. **Press Play on the Ludeo overlay after a Ludeo loads — the game receives `RoomReady`, the gameplay session begins (`Begin`), and the game unpauses** (CR-010, 07 §7). Until then it stays frozen.
7. **Open the Ludeo overlay during playback — the game must pause (frozen tick); close it — the game resumes** (`PauseGameRequest`/`ResumeGameRequest`, mid-play overlay open/close, 07 §2.4)
8. **Confirm restored state survives resume** — spot-check that the live sim and the level's default init didn't overwrite restored values (07 §9.10)
9. Walk the validation checklist in `07-RESTORATION-PATTERNS.md §10`
