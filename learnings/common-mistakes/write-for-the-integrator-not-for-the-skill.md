---
category: common-mistakes
tier: universal
sourceGame: TPSSample
phase: "1,2,3,4,5,6,7,8"
question: null
sanitized: true
origin: "unity:common-mistakes/write-for-the-integrator-not-for-the-skill"
---

# Write for the integrator, not for the skill — they never agreed to learn our vocabulary

Every phase brief, critical requirement and plan file in this skill is written in a private dialect: `CR-0xx` IDs,
"Room", "wave 1", "two-pass", "attribute capture", "non-ludeoable", "readiness gate", "Creator/Player Flow", task
numbers. It is efficient **between agent phases**. It is meaningless to the person paying for the integration.
Reporting progress in it reads as evasive even when the work is good — and the integrator cannot check your
reasoning, which is the point of reporting.

## What this looked like

A phase-2 summary cited a bare requirement ID as the justification for a restore strategy. The integrator asked,
angrily and twice, what that ID was supposed to mean to them. The second push-back came **after** a partial fix that
expanded only that one ID — the rest of the message was still dense with "Room", "wave 1" and phase numbers used as
nouns. **Expanding the term you were challenged on is not the fix.** The whole register was wrong.

## The rule

**Say the thing. Never make the reader resolve a token.** An internal ID may appear in a plan file for traceability,
but always with its meaning inline, and almost never in chat.

**Product words are not jargon — teach them.** "Ludeo" and "Studio Lab" appear in the docs, the dashboard and
eventually in front of players. Define once — *"a Ludeo: a short playable clip someone can drop straight into"* —
then use it. SDK function names are legitimate when the subject is code the integrator will read, but they must not
*replace* the explanation: "`ludeo_Session_OpenRoom` starts capturing the run, `ludeo_Room_Close` ends it" — not a
bare `OpenRoom`.

Everything else is ours, not theirs:

| Don't write | Write |
|---|---|
| "CR-006 two-pass restore" | "rebuild the objects first, then put their properties and links back" |
| "wave 1" | "the first slice we get working end to end" |
| "capture as attributes" | "record each enemy's position and health" |
| "non-ludeoable segment" | "a stretch we don't want captured, like the shop" |
| "phase 5 will handle it" | "the step where we make a saved moment replay" |

## The trap: a paraphrase that dissolves the distinction

The terms most worth simplifying are often the ones that exist **because two things are easy to confuse** — so a
careless plain rendering re-creates the confusion. While following this very rule, an agent rendered "Room" as
"recording". Two distinctions died at once: "recording" implies **video**, when the SDK captures game *state* — which
is what makes a Ludeo playable rather than watchable; and it collapsed **Room into Ludeo** — a room brackets one
captured gameplay segment, and the platform derives Ludeos from it; the game does not decide how many. The agent had
read the warning against that conflation twice in the same session.

**Guard:** before replacing a term, name the distinction it carries and check your replacement still carries it. If
it can't, keep the term and define it.

## Test before sending

> Would a competent engine programmer who has **never heard of this SDK** understand every sentence, and be able to
> disagree with the reasoning?

The integrator knows their codebase; their disagreement is the main error correction available during an engagement.
Vocabulary they can't parse silences exactly the review you most need.

Related: `learnings/common-mistakes/investigate-before-asking.md`.
