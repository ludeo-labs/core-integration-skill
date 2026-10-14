---
category: common-mistakes
tier: universal
sourceGame: VoyagerV2
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/never-claim-verified-without-runtime-test"
---

# Never claim "verified" or "complete" on compilation alone

Compilation proves the code builds, not that it works. After the compile-fix loop passes:

1. Run the phase's rebuild-and-run gate, or present its runtime checklist to the human.
2. Wait for the runtime evidence (the log lines the gate names, or the human's report).
3. Only then mark the phase done.

**Wrong:** "Fully verified: the build and the release package both pass cleanly."
**Right:** "Build and package pass. Here's the runtime checklist: [list]. I'll record the phase as done once the
run confirms it."

This applies to every phase, not just the last one.
