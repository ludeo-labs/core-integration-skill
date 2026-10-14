# Phase 7 — Verification & Cloud

> **Single sequential phase.** Verification and upload are one coupled, outward-facing, human-gated
> procedure: a build that fails any gate must **never** be uploaded, so gating, validation and upload
> belong together in one flow.

> 🛑 **NEVER UPLOAD WITHOUT EXPLICIT USER CONFIRMATION — no exceptions.** Uploading publishes to Ludeo's
> cloud; it is outward-facing and not trivially reversible. The agent does **not** run the real upload on
> its own. After a successful `--dry-run`, **present the exact final upload command and STOP** — either the
> user types an explicit go-ahead and you run it, or the user copies the command and runs it in their own
> terminal. A successful dry-run, a green validation, or prior approval of an *earlier* step is **not**
> upload approval. If in doubt, do not upload.

## 1. Goal / Purpose

Take the **Release build** of the game, **verify** it is upload-ready (Release configuration and Release
SDK binary, no reachable cheats or debug menus, production values in `ludeo.ini`, self-contained runtime
deps, `validate-build` passing), then **publish** it to the Ludeo platform with the `ludeo` CLI, **poll**
the build status to `success`, and **assign** it to the target environment. This is the final phase — when
it passes, the build is live in that environment. An uploaded build that is not assigned is served nowhere.

## 2. Inputs (Input Contract)

- [ ] **Phase 6 complete** — lifecycle, tracking & restore proven, actions wired, and the game builds and
      runs with `LUDEO_SDK_ENABLED=1`.
- [ ] A **Release build** of the game (Release configuration, Release SDK binary — the release-build
      guard in `04 §2`, layer 1). Unlike an editor-driven engine, you can run this build yourself;
      still **confirm the build command and configuration with the user** before running it.
- [ ] The **`validate-build`** skill, if the user has it installed — the self-contained gate; it also
      writes `run.bat`. It is a separate user-level skill and does **not** ship with this one. Without it,
      do Step 4's manual check instead.
- [ ] The **`ludeo` CLI** reachable — verify with `ludeo --help`. If not installed or not on `PATH`, **ask
      the user** to install it or for the path to the binary; do **not** invent a download source.
- [ ] A Ludeo **access token** and the game's **Game ID** (Studio Lab → **Game Options → Info** — the game
      **version** uuid, not a build id). Ask if not provided.
- [ ] **The environment this build ships to.** Games commonly have several (production, QA, demo) — ask
      which one this build is for; never pick for the user. You need its **`envId`** for Step 11: if
      `list_game_environments` is in your tool list, read it there; otherwise ask the user for it (Studio
      Lab → the environment). The ship environment is often not the one you debugged against, so for **it**:
      - **The integrator is in it.** If `LUDEO_PLATFORM.md` doesn't record membership as yes, ask; if they don't
        know or it's no, have them check or add themselves in Studio Lab → Environments → Users management
        (`phase 1` Step 0d (b)). That doesn't block the upload, but say plainly that their captures there fail
        silently until it's done.
      - **Anyone else who needs to capture there** is invited (`phase 1` Step 0d (c)).
- [ ] **Global Triggers created** in Studio Lab → **that environment** (triggers are per environment):
      Pause/Resume on `PauseLudeo`/`ResumeLudeo`, Non-Ludeoable Area on `StartNoneLudeable`/`StopNoneLudeable`
      (`phase 6 · task 2` Step 6). If `list_global_triggers` is in your tool list, check it on that environment
      (an event of `null` counts as missing) and create what is missing per
      [`ludeo-studio-mcp.md`](ludeo-studio-mcp.md); otherwise **ask the user to confirm**. **On Production you
      never create them** — the user makes the change by hand in Studio Lab, and Production is the likeliest
      ship target. The cloud run is the first place the overlay
      pause actually happens, and without the Pause/Resume trigger it will not stop the objective timer. The
      failure is silent.

**Inputs to gather (ask if missing):**

