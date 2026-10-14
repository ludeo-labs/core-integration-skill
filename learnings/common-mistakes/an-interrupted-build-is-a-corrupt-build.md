---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,5,6,7"
question: "Does a full build of the game take longer than the command timeout of the tool running it, or does the build also cook or package content (asset archives, packed data) rather than only compiling code?"
sanitized: true
origin: "unity:engine-quirks/buildscriptsonly-is-not-scripts-only-with-addressables, unity:engine-quirks/buildplayer-unloads-assets-held-across-the-build, unity:engine-quirks/buildplayer-destroys-assets-loaded-before-it"
---

# An interrupted build is a corrupt build — and a build's exit code is not its result

Applies when building the game is slow or writes content as well as code. Iterating on the integration means
rebuilding a lot, and a "code-only" or incremental mode looks like the fast path. Measured on one project:

- Full build: **30 minutes** (dominated by shader compilation).
- "Code-only" build: **1 minute** — but it **rewrote a 603 MB content archive**. Content hooks ran inside the build
  regardless of the mode, so the content pipeline re-executed.

The dangerous part is not the time. **Killing a build mid-content-write leaves a corrupt output, and the next
incremental build does not repair it** — the half-written file is newer than its inputs, so it counts as up to date.
After an interrupted run the game crashed on launch reporting a corrupted archive. Confirmed by timestamp: every
healthy archive carried the last good full build's time; the single corrupt one carried the interrupted build's.

## Rules

1. **Don't promise a fast path before measuring it on this project.** Time it, and check whether content outputs
   change (list the output folder with timestamps before and after). If they are rewritten, it is a content build
   under another name.
2. **Never run a build under a tool timeout shorter than the build.** An agent harness killing the process at N
   minutes is indistinguishable from a power cut. Run builds **in the background** with no wall-clock kill, and poll
   for the result.
3. **After any interrupted build, do a full rebuild.** Don't layer an incremental build on top and assume it heals.
4. **Verify a build by its outputs, not its exit code** — in both directions. Find the build's own success line and
   check the artifact timestamps. A non-zero exit can come from a post-build step that failed *after* a correct
   artifact was produced (one build script's config-restore step threw after the build succeeded, exit 1, artifact
   fine); a zero exit can sit on top of a stale or partial artifact.

## Config flipped for one build

A script that flips a setting for the cloud build (a `ludeo.ini` value, a define set) and restores it afterwards can
fail in the restore and **strand the project in the cloud configuration** — the next local build then silently ships
the wrong settings. After such a build, check the restored values **on disk** rather than trusting the script reached
its end, and give the cloud build its own output folder so it never overwrites the local test build (`phase 7`).

## What to use instead

For iterating on integration code, compile only (the compile gate, `phase 3 · task 5`) — no content touched. Build the
full game only when you need to run it, and accept that it is a full build.
