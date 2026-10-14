# State File — `ludeo-integration-plan/integration.json`

The one machine-readable record of an integration, kept in the **game's** repo next to the other plan files.
`SKILL.md` → **Session start** reads it to resume where the integration left off; every step updates it. The
human-readable plan files (`CODE_MAP.json`, `OBJECT_TRACKING.md`, `RESTORATION_PLAN.md`, …) stay as they are — this
file records **where you are, what was decided, and what the user told you**, and points at those artifacts.

```json
{
  "schemaVersion": 1,
  "gameTitle": "GameName",
  "genres": ["shooter"],
  "engine": { "buildSystem": "cmake | msbuild | make | other", "targetOS": "windows | linux | macos" },

  "current": "3d",
  "steps": {
    "1":  { "status": "completed",   "completedAt": "2026-10-14" },
    "2":  { "status": "completed",   "completedAt": "2026-10-14" },
    "3a": { "status": "completed" }, "3b": { "status": "completed" }, "3c": { "status": "completed" },
    "3d": { "status": "in_progress", "startedAt": "2026-10-15" },
    "3e": { "status": "not_started" }, "3f": { "status": "not_started" },
    "4":  { "status": "not_started" },
    "5b": { "status": "not_started" }, "5c": { "status": "not_started" },
    "5d": { "status": "not_started" }, "5e": { "status": "not_started" },
    "6a": { "status": "not_started" }, "6b": { "status": "not_started" },
    "7":  { "status": "not_started" }
  },

  "sdk": {
    "source": "release repo | user-supplied",
    "version": "4.2.2",
    "path": "ThirdParty/LudeoSDK",
    "versionLine": "LudeoSDK v4.2.2.0, GitHash:…, Build 2026-…"
  },

  "ludeoPlatform": {
    "mcpServer": "ludeo-mcp | ludeo-mcp-staging | none",
    "gameId": "<Studio Lab → Game Options → Info: the game version uuid>",
    "progressReportingDisclosed": false,
    "debugTarget": "QA",
    "environments": [
      { "envId": "<id>", "name": "QA", "betaVersionName": "qa", "isDefault": false, "dialogValue": "qa",
        "integratorIsMember": true, "steamBranch": "qa", "invited": ["Dana"] },
      { "envId": "<id>", "name": "Production", "betaVersionName": null, "isDefault": true, "dialogValue": "{}",
        "integratorIsMember": null, "steamBranch": "", "invited": [] }
    ]
  },

  "intake": {
    "completedAt": "2026-10-14",
    "profile": { },
    "visiblePlayerState": { },
    "dynamicPhaseMetadata": { },
    "playbackUXBar": { },
    "captureTimingRules": { },
    "scriptedSystems": { },
    "launchModel": { },
    "runnability": { },
    "saveSystem": { }
  },

  "artifacts": {
    "codeMap": "ludeo-integration-plan/CODE_MAP.json",
    "tdd": "ludeo-integration-plan/TDD_GameName.md"
  },

  "decisions": [
    { "step": "3f", "topic": "Save system", "decision": "Group 2 — checkpoint only",
      "rationale": "SaveCheckpoint() writes position + inventory, nothing else", "date": "2026-10-14" }
  ],
  "findings": [
    { "step": "2", "type": "hook_point", "description": "Level::OnLoaded fires after spawn",
      "file": "src/world/Level.cpp", "line": 212 }
  ],
  "risks": [
    { "id": "unknown:PUX-2", "raisedAt": "1", "revisitAt": "5c", "note": "Intro cinematic owner unknown" }
  ]
}
```

## Fields

- **`schemaVersion`** — `1`. Bump only with a migration note here.
- **`current`** — the file id of the step in progress or last completed: `1`, `2`, `3a`–`3f`, `4`, `5b`–`5e`,
  `6a`, `6b`, `7` (the prefix of the phase file in `references/`). Steps run in `SKILL.md`'s table order.
- **`steps.<id>.status`** — `not_started` · `in_progress` (set when the step's work begins) · `completed` (set only
  after the step's exit gate passed — rebuild + run where the step edits source) · `skipped` (the user explicitly
  skipped it; record why in `decisions`).
- **`sdk.versionLine`** — the SDK's own version line from the first SDK-enabled run (phase 1 Step 10) — the first
  thing to compare when a notification never fires (`ludeo-integration-docs/11-TROUBLESHOOTING.md` §9).
- **`ludeoPlatform`** — everything [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md) says to record. `isDefault` and
  `dialogValue` come **only** from the Studio Lab *Assign to beta version* check (`null` = not checked yet); a re-read
  never overwrites `isDefault`, and resets `dialogValue` to `null` when it shows the Beta Version Name changed.
  `integratorIsMember: null` = unknown. `steamBranch: ""` = Steam's default branch (what a user means by "public"),
  `null` = not asked. `invited` holds names, never emails. `name` is a display label only — it never goes into
  `betaBranch`. `debugTarget` is the environment local runs reach (`phase 3 · task 4` Question 3).
- **`intake`** — the answers to [`know-your-game.md`](know-your-game.md); later steps read these fields as
  pre-flight checks. Unknown answers are recorded as `"unknown"` and listed in `risks`.
- **`decisions` / `findings`** — append-only. A decision the user made or confirmed goes in `decisions` with its
  rationale; a fact found in the code goes in `findings` with `file:line`.
- **`risks`** — every `unknown` from the intake, and anything a step deferred, with the step that must resolve it.
  A step's pre-flight checks the risks aimed at it.

## Rules

- **Create it once, in phase 1 Step 0a.** If it exists, read it — never recreate it.
- **Preserve what you don't recognise.** Steps add their own fields over time; update the fields you own and write
  everything else back unchanged. Never rewrite the file from the template above.
- **Write at step boundaries**: `in_progress` when a step starts, `completed` when its gate passes, plus any decision
  or finding as it happens — so a session that ends mid-step resumes at the right place.
- **No secrets.** API keys, tokens and Steam credentials stay in `ludeo.ini` / the user's environment, never here.
- **Valid JSON, always.** Re-read the file after writing it; a broken state file loses the integration's place.
