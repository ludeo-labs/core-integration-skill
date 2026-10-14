---
category: common-mistakes
tier: universal
sourceGame: ActionAdventureSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
origin: "unity:common-mistakes/grep-the-learnings-index-by-phase-without-a-word-boundary"
---

# Grepping `learnings/INDEX.md` by phase: `\b` never sits between `p` and the digit

The Load step says to read every entry whose `phase` matches the current phase. An index line carries it as `| p3 |`
or `| p1,3,7 |`, so the obvious regex is something like `p[0-9,]*\b3\b`. **That pattern silently misses every
`p3`-only entry:** `\b` is a boundary between a word and a non-word character, and `p` and `3` are both word
characters, so `p\b3` can never match. It still matches `p1,3` (comma before the 3) — which hides the bug: the grep
returns *some* results, so it looks like it worked.

Observed: a phase-2 grep returned only the universal `p1,2,3,4,5,6,7,8` entries, and the agent concluded "only
universal learnings apply to phase 2". Six phase-2-only learnings existed; the same pattern would have hidden ~30
phase-3 entries.

## Pattern that works

```
grep -E '\| p([0-9]+,)*3(,|\s)' learnings/INDEX.md
```

`([0-9]+,)*` eats earlier phases, `3` is the phase, and `(,|\s)` requires a comma or whitespace after it — so it
matches `p3 `, `p1,3 `, `p3,5 ` and rejects `p13 `.

## Positive control

Before trusting the count, pick an index line you *know* carries the phase and confirm the pattern returns it. This is
`learnings/common-mistakes/ask-what-your-check-cannot-see.md` applied to the first tool call of a phase.
