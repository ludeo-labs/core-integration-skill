---
category: common-mistakes
tier: generalizable
sourceGame: RoguelikeSample
phase: "4,5,6"
question: "About to follow a file:line reference recorded in an EARLIER phase's artifact (CODE_MAP.json, integration points, the TDD)? Check whether a later phase edited that file. Phase 3 inserts hooks into exactly the game files phase 2 indexed by line, so every reference below an insertion silently points somewhere else — and the shift is not uniform, so no single offset corrects it."
sanitized: true
origin: "unity:common-mistakes/a-code-map-line-reference-goes-stale-the-moment-you-edit-the-file"
---

# A CODE_MAP line reference goes stale the moment you edit the file it points into

**Precondition:** a later phase consumes `file:line` coordinates recorded before game files were edited.

Phase 2 records the game's structure in `CODE_MAP.json` as `file:line` coordinates. Phase 3 then edits game files to
install the lifecycle hooks. Nothing reconciles the two, so by phase 4 a large fraction of those line numbers no
longer point at what they claim. This is **structural**: the files phase 3 edits are, by construction, the
highest-value files phase 2 indexed — the central event hub, the flow manager, the pause UI.

On one integration, 54 references pointed into the four files the lifecycle work had touched. Sampled: "the
enemy-registration event" landed on an unrelated UI event, "the orb-spawn method" on a bare `else`, "the
level-teardown method" on a closing brace. None of those errors — you read the wrong code and carry a wrong belief
into a capture or restore design.

## Why an offset does not save you

Hooks are inserted at several points in a file, so the shift is a step function, not a constant: the same
integration had drifted +12 in one file's declaration block and +61 at another file's level-load seam.

## The rule: re-locate by symbol, never by number

1. Take the *name* the entry claims — function, event, member, class.
2. Find its declaration in the current working copy, and use that line.
3. If the entry names no searchable symbol, treat the reference as unverified and read the region before trusting
   it.

This automates well: walk the artifact, extract each entry's identifier, re-grep for its declaration. When repairing:

- **Keep the old value** (e.g. a `_lineRepairedFrom` field) — it distinguishes "verified" from "never checked".
- **Log the repair** in the artifact's corrections log.
- **Check the file, not just the line.** The same audit found an entry attributed to the wrong *file* entirely — a
  by-symbol search finds that; an offset correction never questions the path.

It bites hardest in a multi-thousand-line "god" class, where a wrong line still lands in related-looking code.

**Audit the references at the start of any phase that consumes an earlier artifact**, as a batch — not one at a time
mid-task, after you have already read an unknown number of wrong lines. Related:
`learnings/common-mistakes/investigate-before-asking.md`.
