---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "Does the integration hold player control per run until `Begin` lands, alongside the once-per-app readiness gate — and do the two share one release token, so readiness resolving AFTER a level started can release the run's hold early?"
sanitized: true
origin: "unity:common-mistakes/readiness-latch-and-per-run-control-hold-must-not-share-a-release-token"
---

# The app-run readiness latch and the per-run control hold are two gates — give them separate release tokens

Applies when the integration has both the readiness gate (`LAUNCH-AND-READINESS §3`) and a per-run hold that keeps
control from the player until capture is live.

Two different things get called "the gate":

| | Readiness latch | Control hold |
|---|---|---|
| Scope | **once per app run** | **once per gameplay run** (every level entry, every restore) |
| Means | `ludeo_Session_Activate` resolved (or fell through) | "the player doesn't have control yet" |
| Released by | the activate callback, or the bounded timeout | `Begin`'s **callback**, a capture-declined / room-failure signal, or a bounded watchdog |

The plan can state this perfectly and the implementation still collapse it: the natural body for "readiness
resolved" is *release the gate, hide the cover* — and if the hold is keyed by one token, that line releases **the
run's** hold too.

## Why it hides in review and shows in the log

It's invisible whenever readiness resolves **before** a level starts — the menu-gated flow you exercise by clicking
through. It fires whenever readiness resolves **after**, which is guaranteed on a developer direct-launch into a
level, the path the integrator uses dozens of times a day. The symptom is an ordering, not an error:

```
Control hold HELD (run)
Activate: Success — readiness resolved
Control hold released (readiness)      <-- player has control HERE
OpenRoom → AddPlayer → RoomReady
Begin: Success — capture is live        <-- capture starts several frames LATER
```

Nothing fails; a capture is produced; the opening seconds of every run aren't in it. **Log each release with its
reason, and `Begin`'s success on its own line** — that ordering *is* the test.

## The fix

The readiness release must not touch the run's hold; the hold belongs to the run. Then confirm every release path for
the hold still exists, or you've traded an early release for a hang:

- **`Begin`'s success callback** — the normal release, and the only one that makes "first controlled frame == first
  captured frame" true;
- **capture declined** — readiness fell through, or the room chain returned a failure: hand control back and play
  uncaptured;
- **a bounded watchdog** — so an offline player is never stuck.

Same reasoning for whatever "capture is live" gates per-frame work: key it on `Begin`'s **callback**, not on
`ludeo_GameplaySession_Begin` being *issued*. `SendAction` already drops actions sent before that callback, silently
(`06 §7.1`) — so an early control release also loses the run's first actions, including a `StartNoneLudeable` /
`PauseLudeo` the player triggers in those frames, with no error anywhere.

Related: `learnings/architecture/readiness-gate-cover-gate-the-grant-of-control-not-the-fade.md`.
