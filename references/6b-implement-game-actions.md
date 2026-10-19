# Phase 6 · Task 2 — Implement Game Actions

Read the action map produced by `phase 6 · task 1` and implement `SendAction` calls at each identified location in the game code.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 6 · task 2 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 6 · task 2** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. `phase 3 · task 4` complete — LudeoManager exists and SDK lifecycle works
> 2. `phase 6 · task 1` complete — `ludeo-integration-plan/GAME_ACTIONS_MAP.md` exists
> 3. User has reviewed and approved the action map

## Context Files

**Action Required:** Read the following files. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/06-TRACKING-PATTERNS.md` Section 7 — Action implementation patterns and `SendAction` method
- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` — Mandatory rules (macro guards, error handling)

## Your Task

### Step 1: Read the Action Map

Read `ludeo-integration-plan/GAME_ACTIONS_MAP.md`. Extract all actions with their:
- Ludeo action name
- Source function
- File path and line number
- Confidence level

Skip actions marked `low` confidence — flag them for the user to review manually.

### Step 2: Ensure SendAction Exists on LudeoManager

Find the LudeoManager class in the game codebase (check `ludeo-integration-plan/CODE_MAP.json` or search for `LudeoManager`).

**Check if `SendAction` method already exists.** If not, propose adding it using the canonical header and implementation defined in `ludeo-integration-docs/06-TRACKING-PATTERNS.md` §7.1. Use that version verbatim — do not drop the session-state guard (`m_gameplay_session_active && m_data_writer != nullptr`); it's load-bearing and lets callers invoke the API without per-call-site session checks.

> ⚠️ **Verify the SDK signature against the cloned headers first.** `ludeo_DataWriter_SendAction` takes the DataWriter **handle** plus a `LudeoDataWriterSendActionParams*`, and **`playerId` is required** — the one-argument `ludeo_DataWriter_SendAction(actionName)` form does not exist. The canonical `LudeoManager::SendAction` in §7.1 wraps this and defaults `playerId` to the local player (`m_player_id`), so the call sites below stay one-argument. Confirm the manager actually stores the id it passed to `ludeo_Room_AddPlayer`; if it doesn't, add that first or actions will be dropped server-side.

This is a one-time prerequisite. Propose it first, get user confirmation, then proceed to action insertions.

### Step 3: Insert Action Calls

For each action in the map (high and medium confidence):

1. **Read the source file** at the specified location
2. **Understand the function context** — read the surrounding code to determine the exact insertion point
3. **Propose the change** using this pattern:

```
Action: <ActionName>
File: <file_path>
Function: <function_name>
Insert after line: <line_number>

Code to add:
```

```cpp
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("<ActionName>");
#endif
```

**Insertion rules:**
- Place the action call AFTER the game logic that triggers the event, not before
- If the event has conditional branches (e.g., headshot check inside a kill handler), place the action inside the relevant branch
- Include the necessary `#include` for LudeoManager.h if not already present in the file
- Each action call must be wrapped in `#if LUDEO_SDK_ENABLED`

### Step 4: Handle Edge Cases

**Multiple actions in the same function:**
Insert all relevant actions. Example — a kill handler might need both `Kill` and `Headshot`:

```cpp
void OnEnemyKilled(Entity* killer, Entity* victim, bool headshot)
{
    // ... existing game logic ...

#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("Kill");
    if (headshot) {
        LudeoManager::Get().SendAction("Headshot");
    }
#endif
}
```

**Action inside a switch/case:**
Place the action call inside the relevant case:

```cpp
case ItemType::Coin:
    // ... existing logic ...
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("CollectCoin");
#endif
    break;
```

**File already has `#if LUDEO_SDK_ENABLED` blocks:**
If there's an adjacent block, consider merging rather than adding a separate guard.

### Step 5: Emit the non-gameplay standard actions

