# /11-implement-restoration-flow — Wire LudeoSelected, Wait-for-Player, and the Apply Lifecycle

> **Stage:** State Restoration — Player-Flow Implementation (the inverse of `/4`'s session lifecycle)
> **Prerequisite:** `/10-plan-state-restoration` completed and `RESTORATION_PLAN.md` approved
> **Inputs:** `RESTORATION_PLAN.md`, `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`
> **Output:** `LudeoSelected` interrupt handler, freeze (CR-010), `GetLudeo`+`OpenRoom` dispatch + reader-readiness caching, single-fire `MaybeApplyRestore()` apply gate, read-then-load level boot, `RoomReady → Begin` resume, overlay pause/resume (CR-011), `EndCurrentLudeo()` reset, launch-arg local trigger. The apply **calls** `RestoreTwoPass`/`RestoreEnvironment` — which are **stubs here**; `/12` fills them.

This phase builds **when and how** a Ludeo is triggered, frozen, applied, and resumed — the SDK-orchestration half of restoration. It does **not** read entity state back (that is `/12`). The two halves meet at one seam: `MaybeApplyRestore()` calls `SetCurrent → RestoreTwoPass(reader) → RestoreEnvironment(reader)`. In this phase those three are **stubs** (declared, log-only bodies); `/12-implement-state-reconstruction` implements them. Follow the propose-confirm-execute cycle.

## Why this is its own phase

Restoration fuses two inverses. The **data** half (inverse of `/9`: two-pass read-back) is mechanical and lives in `/12`. **This** half is the inverse of `/4`'s lifecycle — threading, freeze timing, the `GetLudeo`/`OpenRoom` race, reader empty-cycles, the single-fire apply gate, `RoomReady`-withheld-until-Play, overlay pause/resume. It is the part integrations most often get wrong, so it gets its own phase, its own focused reading list, and its own runnable smoke test (with the apply stubbed). Build and verify the flow here **before** filling in reconstruction.

## Fresh Context Check

This is a sequential workflow — continuing to phase 11 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 11** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `/4-implement-sdk-lifecycle` complete — the session exists, notifications are registered at session creation, and the `OpenRoom → AddPlayer → RoomReady → Begin` chain (`TryBeginGameplaySession()`, `OnRoomReadyCallback`, `OnPlayerAddedCallback`) is wired. This phase reuses that chain for the post-restore resume.
> 3. `/9-implement-object-tracking` complete — `LudeoStateAdapter` exists and `LudeoManager::IsRestoring()` exists as the forward-compatible read-only stub `/9` added. This phase makes that flag *live*.
> 4. `/10-plan-state-restoration` complete — `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user approved it.

`/4` is a hard prerequisite: the apply re-uses `/4`'s `RoomReady → Begin` chain rather than inventing a new resume path. `/9` is a hard prerequisite: this phase flips `IsRestoring()` from the no-op stub to a real setter that gates `/9`'s capture paths.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. This is the **flow** reading list — the two-pass/reconciliation/environment sections (`07 §3/§5/§6/§8`) belong to `/12`, not here.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §2 (LudeoSelected flow), §2.2.1 (reader readiness / empty early cycles), §2.4 (overlay control notifications), §2.5 (launch-arg trigger), §7 (wait-for-player), §9.10 (restoration is the authority over a repopulated level), §9.11 (pre-match / location-override suppression). These are the canonical flow patterns — emit from them; don't re-derive from headers.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), **CR-010** (the game MUST be frozen — simulation frozen — from `LudeoSelected` until the apply on Play, while the overlay awaits the player; the level loads + state restores in the apply, then resume comes via `RoomReady → Begin`, the gameplay-session-start chain `/4` wired in `05-LIFECYCLE-MANAGEMENT.md`; `ResumeGameRequest` is mid-play only), **CR-011** (overlay pause/resume — the game must freeze while the overlay is up).
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — §6.2 (OpenRoom carries the `ludeoId` for a scored Player-Flow replay; `nullptr` = unscored new recording), §6.6 (the two `Begin` gates arrive in either order), §6.11 (the two playback-end paths — backend-ends vs game-initiated interrupt). The chain `/4` wired lives here.
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **session + reader-acquisition** API surface only (the entity getter table is a `/12` concern):

  Reader setup is **async, and the reader is delivered in a callback** — not a synchronous chain: `LudeoSelected` (gives a `ludeoId`) → `ludeo_Session_GetLudeo(ludeoId)` *(async)* → its completion callback hands you `LudeoSessionGetLudeoCallbackParams::dataReader` (when `resultCode == Success`) → `ludeo_DataReader_SetCurrent` → `ludeo_DataReader_GetObjectsInfo` (to validate the reader is populated) → **`ludeo_ObjectsInfo_Release`** (mandatory — leaks otherwise). **This exact two-callback flow is spelled out in `07-RESTORATION-PATTERNS.md §2` — emit it from there; don't re-derive it from the headers.** Notifications: `ludeo_Session_AddNotifyLudeoSelected` (interrupt) plus the overlay control set `ludeo_Session_AddNotifyPauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` (mid-play pause/resume/menu — see Step 2 and 07 §2.4). **There is no `ludeo_GameplaySession_AddNotifyPlayerReady`.** The **post-restore resume** is delivered via `RoomReady → Begin` (the chain `/4` wired in `05-LIFECYCLE-MANAGEMENT.md`); `ResumeGameRequest` is the mid-play overlay-closed resume only. Verify any signature you're unsure of against the **cloned headers** (`Include/Ludeo/Session.h`, `DataReader.h`, `*Types.h`), not by guessing.

## The Seam to `/12`

This phase and `/12` meet at exactly one interface. **Build the lifecycle scaffold here with the data read-back stubbed:**

- On `LudeoStateAdapter`, declare `RestoreTwoPass(reader)` and `RestoreEnvironment(reader)` with **stub bodies** — log a line (`"[Ludeo] RestoreTwoPass STUB — filled in /12"`) and return. Do **not** build the `id_map`, the deferred queue, the reader-side object scope, or the `LUDEO_READ_*` helpers — those are `/12`.
- `MaybeApplyRestore()` (Step 4) calls `SetCurrent → RestoreTwoPass → RestoreEnvironment` in that exact order, unpaused, after the level boot. **That call site and the apply gate are this phase's contract — `/12` must not re-wire them.**
- The **entry-identity read** (Step 4 — `start_mode`, `room_x/y` to decide which level to boot) is a flow decision and lives **here**, not in `/12`. It reads a couple of well-known attributes off the entry/world object with direct `ludeo_DataReader_Get*` calls — it does **not** need `/12`'s scope/macros.

Result of this phase: launching with `--ludeo=<id>` boots the correct level, freezes correctly before Play, resumes via `RoomReady → Begin`, and pauses/resumes under the overlay — **with no entities restored yet** (the stub no-ops). `/12` then fills the read-back and the same smoke test additionally verifies state.

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **flow** rows (the entity/property/reference/deferred/environment rows are `/12`'s):
- The **LudeoSelected interrupt flow** table (marshal, freeze, stash id, tear-down, dispatch `GetLudeo`+`OpenRoom`, reader-readiness caching).
- The **wait-for-player** mechanism (reuse game pause vs build a minimal tick-freeze) and the **post-restore resume hook** (`OnRoomReadyCallback → TryBeginGameplaySession()`).
- The **mid-play overlay hooks** (`PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` → file:function).
- The **playback-end** handling (backend-ends vs game-initiated interrupt).
- The **pre-match / location-override suppression** list (intro cutscenes, countdowns, slow-mo, fly-in cameras, default-spawn teleports, respawn-on-load, scripted level-start events) and the `IsRestoring()` gate for each.
- The **entry-identity → level-boot** decision (which attributes name the target level; how the game reaches active gameplay from the menu).

Skip flow rows with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Wire the LudeoSelected Interrupt Handler

This is the entry point — the inverse of the session lifecycle entry `/4` wired. Per 07 §2:
- Register the handler via `ludeo_Session_AddNotifyLudeoSelected` (at session creation, next to the other notify registrations).
- **Also register the overlay control notifications (07 §2.4) in the same place — these are what pause the game while the Ludeo overlay is up, and they are the most-forgotten piece because they are not on the restore call path:**
  - `ludeo_Session_AddNotifyPauseGameRequest` → **pause/freeze the simulation** (not just input).
  - `ludeo_Session_AddNotifyResumeGameRequest` → **resume** (mid-play overlay close only — the post-restore resume goes through `RoomReady → Begin`, see Step 4).
  - `ludeo_Session_AddNotifyBackToMenuRequest` → tear down the current Ludeo, return to menu.
  - Optionally `ludeo_Session_AddNotifyMuteRequest` → mute audio.
  These are **session-lifetime** (register once at session creation; if `/4` created the session, add them where the other `AddNotify*` calls live). **The post-restore resume goes through `RoomReady → Begin` — the same chain `/4` already wired for tracking-start (`05-LIFECYCLE-MANAGEMENT.md`); playback reuses it. Do not wire pause/resume to `ludeo_GameplaySession_AddNotifyPlayerReady` — that notification does not exist in this SDK — and do not treat `ResumeGameRequest` as the post-restore resume (it's only the mid-play overlay-closed resume).**
- In the handler: **marshal off the SDK notification thread immediately**. Then, in this exact order:
  1. **`SetRestoring(true)` FIRST** — this arms the §9.11 pre-match skips (cutscenes, countdowns, default-spawn teleports, etc.); they fire **later**, during the level load inside the apply (Step 4), and hit the gate then. It also suppresses `/9`'s batch registration. **Add the real setter on `LudeoManager` now** — `/9` only emitted the read-only stub; this phase makes `IsRestoring()` live.
  2. **Stash `params->ludeoId` (e.g. `m_pending_ludeo_id`).** It feeds **two** calls: `ludeo_Session_GetLudeo` (the state reader) **and** `OpenRoom`. Passing it to `OpenRoom` is what makes the rerun a **scored Player-Flow replay**; `nullptr` opens a Creator-Flow recording and the rerun silently isn't scored (`05 §6.2`, §6.11). Also **re-arm the single-fire apply gate** here: `m_pending_reader = nullptr; m_room_ready = false; m_applied = false`.
  3. **If a Ludeo is already playing** (another `LudeoSelected` arrived mid-play), run `EndCurrentLudeo()` first — tear down its gameplay session + room (`ludeo_GameplaySession_End(isAbort=true)` → `RemovePlayer` → `CloseRoom`, SDK `Session` stays alive) **and reset prior-Ludeo state** (release the old reader, re-arm `IsRestoring`, replace `m_pending_ludeo_id`) so the previous play can't leak in (`05 §6.11`). Cancel in-flight transitions; suppress non-restoration input. (At the menu there's no run to tear down.) See Step 5 for the centralized helper.
  4. **Freeze the simulation now** — the instant `LudeoSelected` fires (freeze the tick, not just input — CR-010). The game **may already be frozen** at the menu; set the restoration-freeze bit regardless. It holds through the `GetLudeo` + room + wait-for-Play window and unpauses only at the top of the apply (Step 4). **Do not load any level here** — the target is unknown until the reader is in hand.
  5. **Dispatch `ludeo_Session_GetLudeo(m_pending_ludeo_id)` AND `OpenRoom(m_pending_ludeo_id)` now — they race; no ordering guarantee.** Nothing about which level loads is decided yet (the level loads in the apply, Step 4).
     - **`OpenRoom` MUST pass `m_pending_ludeo_id` as `OpenRoomParams.ludeoId`** and is dispatched **here in the handler**, *not* hung off the `/4` "OpenRoom on entering gameplay" path — in player flow no level loads during the handler, so that path never fires; you call `OpenRoom` directly. `OnRoomOpened → AddPlayer → OnPlayerAdded` run now, so `player_added` is set (`Begin` still waits on `room_ready`).
     - **`GetLudeo` is async and its callback may fire REPEATEDLY** (the forced-launch path re-injects `LudeoSelected`). `resultCode == Success` only means a valid reader *handle* arrived — **early cycles return Success with an EMPTY reader** (the data hasn't landed). **In the callback: on `resultCode != Success`, abort (hard failure, no retry); otherwise validate the reader is *populated* — `ludeo_DataReader_GetObjectsInfo` `resultCode == Success && objectsCount > 0` (07 §2.2.1) — and only then CACHE it (`m_pending_reader`) and call `MaybeApplyRestore()`.** Ignore empty cycles; **never let a later empty cycle clobber a cached populated reader.** Do **not** apply state directly in the callback. (Pair each `GetObjectsInfo` with `ludeo_ObjectsInfo_Release`.)

Show each insertion as propose-confirm-execute. If a tear-down or level-load hook the plan named doesn't exist, propose adding it as a separate, named change first. Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001.

### Step 3: Local-testing hook — launch-arg Ludeo id (plus a persistent `ludeo.ini` alternative)

So devs can exercise restoration **without going through the Ludeo overlay**, add a launch argument that synthesizes a `LudeoSelected` for the handler wired in Step 2. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader` (07 §2). **Do not fake the `DataReader`** or short-circuit `GetLudeo`.

Implementation:
- **Parse the arg at startup** using the game's existing arg conventions — `--ludeo=<id>` (POSIX-style), `-ludeo <id>` (Unreal's `FParse::Value`), proprietary command-line table, etc. Match the engine; don't prescribe a format.
- **Also accept `activationLudeoId` from `ludeo.ini`** (see `04 §4`). The launch arg and the config field do the same thing — auto-fire `LudeoSelected` once the session is ready — but the config field is **persistent** across runs (handy for a debug setup), while the launch arg is **one-off** (handy for CLI invocations). Support both: if the launch arg is present, prefer it; otherwise fall back to `LudeoConfig::Instance().GetActivationLudeoId()`. Either path stashes the id and dispatches the same way.
- **Stash the id** on `LudeoManager` (e.g. `m_pending_local_ludeo_id`); don't act on it during early init.
- **Dispatch once the session is ready** — after `ludeo_Session_Activate` succeeds and Step 2's `AddNotifyLudeoSelected` is registered (earlier, `GetLudeo` can't be called and the chain has nothing to drive). Cleanest hook: the session-activation success callback, or a one-shot check on the first `ludeo_Tick` after activation. Dispatch by invoking the same handler the SDK calls (e.g. `OnLudeoSelected(ludeoId)` helper), then clear the stash so it fires once.
- Wrap in `#if LUDEO_SDK_ENABLED` (CR-001). The arg is a no-op when `LUDEO_SDK_ENABLED=0`.

