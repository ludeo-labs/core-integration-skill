---
category: architecture
tier: universal
sourceGame: TPSSample
phase: "5"
question: null
sanitized: true
origin: "unity:architecture/make-the-restore-verify-every-value-it-writes, unity:architecture/validate-placement-after-restore"
---

# Make the restore verify every value it writes, and report it itself

`11 §10` sets the rule: at each apply site register the expected value and a read-back of **live** game state, and
evaluate at two checkpoints — after the settle, and at `RoomReady`. This lesson is how to build it so it stays
useful. It started as placement validation (player and enemy positions, after a moment visibly began in the wrong
place) and grew to the whole restored set.

## What not to build

Re-running the capture writers against the restored world and diffing against the recording. It verifies that
capture and restore agree — which nobody doubts — costs a refactor of every writer, and answers a question nobody
asked. The question that matters: **after we set a value, is the game still holding it?** And the read-back must
hit live state, never a copy of what was written — the first bug this ever caught was the game's spawn handshake
teleporting the player a second after the restore placed them.

## Shape

```cpp
RestoreCheck::Reset();                                            // start of every apply
RestoreCheck::Expect(group, [=]() -> std::optional<std::string> { // nullopt = right, else the complaint
    return Diff("door " + id + " open", wantOpen, door->IsOpen()); });
RestoreCheck::ExpectPosition(group, label, want, [=] { return e->Position(); }, tolerance);
RestoreCheck::Report("after settle");                             // and again at RoomReady
```

- Return a **complaint string**, not a bool, naming the thing and both values. Comparison helpers return "no
  complaint" when correct, so a site can chain several and the first real complaint wins.
- Report positions **even when passing** ("player 0.00 m; 58 enemies, worst drift 1.59 m") — a slow regression shows
  up as drift before it fails. Tolerances: tight for the player (who must not move during the settle), a few metres
  for AI that may step; also count entities **gone**.
- One composite check per entity, not one per field.
- Per group: one line when clean; on failure a count, the first few offenders named, and a **per-kind tally**
  (complaint with the subject stripped: `31x present but NOT VISIBLE`) — otherwise "are all 31 the same problem?" is
  unanswerable from the log.

## Check what the restore writes, never what the game derives

An enemy's aggro target was captured, written back and checked — and 25 of 80 enemies "lost their target". All
correct: the game re-derives the target from line of sight every update. Before adding a check ask **who owns this
value until the checkpoint** — the restore (check it), a system that recomputes it (don't), or a system that will
overwrite it (a restore bug: write to the owner —
`learnings/architecture/write-restored-state-to-whoever-owns-it.md`).

Order checks so the hiding failure comes first: **visibility before values**
(`learnings/architecture/restored-entities-must-arrive-already-arrived.md`).

## Cost

Development only: compile the whole facility out of shipping builds behind the integration's dev macro (CR-001
style), so release builds carry neither the calls nor the closures. On its first real run it found a defect in one
of ten groups that a human had eyeballed as correct — placement said fine; the entities were invisible.