| Input | Used for | Notes |
| --- | --- | --- |
| **Build folder path** | `validate-build` + `--local-directory` | Absolute path to the Release build output folder. |
| **Game ID** | `--game-id` | The game **version** uuid (Studio Lab → Game Options → Info) — **not** a build id, and not the backend `gameId`. |
| **Target environment + `envId`** | `builds assign --env-id` (Step 11) | Which environment this build is for. `list_game_environments` if in your tool list, else ask. |
| **Game version** | `--game-version` | e.g. `1.2.3`. Default to the `gameVersion` value in `ludeo.ini` if set. |
| **SDK version** | `--sdk-version` | **Confirm with the user — do NOT infer it from the SDK folder name.** Builds often link a swapped or overridden SDK, so the folder can lie. Not needed for `sdkFree` builds. |
| **Access token** | `auth set-token` / `--access-token` | Only if not already authenticated. |
| **Changes description** | `--changes-description` | **Default to a non-empty value** — infer from context (Step 6). If you can't, ask; leave empty only if the user chooses to. |

## 3. Steps

### Step 1: Produce the Release build

Build the game in its **Release** configuration with `LUDEO_SDK_ENABLED=1`, using the build system phase 1
configured (`3e-compile-and-fix.md` has the build-and-fix loop). Confirm the exact command with the user
first — this is their project's release path, not a scratch build.

```bash
# CMake example — match the project's actual generator/preset
cmake -S . -B build-release -DCMAKE_BUILD_TYPE=Release -DLUDEO_SDK_ENABLED=ON
cmake --build build-release --config Release
```

**The configuration you *selected* is not proof of what *shipped*.** Confirm against the artifact in
Step 2, not against the command you typed.

### Step 2: Release-build gate

**Do not restate the rules here — apply them.** The five-layer release guard lives in
[`ludeo-integration-docs/04-BUILD-INTEGRATION.md` §2, "Release-build guard"](ludeo-integration-docs/04-BUILD-INTEGRATION.md).
Walk it against the actual build output and **stop on any failure** — fix, rebuild, re-check. Do not
validate or upload a build that fails this gate.

The checks that must land on the artifact itself:

1. **Release SDK binary shipped.** The build folder contains `*-Release.dll`/`.so`/`.dylib`, **not** the
   `*-Development` variant. Check the file that is actually in the output folder — an IDE's selected
   configuration is an inference, the copied file is the fact.
