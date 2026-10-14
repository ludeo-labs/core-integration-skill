---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "4,5"
question: "Does the restore cover the player, enemies, companions and pickups while the levels also have doors, keys, switches, chests, puzzles, power-ups or moving platforms?"
sanitized: true
origin: "unity:common-mistakes/level-mechanics-that-slip-past-a-player-enemies-pickups-restore"
---

# Level mechanics that slip past a player + enemies + pickups restore

Applies when the first restore wave covered the actors and collectables but the levels have interactive mechanics.

A first wave covering player, enemies, companions and pickups *looks* complete. In one 3D platformer integration QA
then found the mechanics below **one report at a time, each in a different level** — all on the census, all parked
in a "later" wave. Walk this list when scoping the census (phase 4) and before calling the restore done. The
systematic process: `learnings/architecture/audit-every-level-against-the-games-own-save-list-before-calling-restore-done.md`.

**Found by QA**

1. **Floor button → door.** Door shut on replay. One "pressed" flag per button; some latch, some are weight-driven
   and re-close — record them two-way. The door opens by animation on the game clock, so under the restore freeze it
   parks half-open and finishes in front of the viewer: place it at the animation's end state.
2. **Keys and locked doors are three pieces of state.** Restoring the "holding key" flag left the **HUD key slot**
   empty (drawn only by the pickup path — redraw it from the restored flag), the **picked-up key** still in the world
   (hide it like any collected pickup), and an **unlocked door** locked again with its key already consumed — restore
   door state and key consumption together.
3. **A one-shot power-up** (next attack is special). A single bool on a player-owned component, set by a respawning
   pickup. **Not in the game's save system** — sweep player-owned components for fields pickups and triggers write.

**Found by the level audit**

4. **Chests** — come back closed, lootable twice. The game's own chest load may add the reward to the score: apply
   it **before** the recorded score so the recorded total wins (`07 §11.2`).
5. **"Activate N switches"** gates — the gate's counter and open flag are separate from the switches.
6. **Multi-part puzzles** — per-part solved flags plus the parent's list of outstanding parts.
7. **Tutorial / hint characters** — the "already played" flag resets; a hint with a scripted scene takes control
   away at the start of the replay.
8. **Burnable / destructible obstacles** — grow back and re-block the path; often not saved.
9. **Moving platforms, rafts, rides** — restart at their authored spot; the state is a phase or path position.
10. **Collapsing platforms and carried objects** — the "carrying" reference is often private; an accessor may be
    needed.
11. **Lower priority:** timed hazards restarting their cycle, mid-slide/mid-climb starts, map markers, hidden
    counters.

**What made the fixes cheap:** most of these had a **per-object save/load already built into the game** — handing
each object's recorded data back to its own load method restored them with zero game edits and with the game's own
side effects (sound skipped, animation to its end). New kinds went into existing id ledgers where the meaning fit,
and new values were read as **optional** so older Ludeos still load — but ask QA for fresh recordings.
