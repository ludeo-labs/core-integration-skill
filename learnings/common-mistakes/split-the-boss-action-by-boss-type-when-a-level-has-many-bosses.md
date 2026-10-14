---
category: common-mistakes
tier: generalizable
sourceGame: RoomActionSample
phase: "6"
question: "Does the 'boss' flag or class that drives a boss-kill action apply to many instances in one level (a gauntlet of mini-bosses) as well as to a single final boss?"
sanitized: true
origin: "unity:common-mistakes/split-the-boss-action-by-boss-type-when-a-level-has-many-bosses"
---

# Split the boss action by boss type when a level has many of them

Applies when the class or flag that triggers a boss-kill action covers both mini-bosses and the final boss.

A single `BossKill` action was sent for every enemy of the game's boss classes. One level turned out to hold eleven
instances of a mini-boss class, and one recording run sent `BossKill` 19 times (respawns re-arm them). A "defeat the
boss" goal with a 2000-point score would have made that level worth ten times the final boss.

**Fix:** one action per boss type, chosen in the same death handler — here a separate action for the mini-boss
class (scored 500) and `BossKill` for the final boss only (scored 2000). Record both in `GAME_ACTIONS_MAP.md` with
which classes send them. These are curated, bounded class buckets fired **in addition to** the canonical kill
action, which every boss death still sends
(`learnings/architecture/additive-action-emission-for-composable-goals.md`).

**Check it before scoring:** count each candidate action in the phase-6 recording run (grep the log for each
`SendAction` name) before the integrator assigns scores and goals, and ask about any action that fires far more often
than its name suggests. An action's name is a promise about its frequency; the count is what the platform will
actually score.