2. **Release compile.** `NDEBUG` (or the project's release define) was defined for the shipped binary. If
   the build system writes a manifest or the build log records the configuration, assert it there.
3. **No debug artifacts in the output folder.** A `*-Development` SDK binary or the game's own
   debug/editor tooling in the folder means a non-release build slipped through. Rebuild release — do not
   hand-clean the folder and upload it.
   **`.pdb` files are different:** MSVC Release configurations generate them by default, so a `.pdb` next
   to the executable does **not** prove a debug build, and rebuilding just produces it again. Keep them
   out of the upload payload with a durable post-build step (archive them separately — they are what
   symbolicates a cloud crash dump), and confirm in the Step 7 dry-run file list that none ship.
4. **`ludeo.ini` holds production values.** For a native build the config file **travels inside the build
   folder**, so unlike a baked-config engine you can read the shipped file directly — do it:
   - `apiKey` set (not the placeholder).
   - `activationLudeoId` **empty**. Left set, the build auto-fires a `LudeoSelected` on startup — the
     debug affordance from `04 §4` and `phase 5 · task 3` Step 3 — and every cloud session jumps straight
     into that one Ludeo.
   - `platformUrl` pointing at the intended environment (production, not staging).
   - `authMode` and the Steam fields matching how the cloud will actually authenticate. Confirm with the
     user which mode the platform expects for this game.

### Step 2.5: Confirm debug features are release-safe

Layer 2 of the release-build guard (`04 §2`) is the rule: cheats, debug consoles, dev menus and
verbose logging must be gated on the **build configuration** (`#ifndef NDEBUG` / `#if !<release define>`
— compiled out of release builds), not on a runtime data flag. A
runtime `if (cheatsEnabled)` still **ships the code** and can be reached. A cloud build is played by end
users on a public machine — anything reachable corrupts captures and is an abuse surface.

The game owns these systems, so **audit and confirm — do not delete them**:

```
Grep -i "cheat|godmode|noclip|debugmenu|devconsole|spawnitem|giveall|levelskip|freecam"   # exclude tests
Grep    "#ifdef NDEBUG|#ifndef NDEBUG|#if defined\(DEBUG\)|_DEBUG"                        # how gating is done today
```

Ask the user what dev affordances exist and how each is gated. Anything reachable in Release: gate it at
the read site, rebuild, re-check. Flag CI as the durable fix (guard layer 5) — a developer's local
configuration switch should never be able to produce a shipping artifact.

### Step 3: Verify the build is self-contained

The thing you upload is the **build folder**, so every runtime dependency must travel *with it*, not merely
resolve on the developer's machine. A build that runs on your box can still fail on a clean one.

1. **Ship the whole ThirdParty runtime folder.** The SDK's runtime deps live in
   `<SDK>/ThirdParty/<platform>/<config>/Bin/` (cohtml, libx264, MediaDecoders, HttpServer, RenoirCore,
   openAL32, the v8 family). Copy the **whole folder** next to the executable — cherry-picking individual
   DLLs is the root cause of the "build crashes on launch with a missing cohtml/libx264" failure. Phase 1
   Step 7 and `04 §5` carry the build-step snippet.
2. **Walk the actual imports where a tool is available** — `dumpbin /dependents <exe>`,
   `Dependencies.exe`, `ldd`, or `llvm-readobj --needed-libs`. Ignore known OS/system libraries; flag the
   rest. With no walker installed, fall back to the checklist above plus the `validate-build` run.
3. **Fix durably, never by hand-copying into the build folder.** A manual copy is discarded on the next
   rebuild. Add the missing artefact to the build system's copy step so it ships every time.

### Step 4: Self-contained launch gate (`validate-build`, or by hand)

If the user has the **`validate-build`** skill, run it on the build folder. It detects the build type,
checks the expected files, **launches the executable from inside its own folder** to prove it is
self-contained (no missing-DLL or missing-asset crash), and **ensures a `run.bat` exists** (creating one
when you approve).

**Without it, do the same check by hand** — it is the gate, not the skill, that is required:
1. Copy the build folder somewhere outside the source tree and the build output directory (so nothing
   resolves from the developer's paths), e.g. a temp folder.
2. Write `run.bat` at its root (the template below), then launch it from a shell whose working directory is
   **somewhere else**, redirecting output: `<copy>\run.bat > out.txt 2>&1`.
3. Ask the user to confirm the game reaches its menu / gameplay; check `out.txt` for the SDK's startup lines
   and for missing-DLL or file-not-found errors. Close the game.

- **If validation FAILs, stop.** Fix per Step 3, then re-validate. Never upload a build that failed a gate.
- **Ensure `run.bat` is present at the build root** — it is the entry point Ludeo launches (the
  `.bat`-not-`.exe` rule, §5). If `validate-build` only warned that it was missing, create it now.
- **Make sure the game's log reaches stdout.** The cloud runner collects the launched process's stdout. If
  the game writes only to a log file, that file dies with the instance and the cloud run comes back with
  SDK logs and no game logs. Phase 1 Step 4 adapted `LudeoConfig.h`'s logging macros to the game's logging
  system — confirm that path ends up on stdout for a release build, or pass whatever flag the game uses to
  make it so.

  ```bat
  @echo off
  cd /d "%~dp0"
  "<Game>.exe" %*
  ```

  - **Call the executable directly — not `start "" /wait`.** `start` gives the child its own console, so
    its stdout no longer flows through the `.bat`'s stdout to the runner. To propagate the exit code and
    keep the pipe intact: `"<Game>.exe" %* & exit /b %ERRORLEVEL%`.
  - A GUI-subsystem executable on bare Windows has no console attached, so verify locally by redirecting
    (`run.bat > out.txt 2>&1`) rather than expecting console output.

### Step 5: Locate the CLI and authenticate

1. `ludeo --help` — confirm the CLI is reachable and learn the current command set. The CLI evolves;
   **trust `--help` over any command quoted here.** If not found, ask the user to install it or give the path.
2. `ludeo auth status` — if not authenticated, `ludeo auth set-token` (ask the user for the token) or pass
   `--access-token` on each call. Tokens are stored in `~/.ludeo/config.json`.

### Step 6: Decide build type — minor by default, major only on the first build

A **major** build stands alone; a **minor** build is a variant attached to an existing major
(`--major-build-id`).

```bash
ludeo builds list --game-id <GAME_ID> --sort-by createdAt --sort-order desc
```

- **No builds returned ⇒ first build ⇒ `--build-type major`** (no `--major-build-id`).
- **Builds already exist ⇒ default to `--build-type minor`**, with `--major-build-id <id>` = the major it
  attaches to (normally the latest major in the list). Confirm with the user if ambiguous.

### Step 7: Dry-run the upload (preview, no changes)

Provide **all** required flags so the command is non-interactive — a missing required flag drops the CLI
into an interactive prompt and hangs it. Point `--exec-path` at the **`run.bat`, as a path relative to
`--local-directory`** (§5), and **default `--runtime-environment` to `proton`**: Ludeo's cloud runs the
Windows build under Proton on Linux. Use another value only if the user confirms a different target.

**Always pass a non-empty `--changes-description`.** Infer a short, concrete summary from context — what
this build changed, or the git log since the last build/tag (e.g. `"Initial Ludeo integration: capture +
restore"` for a first build, `"Fix restore freeze on replay"` for a minor). If nothing can be inferred, ask
the user; leave it empty only if they explicitly choose to. Include it in **both** the dry-run and the real
command.

```bash
# First build (major):
ludeo builds upload --dry-run \
  --game-id <GAME_ID> \
  --game-version <X.Y.Z> \
  --sdk-version <SDK_X.Y.Z> \
  --build-type major \
  --changes-description "<what this build is — inferred or user-provided>" \
  --local-directory "<BUILD_FOLDER>" \
  --exec-path "run.bat" \
  --runtime-environment proton

# Subsequent build (minor) — add the major it attaches to:
ludeo builds upload --dry-run \
  --game-id <GAME_ID> \
  --game-version <X.Y.Z> \
  --sdk-version <SDK_X.Y.Z> \
  --build-type minor --major-build-id <MAJOR_BUILD_ID> \
  --changes-description "<what changed>" \
  --local-directory "<BUILD_FOLDER>" \
  --exec-path "run.bat" \
  --runtime-environment proton
```

`--dry-run` validates the parameters and directory structure and lists every file (and the total size) that
would upload, **without** creating metadata or uploading. Review the file list and resolved flags **with the
user** — this is also your last chance to notice a stray `.pdb` or a debug SDK binary in the payload.

### Step 8: Present the upload command and WAIT for explicit confirmation 🛑

The real upload is the **same command as Step 7 without `--dry-run`**. Do **not** run it autonomously.
Once the dry-run is clean:

1. **Display the exact, fully-resolved command** (all flags filled in, no placeholders) in a code block
   **in the same message that asks for approval**. If you ask again later, re-display the command.
2. **STOP and wait.** Either the user confirms explicitly (an unambiguous go-ahead) and you run that exact
   command, or they run it themselves and you resume at Step 9 once they say it is uploaded.

A clean dry-run, a passing validation, or approval of an earlier step is **not** upload approval.

The upload finishing means the **files landed**; the platform then processes the build, so its status
starts at **`pending`**. Grab the **new build id** from the upload output (or `builds list`, top entry).

### Step 9: Poll the build status until it leaves `pending`

A finished upload is not a finished build. **Do not report success on the upload alone.**

```powershell
# Windows / PowerShell — one self-contained command (polls internally; do not hand-loop with sleeps)
$ludeo  = "ludeo"                      # or the full path to ludeo.exe if not on PATH
$gameId = "<GAME_ID>"; $buildId = "<NEW_BUILD_ID>"
$deadline = (Get-Date).AddMinutes(7)   # platform processing cap — builds can stall
do {
    $out = & $ludeo builds get --game-id $gameId --build-id $buildId | Out-String
    # Read the Status FIELD, not the whole blob — avoids false positives on incidental words.
    $status = if ($out -match '(?im)^\s*Status:\s*(\S+)') { $matches[1] } else { '?' }
    if     ($status -match '(?i)^(success|ready)$')         { Write-Host "✅ Build DONE (status=$status)"; break }
    elseif ($status -match '(?i)^(failed|error|rejected)$') { Write-Host "❌ Build FAILED:`n$out"; break }
    else   { Write-Host "… status=$status; re-checking in 15s"; Start-Sleep -Seconds 15 }
} while ((Get-Date) -lt $deadline)
```

- **Confirm the status token on the first poll.** The observed terminal done-token is **`success`** (the
  line reads `Status: success`); `ready` is matched too for tolerance, but a current CLI does **not** emit
  `ready` — matching only `ready` makes the loop never detect completion. Eyeball the first output and
  adjust the extraction if the field or value differs (`Status:` vs a JSON `"status"`).
- **Terminal states:** `success` (or `ready`) ⇒ done and playable. `failed`/`rejected` ⇒ stop and report the
  payload; it will not become ready by waiting. Still `pending` at the deadline ⇒ report that, don't claim
  success.
- **Poll, don't busy-wait** — a fixed interval (~15s) inside one command with an overall timeout.

### Step 10: Verify the final build metadata

Once `success`, confirm it is the build you intended:

```bash
ludeo builds list --game-id <GAME_ID> --sort-by createdAt --sort-order desc   # new build at top
ludeo builds get  --game-id <GAME_ID> --build-id <NEW_BUILD_ID>               # status + metadata
```

Confirm status **`success`** and that `game-version`, `sdk-version`, build type and `exec-path` (the
`run.bat`) are what you intended.

> **The cloud run is also the first place the overlay pause runs.** `PauseGameRequest` / `ResumeGameRequest` only
> fire in a cloud Player-Flow session (CR-011), so when the user plays the build in the cloud, ask them to open and
> close the overlay mid-play once and confirm the game freezes and resumes — and that the objective timer stops while
> it is open (that needs the Pause/Resume trigger).

> **⚠️ Known gap — "Ludeo runs in cloud" is not verified here.** This phase treats status
> **`success`** (the platform processed the build and can run Ludeos from it) as the bar. There is **no
> discrete step that actually runs or plays a Ludeo in the cloud** to confirm it end to end. Leave this as
> an explicit gap; **do not fabricate a cloud-run step.**

### Step 11: Assign the build to the target environment 🛑

A cloud run is bound by **assignment**: the environment serves whichever build is assigned to it, and an
unassigned build is served nowhere. Only a build that `ludeo builds get` reports as **`success`** — not just
`ready` — can be assigned.

Assigning changes what that environment serves — it may replace the build there now — so gate it like the
upload (Step 8): show `<environment> · <NEW_BUILD_ID>` and the exact resolved command, then **wait for an
explicit go-ahead**. Approval of the upload is not approval of the assignment. One confirmed assign per
environment.

```bash
ludeo builds assign --game-id <GAME_ID> --build-id <NEW_BUILD_ID> --env-id <ENV_ID>
```

`<ENV_ID>` is the target environment's `envId` from the Input Contract — re-read it with
`list_game_environments` if that tool is in your tool list; otherwise use the id the user gave you. Or the
user can assign it themselves in Studio Lab → Game Builds. Either way, confirm with `ludeo builds get` (or
Studio Lab) that the environment now shows this build.

## 4. Questions to ask the human

- **Build folder path**, **Game ID**, **game version**, **access token** — if not provided.
- **The release build command** — their project's actual release path, before you run it.
- **SDK version** — always **confirm**; the SDK folder name can lie if a build linked a swapped SDK.
- **Changes description** — if it can't be inferred from context.
- **Which major** a minor build attaches to — if ambiguous.
- **Developer features** — what cheats / debug consoles / dev menus exist, and how each is gated.
- **Auth mode** — which mode the platform expects for this game's cloud build.
- **Target environment** — which one this build is for, and its `envId` if `list_game_environments` isn't available.
- **Global Triggers** — confirm both (Pause/Resume, Non-Ludeoable Area) exist in that environment before the cloud run.
- **Assignment** — explicit go-ahead to assign the build (Step 11), separate from the upload approval.

## 5. Patterns to apply

- 🛑 **Never upload without explicit user confirmation** — present the final command after a clean
  dry-run, then wait. Run only on an explicit go-ahead, or let the user run it.
- **Verify the artifact, not the intent.** Which SDK binary was copied, what is in `ludeo.ini` in the build
  folder, what is actually in the output directory — never the IDE configuration you selected.
- **Run path is the `run.bat`, not the `.exe` — always.** The `.bat` does `cd /d "%~dp0"` and then starts
  the executable, so the build runs from its own folder regardless of the launcher's working directory —
  the property `validate-build` proves. A raw `.exe` exec-path can break path-relative asset loading.
- **`--exec-path` is local and relative to `--local-directory`** — a path *inside* the build folder
  (`run.bat`, or `sub\dir\run.bat` if nested), **not** absolute.
- **`run.bat` calls the executable directly (no `start`)** — game logs reach the runner only via stdout.
- **Runtime environment defaults to `proton`** — Ludeo's cloud runs the Windows build under Proton.
  Override only if the user confirms a different target.
- **Verify commands against `ludeo --help`** — the CLI changes; the flags here are a snapshot, not the
  authority.
- **Modification builds are not supported from the CLI** (Studio Labs only). The CLI does `new` (default)
  and `sdkFree` builds; use `--build-creation-type sdkFree` (no `--sdk-version`) only for no-SDK builds.

## 6. Output Contract

- A **published build** on the Ludeo platform at status **`success`**, with the intended `game-version`,
  `sdk-version`, build type and `run.bat` exec-path, **assigned** to the target environment.
- A **Release build** verified against the release-build guard (`04 §2`): Release configuration, Release SDK binary, no debug
  artifacts in the output folder, and production values in the shipped `ludeo.ini` (`apiKey` set,
  `activationLudeoId` empty, correct `platformUrl` and `authMode`).
- **Debug features release-safe by default** — cheats, debug consoles and verbose logging gated on the
  build configuration rather than a runtime flag, with what was audited recorded in the verification notes.
  CI flagged as the durable fix.
- `run.bat` at the build root, used as the relative `--exec-path`, launching the executable directly so the
  game's logs reach the cloud runner's stdout collection.

## 7. ✅ Success Criteria

- [ ] **Release build verified on the artifact** — Release SDK binary shipped (not `*-Development`),
      release configuration, no debug artifacts in the output folder, no `.pdb` in the upload payload.
- [ ] **Shipped `ludeo.ini` holds production values** — `apiKey` set, `activationLudeoId` empty, `platformUrl`
      and `authMode` correct for the target environment.
- [ ] **Debug features release-safe** — cheats / debug consoles / dev menus gated on the build
      configuration, none reachable in Release; audited and confirmed with the user.
- [ ] **Build is self-contained** — the whole ThirdParty runtime folder shipped, deps resolved durably.
- [ ] **Self-contained launch PASS** — `validate-build`, or Step 4's manual check (launches from its own folder).
- [ ] **`ludeo` CLI reachable** (`--help`) and authenticated (`auth status`).
- [ ] **Build type correct** — major on the first build, minor otherwise (with `--major-build-id`).
- [ ] **`--sdk-version` confirmed with the user**, not inferred from the SDK folder name.
- [ ] **`--changes-description` non-empty** (inferred or user-supplied).
- [ ] **`--dry-run` reviewed** (file list + resolved flags) and confirmed with the user.
- [ ] **Final upload ran ONLY after explicit user confirmation** (or the user ran it themselves).
- [ ] **Status polled to `success`** — `failed` or a timeout surfaced rather than reported as success.
- [ ] **Global Triggers confirmed** in Studio Lab → the target environment: Pause/Resume and Non-Ludeoable Area.
- [ ] **Build assigned** to the target environment (`builds assign … --env-id`, after an explicit
      go-ahead), or by the user in Studio Lab → Game Builds.
- [ ] **Ludeo run in cloud** — ⚠️ **GAP** (Step 10): treated as satisfied by status `success`; no discrete
      cloud-run verification exists yet.

## 8. Common Mistakes

- **Uploading without explicit confirmation** — the cardinal sin. A clean dry-run is not approval.
- **Reporting success on upload completion** — the upload only lands files; poll `builds get` to `success`.
- **Stopping at `success` without assigning** — the build exists but no environment serves it.
- **Deleting `.pdb` files by rebuilding** — Release generates them again; exclude them from the payload.
- **Trusting the SDK folder name for `--sdk-version`** — builds link swapped SDKs; confirm with the user.
- **Shipping the `*-Development` SDK binary** — check the file in the output folder, not the IDE config.
- **Shipping `ludeo.ini` with `activationLudeoId` still set** — every cloud session jumps into that one Ludeo.
- **Shipping `ludeo.ini` with a placeholder `apiKey` or a staging `platformUrl`** — the build authenticates
  against the wrong environment, and it runs fine locally so the mistake is invisible until the cloud run.
- **Shipping reachable cheats or a debug console** — gate them on the build configuration at the read site;
  a runtime hide-flag still ships the code.
- **Auto-fixing debug config instead of failing loud** — mutating config hides the mistake and dirties
  source; assert and fail, allowlisting legitimate non-default values.
- **Uploading a build that failed `validate-build`** — fix and re-validate first.
- **Registering the `.exe` as `--exec-path`** instead of the relative `run.bat`.
- **Hand-copying a missing DLL into the build folder** — discarded on the next rebuild; fix durably.
- **Cherry-picking ThirdParty DLLs** — copy the whole folder; the missing one crashes on launch.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **CLI not found** | Ask the user to install the Ludeo CLI or provide its path; don't guess a source. |
| **Auth / 401** | `ludeo auth status`; re-`set-token` (token expired or wrong environment). |
| **Command hangs on input** | A required flag is missing → interactive mode. Supply all required flags (incl. `--game-version`/`--sdk-version`/`--build-type`), or add `--no-interactive` so it fails instead of prompting. |
| **Minor rejected for missing major** | `--build-type=minor` needs `--major-build-id`; get it from `builds list`. |
| **Build crashes on launch on a clean machine** | A ThirdParty runtime DLL is missing (cohtml, libx264, …). Copy the whole `ThirdParty/<platform>/<config>/Bin/` folder via a durable build step (Step 3), rebuild, re-validate. |
| **Cloud run has SDK logs but no game logs** | The game's log isn't on stdout, or `run.bat` wraps the exe in `start` (new console breaks the pipe). Call the exe directly and route the game's logging to stdout (Step 4). |
| **Every cloud session opens the same Ludeo** | `activationLudeoId` is still set in the shipped `ludeo.ini` (Step 2). Clear it, rebuild the folder's config, re-validate. |
| **Authenticates locally but fails on the cloud** | `ludeo.ini` carries dev/staging values — check `platformUrl`, `authMode` and `apiKey` in the **shipped** file, not the source template. |
| **`exec-path` not found** | Must be relative to `--local-directory`, and `run.bat` must exist there; re-run Step 4 to (re)create it. |
| **Status stuck `pending` past timeout** | Report it; don't claim success. `failed`/`rejected` won't ready by waiting — surface the payload. |
| **Build is `success` but the cloud still runs an old build** | It was never assigned, or was assigned to a different environment. Check the `envId` and run Step 11. |
| **Assign rejected** | The build is not yet `success` (`ready` is not enough) — re-poll. Otherwise show the user the error and re-check the `envId` with them. |

## Related / Next

- `ludeo-integration-docs/04-BUILD-INTEGRATION.md` §2 "Release-build guard" — the rules this phase enforces; §4 —
  the `ludeo.ini` runtime config; §5 — the ThirdParty copy step.
- `3e-compile-and-fix.md` — the build-and-fix loop, if the release build doesn't compile clean.
- `6b-implement-game-actions.md` — the last integration content before verification.
- **Next:** done — the build is live in the target environment.
