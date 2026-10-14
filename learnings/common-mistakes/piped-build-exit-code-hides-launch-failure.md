---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "1,3"
question: "Does the agent run builds through a shell pipe (`| tee`, `| tail`, `| grep`) or a wrapper, and judge success from the exit code?"
sanitized: true
origin: "unreal:engine-quirks/ue4-ubt-path-different-from-ue5, unreal:engine-quirks/ubt-needs-dotnet6-rollforward-on-newer-runtime"
---

# A piped build reports success when the build tool never ran — check for real compile lines

**Precondition:** builds are launched from a shell with their output piped (`… | tee build.log | tail -40`), and the
result is judged by exit code or by grepping for `error`.

## What happened (twice)

- **Wrong tool path.** The build tool's path differed between two versions of the same engine (one level of
  subdirectory). The invocation failed with `No such file or directory` — but it was piped through `tee`, so the
  **pipeline** exited 0. `grep "error"` on the log found nothing, because the compiler never ran.
- **Missing runtime.** The build tool needed an older .NET runtime than the machine had and exited immediately
  with *"You must install or update .NET to run this application"*. Same pipe, same exit 0, zero files compiled.
  (Fix there: `DOTNET_ROLL_FORWARD=Major` to let it run on the newer runtime, or install the required runtime.)

In both cases the agent's "build passed" was a pipe artifact.

## Why

A pipeline's exit status is the **last** command's (`tee`, `tail`), not the build's, unless `set -o pipefail` is on.
And grepping for compiler errors can't find errors from a compiler that never started.

## The rule

- Redirect instead of piping when you need the exit code: `build-cmd > build.log 2>&1; echo "exit=$?"` — or use
  `set -o pipefail` (bash) or check `${PIPESTATUS[0]}`. In PowerShell, check `$LASTEXITCODE` of the build itself.
- Always redirect **stderr** too, so launch failures land in the log.
- **Positive evidence, not absence of errors:** confirm the log shows the build actually working — compile lines
  (`[N/M] Compile …`, `ClCompile`, per-file names), a link line, and a fresh binary timestamp.
- Before the first build on an unfamiliar project, verify the build tool path exists and that the tool launches
  (`<tool> --help` or `--version`).

When a phase gate says "the build passes", the evidence is the build log showing the compiler and linker ran — not
the shell's exit status.
