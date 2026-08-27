# Open-World / Streaming-World Pattern

> **Applies to:** Open-world RPGs (Daggerfall Unity, Skyrim, Fallout, Witcher), open-world action (GTA, Red Dead), sandbox/survival (Minecraft, Valheim, 7 Days to Die), MMOs/MMORPGs, and any game with a continuous streaming world rather than discrete level/match/mission scenes.
>
> **Load when:** the game has no per-level scenes, the world streams in/out (terrain, locations, chunks), and session boundaries are driven by a state machine or event dispatcher — *not* by `LoadLevel` / `LoadScene` / `StartMatch`.
>
> **This is a structural pattern, not a genre pattern.** Unlike `shooter.md` / `rts.md` / `racing.md` (which catalog actions and trackable objects), this file is about **session lifecycle**: where a Gameplay Session begins and ends when there is no level to bracket it.

---

## 1. The Boundary Rule

**One continuous live run = one Gameplay Session.** Length is irrelevant. A 100-hour Daggerfall play-through is one Gameplay Session, same as a 90-second deathmatch round.

This is **not** a redefinition. The Ludeo Session / Gameplay Session model from [03-SDK-FUNDAMENTALS.md §2.1](../03-SDK-FUNDAMENTALS.md#21-ludeo-session-vs-gameplay-session) and [05-LIFECYCLE-MANAGEMENT.md §3](../05-LIFECYCLE-MANAGEMENT.md#3-ludeo-session-vs-gameplay-session) defines a Gameplay Session as *"a playable moment"* — the `(level, match, mission)` parenthetical is illustrative, not constraining. For a streaming world, the **playable moment is the live run itself**.

```
Ludeo Session  ── activated at game launch, released at game shutdown ─────────┐
                                                                                │
   Gameplay Session 1  ── new-game ────────────── death ──────┐                 │
                                                              │                 │
   Gameplay Session 2  ── load save ───────── back-to-menu ───┤                 │
                                                              │                 │
   Gameplay Session N  ── load save ─────────── quit ─────────┘                 │
                                                                                │
                                  game shutdown ──────────────────────────────► ┘
```

## 2. Is / Isn't a Boundary

| Event | Boundary? | Why |
|---|---|---|
| New game started | ✅ Start | First live frame of a fresh run |
| Load save (from menu) | ✅ Start | First live frame of a resumed run |
| Player death (permadeath) | ✅ End | Run is over |
| Return to main menu | ✅ End | Player exited the run |
| Quit to desktop | ✅ End | Process is leaving |
| Load a *different* save while in-game | ✅ End-then-start | Current run ends, new run begins |
| Dungeon / interior / building enter / exit | ❌ | Same run, different cell |
| Fast travel | ❌ | Same run, teleport |
| World streaming (chunk in/out) | ❌ | SDK doesn't see streaming |
| Sleep / wait / time-skip | ❌ | Same run, time advanced |
| Day / night transition | ❌ | Same run |
| Pause menu / inventory / map | ❌ | Pause overlay, not a boundary (see §5) |
| Dialogue / conversation | ❌ | Same run, modal UI |
| Cutscene | ❌ | Same run, scripted segment |
| Ludeo overlay opened mid-play | ❌ for the boundary | Pause via [CR-011](../00-CRITICAL-REQUIREMENTS.md), not End |

The principle: **only end the Gameplay Session when the live run itself ends.** Everything else is "inside one run."

## 3. Where to Bind `OpenRoom`

[05-LIFECYCLE-MANAGEMENT.md §6.2](../05-LIFECYCLE-MANAGEMENT.md#62-opening-a-room-level-loading-starts) says call `OpenRoom` "when level/match **starts loading**" so SDK async latency hides under the load. For streaming-world games there are three valid bind points, trading latency hiding for proximity to actual gameplay:

| Bind point | Pro | Con |
|---|---|---|
| **Earliest** — the dispatcher that initiates a new/load (e.g. Daggerfall's `StartGameBehaviour.InvokeStartMethod` for `NewCharacter` / `LoadDaggerfallUnitySave` / `LoadClassicSave`) | Maximum latency hiding | The chain may complete long before the player is actually in control |
| **Canonical** *(recommended)* — the game's own "gameplay began" event (e.g. `OnStartGame` / `OnNewGame`, or a state-machine transition into the in-game state) | One canonical, well-subscribed signal; aligns with how the rest of the game already thinks about "the run started" | Slightly less latency hiding |
| **Latest** — the moment the player has control (e.g. state machine reaches `Game`, player input unlocked) | Begin lands right at gameplay start; no gap | Gives up the loading window entirely |

**Default to the canonical event.** Use the earliest bind point only if the canonical event fires too late to hide visible startup time.

## 4. The Existing `RoomReady + PlayerAdded` Gate Is Sufficient

You may worry: "if `OpenRoom` fires at loading start but `StateManager` doesn't reach `Game` for several seconds, won't `Begin` fire before the world is live?"

**No third gate is needed.** The existing `TryBeginGameplaySession()` helper ([05-LIFECYCLE-MANAGEMENT.md §6.6](../05-LIFECYCLE-MANAGEMENT.md#66-beginning-gameplay-after-loading-complete)) gates on `PlayerAdded + RoomReady` — both SDK-side signals. The reason this is safe even when the game world isn't live yet:

- **Sampling is gated by the game's own in-gameplay state — *and* must be off entirely during a Player-Flow replay.** Per the sampling gate ([06-TRACKING-PATTERNS.md §3](../06-TRACKING-PATTERNS.md)), `LUDEO_CAPTURE_*` calls only fire while the game is actually in gameplay. Between `Begin` and the world becoming live, the sampler is dormant — nothing is captured. **But a Player-Flow replay is *also* in-gameplay**, so the in-gameplay gate alone does not exclude it: add a **session-scoped Player-Flow gate** (set when this session's `OpenRoom` carried a `ludeoId`) that suppresses all state capture for the whole replay (`07 §2.3`, `06 §7`). `IsRestoring()` only covers the restore window — it goes false mid-replay, and capture would resume.
- **Actions only fire on real gameplay events.** They're hooked to kills / pickups / quest completions, not to the loading sequence. The loading window doesn't generate action calls.
- **The first captured frame is the real first gameplay frame.** The gap between `Begin` and "world live" is dead time on the SDK side — invisible to the captured Ludeo.

So: keep `TryBegin`'s two-gate `if (player_added && room_ready)`. Do **not** add a third condition. The safety net is the sampler gate inside `Update`, not a third callback.

## 5. Pause Coverage

Per [CR-011](../00-CRITICAL-REQUIREMENTS.md), the Ludeo overlay opening mid-play must **freeze the simulation** — not just input. In a streaming world this means:

- **Use the game's existing pause primitive** if it freezes the sim (e.g. Daggerfall's `GameManager.PauseGame()` / `StateManager.Paused`). If it only pauses input, build a sim-tick freeze.
- **Streaming jobs / coroutines** (terrain Jobs, asset loading, AI tick) must be paused too if they advance world state. Background asset *I/O* that doesn't mutate gameplay state can keep running.
- The pause needs **two independent flags** for `PauseGameRequest` and the post-Ludeo-load pause ([CR-010](../00-CRITICAL-REQUIREMENTS.md)) — not one shared boolean.

## 6. Restoration: Read the Ludeo, Then Reach Active Gameplay and Overwrite

The apply (your load-save plumbing) writes into a **live run** — player, world, and in-gameplay state all present — so the restore must ultimately land on one. But the flow is **synchronous read-then-load**: you fetch the Ludeo's `DataReader` *first*, and only then do you know **which** run to boot — for a streaming world, the captured world cell / spawn region (`room_x`, `room_y`, read from the reader). So "reach active gameplay" is **not** the first step — it happens **inside the apply**, after the reader is in hand. "Active gameplay" is still the target: the point at which, *without Ludeo's intervention, the player would have been able to start playing* (menus, character-creation / new-game / load, loading, intros all done). For a streaming world there is **no per-level scene to load** — entering gameplay is a state-machine transition (`StartGameBehaviour` → `StateManager.Game`), driven once you've read where to go.

> 🔴 **`LudeoSelected` very often arrives at the title menu / app startup — where there is no run at all.** This is the *common production case* (the platform and the forced-Ludeo launch fire it at startup), not a rare edge. Restoring there silently no-ops: the load path hits its "no active game" guard (`!HasInstance` / no `SerializablePlayer`), bails, `onComplete` fires, and `Begin` runs at the menu — overlay/recording start with **nothing reconstructed**. Do **not** assume the player is persistent and the apply "just repositions" it — at the menu the player does not exist yet, so you must **create** the run.

Restoration only ever starts from one of **two** states (the game is in player flow or creator flow from launch, by whether a Ludeo ID was provided — it does not switch a creator run into a replay mid-run):

- **No Ludeo run active yet** (startup / menu): drive the game's new-game / load-save entry to **create** the run (`StartGameBehaviour` → `StateManager.Game`), reaching active gameplay.
- **A Ludeo is already playing** (another `LudeoSelected` arrives during playback or while it awaits Play): tear down the current Ludeo's Gameplay Session + Room (`GameplaySession_End(isAbort=true)` → `RemovePlayer` → `Room_Close`; **do not** quit to desktop — the Ludeo Session survives) **and reset prior-Ludeo state** (release the old reader, re-arm `IsRestoring`, swap in the new `ludeoId`), then reach active gameplay for the **new** Ludeo.

From there, both converge on the **synchronous read-then-load** sequence:

1. **Freeze the simulation the instant `LudeoSelected` fires** (sim tick frozen, CR-010) — it may already be frozen at the menu. The freeze holds until the apply.
2. **Dispatch `GetLudeo(ludeoId)` and `OpenRoom(ludeoId)` now — they race.** `OpenRoom` carries the `ludeoId` (Player Flow) and is called **directly in the handler**, *not* hung off a level-load hook (no level loads yet); `OpenRoom → AddPlayer` run, and the SDK's `RoomReady + PlayerAdded` gate the overlay. The captured **world cell is still unknown** here.
3. **On `RoomReady`** (the player pressed Play; the apply fires once **both** the reader is cached and `room_ready` is set): **unpause → read the entry identity from the reader (`room_x`, `room_y`, spawn region) → reach active gameplay (drive `StartGameBehaviour` → `StateManager.Game` into that region; create the run if none exists) → overwrite with the captured state** via your existing load-save path (the Ludeo is a "save file from elsewhere"). At the menu there was no run — you **create** it here.
4. `OnRoomReadyCallback` is the **post-Ludeo-load resume** — the unpause + load + apply above all happen here. See [07-RESTORATION-PATTERNS.md §2](../07-RESTORATION-PATTERNS.md) and CR-010.

The mental model is **"read the Ludeo, then boot the run it points to and overwrite it,"** not "load a save into whatever is on screen" and not "boot a generic run *before* you've read where to go." If your game has a clean "start/load right now, abort current run" path, route Ludeo restoration through it — but make sure that path actually *enters* gameplay, and that you drive it with the cell/region read from the reader; at the menu it must create the run, not assume one.

## 7. The Sandbox Edge Case (Minecraft / Valheim / 7 Days)

If the game is genuinely indefinite — no death, no permadeath, no narrative end — the run is bounded by **load → play → save-and-exit**. That's still one Gameplay Session:

- **Start** — world load complete (single-player) or server-join complete (multiplayer-ish).
- **End** — save-and-exit, or disconnect from the world.

Long sessions are fine. The Ludeo platform is designed for runs of any length; what matters is that the boundaries map to clean **points of perfect world state** — the moments the game itself considers safe to persist or close.

## 8. Worked Mapping — Daggerfall Unity

| Lifecycle event | Game signal | SDK call |
|---|---|---|
| Game launch | `DaggerfallUnityApplication.SubsystemInit` → `GameManager.Awake` | `ludeo_Initialize` → `Session_Create` → `Session_Activate` |
| New run begins | `StartGameBehaviour.OnNewGame` *or* `OnStartGame` (recommended bind point) | `Session_OpenRoom` |
| World streamed in, player in control | `StateManager.ChangeState(Game)` | *(no SDK call — sampler gate opens)* |
| Player dies (permadeath) | `PlayerDeath` → `StartMethod = TitleMenuFromDeath` | `GameplaySession_End(isAbort=false)` |
| Return to menu | `StartMethods.TitleMenu` | `GameplaySession_End(isAbort=true)` |
| Load different save while in-game | `StartMethods.LoadDaggerfallUnitySave` while in `Game` state | `GameplaySession_End(isAbort=true)` then `Session_OpenRoom` for new run |
| Pause menu / inventory open | `StateManager.Paused` / `UI` | *(local pause only — not a boundary)* |
| Ludeo overlay opened | SDK `PauseGameRequest` | `GameManager.PauseGame()` (sim freeze, [CR-011](../00-CRITICAL-REQUIREMENTS.md)) |
| Application quit | `Application.Quit` | `GameplaySession_End` (if mid-run) → `Session_Release` → `Shutdown` |

The CODE_MAP `session_boundaries` block produced in `phase 1` is the input for this mapping. See [`../../2-map-game-code.md`](../../2-map-game-code.md) §5.

## 9. After This File

This file decides *when* a Gameplay Session lives. For *what* a streaming world captures — presence ≠ existence, world/cell object types, identity across stream cycles, scope-to-the-moment — read its tracking companion [`open-world-tracking.md`](./open-world-tracking.md) alongside [`06-TRACKING-PATTERNS.md`](../06-TRACKING-PATTERNS.md). You also still need the **action catalog** and genre **tracking checklist** for whichever genre(s) the game blends — load the relevant genre file(s) (`shooter.md` / `rts.md` / `racing.md` / `rpg.md` / `survival-sandbox.md`) via [`INDEX.md`](./INDEX.md), or compose from multiple.
