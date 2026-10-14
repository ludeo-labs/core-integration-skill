---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,7"
question: "Is the integration verified on a packaged/staged build (a release folder, an installer output, the phase-7 upload directory) that a separate packaging step produces, rather than on the binary the compile loop just wrote?"
sanitized: true
origin: "unreal:common-mistakes/stale-package-masquerades-as-missing-feature, unreal:common-mistakes/wrong-target-name-silent-noop, unreal:engine-quirks/bp-only-with-code-plugin-still-needs-build-flag"
---

# A stale package looks exactly like a missing feature — check the binary before debugging code

**Precondition:** the game is tested from a packaged or staged build produced by its own packaging step, not from
the binary the compile-fix loop writes.

## What happened

Restore, actions and pause marking all worked in the dev build. The integrator then ran the packaged build and
reported "no pause, no actions, didn't even restore" — it read as a regression across three phases. It was not a
code bug: the package had been produced phases earlier and never rebuilt, so it contained only the early
scaffolding.

Two variants produce the identical symptom:

- **A packaging script copied from another project** still named the old project's build target. The build step
  silently built nothing, the stage/copy step packaged whatever binaries happened to be on disk, and the script
  reported success. The package then failed at launch with a missing integration module — or, worse, ran an old one.
- **A packaging script that skips its compile step on a heuristic** ("no game-source folder, so nothing to
  build"). The dev configuration "worked" only because an earlier build had left a binary that staging reused;
  the release configuration, never built, failed at staging with a missing-executable error.

## Diagnose in seconds, before touching code

1. **Timestamps.** Compare the packaged executable's (and integration DLLs') modification time with the newest
   integration source file. Binary older than the source ⇒ stale. Stop and rebuild the package.
2. **Ghost log lines.** Grep the packaged run's log for a message that no longer exists in source (an early stub
   or placeholder string). If it prints, the binary is old.
3. **Missing new lines.** No action log lines, no `StartNoneLudeable`, no restore markers — corroborates it.
4. **Build stamp.** If the integration logs a build stamp or version at startup, compare it with the source.

## The rule

- Code edits never reach a previously packaged build. After every phase that changes code, rebuild the package
  before any runtime check on it; a human verification gate on a packaged target reads "re-package, then test the
  package" — a passing dev build is necessary, not sufficient.
- A packaging script must always compile the configuration it stages, for a target that exists in **this**
  project. When reusing a script, diff its target and configuration names against this project's build files
  first, and confirm the build log shows real compile lines for that target.
- If the package on disk predates the source, say so up front instead of reporting the run as a code result.
- A wrapper script that ends in an interactive `pause` hangs a non-interactive run — call the underlying build
  and package commands directly with the same flags.

The `phase 7` upload directory is a package too: confirm the binary you upload is the one you just verified.
