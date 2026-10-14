---
category: common-mistakes
tier: generalizable
sourceGame: multiple
phase: "3,5"
question: "Is the restore freeze or the overlay pause implemented by writing the game's global time scale (sim-speed multiplier) — and does the game itself write that value from more than one place, or to values other than 0 and 1?"
sanitized: true
origin: "unity:common-mistakes/timescale-arbiter-must-restore-the-observed-value-not-1f, unity:engine-quirks/a-scene-load-stomps-your-freeze-re-assert-it, unity:engine-quirks/timescale-zero-stops-the-sdk-notification-pump"
---

# A time-scale freeze must restore the observed value, re-assert itself, and reset per run

Applies when the CR-010 restore freeze or the CR-011 overlay pause works by writing the game's global time scale.
The obvious wiring — pause → `scale = 0`, resume → `scale = 1` — is correct only for a game that never writes
anything else. **Grep every write first.** One audit found 22 write sites across 15 files, several non-binary:
hit-stop on impact, slow motion on a boss kill, tutorial slow-downs, a debug speed control. Resuming with a hard `1`
cancels any of those mid-effect and un-pauses a game the player had paused through its own menu. The failure is
intermittent and looks cosmetic, so it survives a smoke test.

## The arbiter

```cpp
struct TimeScaleArbiter {
    bool restoreFreeze = false;   // CR-010 bit
    bool overlayPause  = false;   // CR-011 bit — two independent bits, never one bool
    bool settling = false, applied = false;
    float saved = 1.0f;

    void Apply() {
        const bool paused = restoreFreeze || overlayPause;
        if (paused && !applied)      { saved = Game::TimeScale(); Game::SetTimeScale(0.f); applied = true; }
        else if (!paused && applied) { Game::SetTimeScale(saved);                     applied = false; }
    }
    void EndOfFrame() {                                   // runs last in the frame, before the next sim step
        if (applied && !settling && Game::TimeScale() != 0.f) {
            Game::SetTimeScale(0.f);
            LUDEO_LOG("[Ludeo] freeze re-asserted: something set the time scale under an open hold");
        }
    }
    void ResetForNewRun() { restoreFreeze = overlayPause = applied = settling = false; }
};
```

1. **Save and restore the observed value.** The contract is "leave the scale as I found it".
2. **Re-assert every frame while paused.** Games reset the scale to 1 unconditionally on level restart, menu close,
   game over, tutorial teardown — and a level's own init often does it defensively, because a front-end level may be
   entered from a paused game. An **edge-triggered** freeze (scale written only when the hold goes 0 → 1) never
   notices: the hold is still set, re-holding is a no-op, the world runs, and nothing logs. Re-assert from the last
   update of the frame, **log every time it fires** (that line is how you learn the stomp is real — it fired on the
   first cloud run), and skip it during the settle, which legitimately runs time under an open hold (`07 §2.1`).
3. **Reset per run**, at boot and in the replay-to-replay reset (`07 §2.6`) — a long-lived arbiter otherwise carries
   a stale bit into the next replay.

## Never save a zero

If the arbiter engages while the game is already hard-paused in its own pause menu, it saves `0` and later
faithfully restores `0`: the replay begins frozen with nothing left to release it. Clear the game's pause **through
the game's own resume path** as part of the pre-restore reset — a restore must land in a running game — and refuse to
resume into a scale `<= 0`, with a warning. Know the game's legitimate range first (one game's accessibility speed
setting lived in 0.5–1).

## Plan a non-time-scale guard too

Where the game already gates input and AI on a global state, setting a non-playing state during the apply suppresses
both without new plumbing, and keeps working on frames where a game writer briefly wins the race. It is also the only
valid guard for frame-dependent work: a zero scale around anything that waits on a frame deadlocks (CR-010, "Freeze
vs suppress"). See `learnings/architecture/non-ludeoable-spans-as-a-state-machine-not-paired-calls.md` — the same
state is the lever there.
