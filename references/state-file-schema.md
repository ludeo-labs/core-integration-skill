# State File — `ludeo-integration-plan/integration.json`

The one machine-readable record of an integration, kept in the **game's** repo next to the other plan files.
`SKILL.md` → **Start here** reads it to resume where the integration left off; every step updates it. The
human-readable plan files (`CODE_MAP.json`, `OBJECT_TRACKING.md`, `RESTORATION_PLAN.md`, …) stay as they are — this
file records **where you are, what was decided, and what the user told you**, and points at those artifacts.

```json
{
  "schemaVersion": 1,
  "gameTitle": "GameName",
  "branch": "feature/ludeosdk-integration-#1",
  "vcs": {
    "type": "git",
    "commitPolicy": "per-phase | until-review | no commits until branch",
    "git": { "remote": "origin", "branch": "feature/ludeosdk-integration-#1" }
  },
  "engine": { "buildSystem": "cmake | msbuild | make | other", "targetOS": "windows | linux | macos" },

  "current": "3d",
  "steps": {
    "1":  { "status": "completed",   "completedAt": "2026-10-14" },
    "2":  { "status": "completed",   "completedAt": "2026-10-14" },
    "3a": { "status": "completed" }, "3b": { "status": "completed" }, "3c": { "status": "completed" },
    "3d": { "status": "in_progress", "startedAt": "2026-10-15", "note": "Question 3 answered; LudeoManager.h written" },
    "3e": { "status": "not_started" }, "3f": { "status": "not_started" },
    "4":  { "status": "not_started" },
    "5a": { "status": "not_started" },
    "5b": { "status": "not_started" }, "5c": { "status": "not_started" },
    "5d": { "status": "not_started" }, "5e": { "status": "not_started" },
    "6a": { "status": "not_started" }, "6b": { "status": "not_started" },
    "7":  { "status": "not_started" },
    "8":  { "status": "not_started" }
  },

  "wave": { "current": 1, "plan": [1, 2, 3], "green": [], "deferred": [], "reopened": null },

  "sdk": {
    "source": "release repo | user-supplied",
    "version": "4.2.2",
    "path": "external/ludeo/LudeoCoreSDK_4.2.2",
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

  "harness": {
    "runner": "ludeo-integration-plan/agent/run.ps1",
    "define": "LUDEO_AGENT_HARNESS",
    "scenarios": ["boot", "smoke", "capture", "replay"],
    "captureHotkey": "Shift+F4 (from the SDK log, 2026-10-14)",
    "playClick": "real | stand-in",
    "healthyDuration": { "smoke": "40s", "replay": "55s" }
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
- **`branch`** — the integration's isolation (phase 1 Step 0a): the git branch, the SVN branch URL, or the Perforce
  stream or changelist. The state file lives in it; a session that starts elsewhere finds the integration through it.
- **`vcs`** — `type` (`git` | `svn` | `p4` | `none`), `commitPolicy`, and the per-VCS block the matching
  `vcs/<type>.md` defines (`git`, `svn` or `p4`). Read before any file write: it says which contract file to load.
- **`current`** — set when a step starts; the file id of the step in progress or last completed: `1`, `2`, `3a`–`3f`, `4`, `5a`–`5e`,
  `6a`, `6b`, `7`, `8` (the prefix of the phase file in `references/`). Steps run in `SKILL.md`'s table order.
- **`steps.<id>.status`** — `not_started` · `in_progress` (set when the step's work begins) · `completed` (set only
  after the step's exit gate passed — rebuild + run where the step edits source) · `skipped` (the user explicitly
  skipped it; record why in `decisions`; resume treats it like `completed`). **`steps.<id>.note`** — free text: where
  inside the step work stopped (e.g. "Step 0c done — waiting for the session restart"), so a resumed session doesn't
  redo or skip a sub-step.
- **`wave`** — phase 5's wave loop (`5-tracking-restore-orchestrator.md`): `plan` from `OBJECT_TRACKING.md` →
  `## Wave Rollout`, `current` the wave in progress, `green` the waves whose restore gate passed, `deferred` any the
  user explicitly deferred. Steps `5a`–`5e` hold the status **for the current wave**. When a wave's gate 4 passes,
  add it to `green`; **only when the user confirms widening** increment `current` and reset `5a`, `5b`, `5c`, `5e` to
  `not_started` (`5d` runs once, in wave 1). After the last wave, leave the statuses `completed`. **Phase 5 is done
  only when every `plan` entry is in `green` or `deferred`** — phase 6 may start after wave 1, but phase 7 may not
  start while a wave is outstanding. A guardrail re-open of an earlier wave M: set `reopened: M`, remove M from
  `green`, record why in `decisions`, re-run its tasks, then clear `reopened` and resume `current`. **Phase 8 appends waves** to `plan` and runs them the
  same way (`5d` stays `completed`) while `current` stays `8`; `wave.current` moves to an appended wave, and
  `5a`/`5b`/`5c`/`5e` reset, in the same write that appends it. Phase 8's re-runs of `6a`, `6b` and `7` leave those steps
  `completed`; `steps.8.note` records which one is in progress and where.
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
- **`harness`** — the agent test harness ([`agent-test-harness.md`](agent-test-harness.md)): the runner script
  every run gate calls, the compile define that fences it, the scenarios built so far, the capture hotkey as the
  SDK logged it, whether replays press the overlay's real Play button or the stand-in, and each scenario's healthy
  duration from its first good run (a run several times longer is a wrong setting, not a slow boot). Absent until
  phase 1 Step 10's `boot` run.
- **`decisions` / `findings`** — append-only. A decision the user made or confirmed goes in `decisions` with its
  rationale; a fact found in the code goes in `findings` with `file:line`.
- **`risks`** — every `unknown` from the intake, and anything a step deferred, with the step that must resolve it.
  A step's pre-flight checks the risks aimed at it.

## Migrating — an integration that started before this file existed

Follow [`migration.md`](migration.md): detect the layout (v1.x 15-phase, or v2 before the state file), map it to the
current steps, infer each step's status from evidence, re-check the work older versions built to rules that have since
changed, fold `LUDEO_PLATFORM.md` into `ludeoPlatform`, and add any field a state file is missing.

## Rules

- **Create it once, in phase 1 Step 0a.** If it exists, read it — never recreate it.
- **Preserve what you don't recognise.** Steps add their own fields over time; update the fields you own and write
  everything else back unchanged. Never rewrite the file from the template above.
- **Write at step boundaries**: `in_progress` when a step starts, `completed` when its gate passes, plus any decision
  or finding as it happens — so a session that ends mid-step resumes at the right place.
- **No secrets.** API keys, tokens and Steam credentials stay in `ludeo.ini` / the user's environment, never here.
- **Valid JSON, always.** Re-read the file after writing it; a broken state file loses the integration's place.
