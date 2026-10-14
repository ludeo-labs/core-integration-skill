---
category: architecture
tier: generalizable
sourceGame: RoomActionSample
phase: "5,7"
question: "Are there Ludeos the integrator has already confirmed on screen, a local replay launch argument (--ludeo=<id>), and a restore that logs its own checks before the viewer's Play?"
sanitized: true
origin: "unity:architecture/replay-every-confirmed-ludeo-as-a-regression-gate-before-upload"
---

# Replay every confirmed Ludeo as a regression gate before an upload

**Precondition:** the build accepts the local replay trigger (`07 §2.5`, `--ludeo=<id>`), and the restore logs its
own post-settle checks (`11 §10`).

Each fix to the restore — a new state family, a cutscene filter, a settle rule — can break a level that already
worked, and a human re-testing a dozen levels before every upload does not happen. The restore already checks its
own work after the settle, before Play, so a script can do the re-test:

1. Keep a list in the plan (`RESTORATION_PLAN.md`) of every Ludeo the integrator confirmed on screen, one short name
   each (level and what it covers: "chasing lasers", "boss mid-phase").
2. For each: launch the local build with `--ludeo=<id>` and its own log file, wait until the post-settle check lines
   appear (or a timeout), save the log, and close the process.
3. Summarize per Ludeo: which checks ran, and any failure, error or **missing** check.

Thirteen Ludeos took about seven minutes with nobody at the keyboard. It ran twice before one upload and showed that
three restore fixes had broken none of the confirmed levels.

## Pitfalls

- **Count the check lines per Ludeo, not only the failures.** One replay stalled at the main menu — nothing logged
  after boot — and produced **no** check lines, which a grep for failures would have called a pass. It was a launch
  three seconds after the previous process had been force-closed; rerun a silent Ludeo alone before calling it a
  regression.
- **The checks cover the moment before Play.** Something that goes wrong after Play (a restarted boss phase bringing
  parts back) still needs the integrator's eyes on the Ludeo the fix was for.
- **Run it on the exact build you are about to upload** (`phase 7`), and again after any fix it prompted.