Result: launching the game with `--ludeo=<id>` (or engine-equivalent), **or** setting `activationLudeoId` in `ludeo.ini`, runs the full flow end-to-end — `LudeoSelected → GetLudeo → DataReader → (stub) apply → wait-for-player → RoomReady → Begin` — without needing the platform overlay.

### Step 4: Single-fire Apply + Wait-for-Player

**Wait-for-player + the single-fire apply** (07 §7, **CR-010**) — the game has been **frozen since `LudeoSelected`** (Step 2); `OpenRoom(ludeoId)` and `GetLudeo` were dispatched in the handler and race. The platform **withholds `RoomReady` until the player presses Play**. Put the apply in a **`MaybeApplyRestore()` helper called from BOTH `OnGetLudeoCallback` and `OnRoomReadyCallback`** — it fires **once**, when a **populated** reader has been cached (the readiness validation lives in `OnGetLudeoCallback`, Step 2) **and** `m_room_ready` is set. `OnRoomReadyCallback` just sets `m_room_ready = true` then calls it. Because the populated reader may arrive on a *later* `GetLudeo` cycle, this is **retry-until-ready, not one-shot**: also call `MaybeApplyRestore()` (or just re-check readiness) from `Update` as a fallback, with a **timeout** (e.g. 15 s) — on timeout still-unpopulated, **abort and do NOT `Begin`** (invalid/empty Ludeo; run `EndCurrentLudeo`).

