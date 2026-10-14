---
category: architecture
tier: generalizable
sourceGame: ActionAdventureSample
phase: "3"
question: "Does the game need an SDK-readiness gate (LAUNCH-AND-READINESS §3), and are you planning to hold it behind the game's existing fade-in or loading screen — which may be a fixed-length animation that cannot be held?"
sanitized: true
origin: "unity:architecture/readiness-gate-cover-gate-the-grant-of-control-not-the-fade"
---

# The readiness gate: hold the game's own grant-of-control, not its fade

**Precondition:** the launch model needs the readiness gate (`LAUNCH-AND-READINESS.md` §1, §3) and the game reaches
the first interactive frame through a fade or intro sequence.

`LAUNCH-AND-READINESS.md` §3 says to gate the first interactive frame, not the level load. The tempting place is the
game's fade-in. **Check whether it can be held.** Here the fade was a fixed-length animation that fired its
completion callback once at the end, behind an execute-once latch — no pause, no extend, no re-trigger — so it could
not absorb an open-ended SDK wait. An intro *level* is worse: loading it disturbs the flow the cover exists to hide.

## Gate the grant of control instead

Where the game hands the player control — typically the transition into its "playing" state, often inside the
fade's completion callback — route that one call through the integration:

```cpp
// game, at the grant-of-control site
LudeoGameHooks::EnterPlaying([&] { gameState.Set(GameState::Playing); });

// integration: run now if the gate is open, else hold exactly one pending grant, flushed on release
void LudeoGameHooks::EnterPlaying(std::function<void()> grant) {
    if (LudeoManager::Get().CanStartRun()) grant(); else s_pending = std::move(grant);
}
```

The level still loads and fades in as before; only control is withheld — a one-line game edit reusing the game's
own suppression. For the worst case only, add an integration-owned opaque full-screen cover drawn last, shown if the
gate is still held when the fade completes: a timed-out gate then reads as a clean black hold, not a live-looking
level the player cannot control. When activation resolves inside the fade window — the normal case — nobody sees it.

## Details that bite

- **The gate is boot-time.** Once activation resolves either way it stays open, so only the first level entry after
  boot is ever held — say so in the plan so reviewers stop looking for per-level logic.
- **Player Flow holds control for a different reason.** Under a restore the input hold is owned by `07 §2.1` and
  released at `Begin`; the queued grant must not leak control early. Bound every hold.
- **A helpful accident:** if the grant site already skips while the state is "cinematics" and the restore's
  suppression sets exactly that state, the game declines to grant control during a restore by itself. Verify it,
  then rely on it.

## Audit for every first-grant site

The level manager's grant was **conditional** — skipped while "cinematics" was set or a teleport was pending — and
both exclusions were live: an intro controller set "cinematics" on a fresh run and granted control from its own
sequence, bypassing the gate on exactly the boot path it exists for; teleport arrival granted control from the
teleport's routine. The failure is quiet: control arrives a beat before `Begin` and the opening goes unrecorded.

Grep every transition **into** the playing state and classify each: most are **resumes** (shop closed, dialogue
ended, unpause) and must not be gated; you want every site that can be the **first** grant of a run. Each `if` on
the obvious site hints that another site owns that path. And log inside the gate when it defers: if the "holding"
line never appears in a run that should have exercised it, the gate is not on the path you think.
