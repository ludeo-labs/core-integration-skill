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

### Step 5: Summary

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
- If a file needs `#include "LudeoManager.h"` (or equivalent), add it inside `#if LUDEO_SDK_ENABLED` guards
- This command uses direct `LudeoManager::Get().SendAction()` calls, not macros. A future phase will replace these with a `LUDEO_ACTION` macro.

## Related Phases

- `phase 6` - Creates the action map (run FIRST)
- `phase 5` - Run after implementation to verify compilation

## Next Steps

After running this command:
1. Run `phase 5` to verify the game compiles with SDK enabled
2. Run the game and verify action logs appear during gameplay
3. Review any skipped low-confidence actions manually
