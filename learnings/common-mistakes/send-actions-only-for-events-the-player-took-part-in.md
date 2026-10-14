---
category: common-mistakes
tier: generalizable
sourceGame: FTPS_Online
phase: "6"
question: "Do non-player entities (bots, AI factions, turrets, the environment) damage or kill each other in this game?"
sanitized: true
origin: "unreal:common-mistakes/bot-actions-must-not-use-player-id"
---

# Send an action only when the player took part; bot-on-bot events are not player actions

## The mistake

Every `Kill`/`Death` used the local player's id, including bot-on-bot kills. The docs say "use the same
`playerId` you used in `AddPlayer`", and that was read as "every action gets the human's id". Bot A killing bot B
isn't the player's action. Attributing it inflates their score, completes goals they didn't earn and creates
false highlights.

## The rule

Send only when the player participates, with the `playerId` from `ludeo_Room_AddPlayer`:

- player kills an enemy → `Kill`
- an enemy or the environment kills the player → `Death`
- bot kills bot → nothing as a player action (a distinct world-event action only if the team needs one)

```cpp
if (victim == localPlayer)     ludeo.SendAction("Death");
if (instigator == localPlayer) ludeo.SendAction("Kill");   // resolve projectile/summon → owner first
```

Resolve the instigator through ownership first, or the player's grenade kills read as bot-on-bot.

"Use the same `playerId`" means **don't invent ids**. It doesn't mean "attribute every world event to the player".
