---
category: architecture
tier: generalizable
sourceGame: PlatformerSample
phase: "3"
question: "Does the game have LIVES and a separate game-over screen (platformers, arcade shooters, roguelites with retries)? Then ask the integrator where the run ends — a death that reloads the level is usually the same run continuing."
sanitized: true
origin: "unity:architecture/in-a-lives-based-game-the-run-ends-at-game-over-not-at-death"
---

# In a lives-based game, the run ends at game over — not at every death

**Precondition:** the game has a lives counter distinct from health, a game-over screen distinct from the death
animation, and a reload-the-level path after a death. All three present means the run boundary is game over.

Session boundaries were reasoned as "the run ends when the player dies" — right for a match-based game, wrong for
anything with lives. The integrator's correction, paraphrased: every death was closing a room; they wanted that only
at game over, when all lives are gone. Two events look identical from inside the integration, and only the game can
tell them apart:

| Event | Game does | Run |
|---|---|---|
| death, lives remaining | death animation, then **reloads the same level** | continues |
| death, last life | game-over screen, then loads the menu | ends — `End`, keep the moment |
| level complete | loads the next level | ends — `End`, keep the moment |
| quit to menu | loads the menu | ends — `End(isAbort=true)` |

**Ask this in phase 3 (`3c`), not after the first playtest.** It decides what a moment can contain, and it is a
product decision — a highlight spanning a death and a retry may be exactly what the studio wants, or not.

## Implementing "the run survives a death"

The level loader gives you the discriminator: the **reload** entry point means same level, same run; a plain load
means going somewhere else. Latch it in the reload function and consume it at the single load choke point
(`learnings/architecture/put-the-session-teardown-in-the-level-loader.md`).

The keep-the-run path is **not** a no-op:

- **Drop every tracked object and re-arm registration.** All of them die with the level. If the "already
  registered" flag stays set, the reloaded level's objects are never registered and the run continues capturing
  nothing. Destroy the SDK-side objects (`ludeo_DataWriter_DestroyObject`) and clear the adapter's registration
  state so the reloaded level batch-registers again (`06 §6`).
- **Do not `End`, and do not close the room.** The gameplay session stays open across the reload.
- **The death interval is a non-gameplay span** if the death screen is bracketed (`06 §7.3`). Verify both halves —
  open and close — appear in the log for a death.

Raise **retry** explicitly too: a "restart level" in the pause menu usually funnels through the same reload path and
inherits this decision, though a deliberate restart is arguably a new attempt even when a death is not.
