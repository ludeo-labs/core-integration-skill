# Agent test harness — the agent runs the game itself

Every run gate in this skill (phase 3 · task 5, phase 5 · tasks 1, 3 and 4, phase 6 · task 2, phase 7) needs the
game to be **run**, and most need it **played**: reach gameplay, capture a moment, replay a Ludeo, fire an action.
**The agent does this itself.** It builds the game from source, so it can also build the test tooling to drive it,
and it can read logs and look at screenshots. The integrator is not asked to play a gate unless they chose to
(`intake.runnability.runsTheGame: "integrator"`) or the harness genuinely cannot reach it.

"The agent can't see the game" is wrong. It can launch the game, drive it, read its log, and **open a screenshot
with its file-reading tool and look at it.** What it can't do is guess: every claim about a run cites a log line,
a result file or a screenshot it opened.

The Unity skill carries the same idea (`ludeo-unity` → `agent-test-harness.md`); this is the C++ version. The
mechanism differs because here the agent compiles the game: the harness is a few files in the integration's own
folder, behind a compile define.

## What stays with the integrator

| The agent | The integrator |
| --- | --- |
| Builds the harness and runs every run gate | Approves plans and phase go-aheads, as before |
| Drives the game to a moment and **captures** it | **Turns a captured moment into a Ludeo** and sends back its id — batch several per ask |
| **Replays** each Ludeo, reads the result file, opens the screenshots, fixes and re-runs | **Signs off once per wave** from the evidence bundle, without playing |
| Fires every mapped action and checks its emission in both flows | Upload and assign confirmations (phase 7), Studio Lab writes that need a go-ahead |
| Records anything it could not confirm as an **open item** | Plays a gate only if they want to |

A question of the form *"can you run the game and tell me…"* is a harness gap. Close the gap; don't ask. The one
exception is a check the harness provably can't make after you tried (say what you tried) — then ask for that
check only, with the exact launch command and what to look for.

## Pick the cheapest lever

Use the simplest thing that reaches the moment. Most engines already ship most of what a harness needs; phase 2
records them in `CODE_MAP.json → automation` (`2-map-game-code.md` §10).

| Rung | Lever | Examples | Use for |
| --- | --- | --- | --- |
| 1 | **The game's own automation surface** | launch arguments that load a level (`intake.runnability.levelLoadCommand`), console / cvar scripts executed at boot (`+exec`, `+map`, autoexec files), bot / AI control of the player, demo or replay playback, benchmark / timedemo modes, scripting VMs, property or telnet servers, a built-in screenshot command, a quit command | Booting into gameplay, moving the world forward, quitting cleanly. Zero new code. |
| 2 | **In-process harness module** (test-only code you add) | reads a job file, runs scenario steps from the per-frame hook, calls the game's own functions (start a level, grant an item, kill an enemy, inject input through the game's input layer), samples state, writes `result.json`, takes screenshots through the engine's renderer, quits with an exit code | Anything rung 1 can't reach, and every check that needs the game's state read back |
| 3 | **OS-level input and capture** | `SendInput` / `keybd_event` to the game window, `PrintWindow` / a screen grab, `xdotool` on Linux | Only what must arrive through the real OS input path — chiefly the **Ludeo overlay's capture hotkey** and the overlay's Play button — and a last resort |

Prefer rung 1 over 2 over 3. Rung 3 needs the game window in the foreground, which competes with the integrator's
own use of the machine and with other agents running games on it (see **Sharing the machine**).

## The harness module (rung 2)

**Test-only and compiled out of shipping builds.** Fence it with its own define, e.g. `LUDEO_AGENT_HARNESS`,
on only in the configurations the agent tests (Debug / dev / RelWithDebInfo), **never** in the configuration
phase 7 uploads. Put it in the integration's own folder (`src/ludeo/agent/` or the plan's equivalent), never
spread through game code: the game gets **one** call site, from the per-frame hook phase 3 already wires
(`CODE_MAP.json → lifecycle_hooks.main_loop`), plus one launch-argument parse. With no job argument it does
nothing.

| Piece | What it does | Must |
| --- | --- | --- |
| **Job argument** | `--ludeo-agent-job=<abs path to job.json>`: scenario name, its arguments, a timeout, an output folder | Be the only way to turn the harness on. No job → dormant. |
| **Runner** | Ticks once per frame on the main thread, runs the scenario's steps in order, each with a start, a done check, a timeout and a failure reason | Record per step what it saw, not just pass/fail. Never block the frame. |
| **Drivers** | The game calls a step needs: load a level, wait for control, move / fire / use through the **game's own input or command layer**, grant or kill through its own functions | Go through the game's own paths — a shortcut that skips a game system tests nothing. |
| **Sampler** | Once a second: the game clock, pause state, the run phase, input blocked or not, and the current wave's key values | Read through the same accessors tracking uses. |
| **Screenshots** | Through the engine's own screenshot / framebuffer read; fall back to rung 3 | Taken at named points (`gameplay`, `pre-play`, `restored`, `end`), written as PNG. |
| **Result** | `result.json`: verdict, per-step detail, error and warning counts from the log, duration, the paths of the log and screenshots | Be the one file the agent reads first. Then quit the game cleanly with exit code 0 (passed) / 1 (failed) / 2 (timed out). |
| **Stand-in Play click** *(replay)* | Enters the **same** handler the overlay's Play click reaches (`RoomReady` → `Begin`), for when the real button can't be pressed | Call the real path, never a shortcut around it. Prefer pressing the real button (rung 3) at least once per integration; record which one a run used. |
| *Optional:* fault injection | Makes a restore stage throw or hang on purpose, to prove the player is never left in a frozen world | Log an `injected fault` line. A fault run without that line tested nothing. |