In `MaybeApplyRestore()`, in this **exact order**:
  1. **Gate:** `if (m_applied || !m_is_restoring || !m_room_ready || !m_pending_reader) return; m_applied = true;` — a true single-fire (`m_pending_reader` is only ever set to a populated reader, Step 2).
  2. `SetPaused(false)` / clear the restoration-freeze — **unpause FIRST** (the level load *and* the apply need the game running so movement/physics/AI can settle on restored values).
  3. **Read the entry identity from the reader** (e.g. `start_mode`, `room_x`, `room_y`) and **reach active gameplay** — load THAT level / boot the run (load the single generic level if the game has no rooms). **At the menu / startup there is no player or world — you *boot* one here**, not restore into the menu (it silently no-ops, `07 §2`): scene-based → load level + spawn; state-machine entry / no per-level scene (DFU) → trigger `StartGameBehaviour`. Pre-match sequences fire during this load and silently skip via the gate. *(This entry-identity read is flow-owned — it uses direct `ludeo_DataReader_Get*` on the entry/world object and does not need `/12`'s reader scope.)*
  4. `SetCurrent(m_pending_reader)` → `RestoreTwoPass(m_pending_reader)` → `RestoreEnvironment(m_pending_reader)` → release the reader (one-shot, `m_pending_reader = nullptr`). **`RestoreTwoPass`/`RestoreEnvironment` are stubs in this phase (the Seam) — `/12` fills them.** Keep this call order and site exactly as written.
  5. `SetRestoring(false)` — the **restore window** closes here. This is **not** the whole-replay capture gate: Player-Flow state capture stays off for the entire replay via a session-scoped gate (`06 §7`); `IsRestoring` is only the narrower restore-window sub-gate.
  6. `TryBeginGameplaySession()` — issues `Begin` once **both** `player_added` (set in the handler) and `room_ready` are true, AFTER the apply, so the SDK records playback from the restored state. The two callbacks can arrive in **either order** (`05 §6.6`) — `TryBeginGameplaySession()` is also called from `OnPlayerAddedCallback`, so don't assume `player_added` is already set here.

Do **not** wire to `ludeo_GameplaySession_AddNotifyPlayerReady` (doesn't exist) and don't treat `ResumeGameRequest` as the post-restore resume (mid-play only, CR-011). The overlay owns the Play UI — don't draw your own.

**Playback end** (`05 §6.11`) — two paths, do not conflate them. **Backend ends the Ludeo** (timer hits 0, objective met/failed, or any backend-decided reason): the backend sends **`PauseGameRequest`** (CR-011), so the game just **freezes and waits** for the next platform event. The game does **NOT** detect end-of-moment, **NOT** call `End`, and **NOT** submit — the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue (there is no game-facing "moment ended" notification). **Game-initiated interrupt** (another `LudeoSelected` mid-play, `BackToMenuRequest`, or quit): the **game** calls `ludeo_GameplaySession_End(isAbort=true)` then `RemovePlayer → CloseRoom`. Calling `End` on the backend-ends path, or with `isAbort=false` on the interrupt path, are both bugs.

### Step 5: Clean Reset at Every End-of-Ludeo Path

Each exit from a Ludeo (`BackToMenuRequest`, the player quitting, the backend ending the Ludeo, **and** another `LudeoSelected` firing mid-play) must reset *every* piece of Ludeo-lifecycle state back to its "no Ludeo active" baseline before the next play starts: `m_is_restoring → false`, `m_room_ready → false`, `m_applied → false` (the single-fire apply latch), `m_pending_reader → null`, `m_pending_ludeo_id → "" ` (the OpenRoom flow-select id from Step 2), `m_is_player_flow_replay → false` (the session-scoped capture gate — `06 §7`, `07 §2.3`), `m_freeze_restore → false` (CR-010 flag), `m_freeze_overlay → false` (CR-011 flag — only if no overlay is actually open at that moment), `m_pending_local_ludeo_id → "" ` (the Step 3 launch-arg cache). Centralize the cleanup in a single `EndCurrentLudeo()` helper called from every exit path — otherwise a stuck flag from one play silently corrupts the next.

**On the *game-initiated interrupt* exit paths** (`BackToMenuRequest`, quit, another `LudeoSelected`) the helper must also call `ludeo_GameplaySession_End(isAbort=true)` → `RemovePlayer → CloseRoom` for the session it's tearing down; on the **backend-ends** path the game never called `End` (it only froze on `PauseGameRequest`), so `EndCurrentLudeo()` only resets the flags — do **not** call `End` there (`05 §6.11`).

### Step 6: Lifecycle smoke test — run with `--ludeo=<id>` and verify freeze + boot + pause (REQUIRED gate)

This is the gate that closes phase 11. With Step 3 wired and the apply lifecycle in place (read-back still stubbed), **run the game with the launch arg** and verify the **two-stage read-then-load** flow: the game **freezes at `LudeoSelected`** (overlay shows Play, *nothing of the captured world loaded yet*), then on **Play** the correct level loads + gameplay begins. **Entities/properties will NOT be restored yet — the apply seam is stubbed; that's expected here and `/12` verifies it.** Do not declare phase 11 done by inspection — actually run it.

1. **Launch the game with the arg from the title menu / a cold start** (not from inside a running game) — this mirrors production, where `LudeoSelected` fires at startup before any game exists. Use any captured ludeo id from `/9` testing. Form depends on the engine (`--ludeo=<id>`, `-ludeo <id>`, etc., per Step 3).
2. **Before Play — verify the game froze with no world loaded.** `LudeoSelected` fires, `GetLudeo` + `OpenRoom` dispatch, and the game **freezes** with the overlay's Play button showing. Under read-then-load **nothing of the captured world is loaded yet** — the screen is the title/menu (or a hold screen), frozen; the level loads only *after* Play. Do **not** expect the restored world on screen here; if you see a loaded level pre-Play, the implementation is still load-first (`07 §2`). Check the pre-Play log:
   - `LudeoSelected` (synthesized by Step 3) fires with the expected `ludeoId`.
   - `GetLudeo` completion callback fires with `resultCode == Success` and a non-null `dataReader`, **cached** (not applied). Log `GetObjectsInfo`'s `objectsCount` — confirm it is non-zero (a populated reader landed).
   - `OpenRoom` was dispatched **with the `ludeoId`** and `AddPlayer → OnPlayerAdded` ran (so `player_added` is set; `Begin` waits on `room_ready`).
   - Simulation tick frozen — no physics, no AI, no scripted ticks.
3. **Press Play → the platform releases `RoomReady` → the apply runs.** Everything below happens *after* Play, in the single-fire apply (Step 4).
4. **Verify the apply reached active gameplay (booted a run), not the menu.** This is the check that catches the "overlay at the menu, nothing reconstructed" failure: in the post-Play log the apply must **read the entry identity, load that level, and enter gameplay** (a player + world + in-gameplay state exist — e.g. for DFU, `StateManager` reached `Game`) *before* the (stubbed) two-pass call. Confirm:
   - The entry identity was read and the **correct** level loaded (the one the ludeo captured, not a default).
   - The `RestoreTwoPass`/`RestoreEnvironment` **stubs were reached** (their log lines fire, in order, unpaused) — this proves the apply gate, ordering, and seam are correct even though no state is written yet.
   - `Begin` fired (gameplay session started) after the apply, once both `player_added` and `room_ready` were set.
5. **Hand off to the player to confirm boot + first frame (flow only).** Tell the user:
   > "After pressing **Play**, confirm:
   > - The game **booted into actual gameplay on the captured level** (not the menu, not a default level, not a crash). The level loads *on* Play, so a brief load is expected.
   > - **State is not restored yet** (the player may be at a default spawn / default state) — that's expected in this phase; `/12` adds the state read-back.
   > - The game is running normally (ticking), not frozen, after Play."
6. **Mid-play overlay pause/resume gate — required, not deferred (CR-011).** Once the game is running, prompt the user:
   > "With the game now playing, **open the Ludeo overlay** and confirm the game **freezes** (no physics, no AI, no scripted ticks — not just input suppressed). Then **close the overlay** and confirm the game **resumes**. Repeat the open/close once more to confirm it survives multiple toggles."

   This is the gate that catches the #1 mid-play failure ("game keeps running while the overlay covers it"). If the game doesn't pause when the overlay opens, you did not register `ludeo_Session_AddNotifyPauseGameRequest` / `ResumeGameRequest` at session creation — go back to Step 2 and add them, then rerun the full smoke test from step 1.

Wait for the player's confirmation on both steps 5 and 6 before declaring phase 11 done. If any of steps 2–6 fails, flag against `07 §2`/`§7` / CR-010 / CR-011 and go back to the relevant earlier step — do not move on.

**If the game crashes during steps 1–4:** do **not** retry the launch blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame and the thread it crashed on, then classify against `11-TROUBLESHOOTING §6` — for this phase the likely culprits are **wrong-thread SDK call** (didn't marshal off the notification thread), **SDK call before `Activate`** (the launch-arg dispatch fired too early — §6.7), or **null `DataReader` deref** (applied before validating populated). Fix at the root — don't paper over with null checks or try/catch — then rerun the full smoke test from step 1.

**Iteration discipline — Step 6 is a loop gate, not a one-shot:**

- **Iterate until it passes.** After every failure (crash or wrong-behavior), make a fix and rerun the full smoke test from step 1. Do not advance to "phase 11 done" by inspection.
- **Propose-confirm-execute every fix.** No autonomous code changes between iterations — each fix is shown to the user, approved, then applied.
- **Fix at the root each iteration.** Don't add try/catch, null checks, or symptom-masking to make the test pass.
- **Stop iterating and escalate to the user when ANY of these holds:** the same failure mode recurs after a fix; three distinct attempts on the same failure haven't resolved it; a single iteration sprawls across many files without isolating the cause; or a single iteration's investigation has run unusually long with no convergence.
- **When escalating, hand the user a clear summary:** what failed (stack / log lines), the theories tried, what was changed in each attempt, what's still unknown — then stop and wait for guidance.

## Important Notes

- **This is the inverse of `/4`, not `/9`.** Every piece here mirrors the session lifecycle `/4` wired (`OpenRoom → AddPlayer → RoomReady → Begin`). The data read-back is `/12`. If you find yourself reading entity attributes back into the world, you're in `/12`'s territory — stop and stub it.
- **Propose-confirm-execute** for every change. The `SetRestoring` setter, the apply gate, and the overlay registrations touch project-wide classes — get explicit approval.
- **The game MUST be frozen from `LudeoSelected` to the apply (CR-010).** Freeze the *tick*, not just input, the instant `LudeoSelected` fires; unpause only at the top of the apply.
- **Read-then-load.** No level loads in the handler — the target is unknown until the reader is in hand. The level loads *inside* the apply, after Play.
- **`OpenRoom` carries the `ludeoId`.** `nullptr` silently makes the rerun an unscored new recording (`05 §6.2`).
- **Validate the reader is populated before caching** (`GetObjectsInfo` Success && objectsCount>0). Early `GetLudeo` cycles return Success with an empty reader; ignore them, don't clobber a good one, timeout→abort (`07 §2.2.1`).
- **The overlay drives pause/resume — register it (07 §2.4).** `PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` are session-lifetime notifications registered at session creation. The **post-restore resume is separate** — it comes through `RoomReady → Begin`. There is no `PlayerReady`.
- **Suppress pre-match and location-override mechanisms during playback (07 §9.11).** `SetRestoring(true)` is set in Step 2 *before* the level loads, so intro cutscenes, countdowns, default-spawn teleports, etc. fire during the load and silently skip via the gate.
- **Clean reset at every end-of-Ludeo path (Step 5).** Centralize in `EndCurrentLudeo()`; a stuck flag corrupts the next play.
- **Never block the SDK notification thread.** `LudeoSelected` arrives on the SDK's thread — marshal immediately.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001).
- Do not modify game logic — only add SDK-driven flow control. If a hook site doesn't exist, propose adding it as a separate, named change first.

## Related Commands

- `/4-implement-sdk-lifecycle` — wired the `RoomReady → Begin` chain this phase reuses for the post-restore resume
- `/10-plan-state-restoration` — produces the `RESTORATION_PLAN.md` this command consumes
- `/12-implement-state-reconstruction` — fills the `RestoreTwoPass`/`RestoreEnvironment` stubs this phase calls (run NEXT)
- `/5-compile-and-fix` — run after to verify compilation

## Next Steps

After running this command:
1. Run `/5-compile-and-fix` with `LUDEO_SDK_ENABLED=1` and `=0`
2. Confirm the lifecycle smoke test (Step 6) passes: freeze-before-Play, boot-correct-level-on-Play, overlay pause/resume
3. Run `/12-implement-state-reconstruction` to fill the apply seam, then re-run the smoke test to verify state is restored
