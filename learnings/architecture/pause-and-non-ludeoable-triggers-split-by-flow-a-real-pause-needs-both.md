---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "3,6"
question: "Are you classifying each non-gameplay segment as a pause or a non-ludeoable area — and does any stretch where the simulation freezes (pause menu, the overlay pause) emit ONLY PauseLudeo/ResumeLudeo?"
sanitized: true
origin: "unity:architecture/pause-and-non-ludeoable-triggers-split-by-flow-a-real-pause-needs-both, unity:architecture/classify-non-ludeoable-by-whether-the-sim-actually-freezes"
---

# Classify segments by whether the sim actually freezes — and a real freeze sends both pairs

**Precondition:** the game has both kinds of non-gameplay segment — ones that freeze the simulation and ones where
the player has no control but the world keeps running — and you are wiring the standard trigger actions (`6b` Step 5).

## Step 1 — the game's own code already classifies them

`06 §7.3` says to pick the pair by what should happen to the clock. The discriminator is in the source: **does the
segment call the game's freeze primitive** (time scale to zero, a manager-level pause that gates every update, a
custom clock stop)? Grep the freeze writes and cross-reference them against the state-change sites.

In the source integration the split came out exact along the game's own state enum: every segment entering the
`Paused` state also froze time (tutorial popup, pause menu, game-over screen, full-map screen); **no** segment
entering the `Cinematics` state did (shop, dialogue, an interaction, the upgrade screen, cutscenes, teleports,
scripted intros). The game team had already drawn the line; the classification became a two-line rule, defensible
in review because each row cites a freeze call or its absence. Caveats: trust the freeze evidence over state names
(a "paused" state that keeps simulating is not a freeze), and note that some cutscenes freeze while others do not —
`06 §7.3`'s example list is a starting point, not this game's answer.

## Step 2 — a freeze needs the non-ludeoable pair too

The pause menu froze the sim, so it emitted only `PauseLudeo`/`ResumeLudeo`. The trigger mapping was correct and both
actions were in the log — yet in Creator Lab a creator could still **drag the moment's start point into the menu
stretch**, producing a Ludeo that began on a paused menu.

Reading the platform's non-gameplay documentation in full: the Pause/Resume trigger stops the objective timer and the
backend keeps no data for the span — it behaves as the **Player-Flow** instrument. The Non-Ludeoable Area trigger
keeps the timer and the data, and is what excludes a stretch as a **Creator-Flow** start point. So:

- no control, sim running (cutscene, dialogue, camera pan) → the non-ludeoable pair;
- sim **frozen** (pause menu, and the SDK's overlay pause in Player Flow) → **both** pairs, nested: open `PauseLudeo`
  then `StartNoneLudeable`; close in reverse. Close both on every end path.

With the core span helper that is two calls per edge:

```cpp
void OpenFrozen()  { ReportSpan(LudeoSpan::Pause, true);  ReportSpan(LudeoSpan::NonLudeoable, true);  }
void CloseFrozen() { ReportSpan(LudeoSpan::NonLudeoable, false); ReportSpan(LudeoSpan::Pause, false); }
```

**Verify in Creator Lab, not only in the log:** record a clip containing a pause, publish it, and try to drag the
start handle into the paused stretch — it must refuse. *(This extends `06 §7.3`/`6b`, which send only the pause pair
for a pause; confirm against the current platform behaviour before relying on it.)*
