---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "4,6,8"
question: "Does the game have several distinct game modes / experiences, or is it being expanded beyond the curated slice (phase 8)? Has every mode been mapped before entity and action discovery?"
sanitized: true
origin: "unreal:common-mistakes/phase6a-lyra-simulation-feedback"
---

# Discovery gaps: map every mode first, finish the checklist, and break the curated-slice anchor

**Precondition:** the game has more than one mode, or discovery is widening past the curated slice.

Discovery on a multi-mode sample game surfaced seven gaps:

1. **No mode-discovery step.** The analysis jumped straight to entity types. Map **every** mode or experience
   first, then discover entities and actions per mode. Otherwise whole modes (a capture-point mode, a top-down
   arena mode) get missed.
2. **Partial results presented too early.** Entity tables came out before actions, scoring and abilities were
   done, and the human had to prompt for the rest. Finish the whole checklist before presenting.
3. **No "enrich existing actions" step.** Discovery looked only for new actions. Context on existing ones (weapon,
   method) adds value too. Send it as additive actions, never fused into the name
   (`learnings/common-mistakes/name-actions-from-player-perspective.md`).
4. **Data-driven features under-discovered.** Code-only greps missed features defined in data. The game's
   tag/event/config tables listing gameplay identifiers turned out to be the richest source: scoring, accolades,
   dash, aim, ammo, all in one place. Scan the data and config files, not just the source.
5. **No match-state or timer guidance.** Match time, round state and score limits are near-universal, but there
   was no prompt for timers or win conditions.
6. **Mode-conditional architecture not addressed.** Fundamentally different modes need mode-aware registration and
   action sets. Decide that during mapping, not in implementation.
7. **Curated-slice bias persists.** Even when told "full game", the mental model stayed anchored to the slice.
   In expansion, say it explicitly: forget the curated slice.
