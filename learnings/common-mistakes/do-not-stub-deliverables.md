---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3,5,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/do-not-stub-deliverables"
---

# Don't mark a phase complete with stubbed deliverables

Agents tend to rationalize stubbing a complex feature ("needs more investigation", "deferred to a later phase")
and then mark the phase complete. Each phase must produce working deliverables as defined by its Output Contract.

## How it shows up

- The Player-Flow read side left as a "placeholder" although it's required.
- Health restore "deferred" when the reference flow restores it in the same phase.
- The game-metadata object omitted, although the restore needs it to resolve the level.

## Prevention

Before marking a phase done in `integration.json`, check each Output Contract item:

1. Is the code functional, not a log line or a comment?
2. Does it do what the deliverable says?
3. Would it work if you ran the game now, and have you run it?

If any answer is "no", the phase isn't complete. If something can't be finished, tell the user and record it in
`risks`. Cutting scope is the user's call.

**Reviewers:** push back on "placeholder", "stub", "deferred" or "TODO" for any contract item.
