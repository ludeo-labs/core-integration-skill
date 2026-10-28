# Know Your Game — the kickoff intake

Run at the end of `phase 1` (Step 11). It captures what **cannot be read from the code**: design, UX and environment
decisions only the game team can make. Structural analysis (`phase 2`) answers *what classes and hooks exist*; it
cannot answer *what the first frame of a Ludeo must look like* or *how the game is launched in production*. Those
answers otherwise surface as mid-integration corrections that each cost a rebuild cycle.

**Every question here feeds a check in a later step** (listed under each group). A question with no downstream check
doesn't belong here. Record every answer in `ludeo-integration-plan/integration.json` → `intake`
([`state-file-schema.md`](state-file-schema.md)).

## How to ask

- **Ask in the team's language.** They know their game and their engine, and nothing about Ludeo. No phase numbers,
  file names or Ludeo-internal terms in the question; explain any Ludeo concept inline in one plain sentence (a
  *Ludeo* is a short playable moment cut from a real play session; *Player Flow* is someone else starting that moment
  from the captured state).
- **Investigate before asking.** Where the code can answer (a save system, a pause primitive, how the game boots),
  find the answer with `file:line` and ask the user only to confirm.
- **Unknown is an answer.** Record `"unknown"`, add it to `risks` with the step that must resolve it, and move on —
  never block the kickoff on it.
- **Recommend, then ask.** Where a question is a product choice, say what you'd pick and why in one sentence.
- Target 20–30 minutes with the team lead.

---

## Group 0 — Game and Ludeo profile

| ID | Question |
|----|----------|
| `PRO-1` | Game title, genre(s), target platform, and how players sign in (Steam / other). |
| `PRO-2` | **What is a great Ludeo of this game?** The moment a creator would want to share; what a player should experience when they launch it; typical length; the player actions that matter most. |
| `PRO-3` | Does the game have **boss encounters** (or other multi-phase set-piece fights)? |

```json
"profile": { "genres": ["shooter"], "platform": "windows", "auth": "steam-implicit",
             "ludeoConcept": "a clutch 1v3 in the final zone, 30–90 s", "keyActions": ["Kill", "Revive"],
             "hasBosses": false }
```

**→ Feeds:** `phase 4` Step A3 and `phase 6 · task 1` Step 2 (which `game-patterns/` files to load, instead of a web
search; `hasBosses` → `game-patterns/bosses.md`); `phase 6 · task 1` / `task 2` (the key actions are mapped, and goals
are built on them); `phase 4`'s census (what the moment needs).

---

## Group 1 — Visible player state

The first frame a viewer sees must match the captured moment *visually*, even when the state is technically
correct. "The state is right but the avatar looks wrong" is the most common UX failure, and it is a design call.

| ID | Question |
|----|----------|
| `VPS-1` | What MUST the player see correctly **in the first frame**? Walk the avatar top to bottom: headgear, face, outfit/skin, weapon in hand and its attachments, ammo, health, armor/shield, equipped gadget, active effects. |
| `VPS-2` | What visible state is cosmetic and can be deferred or skipped (idle fidget, breathing, mid-reload pose, cape sway)? |
| `VPS-3` | What HUD must read correctly at frame 0 (score, timer, objective text, minimap markers, squad indicators)? |
| `VPS-4` | Does a loadout / progression / unlock rule limit which weapons or gadgets the player can be restored with? |

```json
"visiblePlayerState": { "firstFrameRequired": ["outfit", "weaponEquipped", "ammo", "health"],
                        "deferrable": ["idleFidget"], "hudAtFrameZero": ["timer", "objective"],
                        "loadoutDependency": "none" }
```

**→ Feeds:** `phase 4` — every `firstFrameRequired` item must be mapped (`06 §9.3`: visible constants are captured
too). `phase 5 · task 4` — each must be **restored**, not stubbed, before the task completes; its smoke test checks
them on the frozen frame behind the overlay.

---

## Group 2 — Game-wide phase state

Most games keep a few globals that drive music, AI pressure, UI tone or mission flow. If they change during a
moment, they must be captured continuously — and restoring them is a separate requirement.

| ID | Question |
|----|----------|
| `DPM-1` | Which game-wide phase/state values drive music, AI behaviour, UI or mission flow (alert level, combat phase, intensity, mission state)? |
| `DPM-2` | Do any of them **change** during a typical moment? |
| `DPM-3` | Must they be **restored** when a Ludeo starts, or is capturing them enough? |
| `DPM-4` | What is fixed for the whole run (map, difficulty, mode)? |

