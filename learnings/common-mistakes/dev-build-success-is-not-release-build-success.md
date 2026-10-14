---
category: common-mistakes
tier: generalizable
sourceGame: FPSGameStarterKit
phase: "1,3"
question: "Does the game build in more than one configuration or packaging path (an editor/dev build versus a release/shipping/packaged build), and will the integration be uploaded as a release build?"
sanitized: true
origin: "unreal:common-mistakes/packaging-smoke-test-required"
---

# A clean dev build is not a clean release build: smoke-test the packaging path before calling the build done

**Precondition:** the game has a dev configuration you iterate in, and a separate release/packaging path (the one
phase 7 uploads).

## The mistake

The SDK lifecycle phase was marked complete after the dev build compiled cleanly. Packaging failed later: the
project had no target for the release build, so the dev build ran fine and the package couldn't be produced. The
human found it when they ran the packaging script.

Dev builds can hide failures that only appear on the release path:

- a missing or different build target or project for the release configuration;
- module or library dependencies the dev build tolerates (dynamic loading, a DLL already on the path) but a
  static or release link rejects;
- code under different preprocessor defines in release, including the `LUDEO_SDK_ENABLED` off-build (CR-001);
- the SDK runtime not staged next to the packaged executable.

## Correct behavior

- **Always:** before calling the build or compile step done, run a fast **release-configuration build** of the
  game target. A build without full packaging catches missing targets, missing modules and link gaps cheaply.
- **When the game will be uploaded (phase 7):** also run the full package and **boot it once**. Check the log for
  the SDK version line and a successful activation.
- **In phase 1,** find out how the game packages, and whether a release target even exists, so a missing target
  is planned for rather than discovered at upload.

Related: `learnings/common-mistakes/never-claim-verified-without-runtime-test.md`.
