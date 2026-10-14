---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "7"
question: "Does the machine already hold a `ludeo` CLI token for another game (the integrator works on several titles)?"
sanitized: true
origin: "unity:common-mistakes/ludeo-cli-set-token-ignores-config"
---

# `ludeo auth set-token` ignores `--config` — it overwrites the saved token

Applies when the integrator's machine already holds a CLI token for a different game.

To keep a second game's token apart, `ludeo --config <other.json> auth set-token ...` was used. The CLI (v1.6.2)
wrote the token into the default `~/.ludeo/config.json` anyway ("Config saved to: ...config.json") and never created
the other file — replacing the first game's token. Tokens are bound to one game version, so the first game's uploads
then target the wrong game until its token is set again.

- Before `set-token`, run `ludeo auth status`. If a token for another game is saved, tell the integrator it will be
  replaced (they can re-set it from Studio Lab later). Re-check the behavior on newer CLI versions rather than
  assuming it.
- `ludeo builds list` prints `Using Game ID from access token: <id>` — confirm it is the intended game before a
  dry-run. That id is the **game version** id; the Studio Lab environment id (for `builds assign --env-id`) is a
  different value (`phase 7`).
- Never type the token for the integrator; give them a one-line command or a tiny `.bat` that prompts for it.
