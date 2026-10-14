---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "5"
question: "Can anything in the restored level create objects (projectiles, spawns, effects) or trigger irreversible events (one-shot animations, damage or death on non-player entities) during the restore's settle, while the player is only protected by the input hold or invulnerability?"
sanitized: true
origin: "unity:common-mistakes/the-settle-is-live-so-clear-what-it-spawns-and-hold-what-chases"
---

# The settle is live: clear what it spawns and hold what chases

Applies when the restore's settle window runs real frames in a level with shooters, spawners or chasing hazards.

The settle (CR-010 step 5) lets the game run ~0.5 s with time running and input held, so cameras, physics and the
deferred queue (`ApplyDeferred()`) settle before the second freeze. In the observed integration the settle ran
longer (up to a few seconds) and the player was made invulnerable. **Values** are safe — the apply's owners write
over what the settle moves. Things the settle **creates or triggers once** are not:

- **Projectiles.** A turret whose restored sequence step fires immediately, and hunting ranged enemies, fired during
  the settle. Their shots were still in the air, frozen, when the viewer pressed Play — although the creator never
  faced them. Shots in flight weren't captured at all, so none of these can be the creator's.
- **Chasing hazards.** A chasing wave restored close to the player reached the invulnerable player during the settle.
  The touch fired the hazard's own "drowned" event, whose sinking animation has no way back — the replay had no
  visible wave for its whole length while the chase logic kept running.

## Fix

- **At the end of the settle, before the second freeze**, remove transient projectiles through the game's own
  removal (the one it runs on player death or level restart). Check each projectile type — some clear on an aggro
  toggle, others only on death or restart.
- **Hold chasing hazards** during the settle (gate their movement on `IsRestoring()`, which stays true until the
  settle ends — CR-010 "Freeze vs suppress"), and restore their recorded pause flag as part of the apply so it holds
  when the viewer takes control.
- If the game fires shots from restored state, prefer gating the **trigger** (the turret's fire step, the enemy's
  attack decision) on `IsRestoring()` over deleting results afterwards (`07 §11.1`); the post-settle sweep is the
  backstop.

## Generalization

When designing the settle, list what it can **create** (spawns, projectiles, effects) or **trigger irreversibly**
(one-shot animations, damage and death events on things other than the player) — not only what it can move.
Invulnerability and the input hold protect the player's health and input; they don't protect the world's reaction to
touching the player.
