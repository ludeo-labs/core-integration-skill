# Orchestration — how phases 3, 5 and 6 run

Phases 3, 5 and 6 are each one logical phase made of single-task **briefs** (`3a`–`3f`, `5a`–`5e`, `6a`–`6b`). The
driving agent runs each of them as an **orchestrator**: it hands one task at a time to a worker, checks what came
back, and **owns every gate itself** — so the user experiences one continuous phase and the orchestrator's context
stays small. The phase entry points are `3-lifecycle-orchestrator.md`, `5-tracking-restore-orchestrator.md` and
`6-actions-orchestrator.md`.

## Dispatch — one task at a time

**If your agent can start subagents** (e.g. Claude Code's Agent tool), dispatch one per task with:

- the **absolute path of the task brief**, the **game repo path**, and the **input artifact paths** it needs (for
  phase 5, also the wave number `N` and that wave's `objectType`s);
- the instruction to follow the brief exactly, produce its output, **not** run the game (the orchestrator owns the
  gate), and return a short summary, the files it created or edited, and any questions for the user.

On return: **check the artifacts exist and are well-formed**, relay the questions, then run the task's gate. Pass state
**by file** — the plan files and the state file on disk — never by re-telling a previous worker's output.

**If your agent can't start subagents**, run the briefs yourself, one at a time, in the same order and with the same
gates. Keep the same discipline: read a brief's inputs from disk, write its outputs to disk, update the state file,
and don't carry one task's working notes into the next. Suggest a fresh session between tasks when context grows —
the state file and the plan files are what make that safe.

## Gates

- **Every gate is the orchestrator's.** A worker never declares its own task done.
- **Build gates: the agent builds.** CMake / MSBuild / make run headless — build with the SDK on (and off if a no-SDK
  build ships), read the log, fix (`3e-compile-and-fix.md`). **Run gates: the integrator runs** — whoever
  `integration.json → intake.runnability.runsTheGame` names. The agent reads the run log afterwards; beyond the log
  it relies on their word. Never declare a run gate passed by inspection.
- **Review gates** (a plan the user must approve) stop the phase until the user has approved the specific rows.
- Update the state file at every gate (`state-file-schema.md`): the step's status, decisions, findings.

## Fix loop

When a gate fails (build error, missing log line, wrong replay):

1. **Instrument before theorizing** (`ludeo-integration-docs/11-TROUBLESHOOTING.md` §10): get the real log first;
   restore bugs invite confident, wrong theories that one log line kills.
2. Hand a fix worker the **same brief**, the failing log text or the user's report **by file**, and the files the
   previous worker touched.
3. Root-cause every fix — no try/catch or symptom-masking (`3e-compile-and-fix.md`); propose, confirm, then change.
4. The orchestrator keeps the iteration state across as many round trips as it takes. Escalate to the user when the
   same failure recurs after a fix or three attempts haven't moved it.

## Progress

Report each phase's start and finish (and, in phase 5, each wave) per `ludeo-studio-mcp.md` → **Reporting
progress**, from the orchestrator only — tell workers not to call `ludeo-mcp` tools.
