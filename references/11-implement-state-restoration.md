# /11-implement-state-restoration — Build LudeoStateAdapter + LudeoSelected Handling

> **Stage:** State Restoration — Implementation
> **Prerequisite:** `/10-plan-state-restoration` completed and `RESTORATION_PLAN.md` approved
> **Inputs:** `RESTORATION_PLAN.md`, `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`
> **Output:** `LudeoStateAdapter` restore path wired into the game, `LudeoSelected` interrupt handling, two-pass restoration code, deferred-property queue, environment restore, wait-for-player flow

Read the approved `RESTORATION_PLAN.md` and emit the restoration code — the **inverse of `/9`**. Where `/9` created objects with `ludeo_DataWriter_CreateObject` and wrote attributes with `ludeo_DataWriter_Set*`, this command spawns them in Pass 1 and reads attributes back with `ludeo_DataReader_Get*` in Pass 2. Follow the propose-confirm-execute cycle.

## Fresh Context Check

This is a sequential workflow — continuing to phase 11 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 11** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

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
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), CR-006 (two-pass restoration is mandatory), **CR-010 (the game MUST be frozen — simulation frozen — from `LudeoSelected` until the apply on Play, while the overlay awaits the player; the level loads + state restores in the apply, then resume comes via `RoomReady → Begin`, the gameplay-session-start chain `/4` wired in `05-LIFECYCLE-MANAGEMENT.md`; `ResumeGameRequest` is mid-play only)**.
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
- In the handler: **marshal off the SDK notification thread immediately**. Then, in this exact order:
  1. **`SetRestoring(true)` FIRST** — this arms the §9.11 pre-match skips (cutscenes, countdowns, default-spawn teleports, etc.); they fire **later**, during the level load inside the apply (Step 8), and hit the gate then. It also suppresses `/9`'s batch registration. Add the setter on `LudeoManager` if `/9` only emitted the read-only stub.
  2. **Stash `params->ludeoId` (e.g. `m_pending_ludeo_id`).** It feeds **two** calls: `ludeo_Session_GetLudeo` (the state reader) **and** `OpenRoom`. Passing it to `OpenRoom` is what makes the rerun a **scored Player-Flow replay**; `nullptr` opens a Creator-Flow recording and the rerun silently isn't scored (`05 §6.2`, §6.11). Also **re-arm the single-fire apply gate** here: `m_pending_reader = nullptr; m_room_ready = false`.
  3. **If a Ludeo is already playing** (another `LudeoSelected` arrived mid-play), run `EndCurrentLudeo()` first — tear down its gameplay session + room (`ludeo_GameplaySession_End(isAbort=true)` → `RemovePlayer` → `CloseRoom`, SDK `Session` stays alive) **and reset prior-Ludeo state** (release the old reader, re-arm `IsRestoring`, replace `m_pending_ludeo_id`) so the previous play can't leak in (`05 §6.11`). Cancel in-flight transitions; suppress non-restoration input. (At the menu there's no run to tear down.)
  4. **Freeze the simulation now** — the instant `LudeoSelected` fires (freeze the tick, not just input — CR-010). The game **may already be frozen** at the menu; set the restoration-freeze bit regardless. It holds through the `GetLudeo` + room + wait-for-Play window and unpauses only at the top of the apply (Step 8). **Do not load any level here** — the target is unknown until the reader is in hand.
  5. **Dispatch `ludeo_Session_GetLudeo(m_pending_ludeo_id)` AND `OpenRoom(m_pending_ludeo_id)` now — they race; no ordering guarantee.** Nothing about which level loads is decided yet (the level loads in the apply, Step 8).
     - **`OpenRoom` MUST pass `m_pending_ludeo_id` as `OpenRoomParams.ludeoId`** and is dispatched **here in the handler**, *not* hung off the `/4` "OpenRoom on entering gameplay" path — in player flow no level loads during the handler, so that path never fires; you call `OpenRoom` directly. `OnRoomOpened → AddPlayer → OnPlayerAdded` run now, so `player_added` is set (`Begin` still waits on `room_ready`).
     - **`GetLudeo` is async** — its callback delivers the `DataReader` in `LudeoSessionGetLudeoCallbackParams::dataReader` (only when `resultCode == Success`). **In that callback, CACHE the reader (e.g. `m_pending_reader`), then call `MaybeApplyRestore()` — do NOT apply state directly.** The apply is gated on `m_pending_reader && m_room_ready` and fires **once**, when the last of the two arrives (Step 8), so the game is ticking while movement/physics/AI react to the restored values (CR-010, 07 §2).

Show each insertion as propose-confirm-execute. If a tear-down or level-load hook the plan named doesn't exist, propose adding it as a separate, named change first.

