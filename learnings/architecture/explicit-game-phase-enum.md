---
category: architecture
tier: generalizable
sourceGame: ActionRoguelike
phase: "2"
question: "Does the game expose an explicit game-phase value (loading, playing, dead, respawning), or would the integration have to infer 'in gameplay' from side signals such as health > 0?"
sanitized: true
origin: "unreal:architecture/explicit-game-phase-enum"
---

# Gate on an explicit game-phase value, not on inferred state

**Precondition:** the integration needs a reliable "gameplay is active" condition — for the Creator `OpenRoom` hook,
the "reached active gameplay" readiness of a restore (`07 §2.1` step 4), per-tick capture gating.

Don't infer it (`player.health > 0`, "a player entity exists"). Inferred conditions don't account for loading,
warmup, death, respawn or level transitions, and they flip true at the wrong moments — a reviewer rejected exactly
this health-based gate as fragile.

Use the game's explicit phase/state value if it has one (`Loading`, `Playing`, `Dead`, `Respawning`, …) and record it
in `CODE_MAP.json` during code mapping. If the game has none, propose adding one as a small, gated game-code change and
surface it to the human, rather than building the integration's gates on side signals.

Related: `learnings/architecture/phase-variable-is-the-lifecycle-signal.md` (one phase variable carrying both edges of
the session lifecycle).