From the map's **Non-Gameplay Actions** category. Both pairs use the **standard names exactly** — the Global
Triggers are created on those strings, and a trigger event can be bound to only one action per environment.
They are session/area events: no player guard, and they fire in **both** flows. `LudeoManager::SendAction`'s
session-state guard (`06 §7.1`) already drops them outside an active gameplay session, which is where they
belong — a pause in the main menu or while waiting for a Ludeo sends nothing.

- **Non-ludeoable areas** — report `StartNoneLudeable` at every **enter** site and `StopNoneLudeable` at every
  **exit** site, through the span helper below. Tracking keeps running; the backend excludes the window
  (`06 §7.3`). **Every `StartNoneLudeable` needs a reachable `StopNoneLudeable` on all exit paths**, early
  returns included — a dangling open span keeps Ludeo creation off for the rest of the run.
- **Pause/resume** — emit `PauseLudeo` at **every** pause and `ResumeLudeo` at its end, at the game's **pause
  primitive** (the one freeze function every pause path funnels through), not at the ESC key. This is what
  stops the **Ludeo objective timer**: freezing the simulation does not, so without it the player's clock
  drains through every pause. "Every" includes the pause menu, cutscenes, dialogue, loading screens, focus loss
  — **and the SDK's `PauseGameRequest` handler** (CR-011), which must reach this same emit.
  - **Report once per transition.** Route the `PauseGameRequest`/`ResumeGameRequest` handlers *through* the
    pause primitive, and guard the emit with a span flag so a pause that arrives on two paths reports once.
    If the map noted that the primitive also shows the game's pause menu, give the SDK handlers a
    **freeze-only** path that still reports the span — the game's menu must not open under the Ludeo overlay.
- **Keep each span flag equal to what was actually sent.** `SendAction` drops actions outside an active
  gameplay session, so a flag flipped there would drift: a game already paused when gameplay begins would
  never send `PauseLudeo` (the timer runs), and its later unpause would send an orphan `ResumeLudeo`. So:
  1. **Outside a session, touch no span** — only remember the game's own state.
  2. **When the gameplay session begins**, seed from that state: if the game is already paused (or inside a
     non-ludeoable area), open the span now.
  3. **Before the gameplay session ends**, close any span still open, while the session is still active — or
     it stays open into the next run, whose first pause then hits the guard and is never reported. This
     matters most in games that play many rounds per process.

  Reset the flags with the CR-010/CR-011 freeze bits at every end-of-Ludeo path (`phase 5 · task 3` Step 5).
  - **If the map recorded no pause primitive, do not build one.** Emit at whatever freeze the game has —
    including the one the `PauseGameRequest` handler performs for the overlay — and never add a pause menu,
    keybinding or freeze path the game didn't have. If it cannot freeze at all, emit nothing and say so in
    the summary.

```cpp
// Non-ludeoable area boundary (e.g. shop). Report the exit on every early-exit path too.
void ShopUI::Open()
{
    // ... existing logic ...
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().ReportSpan(LudeoSpan::NonLudeoable, true);   // StartNoneLudeable
#endif
}

// Pause primitive — every pause path funnels here, including LudeoManager's PauseGameRequest handler.
void Game::SetPaused(bool paused)
{
    // ... existing freeze / unfreeze ...
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().ReportSpan(LudeoSpan::Pause, paused);        // PauseLudeo / ResumeLudeo
#endif
}

// LudeoManager — one helper for both pairs. Members: bool m_in_span[2] = {}, m_span_open[2] = {};
// m_in_span = what the game is in; m_span_open = what was actually SENT.
enum class LudeoSpan { Pause = 0, NonLudeoable = 1 };

void LudeoManager::ReportSpan(LudeoSpan span, bool open)
{
    const int i = static_cast<int>(span);
    m_in_span[i] = open;                              // always track the game's own state
    if (!m_gameplay_session_active) return;           // outside a session: send nothing, touch no span flag
    if (open == m_span_open[i]) return;               // already reported this transition
    m_span_open[i] = open;
    static const char* kOpen[]  = { "PauseLudeo",  "StartNoneLudeable" };
    static const char* kClose[] = { "ResumeLudeo", "StopNoneLudeable"  };
    SendAction(open ? kOpen[i] : kClose[i]);
}

// Call right after the gameplay session begins (end of TryBeginGameplaySession): seed from the game's state.
void LudeoManager::SeedSpansOnGameplayBegin()
{
    for (int i = 0; i < 2; ++i) {
        m_span_open[i] = false;
        if (m_in_span[i]) ReportSpan(static_cast<LudeoSpan>(i), true);   // began already paused / in an area
    }
}

// Call at the start of EndGameplaySession(), while the session is still active: close what is open.
void LudeoManager::CloseSpansBeforeGameplayEnd()
{
    for (int i = 0; i < 2; ++i) {
        if (!m_span_open[i]) continue;
        const bool stillIn = m_in_span[i];
        ReportSpan(static_cast<LudeoSpan>(i), false);   // sends the closing action
        m_in_span[i] = stillIn;                         // the game's own state is unchanged
    }
}
```

