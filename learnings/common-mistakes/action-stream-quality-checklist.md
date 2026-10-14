---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "6"
question: "Is the game action/combat-driven (kills, damage exchanges, scripted mission beats), so that highlights depend on action density and kill-method detail?"
sanitized: true
origin: "unreal:common-mistakes/action-stream-quality-checklist"
---

# Pass a five-point quality check on the action set before phase 6 is done

**Applies to** action/combat-driven games. Highlight picking and goals depend on how dense the action stream is
and how much signal it carries. A sparse, single-axis stream produces weak highlights however good the restore
is. Walk the planned set in `GAME_ACTIONS_MAP.md` against these five checks.

| # | Check | Why it matters |
|---|---|---|
| 1 | **Per-player attribution** | Every `SendAction` carries the `playerId` used in `ludeo_Room_AddPlayer` (`06 §7.1`), and only for events the player took part in. Without it, kills attribute to nobody, or to the wrong player. |
| 2 | **Combat heartbeat** | Per-shot / per-hit / per-damage-taken actions during fights. Without them the platform can't tell 30 s of firefight from 30 s of standing still. |
| 3 | **Kill-method split** | `Headshot`, `Melee`, `Explosive`, `Stealth` … as separate actions. Method can't be derived from a bare `Kill` afterwards. |
| 4 | **Mission-beat actions** | The level's scripted moments (device started/activated, area breached, extraction arrived, boss phase). Highlights anchor on them. |
| 5 | **Standard trigger actions** | `PauseLudeo`/`ResumeLudeo` on **every** pause, the SDK overlay pause included, and `StartNoneLudeable`/`StopNoneLudeable` around non-ludeoable areas. Once per transition, exact strings, matching Global Triggers (`06 §7.3`). |

## Anti-pattern: the two-action phase 6

A "match state changed" action plus one poll-based `Kill` is **not enough**: roughly one action a minute leaves
the highlight picker nothing to work with. Comparable integrations shipped with somewhere between half a dozen
and a dozen and a half actions.

## How to apply

- During the action-map review, for each check that's missing, write down which action(s) would satisfy it.
- Treat a missing check as a **blocker** to raise in the plan, not something to discover after the phase closes.
- Don't stub. If a check is hard to satisfy (no clean damage hook, say), ask the user. Don't silently skip it.
- After the run, confirm in the log that each kind actually fires, in **both** flows.

Related: `learnings/common-mistakes/action-axis-player-method-not-victim-taxonomy.md`,
`learnings/common-mistakes/design-actions-for-goals-and-constraints.md`.
