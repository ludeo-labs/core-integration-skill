---
category: common-mistakes
tier: generalizable
sourceGame: EndlessFPS
phase: "5,7"
question: "Is someone asking to enable the developer console (or another debug-only facility) in a release build just to start a Ludeo there?"
sanitized: true
origin: "unreal:engine-quirks/console-in-shipping-needs-unique-env-prefer-launch-arg"
---

# To play a Ludeo in a release build, use the launch arg — don't enable the console

**Precondition:** you want to start Player Flow on a release/shipping build, where the game's developer console
is compiled out.

## The trap

The obvious route — "turn the console on in the release build so we can type the play command" — is usually
expensive and invasive in an engine:

- The console is typically compiled out by a build-configuration define, not a runtime switch, so enabling it is a
  **build-configuration change** for the release target.
- On engines distributed with precompiled release libraries, flipping such a define can force a rebuild of large
  parts of the engine (the precompiled libraries were built with the console off), plus restructuring the
  project's build setup to carry the new define.
- It ships a debug surface in the exact build the cloud runs.

## The cheaper path

The reason people want the console in a release build is almost always to start **Player Flow**. The integration
already has a route for that: the local trigger launch arg (`07 §2.5`, e.g. `--ludeo=<id>`, implemented in
`phase 5 · task 3` Step 3), which the game parses from its own command line — independent of any console — and
which feeds the **same** `LudeoSelected` handler. On the cloud, the platform supplies the Ludeo context itself.

- **Local release test:** add the launch arg to the shortcut or a `run.bat` line. No console, no rebuild.
- **Cloud:** nothing to add for Player Flow.

## How to apply

When asked to "enable the console in the release build", first ask **why**. If it's to play a Ludeo, point at the
launch arg (or `ludeo.ini`'s `activationLudeoId`, `04 §4` runtime configuration). A reachable console in a build
that goes to the cloud is also exactly what `04 §2`'s release-build guard forbids, so the console route is at
most a temporary local diagnostic build that is never uploaded — take it on only if arbitrary console access is a
hard requirement, budget the rebuild, and record it as a game build change.

The same reasoning applies to any debug-only facility in a release build; see
`learnings/common-mistakes/release-config-compiles-debug-bodies-to-stubs.md` for why simply forcing it on
often leaves you calling empty stubs.
