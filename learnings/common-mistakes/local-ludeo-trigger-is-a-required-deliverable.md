---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: "3,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/ludeo-play-console-command-is-required"
---

# The local Ludeo trigger is a required deliverable, not an optional nicety

## The mistake

The agent implemented the startup sequence's SDK steps and skipped one: registering the developer trigger that
plays a Ludeo by id. That step was a one-line registration, and the reference listed it three times. The user
found the gap when they tried to test Player Flow and had no way to start it.

## Why it matters

Without a local trigger, Player Flow can't be exercised during development. The overlay may not offer a "play a
Ludeo" path on a local build, and every phase-5 smoke test (`5d` Step 6, `5e` Step 7) depends on it. In this skill
the trigger is `5d` Step 3: a `--ludeo=<id>` launch argument (in the engine's own argument convention), plus
`activationLudeoId` in `ludeo.ini`. Both synthesize a `LudeoSelected` that goes through the real handler and the
real `ludeo_Session_GetLudeo`. If the engine has a dev console, a "play Ludeo <id>" command is a cheap third
entry point that skips a restart. It must dispatch the same way, and never fake the `DataReader`.

## Why the agent skipped it

It picked the interesting SDK steps from the reference instead of executing the reference as a checklist. A step
being trivial to implement doesn't make it optional to deliver.

## Prevention

After implementing a numbered sequence from a reference file, count the steps in your code against the steps in
the reference, and diff them one by one. A mismatch means something is missing. Every Player-Flow entry point the
reference lists (the overlay's `LudeoSelected`, the launch arg, the `ludeo.ini` field) must exist before the
phase is called done.
