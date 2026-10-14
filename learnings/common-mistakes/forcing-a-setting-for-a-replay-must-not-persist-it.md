---
category: common-mistakes
tier: generalizable
sourceGame: PlatformerSample
phase: "3,5"
question: "Are you forcing a game setting for a replay or a boot path (player count, language, screen mode, difficulty) by calling the game's own setter? Check whether that setter WRITES THE SAVE — if it does, one replay silently overwrites a preference the player chose."
sanitized: true
origin: "unity:common-mistakes/forcing-a-setting-for-a-replay-must-not-persist-it"
---

# Forcing a setting through the game's own setter can overwrite the player's saved preference

**Precondition:** a replay or direct-boot path needs a known configuration, and the game's setters persist.

A replay must run in a known configuration — single player, a chosen language, a window mode — and using the game's
own setter rather than poking engine state is the right instinct about *behaviour*. It is dangerous about
*persistence*: in a game with save slots, a settings setter usually writes the slot. Two instances on one integration:

- the player-count setter **saved**, so forcing single player for a replay would permanently overwrite a player's
  chosen two-player preference. The game had a *temporary* variant of the same setter beside the persisting one —
  that is the one to call;
- the screen-mode setter **persisted** too, so a single direct-boot launch made the forced window mode the player's
  stored preference from then on.

**Look for the non-persisting variant first.** If none exists, set the engine state directly and put it back when the
replay ends (`EndCurrentLudeo` and the quit path), or accept the persistence and *state* it as a known side effect —
never discover it later from a confused player. If you must write the persisted value itself, treat it as a borrow
with a ledger (`learnings/common-mistakes/a-progression-flag-force-needs-a-record-once-undo-ledger.md`).

## Force, don't refuse

When a replay arrives in a configuration the integration doesn't support, **force the supported configuration rather
than ignoring the selection** — provided the Ludeo itself is playable (CR-010 validation is about the entry identity,
not the viewer's current settings). The platform can select a Ludeo at any moment, including at launch, and a refused
replay strands the viewer on a dead screen. Here every Ludeo was single-player by construction, so single player was
the only coherent state to replay one in.

## Use the game's own predicate

The same work found the existing capture gate leaking: it tested one multiplayer enum value and missed a second (a dual
mode, also two players), so two-player sessions had been captured for weeks. The game's own input manager already
checked both. **When you need a predicate the game also needs — "is this multiplayer", "is this a boss level" — reuse
the game's**, put it in one place in the layer, and call it everywhere (capture gate, restore, validation) so they
can't drift apart.
