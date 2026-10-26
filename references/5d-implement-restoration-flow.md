# Phase 5 · Task 3 — Implement Restoration Flow

> **Stage:** State Restoration — Player-Flow Implementation (the inverse of `phase 3 · task 4`'s session lifecycle)
> **Prerequisite:** `5c-plan-state-restoration.md` completed and `RESTORATION_PLAN.md` approved
> **Runs once, in wave 1**, dispatched by [`5-tracking-restore-orchestrator.md`](5-tracking-restore-orchestrator.md). The
> flow is moment-agnostic; later waves only grow capture and the read-back.
> **Inputs:** `RESTORATION_PLAN.md`, `CODE_MAP.json`, `SDK_INTEGRATION_POINTS.json`
> **Output:** `LudeoSelected` handler that **validates before it disturbs anything** (`GetLudeo` + reader-readiness + entry-identity check), the commit (teardown first, then `SetRestoring` and the input hold), reach-active-gameplay on the captured level, the **held apply + settle** (CR-010), `OpenRoom(ludeoId)` after the settle, `RoomReady → Begin → unfreeze`, overlay pause/resume (CR-011), `EndCurrentLudeo()` reset, launch-arg local trigger. The apply **calls** `RestoreTwoPass`/`RestoreEnvironment` — which are **stubs here**; `phase 5 · task 4` fills them.

This phase builds **when and how** a Ludeo is validated, built, held and resumed — the SDK-orchestration half of restoration. It does **not** read entity state back (that is `phase 5 · task 4`). The two halves meet at one seam: `ApplyHeld()` calls `SetCurrent → RestoreTwoPass(reader) → RestoreEnvironment(reader)`. In this phase those three are **stubs** (declared, log-only bodies); `5e-implement-state-reconstruction.md` implements them. Follow the propose-confirm-execute cycle.

## Why this is its own phase

Restoration fuses two inverses. The **data** half (inverse of `phase 5 · task 1`: two-pass read-back) is mechanical and lives in `phase 5 · task 4`. **This** half is the inverse of `phase 3 · task 4`'s lifecycle — threading, validate-before-disturb, reader empty-cycles, the held apply and settle, `RoomReady` as the viewer's Play click, overlay pause/resume. It is the part integrations most often get wrong, so it gets its own phase, its own focused reading list, and its own runnable smoke test (with the apply stubbed). Build and verify the flow here **before** filling in reconstruction.

## Fresh Context Check

This is a sequential workflow — continuing to phase 5 · task 3 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 5 · task 3** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Engine Scope

Proprietary C++ engines only. If the game uses Unity or Unreal, stop — use the engine-specific guide instead.

## Prerequisites

**From the intake** (`ludeo-integration-plan/integration.json` → `intake`; [`know-your-game.md`](know-your-game.md)) — `runnability.levelLoadCommand` is how Step 4 reaches the captured level from a cold
start. The Step 6 run is the agent's: the harness's `replay` scenario ([`agent-test-harness.md`](agent-test-harness.md)), built here.

> **REQUIRED:** These must be complete before running this command:
> 1. `phase 3 · task 4` complete — LudeoManager exists and SDK lifecycle works
> 2. `3d-implement-sdk-lifecycle.md` complete — the session exists, notifications are registered at session creation, and the `OpenRoom → AddPlayer → RoomReady → Begin` chain (`TryBeginGameplaySession()`, `OnRoomReadyCallback`, `OnPlayerAddedCallback`) is wired. This phase reuses that chain for the post-restore resume.
> 3. `5b-implement-object-tracking.md` complete — `LudeoStateAdapter` exists and `LudeoManager::IsRestoring()` exists as the forward-compatible read-only stub `phase 5 · task 1` added. This phase makes that flag *live*.
> 4. `5c-plan-state-restoration.md` complete — `ludeo-integration-plan/RESTORATION_PLAN.md` exists and the user approved it.

`phase 3 · task 4` is a hard prerequisite: the resume re-uses `phase 3 · task 4`'s `RoomReady → Begin` chain rather than inventing a new path. `phase 5 · task 1` is a hard prerequisite: this phase flips `IsRestoring()` from the no-op stub to a real setter that gates `phase 5 · task 1`'s capture paths.

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. This is the **flow** reading list — the two-pass/reconciliation/environment sections (`07 §3/§5/§6/§8`) belong to `phase 5 · task 4`, not here.

- `ludeo-integration-docs/07-RESTORATION-PATTERNS.md` — §2 (LudeoSelected flow — **§2.1 is the sequence this phase implements**), §2.2.1 (reader readiness / empty early cycles), §2.4 (overlay control notifications), §2.5 (launch-arg trigger), §6 (deferred properties — what the settle is for), §7 (wait-for-player), §9.10 (restoration is the authority over a repopulated level), §9.11 (start-of-run suppression). These are the canonical flow patterns — emit from them; don't re-derive from headers.
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — CR-001 (`#if LUDEO_SDK_ENABLED` guards), **CR-010** (build the restored moment **before** Play: validate → commit → reach active gameplay → freeze → apply → settle → freeze → `OpenRoom` → on `RoomReady`, `Begin` → unfreeze), **CR-011** (overlay pause/resume — the game must freeze while the overlay is up).
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` — §6.2 (OpenRoom carries the `ludeoId` for a scored Player-Flow replay; `nullptr` = unscored new recording), §6.6 (the `Begin` gates arrive in either order), §6.11 (the playback lifecycle and the two playback-end paths). The chain `phase 3 · task 4` wired lives here.
- `ludeo-integration-docs/12-SDK-API-REFERENCE.md` — the **session + reader-acquisition** API surface only (the entity getter table is a `phase 5 · task 4` concern):

  Reader setup is **async, and the reader is delivered in a callback** — not a synchronous chain: `LudeoSelected` (gives a `ludeoId`) → `ludeo_Session_GetLudeo(ludeoId)` *(async, read-only)* → its completion callback hands you `LudeoSessionGetLudeoCallbackParams::dataReader` (when `resultCode == Success`) → `ludeo_DataReader_GetObjectsInfo` (to validate the reader is populated) → **`ludeo_ObjectsInfo_Release`** (mandatory — leaks otherwise) → later `ludeo_DataReader_SetCurrent` in the apply. **This exact flow is spelled out in `07-RESTORATION-PATTERNS.md §2` — emit it from there; don't re-derive it from the headers.** Notifications: `ludeo_Session_AddNotifyLudeoSelected` plus the overlay control set `ludeo_Session_AddNotifyPauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` (see Step 2 and 07 §2.4). **There is no `ludeo_GameplaySession_AddNotifyPlayerReady`.** Verify any signature you're unsure of against the **SDK headers** (`Include/Ludeo/Session.h`, `DataReader.h`, `*Types.h`), not by guessing.

## The Seam to `phase 5 · task 4`

This phase and `phase 5 · task 4` meet at exactly one interface. **Build the lifecycle scaffold here with the data read-back stubbed:**

- On `LudeoStateAdapter`, declare `RestoreTwoPass(reader)`, `RestoreEnvironment(reader)` and `ApplyDeferred()` with **stub bodies** — log a line (`"[Ludeo] RestoreTwoPass STUB — filled in phase 5 · task 4"`) and return. Do **not** build the `id_map`, the deferred queue, the reader-side object scope, or the `LUDEO_READ_*` helpers — those are `phase 5 · task 4`.
- `ApplyHeld()` (Step 4) calls `SetCurrent → RestoreTwoPass → RestoreEnvironment` in that exact order, **frozen**, after the game's native spawn is done, followed by the settle, whose **first tick** calls `ApplyDeferred()` (the `07 §6` deferred-property queue `RestoreTwoPass` fills). **These call sites and their ordering are this phase's contract — `phase 5 · task 4` fills the three bodies and must not re-wire them.**
- The **entry-identity read** (Step 2 — `start_mode`, `room_x/y`, … to decide which level to boot, and whether this integration can play the Ludeo at all) is a flow decision and lives **here**, not in `phase 5 · task 4`. It reads a couple of well-known attributes off the entry/world object with direct `ludeo_DataReader_Get*` calls — it does **not** need `phase 5 · task 4`'s scope/macros.

Result of this phase: launching with `--ludeo=<id>` validates the selection, boots the correct level, holds the (still default-state) moment frozen behind the overlay **before** Play, and resumes it on Play via `RoomReady → Begin` — **with no entities restored yet** (the stub no-ops). `phase 5 · task 4` then fills the read-back and the same smoke test additionally verifies state.

## Your Task

### Step 1: Read the Plan

Read `ludeo-integration-plan/RESTORATION_PLAN.md`. Extract the **flow** rows (the entity/property/reference/deferred/environment rows are `phase 5 · task 4`'s):
- The **LudeoSelected flow** table (marshal, validate via `GetLudeo` + readiness + entry identity, commit, teardown, reach active gameplay, held apply, settle, `OpenRoom`).
- The **hold/freeze** mechanism (reuse game pause vs build a minimal tick-freeze; how input is suppressed while time runs for the settle) and the **resume hook** (`OnRoomReadyCallback → TryBeginGameplaySession()` → unfreeze).
- The **native-spawn-done signal** — the point after which the game's own level-start spawning has finished and the apply may run.
- The **mid-play overlay hooks** (`PauseGameRequest`/`ResumeGameRequest`/`BackToMenuRequest` → file:function).
- The **playback-end** handling (backend-ends vs game-initiated interrupt).
- The **start-of-run suppression** list — *both* categories (07 §9.11): state-clobbering (intro cutscenes, countdowns, slow-mo, fly-in cameras, default-spawn teleports, respawn-on-load, scripted level-start events) **and** flow-blocking (press-start/click-to-continue gates, modal popups, EULA/login/age-gate, tutorial overlays, confirmation dialogs) — and the `IsRestoring()` gate for each.
- The **entry-identity → level-boot** decision (which attributes name the target level; how the game reaches active gameplay from the menu; which entry identities this integration can play).

Skip flow rows with unresolved Open Questions — confirm with the user before generating code for them.

### Step 2: Wire the LudeoSelected handler — validate before disturbing anything

This is the entry point — the inverse of the session lifecycle entry `phase 3 · task 4` wired. Per 07 §2.1–§2.2:
- Register the handler via `ludeo_Session_AddNotifyLudeoSelected` (at session creation, next to the other notify registrations).
- **Also register the overlay control notifications (07 §2.4) in the same place — the most-forgotten piece, because they are not on the restore call path:**
  - `ludeo_Session_AddNotifyPauseGameRequest` → **pause/freeze the simulation** (not just input).
  - `ludeo_Session_AddNotifyResumeGameRequest` → **resume** (mid-play overlay close only — the post-restore resume goes through `RoomReady → Begin`, see Step 4).
  - `ludeo_Session_AddNotifyBackToMenuRequest` → tear down the current Ludeo, return to menu.
  - Optionally `ludeo_Session_AddNotifyMuteRequest` → mute audio.
  These are **session-lifetime** (register once at session creation). **Do not wire pause/resume to `ludeo_GameplaySession_AddNotifyPlayerReady` — it does not exist in this SDK — and do not treat `ResumeGameRequest` as the post-restore resume.**
- **In the handler — marshal off the SDK notification thread immediately, then only:**
  1. If this id is **in flight** — still the candidate being validated, or the pending id of a restore that hasn't reached `Begin` — return (the forced-launch path re-injects `LudeoSelected`). A Ludeo that already played is **not** in flight: re-selecting it ("play again") must go through.
  2. Stash it as the **candidate** id (not yet the pending one) and start a readiness deadline (e.g. 15 s).
  3. Dispatch `ludeo_Session_GetLudeo(candidate id)`, passing the id through `clientData` so the callback can be matched to its selection. **Nothing else.** No teardown, no freeze, no `SetRestoring`, no `OpenRoom` — `GetLudeo` is read-only, and a selection that turns out bad must leave the running session (or the menu) exactly as it was. On a cloud VM nobody can recover a session that was torn down for nothing.
- **In the `GetLudeo` callback** (marshalled; it may fire **repeatedly**):
  - Not for the current candidate (a late callback for a selection since replaced or ignored) → drop it.
  - `resultCode != Success` → **ignore the selection** (log why); do not retry. *Ignoring* means: clear the candidate id, reader and deadline — touch nothing else.
  - Reader not populated (`ludeo_DataReader_GetObjectsInfo` `resultCode == Success && objectsCount > 0`, each paired with `ludeo_ObjectsInfo_Release` — 07 §2.2.1) → ignore this cycle; a populated reader arrives a cycle or two later. A per-frame check in `Update` ignores the selection if the deadline passes still empty.
  - Populated → **read the entry identity** and check this integration can play it (identity present; a level/slice the integration supports). Absent identity → "Ludeo predates the identity capture — re-capture" (07 §2.2); unknown level → "routing/content bug". Either way **ignore the selection**.
  - Playable → accept the reader (never let a later cycle replace it) and **commit** (Step 4).

Show each insertion as propose-confirm-execute. If a teardown, level-load or native-spawn-done hook the plan named doesn't exist, propose adding it as a separate, named change first. Wrap all SDK references in `#if LUDEO_SDK_ENABLED` per CR-001.

### Step 3: Local-testing hook — launch-arg Ludeo id (plus a persistent `ludeo.ini` alternative)

So devs can exercise restoration **without going through the Ludeo overlay**, add a launch argument that synthesizes a `LudeoSelected` for the handler wired in Step 2. The arg only changes the *source* of the id — the same handler still calls `ludeo_Session_GetLudeo`, whose async callback still delivers the `DataReader` (07 §2). **Do not fake the `DataReader`** or short-circuit `GetLudeo`.

Implementation:
- **Parse the arg at startup** using the game's existing arg conventions — `--ludeo=<id>` (POSIX-style), a proprietary command-line table, etc. Match the engine; don't prescribe a format.
- **Also accept `activationLudeoId` from `ludeo.ini`** (see `04 §4`). The launch arg and the config field do the same thing — auto-fire `LudeoSelected` once the session is ready — but the config field is **persistent** across runs (handy for a debug setup), while the launch arg is **one-off** (handy for CLI invocations). Support both: if the launch arg is present, prefer it; otherwise fall back to `LudeoConfig::Instance().GetActivationLudeoId()`. Either path stashes the id and dispatches the same way.
- **Stash the id** on `LudeoManager` (e.g. `m_pending_local_ludeo_id`); don't act on it during early init.
- **Dispatch once the session is ready** — after `ludeo_Session_Activate` succeeds and Step 2's `AddNotifyLudeoSelected` is registered (earlier, `GetLudeo` can't be called and the chain has nothing to drive). Cleanest hook: the session-activation success callback, or a one-shot check on the first `ludeo_Tick` after activation. Dispatch by invoking the same handler the SDK calls (e.g. `OnLudeoSelected(ludeoId)` helper), then clear the stash so it fires once.
- Wrap in `#if LUDEO_SDK_ENABLED` (CR-001). The arg is a no-op when `LUDEO_SDK_ENABLED=0`.

