---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "5"
question: "Does the restore poll a game-owned 'world/level is ready' flag to know when the captured level exists? Find what CLEARS it — if the loader or generator clears it rather than the load request, it still answers for the level being left."
sanitized: true
origin: "unity:architecture/a-world-ready-flag-may-still-answer-for-the-world-you-are-leaving"
---

# A "world is ready" flag may still be answering for the world you are leaving

**Precondition:** the restore's "reach active gameplay" step (`07 §2.1` step 4) waits on a game-owned readiness
flag before it freezes and applies.

"Level loaded" is not that signal when content builds over many frames, so the natural move is to poll the game's
own readiness state. Here a level manager exposed a spawn-queue counter and a `setup_finished` boolean. Both looked
authoritative.

`setup_finished` is set `true` when the level finishes assembling. The trap is what sets it **false**: not the load
request, but a line near the top of the generator's build routine — which runs only after the new level is up and
generation begins. Between "the restore asks for the level" and "the generator starts", the flag still holds the
previous level's answer.

## It fails by succeeding at the wrong time

- **A level was already loaded** → the flag is still `true` → the gate passes on the first frame after the load is
  requested. The restore freezes, applies and opens the room into the world it is in the middle of leaving. It
  looks like the flow works.
- **Cold start, no level yet** → the flag is `false` → the gate waits correctly.

The two cases disagree, and the broken one looks healthy. One session was lost to the theory "replay only works
after you play a level first, so it must need a live session" — plausible, and built entirely on a false positive.

## The fix: treat the flag as an edge

1. Wait until the flag reads `false` — the game admitting the old world is gone;
2. only then wait for it to read `true` (plus any loading counter it pairs with).

No game edit and no new game state; on a cold start stage 1 is satisfied immediately. Bound both stages and log
which one you are in — a two-stage wait that stalls silently is as unreadable as the false positive it replaced.

Writing `false` into the flag from the integration before loading was rejected: it mutates state the game owns and
hides the same bug from the game's own tooling, which polls the same flag.

## The general rule

For any game-owned readiness boolean you poll across a level transition, ask: **what clears it, and does that
happen before or after the thing I am waiting for?** A flag reset by the producer rather than by the request lies
for exactly the window you care about. Level-scoped is not the same as edge-safe. Related:
`learnings/architecture/wait-on-work-in-flight-not-on-a-flag-the-restore-suppressed.md`.
