# Implement Game Actions - Insert LUDEO_ACTION Calls

Read the action map produced by `phase 6` and implement `SendAction` calls at each identified location in the game code.

## 🚦 Fresh Context Check

This is a sequential workflow — continuing to phase 7 in the **same session as earlier phases is normal**; do **not** stop just because prior phases ran here. Only stop if **phase 7** was already completed in this conversation and you're about to redo/regenerate its output — then confirm with the user first. If context has grown very large you may *suggest* a fresh session, but it is not required.

## Prerequisites

> **REQUIRED:** These must be complete before running this command:
> 1. Phase 0 complete — LudeoManager exists and SDK lifecycle works
> 2. `phase 6` complete — `ludeo-integration-plan/GAME_ACTIONS_MAP.md` exists
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

**Non-ludeoable area boundaries:**
Insert the enter/exit pair from the map's **Non-Ludeoable Boundaries** category at the area's open/close hooks, using the same `SendAction` call as any other action — e.g. `ShopEntered` in `ShopUI::Open`, `ShopExited` in `ShopUI::Close`:

```cpp
void ShopUI::Open()
{
    // ... existing logic ...
#if LUDEO_SDK_ENABLED
    LudeoManager::Get().SendAction("ShopEntered");
#endif
}
```

These are emitted exactly like combat/collection actions: never gated, and they do **not** pause tracking — capture keeps running through the area. The backend, not the game, decides the window is non-ludeoable (see Step 5 and `06 §7.3`).

### Step 5: Surface the one-time platform-trigger step

If the map included a **Non-Ludeoable Boundaries** category, the boundary actions now *emit* — but that alone does nothing until they are connected to the global triggers on Ludeo's platform. This is out-of-code configuration the agent cannot do from the codebase. Surface it to the user explicitly:

> "`ShopEntered`/`ShopExited` (and any other boundary actions) are now firing. To make those windows non-ludeoable, connect each enter/exit action to the corresponding **global trigger** on Ludeo's platform. Until that one-time mapping is done, the backend will not exclude those segments."

### Step 6: Summary

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
- **Non-ludeoable area boundaries are ordinary actions** — emit the enter/exit pair at the area's open/close hooks, never gate them, and never pause tracking for them. The backend marks the window once the actions are wired to global triggers on the platform (Step 5). See `06 §7.3`.
- If a file needs `#include "LudeoManager.h"` (or equivalent), add it inside `#if LUDEO_SDK_ENABLED` guards
- This command uses direct `LudeoManager::Get().SendAction()` calls, not macros. A future phase will replace these with a `LUDEO_ACTION` macro.

## Related Phases

- `phase 6` - Creates the action map (run FIRST)
- `phase 5` - Run after implementation to verify compilation

## ✅ Exit gate — rebuild + run (REQUIRED — do not advance without it)

This phase edited source files, so it is **not done** until the game still builds and runs. The agent
cannot see a running game, so this gate falls to the integrator — make the ask explicit and wait:

1. **Rebuild** via the build system and confirm a **clean build with `LUDEO_SDK_ENABLED=1`** (and, if the
   project ships a no-SDK build, `=0`) — run the build-and-fix loop in `phase 5` and read the build log.
2. **Run the game and confirm it still runs** — enter gameplay and verify `SendAction` log lines appear
   with no SDK errors or crashes.

The agent reads build/run logs where they exist but **cannot truly verify** a clean build or a live run
on its own — beyond the logs it relies on the integrator's word, and if they confirm without checking,
that's their call. **Do not offer to advance until the user confirms both** (or explicitly skips). Also
review any skipped low-confidence actions manually before moving on.