`PauseLudeo` ≠ `StartNoneLudeable`: pause/resume **stops** the objective timer and the backend saves nothing
for the span; non-ludeoable **keeps** the timer running and the backend keeps the data. Wire **both** pairs.

### Step 6: Get the Global Triggers and goals created (out-of-code, required)

Both pairs are ordinary `SendAction` strings, not SDK constants. They do nothing until a matching **Global
Trigger** exists in **Studio Lab → the environment → Global Triggers** — and a missing or misnamed trigger
fails **silently**: no error, the action still shows in the log, the timer keeps counting. Studio Lab lists an
action only after a build has sent it, so **do this step after the exit gate's run** (below) has fired both
pairs and the gameplay actions. The same holds for goals: a Ludeo's objectives are goals on gameplay actions,
and Studio Lab offers an action only once a run has sent it.

**With the tools** — when `list_global_triggers` / `create_global_trigger` and `list_goals_and_constraints` /
`create_goal_or_constraint` are in your tool list, do it yourself on the target environment, per the rows in
[`ludeo-studio-mcp.md`](ludeo-studio-mcp.md):
1. **Triggers.** List them; for each pair the code sends and the list lacks, create it (closer first). Never on
   Production — there the user makes the change by hand.
2. **Goals and constraints.** List them; then choose goals (objectives a creator can pick) and constraints (ways
   to lose) from `GAME_ACTIONS_MAP.md`, the intake's `profile.keyActions` / `ludeoConcept` (what a great Ludeo of this
   game is) and the genre file in `ludeo-integration-docs/game-patterns/`, on gameplay actions only — never on the four trigger actions. Never on Production.
3. **Report what you made**, one line each (`environment · + PauseLudeo on pause_ludeo — "…"`,
   `environment · + goal "Kill enemies" on Kill`), so the user can ask for changes.

**By hand** — only without the tools, give the user this instruction verbatim (and ask them to create goals on
the gameplay actions in Studio Lab → the environment → Goals and Constraints):

> "**Needed on the Ludeo platform.** In Studio Lab → your environment → Global Triggers, create (or confirm) a
> **Pause/Resume** trigger starting on `PauseLudeo` and ending on `ResumeLudeo`, and a **Non-Ludeoable Area**
> trigger starting on `StartNoneLudeable` and ending on `StopNoneLudeable`. Triggers are per environment, so
> do this in every environment the game is played in. Names must match exactly. Until both exist, pauses won't
> stop the player's clock and non-ludeoable areas won't be excluded, with nothing in any log to say so."

> **Open cross-skill item:** whether one generic `StartNoneLudeable`/`StopNoneLudeable` pair covers every
> non-ludeoable area, or the backend needs to distinguish areas, is a platform question. Use the single pair by
> default; flag it if the game has several distinct areas the backend must tell apart.

### Step 7: Summary

After all actions are inserted, output a summary:

```
## Actions Implementation Summary

**SendAction method:** Added / Already existed
**Actions implemented:** X / Y total
**Actions skipped (low confidence):** Z — manual review needed

### Implemented Actions
| Action | File | Function | Status |
|--------|------|----------|--------|
| Kill | src/combat/Combat.cpp | OnEnemyKilled | Inserted |
| Headshot | src/combat/Combat.cpp | OnEnemyKilled | Inserted |
| ... | ... | ... | ... |

### Skipped (Low Confidence)
| Action | File | Reason |
|--------|------|--------|
| ... | ... | ... |
```

## Important Notes

- Follow the **propose-confirm-execute** cycle — show each change before making it
- Every SDK call must be wrapped in `#if LUDEO_SDK_ENABLED`
- Action calls go AFTER game logic, not before
- **Actions fire in BOTH Creator Flow (recording) and Player Flow (playback)** — never gate `SendAction` behind `IsRestoring()` or any "are we in playback?" check. Player Flow re-fires the same sites so the SDK can score win/fail conditions. See `06 §7` for the dual-flow contract; state writes *are* gated to Creator Flow only, action writes are not.
- Do NOT modify game logic — only add SDK calls
- **Non-gameplay actions use the standard names** — `StartNoneLudeable`/`StopNoneLudeable` at non-ludeoable area boundaries (never pause tracking for them), `PauseLudeo`/`ResumeLudeo` at every pause including the SDK's overlay pause. They do nothing until the Global Triggers exist (Step 6). See `06 §7.3`.
- **The summary must carry the platform action item** from Step 6 until the user confirms the triggers exist.
- If a file needs `#include "LudeoManager.h"` (or equivalent), add it inside `#if LUDEO_SDK_ENABLED` guards
- This command uses direct `LudeoManager::Get().SendAction()` calls, not macros. A future phase will replace these with a `LUDEO_ACTION` macro.

## Related Phases

- `phase 6 · task 1` - Creates the action map (run FIRST)
- `phase 3 · task 5` - Run after implementation to verify compilation

## ✅ Exit gate — rebuild + run (REQUIRED — do not advance without it)

This phase edited source files, so it is **not done** until the game still builds and runs. **The agent runs the build itself** (CMake / MSBuild / make work headless) and reads the
log, and **runs the game itself** through the agent test harness ([`agent-test-harness.md`](agent-test-harness.md)):

1. **Rebuild — the agent, not the integrator.** **Rebuild** via the build system and confirm a **clean build with `LUDEO_SDK_ENABLED=1`** (and, if the
   project ships a no-SDK build, `=0`) — run the build-and-fix loop in `phase 3 · task 5` and read the build log.
2. **Run the game in both flows** — capture a session (Creator Flow), then replay a Ludeo (Player Flow) — and
   verify each action's `SendAction` log line appears **in both**, with no SDK errors or crashes. Make the run **pause once and enter a non-ludeoable area once** (if the game has one), so
   `PauseLudeo`/`ResumeLudeo` and `StartNoneLudeable`/`StopNoneLudeable` are sent and Studio Lab can list them.

The agent verifies both itself — show the build command and its result, and the harness run (scenario
`actions`): its command, `result.json`'s verdict, the log lines that prove it, and the screenshots you opened.
If it cannot build here (toolchain missing, IDE-only or license-gated build), say so and ask the integrator to
build. **Do not offer to advance until the build and the run both pass.** Only when `intake.runnability.runsTheGame` is
`"integrator"` (or this check is in `integratorPlays`) does the integrator run it, and then beyond the log the
agent relies on their word. Also
review any skipped low-confidence actions manually before moving on.

Once the run passes, do **Step 6** (Global Triggers and goals) if it is still open — the run just sent the
actions it needs. Then hand back to `6-actions-orchestrator.md` (when `current` is `8`, back to `8-polish.md` instead): if phase 5 still has waves outstanding it
returns there; once every wave is green or deferred, phase 7 (`7-upload-build.md`) verifies the Release build and
publishes it.