```json
"dynamicPhaseMetadata": { "phaseValues": [ { "name": "AlertLevel", "changesDuringMoment": true, "mustRestore": true } ],
                          "staticMetadata": ["MapId", "Difficulty"] }
```

**→ Feeds:** `phase 4` (each value is an attribute on the world/session object — `06 §1.2`); `phase 5 · task 1`
(values that change are written every tick); `phase 5 · task 2` (values with `mustRestore` are in the restore plan).

---

## Group 3 — Playback UX bar

The gap between "the restored state is correct" and "the first seconds of the Ludeo feel right" has to be set
explicitly, or the integration lands technically and is rejected on feel.

| ID | Question |
|----|----------|
| `PUX-1` | What should the first 5 seconds after Play feel like? Is any visible transition acceptable, and for how long? |
| `PUX-2` | What plays at a normal level start — intro cinematics, briefing voice-over, countdown, warm-up, tutorial gates, press-start screens? Must each be skipped when a Ludeo starts? What triggers each? |
| `PUX-3` | Are equip / draw / ability-activate animations acceptable at the start of a Ludeo, or must they be instant? |
| `PUX-4` | How long may input stay locked after Play before the player has full control? |

```json
"playbackUXBar": { "firstSecondsMustFeel": "immediate action, no briefing",
                   "startOfRunToSuppress": [ { "what": "briefingVO", "trigger": "Mission::Begin" } ],
                   "instantAnimations": ["weaponEquip"], "maxInputLockMs": 500 }
```

**→ Feeds:** `phase 5 · task 2` — every `startOfRunToSuppress` entry is on the start-of-run suppression list (`07
§9.11`, both categories); `phase 5 · task 4` — the smoke test confirms `firstSecondsMustFeel` with the user.

---

## Group 4 — Capture timing

A Ludeo captured too early is empty — not because the integration is broken, but because nothing has happened yet.
Without a stated threshold, early captures get debugged as bugs.

> **The Creator-Flow room opens on the run-start / level-load path, not on a gameplay-phase condition.** `OpenRoom`
> goes where the level loads (`05 §6.2`, CR-009); a warm-up, countdown or "interesting state" condition gates only
> **`Begin`**. The one exception is a readiness-gated launch: there `OpenRoom` waits for the start trigger
> ([`LAUNCH-AND-READINESS.md`](ludeo-integration-docs/LAUNCH-AND-READINESS.md) §3).

| ID | Question |
|----|----------|
| `CTR-1` | When does **interactive gameplay** begin — after warm-up / countdown, at first contact, after N seconds? (This gates `Begin`, never `OpenRoom`.) |
| `CTR-2` | When should a capture end — mission end, extraction, death, an explicit player action? |
| `CTR-3` | Below what point are captures *expected* to be uninteresting (no enemy engaged yet, progression 0)? |

```json
"captureTimingRules": { "beginTrigger": "after countdown", "endTrigger": "missionEnd OR death",
                        "minimumInterestingState": "first enemy engaged" }
```

**→ Feeds:** `phase 3 · task 3` / `task 4` (the `Begin` gate and the teardown trigger; the room still opens on the
level-load path); `phase 3 · task 2` — the TDD records `minimumInterestingState`, so an early, empty capture is matched
against it before anyone debugs it.

---

## Group 5 — Scripted systems driven by past events

**Snapshot state** (positions, health, current phase) can be captured and applied directly. **Progression trails**
(objectives passed, milestones hit, props used, the history a level script reacts to) cannot be restored by
writing values alone: scripted systems respond to a *sequence of past events*. Restore only the current values and
the level re-runs its opening logic — early voice-over, early-phase spawns. The fix is still a snapshot, not a
timeline replay: capture **how far** the trail got, and restore it through the game's own "advance to this point"
entry, with that call's side effects (spawns, voice-over) gated (`07 §11`).

| ID | Question |
|----|----------|
| `EDS-1` | Which mission / objective / milestone systems drive scripted events (spawns, voice-over, cinematics, area activation, prompts)? |
| `EDS-2` | Does each fire from **current state** (a snapshot works) or from **a sequence of past events** (a trail is needed)? An "objective completed" / "milestone passed" event that triggers logic is a trail. |
| `EDS-3` | Does level or mission scripting run logic based on how far the mission has progressed? |
| `EDS-4` | Which mission props carry state that matters (deployables, switches, disabled cameras, activated zones, destructibles)? |

```json
"scriptedSystems": { "systems": [ { "name": "MilestonePassed", "kind": "trail", "loadBearing": true,
                                    "captureHook": "Mission::OnMilestone", "replayHook": "Mission::AdvanceTo" } ],
                     "missionProps": ["switch", "extractionZone"], "levelScriptReactsToProgress": true }
```

