---
category: architecture
tier: generalizable
sourceGame: TPSSample
phase: "3,5"
question: "Does the game initialize the player through an entry flow (front end, hub/lobby, session host, spawn handshake, countdown) before gameplay levels? If the replay boots the level any other way, every skipped step is a latent failure — the restore must run AFTER that flow, never instead of it."
sanitized: true
origin: "unity:architecture/boot-the-replay-through-the-games-own-entry-flow, unity:architecture/jumping-straight-into-a-level-skips-setup-the-restore-needs"
---

# Boot the replay through the game's own entry flow — and restore after it, never instead of it

**Precondition:** the game builds its player through an entry flow (front end → hub/lobby → gameplay level, often
with a session host and a spawn handshake) rather than at level load.

## What happened

To iterate faster, a "launch straight into level N" argument was added, copying what the studio's own repro tool
did. The player fell through the world, after a wall of "null connection" errors. Then the replay boot — designed
the same way — failed one layer deeper every run:

1. Re-hosting the session over a live one tore the host down mid-frame; the re-host crashed spawning the player.
2. Booting the level cold left the "level set up" flag permanently false — it is raised by a scene-loaded handshake
   only the real entry flow completes.
3. The directly booted player was **half-built**: its weapon object never existed, so the first restored equipment
   write crashed inside the game's own appearance rebuild.

Two patches were both wrong. **Faking the flag** let the flow proceed — into crash 3. **Gating the spawn handshake**
(so it would not overwrite the restored position) gated the whole spawn: physics left kinematic, player invisible,
camera without valid state — a playing-but-black screen and thousands of zero-vector warnings.

The repro tool worked only because it ran **inside an already-established session** — front end done, loadout
resolved, platform layer up, host running. It restores *into* a session; it never creates one.

## The shape that works

"The same flow as creation mode, only the integration triggers the load" — this is `07 §2.1` step 4 done right:

1. **No session up?** Enter through the game's own front-end/hub flow, exactly like its title flow. The player comes
   up whole because the game built it.
2. **Enter the gameplay level through the game's own between-levels transition**, with the recorded generation
   inputs applied on top.
3. **Gate the apply on the game's own "finished starting up" signal** — the native spawn handshake must have
   **completed** before step 5's freeze. Spawn first, moment on top: nothing later re-places the player, and the
   restore overwrites a fully built one. Use the game's real readiness flag, not the existence of a few singletons
   — singletons exist before they are initialized (one gate on singleton presence hosted with a null platform layer).

Do not fight the entry flow's callbacks one by one — the class of "things the entry flow does" is open-ended and
every patch reveals the next. Route through it and sequence after it.

## The cheap check

Before designing a restore around a boot sequence, test the sequence alone: launch, drive it, and see whether the
player can stand on the floor and move. And do not build a jump-straight-to-gameplay dev shortcut; playing through
the menus costs seconds. Related: `learnings/architecture/write-restored-state-to-whoever-owns-it.md`.
