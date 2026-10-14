---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "4"
question: null
sanitized: true
origin: "unreal:common-mistakes/reverify-prior-session-blockers"
---

# Don't trust a prior session's "blocker" note without re-verifying it

## The mistake

A known-issues note in the state file, left by an earlier session, said a tool was "blocked because the studio's
editor tooling suppresses script execution". The agent took it as authoritative and spent about 30 minutes
designing workarounds (a static asset scanner, patched launch scripts, config edits, debug probes).

When it finally grepped the source of the warning text, the "suppressor" turned out to be a startup function that
logs a warning when an environment variable is unset, then **returns from that one function**. It disables
nothing. The earlier diagnosis was wrong. The real blocker was something else, and it never got diagnosed because
the time went to the wrong path.

## The rule

**Before treating any earlier "X is blocked because Y" note as fact, spend 5 minutes verifying Y.** If Y is a log
warning, find its source. If Y is a config setting, read it. If Y is "it doesn't work", try it.

Known-issue notes in `integration.json`, earlier plan files and handoff notes are snapshots of what someone
*thought* was true. They may have been rushed misdiagnoses, silently worked around, or made stale by a later
change.

## Why skipping re-verification is tempting, and costly

"The earlier note was careful", "there's no time", "if it's wrong I'll find out later": re-verifying takes five
minutes, and chasing a wrong path takes hours.

## How to apply

For any blocker note that gates non-trivial work:

1. Read its claimed root cause.
2. Find the actual evidence: a log line, a config value, source code.
3. Check whether the claim still holds.
4. If it doesn't, update the note immediately, so the correction isn't lost.

Related: `learnings/common-mistakes/never-claim-sdk-behavior-without-citation.md`,
`learnings/common-mistakes/do-not-trust-learning-without-verifying-precondition.md`.