Result: launching the game with `--ludeo=<id>` (or engine-equivalent), **or** setting `activationLudeoId` in `ludeo.ini`, runs the full flow end-to-end — `LudeoSelected → GetLudeo → validate → reach active gameplay → (stub) apply → settle → OpenRoom → wait for Play → RoomReady → Begin` — without needing the platform overlay.

### Step 4: Commit, reach active gameplay, apply held, settle, open the room

Per CR-010 and 07 §2.1 steps 3–8. Everything below runs **before** the viewer presses Play.

1. **Commit** (only a validated selection gets here). Take the candidate id and reader **by value** first — the teardown below resets the shared fields.
   - **If a Ludeo is playing, or an earlier restore is still in progress** (committed but not yet at `Begin`), run `EndCurrentLudeo()` (Step 5) **first** — `End(isAbort=true)` if `Begin` ran → `RemovePlayer` → `CloseRoom`. These are async: **start the new restore only in its continuation**, once the close has completed, or a second room opens over the still-closing one.
   - **Then** (`StartRestore`): bump `m_restore_generation` and set `m_restore_in_progress`; `SetRestoring(true)` — arms the §9.11 start-of-run skips **before** the level load fires them, and suppresses `phase 5 · task 1`'s batch registration (**add the real setter on `LudeoManager` now** — `phase 5 · task 1` only emitted the read-only stub); set `m_pending_ludeo_id` / `m_pending_reader` from the held values; re-arm `m_room_ready = m_player_added = m_applied = false`; reset the CR-010/CR-011 freeze bits to a clean baseline.
   - Turn the **input hold** on — player input off until `Begin`. (The start-of-run skips read `IsRestoring()`, not the hold.) The simulation runs as much as the game's own load path needs — a frozen engine often cannot load a level.
   - Every later continuation (load done, settle tick, settle done) captures the generation and **no-ops if it changed** — an interrupted restore must not apply into, or open a room for, its replacement.
