---
category: common-mistakes
tier: universal
sourceGame: TacticsGame
phase: "1"
question: null
sanitized: true
origin: "unreal:common-mistakes/intake-questions-must-be-jargon-free"
---

# Intake questions must be jargon-free: explain Ludeo-side concepts inline

## The mistake

The agent asked the packaging-target intake question in the skill's internal phrasing: should the project be
"editor-only, packaged, or cloud-build", with a note about a "tier 2 smoke test (full package + boot)". The
integrator is a game developer, not a Ludeo employee. They answered, then pushed back hard: they didn't know what
the smoke test was or what a cloud build target meant, and said the question was bad.

## Why it matters

Intake (phase 1, `know-your-game.md`) is often the integrator's first contact with the skill. Skill-internal
vocabulary (tiers, stage gates, task numbers, `cloud-build`, smoke test) reads as noise to someone who knows their
engine but not Ludeo's pipeline. Each jargon term either blocks the answer or, worse, gets answered wrong without
anyone noticing.

## Prevention

For every question you ask the human:

1. **Assume the reader** knows their game and engine, and nothing about Ludeo's pipeline.
2. **Explain any Ludeo-side concept in one sentence of game-dev terms.** For example, "cloud build" becomes: "Ludeo
   runs your game on its cloud machines for playback, so a release build is uploaded eventually; choosing this
   means we set that build up now."
3. **Never reference skill internals** (phase/task numbers, reference files, gate names) in the question text.
   They are for the agent.
4. If the human pushes back on a question, answer that meta-question first, plainly, then re-confirm their
   choice. Capture the better phrasing as a learning.
