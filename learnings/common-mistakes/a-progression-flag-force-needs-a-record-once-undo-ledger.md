---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "5"
question: "Are you forcing a PERSISTED progression flag (a save-file key, a settings/registry value) at the restore's commit, before the level load, to suppress an intro or tutorial that HOLDS PLAYER CONTROL — and can a second selection re-enter that commit while the first force is still outstanding?"
sanitized: true
origin: "unity:common-mistakes/a-progression-flag-force-needs-a-record-once-undo-ledger"
---

# Forcing a persisted progression flag for a restore needs a record-once, persisted undo ledger

**Precondition:** a flow-blocking intro/tutorial (`07 §9` item 11) is chosen from a *persisted* flag that the level
reads during its own load, so an `IsRestoring()` gate in code can't reach it.

The fix is a **write to the flag**, and its deadline is before the level load: at the commit (CR-010 step 3), after
`SetRestoring(true)` and before reaching active gameplay — never in the apply, which is far too late. The one-line
version is wrong in five ways:

1. **The flag is the viewer's data, not the Ludeo's.** Leaving the force in place tells the viewer's game they've seen
   an intro they may never have played. A restore may *borrow* the viewer's progression for the replay; every force
   is recorded and handed back.
2. **Record ONCE.** A validated second selection mid-replay runs `EndCurrentLudeo` and then the commit again. A naive
   ledger re-reads "the original" — which is now the forced sentinel — and the undo writes the sentinel back as the
   viewer's value, permanently, with a perfect-looking log. (Opposite polarity to the freeze bits, which must be
   re-armed on *every* restore — CR-011. The question is whether the value is the layer's or the player's.)
3. **"Absent" is not "zero".** A read that returns a default for a missing key can't distinguish "had 0" from "had no
   key"; undoing the latter by writing 0 *creates* a key. Track presence separately and undo by deleting.
4. **Wire the undo to the exit that doesn't announce itself.** `EndCurrentLudeo` covers ordinary finishes, but the
   CR-007 exit helper early-returns when `Begin` never ran — and "the viewer quit before pressing Play" is exactly that
   case. Undo on the quit path (`05 §7.4`) as its own call, idempotent.
5. **An in-memory ledger can't survive the failure it exists for — persist it.** Observed: run 1 recorded `3`, forced
   `9999`, then the process was killed — no teardown at all. Run 2 read `9999`, recorded it as the viewer's value,
   forced, undid: the `3` was gone forever. The force was durable; the note about what it overwrote was not.

```cpp
// force: ledger FIRST — a crash between the two leaves "ledger, no force", whose repair is harmless
if (!store.Has(kLedgerKey)) store.Set(kLedgerKey, hadKey ? original : kAbsentSentinel);  // present = trust it
store.Set(kGameKey, kForced); store.Flush();
// undo: restore, THEN delete the ledger — its existence is the "force outstanding" marker
// boot: ledger present => a previous process died holding a force -> restore and clear, before any reader runs
```

Pick the forced value as a sentinel far above any plausible authored maximum (the threshold often lives on an object
in the level not yet loaded), and check whether the consumer's "already seen" branch also skips an increment you'd
otherwise have to absorb. The same shape covers any persisted value a restore must lie about: tutorial-complete,
seen-cutscene sets, first-launch stamps. Related:
`learnings/common-mistakes/forcing-a-setting-for-a-replay-must-not-persist-it.md`.
