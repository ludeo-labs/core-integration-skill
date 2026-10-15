# Migration — resume an integration started under an older version of this skill

Run this when `SKILL.md` → **Start here** finds plan files but no state file, or a state file older than the current
schema. It turns what exists into the current step model (`1`–`8`, with `3a`–`3f`, `5a`–`5e`, `6a`–`6b`), flags the
work that was built to rules this skill has since changed, and records the result in
`ludeo-integration-plan/integration.json` ([`state-file-schema.md`](state-file-schema.md)). Show the user the inferred
status and the re-check list, and let them correct it, **before** resuming.

## 1. Detect which layout you have

| Signs | Layout | Go to |
|---|---|---|
| `integration.json` with `schemaVersion: 1` | current | nothing to migrate — but add any field §5 lists as missing |
| no `integration.json`; plan files under `ludeo-integration-plan/`; the user, the TDD or notes speak of **phases 0–12, 2b, 2c** | **v1.x skill** (15 phases, actions before tracking) | §2, then §3 and §4 |
| no `integration.json`; plan files; the user speaks of phases 1–7 | **v2 before the state file** | §3 and §4 |

If you can't tell, ask the user which skill version (or which phase numbers) the integration was run with — the plan
file names are the same in every version, so they don't tell the layouts apart.

## 2. v1.x phase → current step

