# Find SDK Integration Points

Read an existing CODE_MAP and identify specific locations for Ludeo SDK lifecycle integration.

## 🚦 Fresh Context Check

**Before proceeding, verify this is a fresh agent session:**
- If you see prior tool calls, game analysis, or CODE_MAP references in this conversation, **STOP** and tell the user:
  > "This chat has prior context. For best results, please start a fresh agent session and continue with phase 2 there."
- If this is a fresh conversation, proceed.

## 📚 Context Files

**Action Required:** You must read the following files for SDK lifecycle details. Do not assume they are in context. The docs live inside this skill at `ludeo-integration-docs/` (relative to this workflow file).

- `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md` - Critical rules (threading, callbacks, tick requirements)
- `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md` - SDK lifecycle phases, callback flow, timing

## Prerequisites

Run `phase 1` first to generate `ludeo-integration-plan/CODE_MAP.json`.

## Your Task
 
1. **Read context files first:**
   - `ludeo-integration-docs/00-CRITICAL-REQUIREMENTS.md`
   - `ludeo-integration-docs/05-LIFECYCLE-MANAGEMENT.md`

2. **Read the CODE_MAP file** from `ludeo-integration-plan/CODE_MAP.json`
   
3. **Analyze the CODE_MAP** - Use the `lifecycle_hooks` section

4. **Map each game hook to Ludeo SDK functions** - Output integration points

## ⚠️ Critical: Ludeo Session ≠ Gameplay Session

The Ludeo SDK has **two session levels** — confusing them is the #1 integration mistake:

- **Ludeo Session** = program lifetime. Created once at startup, released at shutdown. It is the SDK's connection to the platform. It is **not** tied to any match or level.
- **Gameplay Session** = one match/level. Created and destroyed many times within a single Ludeo Session.

```
Game Launch ──► [Ludeo Session: entire program] ──► Game Shutdown
                      │
                      ├── Match 1 ──► [Gameplay Session 1] ──► End
                      ├── Match 2 ──► [Gameplay Session 2] ──► End
                      └── Match 3 ──► [Gameplay Session 3] ──► End
```

`Session_Create`, `Session_Activate`, and `Session_Release` belong at **program startup/shutdown** — never inside match start/end logic.

## SDK Functions to Map

For each SDK function, find the best location from the CODE_MAP:

| SDK Function | When to Call | Look for in CODE_MAP |
|--------------|--------------|----------------------|
| `ludeo_Initialize()` | Game startup, early | `lifecycle_hooks.initialization` - earliest point |
| `ludeo_Session_Create()` | After Initialize | Same location as Initialize |
| `ludeo_Session_Activate()` | After window/GL ready | `lifecycle_hooks.initialization` - after graphics init |
| `ludeo_Session_Tick()` | Every frame | `lifecycle_hooks.main_loop` |
| `ludeo_Session_OpenRoom()` | Level/match loading starts (ALL paths) | `lifecycle_hooks.session_start` |
| `ludeo_GameplaySession_End()` | Gameplay ends (ALL exit paths) | `lifecycle_hooks.session_end` - may need multiple locations |
| `ludeo_Session_Release()` | Game shutdown | `lifecycle_hooks.shutdown` |
| `ludeo_Shutdown()` | Game exit | `lifecycle_hooks.shutdown` - last point |

## Output Format

Output `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json` with this structure:

```json
{
  "game_name": "<from CODE_MAP>",
  "code_map_source": "ludeo-integration-plan/CODE_MAP.json",
  "threading_model": "<from CODE_MAP>",
  "integration_points": [
    {
      "sdk_function": "<function name>",
      "file": "<file path from CODE_MAP>",
      "function": "<function name from CODE_MAP>",
      "line": "<line number from CODE_MAP>",
      "context": "<brief description of when/why>",
      "timing": "<Once at startup | Every frame | Each level start | etc>",
      "thread": "main"
    }
  ],
  "callback_handlers": {
    "note": "These are SDK callbacks, NOT game integration points",
    "OnRoomOpenedCallback": "Calls ludeo_Room_AddPlayer()",
    "OnPlayerAddedCallback": "Tracks player added state",
    "OnRoomReadyCallback": "Calls ludeo_GameplaySession_Begin() when ready"
  },
  "warnings": ["<any threading or timing concerns>"]
}
```

**Required integration points:** Initialize, Session_Create, Session_Activate, Session_Tick, Session_OpenRoom, GameplaySession_End (ALL exit paths), Session_Release, Shutdown.

## Process

1. Read `ludeo-integration-plan/CODE_MAP.json`
2. For each SDK function, select the best location from `lifecycle_hooks`
3. Verify threading requirements (all calls must be main thread)
4. Output `ludeo-integration-plan/SDK_INTEGRATION_POINTS.json`

## Important Notes

- Do NOT analyze the game codebase directly - use only the CODE_MAP
- Do NOT suggest code implementations - only locations
- `ludeo_GameplaySession_End()` often needs MULTIPLE locations (win, lose, quit, disconnect)
- All SDK calls must be on main thread
- If CODE_MAP is missing required sections, report what's missing