**→ Feeds:** `phase 4` (trail systems are captured — with `loadBearing` they are in the first wave, never deferred);
`phase 5 · task 2` (each load-bearing trail has a capture **and** a restore path in the plan — the game's own
"advance to this point" entry, called during the apply, its side effects gated per `07 §11`); `phase 5 · task 4` (the
smoke test confirms the level does not re-run its opening logic).

---

## Group 6 — Launch model

Two independent axes — ask both; a game can boot straight into play for creation and still take Ludeos mid-run.

| ID | Question |
|----|----------|
| `LM-1` | **Creator launch:** does a normal session start through a menu / lobby / level select, or does the game **boot straight into gameplay**? If there is a menu, is it a deliberate click-through, or does "Play" load and start immediately? |
| `LM-2` | **Player (Ludeo) launch:** is a Ludeo picked while the game is already running, is the game **launched with a Ludeo preselected** (it boots into the replay), or both? |
| `LM-3` | Does the game ever auto-continue, skip its intro, or boot directly into a session (a "continue" path, a debug auto-enter)? |

```json
"launchModel": { "creatorLaunch": "menu-gated | boot-straight | fast-menu-autostart",
                 "playerLaunch": "mid-run | preselected | both", "autoEnterPaths": [] }
```

**→ Feeds:** `phase 2` cross-checks the answer against the boot-flow code and flags a mismatch; `phase 3 · task 3` /
`task 4` — when either axis is boot-straight / preselected, or the menu starts immediately, build the SDK-readiness
gate ([`LAUNCH-AND-READINESS.md`](ludeo-integration-docs/LAUNCH-AND-READINESS.md) §3); a preselected launch also needs
the game's own auto-start suppressed (§4); `autoEnterPaths` are run boundaries (`game-patterns/open-world.md`).

---

## Group 7 — Runnability

| ID | Question |
|----|----------|
| `RUN-1` | Can a level be played **without the game's live/online backend**? If not, is there (or must there be) an offline switch? |
| `RUN-2` | What is the exact way to load a given level from a cold start (command-line argument, console command, a state-machine call)? |
| `RUN-3` | Not a question about who plays — **the agent runs every run check itself** through the agent test harness. Tell the user that, then ask: *"Do you want to play any of the checks yourself? And are there debug or cheat commands, a console, bots, or a demo mode I should know about?"* |
| `RUN-4` | Can the game run on **this** machine at all — license, hardware, platform? (Answer from the phase 1 builds and the Step 10 `boot` run where you can.) |

```json
"runnability": { "offlineBackend": "works | switch-exists:<flag> | switch-needed",
                 "levelLoadCommand": "--level=<id>", "runsTheGame": "agent",
                 "integratorPlays": [], "devCommands": "console: `give`, `god`; bots via `addbot`" }
```

`runsTheGame` is `"agent"` unless RUN-4 is no (then `"integrator"`, with the reason in `risks`). `integratorPlays`
lists the checks the user chose to play themselves (default empty).

**→ Feeds:** every rebuild + run gate (`agent-test-harness.md`); `phase 2` §10 (the automation levers, seeded by
`devCommands`); `phase 5 · task 2` / `task 3` (reaching a captured level from a cold start uses `levelLoadCommand`);
`switch-needed` is a **blocker** — record it in `risks` against `phase 3 · task 4`.

---

## Group 8 — Save system (game level)

Answer from the code, then confirm. The per-entity reconciliation-vs-manual matrix is **not** built here — it needs
`CODE_MAP.json` and is produced in `phase 3 · task 6`.

- **Mechanism** (custom binary, JSON, an engine serializer, none) and **format** (named fields / opaque blob / mixed).
- **Group:** **1** full gameplay-state save · **2** checkpoint / partial · **3** none (settings / scores only).
- A strong save is not the same as reconciliation: a Group-1 game that saves opaque bytes is still **manual** per
  entity. Transition / streaming caches are not the canonical save — find the real save/load path.

```json
"saveSystem": { "mechanism": "custom binary", "format": "opaque-blob", "group": 1,
                "entryPoints": ["SaveManager::Save (src/save/SaveManager.cpp:88)"] }
```

**→ Feeds:** `phase 3 · task 6` (starts from this, adds the per-entity matrix).

---

## Done when

- [ ] Every group answered or marked `"unknown"`, recorded in `integration.json → intake` with `completedAt`.
- [ ] Every unknown is in `risks` with the step that must resolve it.
- [ ] Code-answerable items carry `file:line` evidence and were confirmed by the user.