| v1.x phase | v1.x file | Current step |
|---|---|---|
| 0 | `0-build-game-with-sdk.md` | `1` (the kickoff intake didn't exist — run it, §4) |
| 1 | `1-map-game-code.md` | `2` |
| 2 | `2-find-sdk-integration-points.md` | `3a` |
| 2b | `2b-create-tdd.md` | `3b` |
| 2c | `2c-classify-save-system.md` | `3f` |
| 3 | `3-plan-sdk-lifecycle.md` | `3c` |
| 4 | `4-implement-sdk-lifecycle.md` | `3d` |
| 5 | `5-compile-and-fix.md` | `3e` |
| 6 | `6-map-game-actions.md` | `6a` |
| 7 | `7-implement-game-actions.md` | `6b` |
| 8 | `8-map-game-objects.md` | `4` (Part A) + `5a` (Part B, one wave) |
| 9 | `9-implement-object-tracking.md` | `5b` |
| 10 | `10-plan-state-restoration.md` | `5c` |
| 11 | `11-implement-restoration-flow.md` | `5d` |
| 12 | `12-implement-state-reconstruction.md` | `5e` |
| — | (no v1.x equivalent) | `7` upload, `8` polish & expansion |

**Order changed.** v1.x mapped and sent actions (6–7) **before** tracking and restore (8–12); now actions come after
phase 5's wave 1, because an action can't be verified in a flow you can't replay yet. A v1.x integration can therefore
have `6a`/`6b` work done while phase 5 isn't — keep it, but see §4 item 2. Resume at the **earliest unfinished step in
the current order**.

## 3. Infer each step's status from evidence

Code-only steps leave no plan file, so look for the code they write. A step whose code exists but whose gate (rebuild
+ run) can't be confirmed is `in_progress`, not `completed`.

| Step | Evidence it ran |
|------|-----------------|
| `1` | the SDK under the project, the `LUDEO_SDK_ENABLED` build option, a stub `LudeoConfig.h` |
| `2` | `ludeo-integration-plan/CODE_MAP.json` |
| `3a` | `SDK_INTEGRATION_POINTS.json` |
| `3b` | `TDD_<Game>.md` |
| `3c` | `SDK_LIFECYCLE_PLAN_<Game>.md` |
| `3d` | `LudeoManager.h/.cpp`, `LudeoConfig.cpp`, `ludeo.ini`, the hooks in game code |
| `3e` | a clean build with the SDK on (ask, or build it) |
| `3f` | `GAME_ANALYSIS_SAVE_SYSTEM.md`, `CODE_MAP.json → save_system.group` |
| `4` | `OBJECT_TRACKING.md` with `## Object Type Census` + `## Wave Rollout` (approved) — an older plan without them predates waves: treat it as one wave and offer to run phase 4 Part A |
| `5a` | `## Entity: … (wave: N)` blocks for the current wave |
| `5b` | `LudeoStateAdapter`, `LudeoCaptureMacros.h`, `LUDEO_CAPTURE_*` calls in game code |
| `5c` | `RESTORATION_PLAN.md` (approved) |
| `5d` | a `LudeoSelected` handler, `ApplyHeld`, `EndCurrentLudeo` |
| `5e` | real (non-stub) `RestoreTwoPass` / `RestoreEnvironment` bodies |
| `6a` | `GAME_ACTIONS_MAP.md` |
| `6b` | `SendAction` / `LUDEO_ACTION` calls in game code |
| `7` | nothing local — ask whether a build was uploaded, and its build id |
| `8` | a `## Phase 8: Polish & Expansion` section in `TDD_<Game>.md` (completed); waves past the original plan in `## Wave Rollout` (in progress) |

## 4. Re-check what older versions built differently

Each item below is work that exists but was built to a rule this skill has since changed. Add one line per item that
applies to the state file's `risks`, aimed at the step that must redo it, and set that step `in_progress` with a `note`
saying what to re-check.

1. **The restore flow (`5d`) — v1.x, and v2 before the CR-010 fix.** Older flows froze at `LudeoSelected`, raced
   `GetLudeo` against `OpenRoom`, and loaded and applied the state **on Play** (`RoomReady`). The current order applies
   everything **before** Play: `GetLudeo` only → validate → commit → reach active gameplay → freeze → apply → settle →
   freeze → `OpenRoom` → `AddPlayer` → `RoomReady` → `Begin` → unfreeze (CR-010, `07 §2.1`). Evidence of the old flow:
   `OpenRoom` issued from the `LudeoSelected` / `GetLudeo` path, or a restore apply reachable from the `RoomReady`
   callback. Set `5d` `in_progress` and redo it against `5d-implement-restoration-flow.md`; `5e`'s read-back usually
   survives unchanged.
2. **Actions mapped before restore existed (`6b`).** The v1.x gate verified actions in the Creator Flow only. The
   current gate needs both flows, which needs phase 5's wave 1. Keep `6a` `completed`; set `6b` `in_progress` with
   the note "Player-Flow run pending — after wave 1".
3. **Non-ludeoable areas as per-area action pairs.** v1.x emitted a pair per area (`ShopEntered`/`ShopExited`,
   `DialogueStarted`/`DialogueEnded`, `MenuOpened`/`MenuClosed`, …). The platform's Global Triggers now bind the
   standard pair `StartNoneLudeable`/`StopNoneLudeable`, and every pause — the SDK overlay pause included — emits
   `PauseLudeo`/`ResumeLudeo` (`06 §7.3`, `6b` Steps 5–6). Replace the per-area pairs (keep them as ordinary actions
   only if a goal uses them), add the pause pair, and re-create the Global Triggers on the standard names.
4. **No `ludeo.ini`.** Integrations from before v1.1 read their settings from constants. The runtime configuration is
   now file-based (`04 §4`) — if `ludeo.ini` is missing, set `3d` `in_progress`.
5. **No kickoff intake.** v1.x had none. Run `know-your-game.md` (phase 1 Step 11) before resuming — later steps read
   its answers.
6. **Not on the VCS contract.** Run `detect_vcs` (`vcs/README.md`), record `vcs` and the existing integration branch,
   and ask the user for the commit policy.
7. **`LUDEO_PLATFORM.md`** (the Studio MCP record from before the state file) — fold it into `ludeoPlatform` with §6's
   value mapping, then delete it.

## 5. A state file missing newer fields

`schemaVersion` is still `1`, but fields arrived over time. When one is missing, add it — never rewrite the file from
the template:

- `vcs` → run `detect_vcs`; record `type`, `commitPolicy` and the per-VCS block.
- `wave` → build it from `OBJECT_TRACKING.md` → `## Wave Rollout` and the green waves' evidence.
- `steps.8` → `not_started` (or per §3's evidence).
- `intake` empty → run the intake.

When a future change bumps `schemaVersion`, it adds its upgrade steps here as a new section.

## 6. Folding `LUDEO_PLATFORM.md` into `ludeoPlatform`

Map values exactly; never guess a boolean:

| Old | New |
|-----|-----|
| `Studio MCP server:` line | `mcpServer` |
| `Game ID:` line | `gameId` |
| `progress reporting disclosed: yes / no` | `progressReportingDisclosed: true / false` |
| table `Default?` `yes` / `no` / `?` | `isDefault: true / false / null` |
| table `Dialog value` `?` | `dialogValue: null` (any other value copied as is) |
| `Integrator is member?` `yes` / `no` / `?` | `integratorIsMember: true / false / null` |
| `Steam branch` `(default)` / empty | `steamBranch: ""` / `null` |

A `?` that becomes `false` would look like a confirmed answer and unlock Studio Lab writes that need a confirmed
default environment — keep it `null`.

## 7. Record the migration

Append to `decisions`: which layout was found, the inferred statuses the user confirmed, and the re-check items from
§4 — e.g. `{ "step": "1", "topic": "Migration", "decision": "v1.x layout → current steps; 5d and 6b re-opened",
"date": "…" }`. Then continue from `current` as **Start here** describes.
