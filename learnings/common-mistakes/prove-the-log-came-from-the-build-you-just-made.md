---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "1,3,5,6,7"
question: "Are you about to read a runtime log to judge a change you just built — on a project where a build takes minutes and overwrites the previous binary in place, so a run launched during that window exercises the OLD binary?"
sanitized: true
origin: "unity:common-mistakes/prove-the-log-came-from-the-build-you-just-made"
---

# Prove the log came from the build you just made

Applies when builds are slow and overwrite the previous output in place.

A release build here took four to six minutes and overwrote the previous executable in place. Anyone launching the
game during that window got the old binary, and nothing in the resulting log said so. It parsed, had the expected
shape, and read as a clean pass of the very change it did not contain. That happened: a log was handed over as the
first test of new verification code and showed the integration working. It was the previous build; the new checks
had never run.

## The check that catches it

Before reading anything else in a fresh log, **search it for a string only the new code can print** — and for one
only the *old* code could print:

- new string present, old string absent → this is the new binary, read on;
- old string present → the run predates the change; stop and re-run.

One grep separates a real result from a confident wrong one.

## The stronger version, for a change with no new log line

Search the **built binary** instead of the log. String literals survive into the executable (and, with symbols,
function names): a literal you added should be present; a literal you deleted should be absent.

This also catches the sibling failure: trusting a build's exit code. A build script can exit `0` while a step it
wraps failed, or a stale object can be linked without your edit. Confirm the build's own success line, then confirm
the artifact contains the change — compare its timestamp with your edit too. See
`learnings/common-mistakes/a-green-compile-does-not-prove-your-edit-compiled.md`, the compile-time twin.

## Don't launch into a build in progress

Say explicitly when a build starts and when it has finished, and give the full path of the executable that was
produced. A run started against a half-written output folder isn't just stale, it's undefined — the process loads
whichever files happened to be there. Wait for the success line before anyone launches.
