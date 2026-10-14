---
category: architecture
tier: generalizable
sourceGame: multiple
phase: "5"
question: "Does the game configure a gameplay level from data handed over by another layer — a save slot read at level init, a handoff structure filled by the menu or meta layer before the level loads, a config file — rather than from fields the integration can set after load?"
sanitized: true
origin: "unreal:architecture/player-flow-bot-spawn-via-save-slot, unreal:architecture/marketplace-toolkit-reparented-gamemode-is-the-bridge"
---

# Reach the captured setup through the game's own setup channel

**Precondition:** the level's starting configuration — bot counts, units to spawn, loadout, objectives — reaches it
through a channel: the level-init code loads a save slot, or the meta/menu layer fills a handoff structure before the
level loads and the level's rules object reads it on arrival.

## What happened

A game's bot spawner read team bot counts from a save slot during level init. Five approaches failed before the
right one:

1. **Set the in-memory fields after load** → overwritten when the game reloaded the slot.
2. **Call the game's own "save bot numbers" function out of context** → its cached save object was null outside the
   menu flow.
3. **Instantiate the bots directly** → bots appeared without team, AI controller, collision or manager registration.
4. **Call the spawner directly** → it reloaded the slot (clobbering the values) and spawned duplicates.
5. **Add a "skip loading" flag** → a game-code edit that still failed: the values were reset during the level load.

## The fix

Write the captured configuration **into the channel the game reads** — here, the save slot, through the game's own
save API — before the level loads, then let the game's level-init and spawn run naturally, then apply per-entity
state on top. It works because the slot is the single source of truth the game trusts; the game's own spawn path does
all the initialization (team, AI, collision, registration).

The handoff-structure variant is the same rule: populate the handoff from the captured data, load the level, let the
game spawn, then apply. Loading the level directly, without the handoff, gives a level with no setup data.

## Where it sits in the core order

This is part of the commit and "reach active gameplay" (`07 §2.1` steps 3–4): write the channel, load the level
through the game's normal path, wait for its native spawn, then freeze → apply.

## Cautions

- **A save slot is the player's persistent data.** Writing captured values into it changes their real save. Prefer a
  dedicated slot or an in-memory override the loader honours; if the game only reads one slot, back it up and restore
  it when the Ludeo ends (`EndCurrentLudeo`).
- Find the slot name or handoff structure from the game's code (the loader's call site), and record it in
  `CODE_MAP.json`.
