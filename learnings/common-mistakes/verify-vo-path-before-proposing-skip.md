---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/verify-vo-path-before-proposing-skip"
---

# Trace which code actually plays the voice-over before proposing a way to skip it

## The mistake

A briefing voice-over (a short scene-setting line played as the level begins) played at the start of every Ludeo
replay instead of dropping the player straight into the action. The first plan proposed the game's official
"skip intro sequence" mechanism — a game-state setting, a broadcast that skips the intro, and a request-end-intro
call.

That plan would have changed nothing. The "intro sequence" those functions control is the lobby/mission-overview
intro — a different presentation path. The briefing line was played by the level's script reacting to a
"gameplay phase started" event and calling the game's dialog manager with a briefing asset.

An exploration pass had reported "the lobby intro sequence" as a hypothesis without checking which code played the
line the user heard; the plan was built on that hypothesis.

## The lesson

"Intro", "briefing" and "cinematic" mean different things in different games. **Map the play path from what the
user observes to the code before proposing a skip.**

1. What does the user *hear or see*? Exact words, length, when it starts relative to level load.
2. Grep for the literal words — dialog assets and subtitle tables are often keyed by the line or a close id.
3. Find the central voice/dialog subsystem (dialog manager, narrative/voice/bark manager, the audio middleware's
   event-post wrapper) and who calls it.
4. Find the event or broadcast that triggers that call (phase-started, mission-start, level-script hooks).
5. Only now design the mitigation.

## Anti-pattern: "there's a skip-intro system — use it"

A function with *Skip* + *Intro* / *Cinematic* / *Sequence* in its name is a lead, not an answer. It most likely
controls a different stage (menu intro, pre-mission UI, a cutscene) than the one bothering you.

## How to apply

When a cosmetic artifact (voice-over, UI overlay, cutscene) appears during Ludeo playback, trace it as above, then
prefer the **narrowest** suppression — mute or skip that one dialog/audio path while `IsRestoring()` or during the
replay's opening — over killing the broadcast that triggers it, which usually has gameplay listeners too
(`learnings/common-mistakes/prefer-narrow-mute-over-killing-trigger-event.md`,
`learnings/architecture/suppress-briefing-vo-by-muting-the-dialog-system.md`). For scripted moments in general,
`07 §11.3` (keep the presentation, skip the reposition) applies.