2. **Reach active gameplay on the captured level** — load THAT level / boot the run (the single generic level if the game has no rooms). **At the menu / startup there is no player or world — you *boot* one here** (scene-based → load level + spawn; state-machine entry → trigger the game's new-game / load flow). Start-of-run sequences fire during this load and silently skip via the gate. Wait for the **native-spawn-done** signal from the plan — applying before the game's own spawning finishes lets that spawning overwrite the snapshot. **Skip `phase 3 · task 4`'s Creator-Flow "`OpenRoom` when the level starts loading" hook while `IsRestoring()`** — otherwise this load opens an unscored `nullptr` room before the Player room (CR-009).
3. **`ApplyHeld()`** — **freeze** the simulation (CR-010 restoration bit), then `ludeo_DataReader_SetCurrent(m_pending_reader)` → `RestoreTwoPass(m_pending_reader)` → `RestoreEnvironment(m_pending_reader)` → release the reader (`m_pending_reader = nullptr`). **`RestoreTwoPass`/`RestoreEnvironment` are stubs in this phase (the Seam).** Keep this call order and site exactly as written.
4. **Settle** — let time run for ~0.5 s with **input still suppressed**, then **freeze again**. Teleports, character controllers and pooled spawns need real frames to take; a teleport issued into a frozen world can be swallowed. On the settle's **first tick**, call `ApplyDeferred()` (stub here) — the `07 §6` deferred-property queue needs live subsystems. The freeze controller needs an explicit settle mode: time released, input suppression kept. Then `SetRestoring(false)` — the restore window closes here. This is **not** the whole-replay capture gate: Player-Flow state capture stays off for the entire replay via a session-scoped gate (`06 §7`).
5. Set `m_applied = true` and **`OpenRoom(m_pending_ludeo_id)`** — it **MUST** pass the Ludeo's id as `OpenRoomParams.ludeoId` (Player Flow; `nullptr` opens a Creator-Flow recording and the rerun is silently not scored — `05 §6.2`). It is called directly here, *not* hung off the `phase 3 · task 4` "OpenRoom on entering gameplay" path. `OnRoomOpened → AddPlayer → OnPlayerAdded` sets `player_added`; `TryBeginGameplaySession()` runs and waits.

**Wait for Play.** The finished moment is now on screen, frozen, behind the overlay. The overlay owns the Play UI — don't draw your own.

**On `RoomReady` — the viewer pressed Play** (the platform withholds it until then): set `m_room_ready = true` and call `TryBeginGameplaySession()`. It issues `Begin` only when `player_added`, `room_ready` **and** `m_applied` are all true — the callbacks can arrive in **either order** (`05 §6.6`), so it is also called from `OnPlayerAddedCallback` — and **then unfreezes** (clears the restoration freeze and the input hold) and clears `m_restore_in_progress`. Nothing loads or is written after Play.

Do **not** wire to `ludeo_GameplaySession_AddNotifyPlayerReady` (doesn't exist) and don't treat `ResumeGameRequest` as the post-restore resume (mid-play only, CR-011).

**Playback end** (`05 §6.11`) — two paths, do not conflate them. **Backend ends the Ludeo** (timer hits 0, objective met/failed, or any backend-decided reason): the backend sends **`PauseGameRequest`** (CR-011), so the game just **freezes and waits** for the next platform event. The game does **NOT** detect end-of-moment, **NOT** call `End`, and **NOT** submit — the backend owns submission, and `PauseGameRequest` is the universal end-of-moment cue. **Game-initiated interrupt** (a validated `LudeoSelected` mid-play, `BackToMenuRequest`, or quit): the **game** calls `ludeo_GameplaySession_End(isAbort=true)` then `RemovePlayer → CloseRoom`. Calling `End` on the backend-ends path, or with `isAbort=false` on the interrupt path, are both bugs.

**The game's own end is not an end path.** A match, race or level that ends by itself during a replay (frag or time
limit, finish line, level complete, game over), and everything the game starts after it (intermission input, map
restart, map vote, next level, a Creator room for the next match), must **hold**: keep the room and gameplay session
open, stay on or freeze at the end screen (a freeze-only path — the hold must not send `PauseLudeo`, or the timer stops and the backend never ends the Ludeo), block the follow-ons, and let the backend end the Ludeo on its timer
(`05 §6.11`, CR-007 note). Find every such hook in the game now — they are usually in game-mode code the restore never
touches — and branch them on `m_is_player_flow_replay`. The phase 8 conformance suite replays a Ludeo through a
natural end to prove it (`8-polish.md`).

### Step 5: Clean Reset at Every End-of-Ludeo Path

Each exit from a Ludeo (`BackToMenuRequest`, the player quitting, the backend ending the Ludeo, **and** a validated `LudeoSelected` mid-play) must reset *every* piece of Ludeo-lifecycle state back to its "no Ludeo active" baseline before the next play starts: `m_is_restoring → false`, `m_restore_in_progress → false`, `m_room_ready → false`, `m_player_added → false`, `m_applied → false`, `m_pending_reader → null`, `m_pending_ludeo_id → ""`, `m_is_player_flow_replay → false` (the session-scoped capture gate — `06 §7`, `07 §2.3`), `m_freeze_restore → false` and the input hold (CR-010), `m_freeze_overlay → false` (CR-011 — only if no overlay is actually open at that moment), `m_pending_local_ludeo_id → ""` (the Step 3 launch-arg cache), `m_launching_into_ludeo → false` (the preselected-launch flag — `ludeo-integration-docs/LAUNCH-AND-READINESS.md` §4; also cleared at the commit and when a selection is ignored). Centralize the cleanup in a single `EndCurrentLudeo(then)` helper called from every exit path — otherwise a stuck flag from one play silently corrupts the next. It also **bumps `m_restore_generation`**, so the pending continuations of an interrupted restore no-op, and runs `then` once its teardown has completed. It does **not** touch the candidate id/reader: a newly validated selection holds its own copy through the teardown, and only `StartRestore` sets the pending state afterwards.

**On the *game-initiated interrupt* exit paths** (`BackToMenuRequest`, quit, a validated `LudeoSelected`) the helper must also call `ludeo_GameplaySession_End(isAbort=true)` (only if `Begin` ran) → `RemovePlayer → CloseRoom` for whatever it's tearing down — including a restore that opened its room but never reached `Begin`, or one still loading (no room yet: just reset and continue) — and call its continuation only after the close completes; on the **backend-ends** path the game never called `End` (it only froze on `PauseGameRequest`), so `EndCurrentLudeo()` only resets the flags — do **not** call `End` there (`05 §6.11`).

### Step 6: Lifecycle smoke test — run with `--ludeo=<id>` and verify validate + build-before-Play + resume (REQUIRED gate)

This is the gate that closes phase 5 · task 3. With Step 3 wired and the flow in place (read-back still stubbed), **run the game with the launch arg**. **Entities/properties will NOT be restored yet — the apply seam is stubbed; that's expected here and `phase 5 · task 4` verifies it.** Do not declare phase 5 · task 3 done by inspection — actually run it.

1. **Launch the game with the arg from the title menu / a cold start** (not from inside a running game) — this mirrors production, where `LudeoSelected` fires at startup before any game exists. Use any captured ludeo id from `phase 5 · task 1` testing.
2. **Before Play — verify the moment was built and is held, frozen, behind the overlay.** Check the pre-Play log, in this order:
   - `LudeoSelected` (synthesized by Step 3) fires with the expected `ludeoId`; `GetLudeo` is dispatched and **nothing else happens yet**.
   - The `GetLudeo` callback reports a **populated** reader (log `objectsCount`, non-zero) and the entry identity read from it.
   - The commit: `SetRestoring(true)`, the hold, the **correct** level loading (the one the Ludeo captured, not a default), native-spawn-done.
   - The `RestoreTwoPass`/`RestoreEnvironment` **stubs reached**, in order, then the settle, then the second freeze.
   - Only **then** `OpenRoom` **with the `ludeoId`** → `AddPlayer` → `OnPlayerAdded`.
   - On screen: the **captured level, frozen**, with the overlay's Play button — not the menu, not a loading cover. (State is still default — the stubs write nothing.)
3. **Press Play → `RoomReady` → `Begin` → unfreeze.** Confirm in the log that nothing loaded or applied after `RoomReady`, and that `Begin` fired once all three gates were set.
4. **Confirm the flow from the harness evidence (flow only).** Build the harness's `replay` scenario now
   ([`agent-test-harness.md`](agent-test-harness.md)) and run steps 1–3 and 5 through it. From its screenshots and
   samples, confirm yourself:
   - Before Play: the screenshot shows the **captured level**, frozen, behind the Ludeo overlay (the sampler shows
     the clock not advancing).
   - After Play (the overlay's real button, or the stand-in that enters the same `RoomReady` path — record which in
     `harness.playClick`): the game **resumed instantly** on that level — no load, no menu, no crash — and is
     ticking, not frozen.
   - **State is not restored yet** (default spawn / default state) — expected in this phase; `phase 5 · task 4`
     adds the read-back.
5. **Bad-selection check.** Launch once with an id that doesn't exist (or a Ludeo from another game) and confirm the selection is **ignored**: the log says why, and the menu (or the running game) is untouched — no teardown, no freeze, no room.
6. **Overlay pause/resume — what can and can't be tested locally (CR-011).** The SDK sends the overlay's `PauseGameRequest`/`ResumeGameRequest` **only in a cloud Player-Flow session — never in a local build** (the end-of-Ludeo `PauseGameRequest` does arrive locally — CR-011), so opening the overlay locally does **not** exercise these handlers, and a clean local run is no evidence they work. Locally, confirm instead: (a) both notifications are **registered at session creation** (log line per registration); (b) if the game has a debug hook, invoking the two handlers directly **freezes the simulation** (not just input) and **resumes** it, twice in a row. The real check is the cloud run after `phase 7`.

Steps 4 and 5 must pass on the harness evidence before declaring phase 5 · task 3 done. If any step fails, flag against `07 §2` / CR-010 / CR-011 and go back to the relevant earlier step — do not move on.

**If the game crashes during steps 1–3:** do **not** retry the launch blindly. Capture the stack trace and the last several log lines, identify the `ludeo_*` call on the failing frame and the thread it crashed on, then classify against `11-TROUBLESHOOTING §6` — for this phase the likely culprits are **wrong-thread SDK call** (didn't marshal off the notification thread), **SDK call before `Activate`** (the launch-arg dispatch fired too early — §6.7), or **null `DataReader` deref** (applied before validating populated). Fix at the root — don't paper over with null checks or try/catch — then rerun the full smoke test from step 1.

**Iteration discipline — Step 6 is a loop gate, not a one-shot:**

- **Iterate until it passes.** After every failure (crash or wrong-behavior), make a fix and rerun the full smoke test from step 1. Do not advance to "phase 5 · task 3 done" by inspection.
- **Propose-confirm-execute every fix.** No autonomous code changes between iterations — each fix is shown to the user, approved, then applied.
- **Fix at the root each iteration.** Don't add try/catch, null checks, or symptom-masking to make the test pass.
- **Stop iterating and escalate to the user when ANY of these holds:** the same failure mode recurs after a fix; three distinct attempts on the same failure haven't resolved it; a single iteration sprawls across many files without isolating the cause; or a single iteration's investigation has run unusually long with no convergence.
- **When escalating, hand the user a clear summary:** what failed (stack / log lines), the theories tried, what was changed in each attempt, what's still unknown — then stop and wait for guidance.

## Important Notes

- **This is the inverse of `phase 3 · task 4`, not `phase 5 · task 1`.** Every piece here mirrors the session lifecycle `phase 3 · task 4` wired (`OpenRoom → AddPlayer → RoomReady → Begin`). The data read-back is `phase 5 · task 4`. If you find yourself reading entity attributes back into the world, you're in `phase 5 · task 4`'s territory — stop and stub it.
- **Propose-confirm-execute** for every change. The `SetRestoring` setter, the hold/settle controller, and the overlay registrations touch project-wide classes — get explicit approval.
- **Validate before disturbing anything.** The handler only dispatches `GetLudeo`; a failed, empty or unplayable selection is ignored and the running session is untouched.
- **Build the moment before Play (CR-010).** Reach active gameplay, apply frozen, settle with input off, freeze, then `OpenRoom`. `RoomReady` is the viewer's Play click — on it, only `Begin` → unfreeze.
- **`OpenRoom` carries the `ludeoId`.** `nullptr` silently makes the rerun an unscored new recording (`05 §6.2`).
- **Validate the reader is populated before accepting it** (`GetObjectsInfo` Success && objectsCount>0). Early `GetLudeo` cycles return Success with an empty reader; ignore them, don't let a later cycle replace an accepted reader, and time out → ignore the selection (`07 §2.2.1`).
- **The overlay drives mid-play pause/resume — register it (07 §2.4)**, and remember it only fires in the cloud. The **post-restore resume is separate** — it comes through `RoomReady → Begin`. There is no `PlayerReady`.
- **Suppress start-of-run mechanisms during playback — both categories (07 §9.11).** `SetRestoring(true)` is set at the commit, *before* the level loads, so **state-clobbering** mechanisms fire during the load and silently skip via the gate. Gate **flow-blocking** UI on the same flag (press-start/click-to-continue gates, modal popups, EULA/login/age-gate, tutorial overlays, confirmation dialogs) so the moment behind the overlay is the captured state *and* is interactive on the first frame after Play.
- **Clean reset at every end-of-Ludeo path (Step 5).** Centralize in `EndCurrentLudeo()`; a stuck flag corrupts the next play.
- **Never block the SDK notification thread.** `LudeoSelected` arrives on the SDK's thread — marshal immediately.
- Every SDK call wrapped in `#if LUDEO_SDK_ENABLED` (CR-001).
- Do not modify game logic — only add SDK-driven flow control. If a hook site doesn't exist, propose adding it as a separate, named change first.

## Related Commands

- `3d-implement-sdk-lifecycle.md` — wired the `RoomReady → Begin` chain this phase reuses for the post-restore resume
- `5c-plan-state-restoration.md` — produces the `RESTORATION_PLAN.md` this command consumes
- `5e-implement-state-reconstruction.md` — fills the `RestoreTwoPass`/`RestoreEnvironment` stubs this phase calls (run NEXT)
- `3e-compile-and-fix.md` — run after to verify compilation

## ✅ Exit gate — rebuild + run (REQUIRED — do not advance without it)

This phase edited source files, so it is **not done** until the game still builds and runs. **The agent runs the build itself** (CMake / MSBuild / make work headless) and reads the
log, and **runs the game itself** through the agent test harness ([`agent-test-harness.md`](agent-test-harness.md)):

1. **Rebuild — the agent, not the integrator.** **Rebuild** and confirm a **clean build with `LUDEO_SDK_ENABLED=1` and `=0`** — run the build-and-fix
   loop in `3e-compile-and-fix.md` and read the build log.
2. **Run the game and confirm it still runs** — play a Ludeo and confirm the lifecycle smoke test
   (Step 6) passes: the captured level held frozen behind the overlay before Play, an instant resume on
   Play, a bad selection ignored, with no SDK errors or crashes in the log. The **data** read-back is
   `phase 5 · task 4`, so fully-restored state isn't expected yet — you're confirming the flow fires and
   the game doesn't break.

The agent verifies both itself — show the build command and its result, and the harness run (scenario
`replay`): its command, `result.json`'s verdict, the log lines that prove it, and the screenshots you opened.
If it cannot build here (toolchain missing, IDE-only or license-gated build), say so and ask the integrator to
build. **Do not offer to advance until the build and the run both pass.** Only when `intake.runnability.runsTheGame` is
`"integrator"` (or this check is in `integratorPlays`) does the integrator run it, and then beyond the log the
agent relies on their word. Then
run `5e-implement-state-reconstruction.md` to fill the apply seam.
