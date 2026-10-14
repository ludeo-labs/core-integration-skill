---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "3,5,6"
question: "Are you running an orchestrated phase (3, 5 or 6) where a dispatched worker has surfaced a question for the human?"
sanitized: true
origin: "unity:common-mistakes/verify-a-relayed-question-before-asking-it"
---

# Relaying a worker's question is not exempt from investigate-before-asking

Applies in the orchestrated phases, where a worker's questions come back to the orchestrator to be relayed
(`references/orchestration.md`). Read literally, "relay the questions" turns the orchestrator into a pipe, and that
collides with `learnings/common-mistakes/investigate-before-asking.md`. **Relay is not a licence to skip
verification.** The worker ran in isolated context on one brief; the orchestrator holds the state file
(`ludeo-integration-plan/integration.json`), the glossary and every prior decision — it is the *only* place a bad
question can be caught.

## What this looked like

A phase-3 worker surfaced: *"level → level: is an intermediate level a finished moment? Not inferable from code —
it's a product call. Recommend ending normally; default to that."*

The orchestrator relayed it, and in relaying added its own framing — "this decides how many playable clips a run can
produce" — which contradicted the engagement's own glossary (the platform decides how many clips a captured stretch
yields, not the game). The integrator rejected the question outright.

Two separate failures, and the second is the dangerous one:

1. **Not verified.** The question was answerable. Ending the gameplay session normally versus as an abort
   (`ludeo_GameplaySession_End` with `isAbort`) means "keep this capture or discard it". The player completed the
   level and chose to continue, so it is kept. No human needed — and the worker had even supplied the right default.
2. **Amplified while being translated.** Trying to make an API detail read as a product decision, the orchestrator
   invented a rationale it had not checked. Translating for the integrator is required — but a translation that adds
   an unverified claim is worse than the jargon it replaced, because the integrator now has to catch it.

## The gate before relaying any worker question

1. **Can I answer it?** Check the state file, the glossary, prior decisions, the installed SDK headers, the docs. The
   orchestrator has context the worker did not.
2. **Is the worker's recommended default obviously correct?** Then take it, record the decision with its rationale,
   and tell the integrator what you decided — don't ask.
3. **Does the question survive its own vocabulary?** If it uses a word the integrator owns (see
   `learnings/common-mistakes/moment-is-the-integrators-word-do-not-redefine-it.md`), re-derive what is actually
   being asked before it goes near a human.
4. **Am I adding a rationale I have not verified?** Every clause added in translation is a new assertion, and
   investigate-before-asking applies to it in full.

Only what survives all four is a real question. In the observed case, nothing did.

## Why it matters more when orchestrated

Batching questions is already the rule. But worker-surfaced questions arrive pre-formed and plausible, carrying the
authority of work the orchestrator did not watch — exactly the condition under which an unverified claim reaches the
client with a straight face. The orchestrator's value is not routing; it is being the last reader who holds the
whole picture.