Runs and their evidence live under `ludeo-integration-plan/agent/runs/<run-id>/` (`job.json`, `result.json`, the
game and SDK logs copied out, screenshots). Ignore the screenshots and logs in VCS; commit the scenario files.

A **runner script** (`ludeo-integration-plan/agent/run.ps1` or `.sh`) wraps one run: write the job, launch the
build with its full path and arguments, wait with a hard timeout, **kill the process on timeout**, copy the logs
out, print `result.json`. Every gate calls this script, so a run is one command the agent can repeat.

## Scenarios — what each gate runs

Build them as the gates need them; each is small.

| Scenario | Built in | Steps | Closes |
| --- | --- | --- | --- |
| `boot` | phase 1 Step 10 (rung 1 only, no code) | launch the baseline build into gameplay with `levelLoadCommand`, wait, screenshot, quit | proves the agent can run the game before any SDK code exists |
| `smoke` | phase 3 · task 4 | boot → SDK activated → gameplay → room open → hold N s → pause / resume → exit to menu (room closed) → quit | the phase 3 run gate |
| `capture` | phase 5 · task 1 (wave 1), extended per wave | boot → reach the moment the wave tracks, **mid-run** → press the capture hotkey (rung 3) → confirm the capture in the SDK log → play on a few seconds → exit | gate 1 of every wave |
| `replay` | phase 5 · task 3 | launch with `--ludeo=<id>` → wait for validate → pre-play frame frozen behind the overlay (screenshot) → Play (real button or stand-in) → sample N s → screenshot → exit; `replay-twice` re-selects a second Ludeo through the real path | 5d Step 6, gate 4 of every wave |
| `actions` | phase 6 · task 2 | perform each mapped action at least once through the game's own paths, in a capture run and in a replay | the phase 6 run gate |

**Capture specifics.** Read the live capture binding from the SDK / overlay log on the first run, not from the docs
— an environment can override the default — and record it in `integration.json → harness.captureHotkey`. Send it
to the game window while it's in the foreground. Confirm from the log, matching exact lines, and take the capture's
identity (ids and time) from the SDK's own line. Name the moment for the integrator unambiguously: time, the
SDK's id for it, and what it contains ("wave 2, lap 2, third place, holding a boost").

**`LUDEOS.md`.** Track every capture in `ludeo-integration-plan/LUDEOS.md`:

| Ludeo id | Captured (time, SDK id) | Wave / schema | Contains | Status |
| --- | --- | --- | --- | --- |

Status moves `captured` → `replayed` → `confirmed` (its wave signed off), or `stale` when a later wave changed the
capture schema (phase 5 → *Re-capture every wave*). Phase 7 replays every `confirmed` Ludeo before an upload.

## What a pass must show

A verdict of `passed` is not the proof. Read the evidence:

- **The right Ludeo** — the id in the restore log is the one you meant.
- **The values came back** — compare restored values against the Ludeo's recorded ones (read from the reader, or
  the capture run's sampler at capture time). A game's own run-start setup can grant defaults on top of a restore
  and still let a shallow check pass.
- **The game runs** — clock advancing, not paused, input live, no unexpected blocking screen, no SDK errors.
- **The player sees it** — **open the screenshots and look**: HUD counters, the player's position, what is on
  screen. A model can be right while the HUD reads stale values.
- **Placement** — nothing restored sits in empty space, through the floor, or far from the level's geometry.
  This was an integrator question; with screenshots it is the agent's.

Anything the harness can't confirm goes into the wave's evidence as an explicit **open item**. Don't drop it, and
don't turn it into "please play the game" — ask for exactly that check.

## The wave sign-off

At the end of each wave, give the integrator one short evidence bundle and the existing question, *"wave N
restores — widen to wave N+1?"*: the Ludeos replayed (from `LUDEOS.md`) with each run's verdict and duration; the
screenshots that show the restored moment; the restored-vs-recorded comparison for the wave's values; the open
items. They answer from the bundle; they don't replay it.

## Sharing the machine

- **Background-safe by default.** Rungs 1 and 2 don't need focus: run windowed, small resolution, audio muted,
  using the game's own options for each.
- **Rung 3 takes the foreground.** Keep those runs short, tell the integrator before the first one in a session
  ("the game window will take focus for ~30 s"), and serialize them across agents on the same machine with a
  lock file: create `%TEMP%\ludeo-agent-foreground.lock` (or `/tmp/…`) exclusively before the run, delete it after;
  if it exists and is younger than the run timeout, wait.
- **Never leave a game running.** The runner script kills on timeout; check for leftover game processes after a
  failed run.
- **Protect the integrator's data.** A run plays the game for real: back up the game's config and save folder
  before the first run and restore them after, or point the game at a scratch profile with its own arguments.

## The release build

The harness is compiled out of the build phase 7 uploads, by design. Phase 7 replays the `confirmed` Ludeos on
the harness build (same code, `LUDEO_AGENT_HARNESS` on), then gives the Release build a launch smoke driven from
outside (rung 1 and 3: it starts, the SDK activates, gameplay is reached, the log is clean, a screenshot shows
it) and **verifies the harness is absent** from it (`7-upload-build.md` Step 2.5).

## When the game can't run here

If the game can't run on this machine at all (license-gated, hardware, platform), say so in phase 1 and set
`runsTheGame: "integrator"`. Everything else — an awkward boot, menus, no level-load argument, no console — is
what the harness is for: build the missing lever (rung 2) rather than hand the gate over.