### Step 3.5: Local-testing hook — launch-arg Ludeo id (plus a persistent `ludeo.ini` alternative)

So devs can exercise restoration **without going through the Ludeo overlay**, add a launch argument that synthesizes a `LudeoSelected` for the handler wired in Step 3. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader` (07 §2). **Do not fake the `DataReader`** or short-circuit `GetLudeo`.

Implementation:
- **Parse the arg at startup** using the game's existing arg conventions — `--ludeo=<id>` (POSIX-style), `-ludeo <id>` (Unreal's `FParse::Value`), proprietary command-line table, etc. Match the engine; don't prescribe a format.
- **Also accept `activationLudeoId` from `ludeo.ini`** (see `04 §4`). The launch arg and the config field do the same thing — auto-fire `LudeoSelected` once the session is ready — but the config field is **persistent** across runs (handy for a debug setup), while the launch arg is **one-off** (handy for CLI invocations). Support both: if the launch arg is present, prefer it; otherwise fall back to `LudeoConfig::Instance().GetActivationLudeoId()`. Either path stashes the id and dispatches the same way.
- **Stash the id** on `LudeoManager` (e.g. `m_pending_local_ludeo_id`); don't act on it during early init.
- **Dispatch once the session is ready** — after `ludeo_Session_Activate` succeeds and Step 3's `AddNotifyLudeoSelected` is registered (earlier, `GetLudeo` can't be called and the chain has nothing to drive). Cleanest hook: the session-activation success callback, or a one-shot check on the first `ludeo_Tick` after activation. Dispatch by invoking the same handler the SDK calls (e.g. `OnLudeoSelected(ludeoId)` helper), then clear the stash so it fires once.
- Wrap in `#if LUDEO_SDK_ENABLED` (CR-001). The arg is a no-op when `LUDEO_SDK_ENABLED=0`.

Result: launching the game with `--ludeo=<id>` (or engine-equivalent), **or** setting `activationLudeoId` in `ludeo.ini`, runs the full restoration flow end-to-end — `LudeoSelected → GetLudeo → DataReader → restore → wait-for-player → RoomReady → Begin` — without needing the platform overlay.

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

- **Wait-for-player + the single-fire apply** (07 §7, **CR-010**) — the game has been **frozen since `LudeoSelected`** (Step 3, step 4); `OpenRoom(ludeoId)` and `GetLudeo` were dispatched in the handler and race. The platform **withholds `RoomReady` until the player presses Play**. Put the apply in a **`MaybeApplyRestore()` helper called from BOTH `OnGetLudeoCallback` and `OnRoomReadyCallback`** — it fires **once**, when the last of `{m_pending_reader cached, m_room_ready}` arrives. `OnRoomReadyCallback` just sets `m_room_ready = true` then calls it. In `MaybeApplyRestore()`, in this **exact order**:
  1. **Gate:** `if (!m_is_restoring || !m_room_ready || !m_pending_reader) return;` — a true single-fire.
  2. `SetPaused(false)` / clear the restoration-freeze — **unpause FIRST** (the level load *and* the apply need the game running so movement/physics/AI can settle on restored values).
  3. **Read the entry identity from the reader** (e.g. `start_mode`, `room_x`, `room_y`) and **reach active gameplay** — load THAT level / boot the run (load the single generic level if the game has no rooms). **At the menu / startup there is no player or world — you *boot* one here**, not restore into the menu (it silently no-ops, `07 §2`): scene-based → load level + spawn; state-machine entry / no per-level scene (DFU) → trigger `StartGameBehaviour`. Pre-match sequences fire during this load and silently skip via the gate.
  4. `SetCurrent(m_pending_reader)` → `RestoreTwoPass(m_pending_reader)` → `RestoreEnvironment(m_pending_reader)` → release the reader (one-shot, `m_pending_reader = nullptr`).
  5. `SetRestoring(false)` — the **restore window** closes here. This is **not** the whole-replay capture gate: Player-Flow state capture stays off for the entire replay via a session-scoped gate (`06 §7`); `IsRestoring` is only the narrower restore-window sub-gate.
  6. `TryBeginGameplaySession()` — issues `Begin` once **both** `player_added` (set in the handler) and `room_ready` are true, AFTER the apply, so the SDK records playback from the restored state. The two callbacks can arrive in **either order** (`05 §6.6`) — `TryBeginGameplaySession()` is also called from `OnPlayerAddedCallback`, so don't assume `player_added` is already set here.

  Do **not** wire to `ludeo_GameplaySession_AddNotifyPlayerReady` (doesn't exist) and don't treat `ResumeGameRequest` as the post-restore resume (mid-play only, CR-011). The overlay owns the Play UI — don't draw your own.
- **Playback end** (`05 §6.11`) — two paths, do not conflate them. **Backend ends the Ludeo** (timer hits 0, objective met/failed, or any backend-decided reason): the backend sends **`PauseGameRequest`** (CR-011), so the game just **freezes and waits** for the next platform event. The game does **NOT** detect end-of-moment, **NOT** call `End`, and **NOT** submit — the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue (there is no game-facing "moment ended" notification). **Game-initiated interrupt** (another `LudeoSelected` mid-play, `BackToMenuRequest`, or quit): the **game** calls `ludeo_GameplaySession_End(isAbort=true)` then `RemovePlayer → CloseRoom`. Calling `End` on the backend-ends path, or with `isAbort=false` on the interrupt path, are both bugs.
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

This is the gate that closes phase 11. With Step 3.5 wired and the rest of the restore path in place, **run the game with the launch arg** and verify the **two-stage read-then-load** flow: the game **freezes at `LudeoSelected`** (overlay shows Play, *nothing of the captured world loaded yet*), then on **Play** the level loads + state restores + gameplay begins in one step. Do not declare phase 11 done by inspection — actually run it.

1. **Launch the game with the arg from the title menu / a cold start** (not from inside a running game) — this mirrors production, where `LudeoSelected` fires at startup before any game exists. Use any captured ludeo id from `/9` testing. Form depends on the engine (`--ludeo=<id>`, `-ludeo <id>`, etc., per Step 3.5).
2. **Before Play — verify the game froze with no world loaded.** `LudeoSelected` fires, `GetLudeo` + `OpenRoom` dispatch, and the game **freezes** with the overlay's Play button showing. Under read-then-load **nothing of the captured world is loaded yet** — the screen is the title/menu (or a hold screen), frozen; the level loads only *after* Play. Do **not** expect the restored world on screen here; if you see a loaded level pre-Play, the implementation is still load-first (`07 §2`). Check the pre-Play log:
   - `LudeoSelected` (synthesized by Step 3.5) fires with the expected `ludeoId`.
   - `GetLudeo` completion callback fires with `resultCode == Success` and a non-null `dataReader`, **cached** (not applied).
   - `OpenRoom` was dispatched **with the `ludeoId`** and `AddPlayer → OnPlayerAdded` ran (so `player_added` is set; `Begin` waits on `room_ready`).
   - Simulation tick frozen — no physics, no AI, no scripted ticks.
3. **Press Play → the platform releases `RoomReady` → the apply runs.** Everything below happens *after* Play, in the single-fire apply (Step 8).
4. **Verify the apply reached active gameplay (booted a run), not the menu.** This is the check that catches the "overlay at the menu, nothing reconstructed" failure: in the post-Play log the apply must **read the entry identity, load that level, and enter gameplay** (a player + world + in-gameplay state exist — e.g. for DFU, `StateManager` reached `Game`) *before* the two-pass apply. Then:
   - Two-pass restoration completes — Pass 1 spawn count + Pass 2 apply count + deferred queue drained match the plan (**non-zero** — a zero count means the apply ran against a menu/empty game and silently bailed: the level load was skipped or routed to the menu; this is the bug, not a pass — `07 §2`).
   - No `Expected type` lines (no attribute type-lock mismatches — `11-TROUBLESHOOTING §1`).
5. **Hand off to the player to confirm the post-Play first frame.** Tell the user:
   > "After pressing **Play**, confirm:
   > - The **first visible frame** is the captured mid-level moment — player at the captured position with captured health/inventory/state. **Not** a level-start cinematic, **not** a default spawn point, **not** a fade-in (07 §9.11). (The level loads *on* Play, so a brief load is expected before this frame.)
   > - No intro cutscene, countdown, slow-mo, or fly-in camera plays between Play and gameplay.
   > - The restored state survives a few seconds of play (no respawn / teleport / scripted reset clobbers it).
   > - Gameplay proceeds normally without snap-back or drift."

6. **Mid-play overlay pause/resume gate — required, not deferred (CR-011).** Once playback is running, prompt the user:
   > "With the game now playing, **open the Ludeo overlay** and confirm the game **freezes** (no physics, no AI, no scripted ticks — not just input suppressed). Then **close the overlay** and confirm the game **resumes**. Repeat the open/close once more to confirm it survives multiple toggles."

   This is the gate that catches the #1 mid-play failure ("game keeps running while the overlay covers it"). If the game doesn't pause when the overlay opens, the agent did not register `ludeo_Session_AddNotifyPauseGameRequest` / `ResumeGameRequest` at session creation — go back to `/4` §3.5 and add them, then rerun the full smoke test from step 1.

Wait for the player's confirmation on both steps 5 and 6 before declaring phase 11 done. If any of steps 2–6 fails, flag against `07 §10` / CR-010 / CR-011 and go back to the relevant earlier step — do not move on.

**If the game crashes during steps 1–4:** do **not** retry the launch blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame and the thread it crashed on, then classify against `11-TROUBLESHOOTING §6` (null `DataReader` deref, wrong-thread SDK call, `EnterObject`/`LeaveObject` mismatch, stale `id_map` deref, pointer-as-reference, use-after-`ObjectsInfo_Release`, SDK call before `Activate`). Fix at the root — don't paper over with null checks or try/catch — then rerun the full smoke test from step 1.

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
- **Bracket restoration with `IsRestoring()`.** Set it `true` before the level loads and `false` on player resume — it's the switch that stops `/9`'s **state-write** paths (batch registration, per-tick capture, `Set*`) from double-creating / overwriting during a restore. **Action sends (`SendAction` / `LUDEO_ACTION`) are NOT gated** — they fire in both Creator and Player Flow so the SDK can score the Ludeo's win/fail conditions during playback (`06 §7`, `07 §2.3`).
- **Clean reset at every end-of-Ludeo path.** Each exit from a Ludeo (`BackToMenuRequest`, the player quitting, the backend ending the Ludeo, **and** another `LudeoSelected` firing mid-play) must reset *every* piece of Ludeo-lifecycle state back to its "no Ludeo active" baseline before the next play starts: `m_is_restoring → false`, `m_room_ready → false`, `m_pending_reader → null`, `m_pending_ludeo_id → "" ` (the OpenRoom flow-select id from Step 3), `m_is_player_flow_replay → false` (the session-scoped capture gate — `06 §7`, `07 §2.3`), `m_freeze_restore → false` (CR-010 flag), `m_freeze_overlay → false` (CR-011 flag — only if no overlay is actually open at that moment), `m_pending_local_ludeo_id → "" ` (the Step 3.5 launch-arg cache). Centralize the cleanup in a single `EndCurrentLudeo()` helper called from every exit path — otherwise a stuck flag from one play silently corrupts the next. **On the *game-initiated interrupt* exit paths** (`BackToMenuRequest`, quit, another `LudeoSelected`) the helper must also call `ludeo_GameplaySession_End(isAbort=true)` → `RemovePlayer → CloseRoom` for the session it's tearing down; on the **backend-ends** path the game never called `End` (it only froze on `PauseGameRequest`), so `EndCurrentLudeo()` only resets the flags — do **not** call `End` there (`05 §6.11`).
- **The overlay drives pause/resume — register it (07 §2.4).** `PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` are session-lifetime notifications the game must register at session creation. Their job is **mid-play overlay open/close**: pause when the overlay reopens, resume when it closes. Skipping them is the "loads the right map but never pauses while the overlay is up" failure. The **post-restore resume is separate** — it comes through `RoomReady → Begin` (the chain `/4` wired). There is no `PlayerReady`.
- **Restoration is the authority over a repopulated level (07 §9.10).** Loading the level spawns its **default** content and runs the game's own init — the world is **not** empty. Reconcile captured objects to placed instances (Step 6, don't blind-spawn duplicates), apply restored values **after** level init settles, and keep the simulation **frozen** (Step 8) until `OnRoomReadyCallback` unpauses. If the live sim or the level's default init runs over your apply, the restored snapshot is silently overwritten — the "right map, wrong state" failure.
- **Suppress pre-match and location-override mechanisms during playback (07 §9.11).** Intro cutscenes, countdowns, slow-mo intros, fly-in cameras, default-spawn teleports, respawn-on-load logic, scripted level-start events — every one of these that runs after level-load can clobber the restored state or hide it behind a cinematic. Gate each on `IsRestoring()` (or equivalent). **Order matters**: `SetRestoring(true)` is set in Step 3 *before* the level loads, so these sequences fire during load and silently skip via the gate; **then** the pause is set on the resulting clean post-skip baseline (Step 3). Result: playback starts exactly at the captured moment on the first visible frame, and the paused frame the player sees while the overlay awaits Play is clean — not a frozen mid-intro.
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
6. **Press Play on the Ludeo overlay (shown after `LudeoSelected`) — the game receives `RoomReady`, then in one step the level loads, state restores, the game unpauses, and the gameplay session begins (`Begin`)** (CR-010, 07 §7). Until Play it stays frozen with nothing of the captured world loaded.
7. **Open the Ludeo overlay during playback — the game must pause (frozen tick); close it — the game resumes** (`PauseGameRequest`/`ResumeGameRequest`, mid-play overlay open/close, 07 §2.4)
8. **Confirm restored state survives resume** — spot-check that the live sim and the level's default init didn't overwrite restored values (07 §9.10)
9. Walk the validation checklist in `07-RESTORATION-PATTERNS.md §10`
