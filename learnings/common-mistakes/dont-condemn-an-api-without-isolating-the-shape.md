---
category: common-mistakes
tier: generalizable
sourceGame: ActionGame
phase: "5"
question: "Is a handoff doc or a prior agent's note telling you to avoid an SDK API that this integration already calls successfully elsewhere?"
sanitized: true
origin: "unreal:common-mistakes/dont-condemn-an-api-without-isolating-the-shape"
---

# Don't condemn an API without isolating the shape of the usage that broke

**Applies when** all three hold:

1. A handoff doc or a prior agent's notes say to avoid an SDK API ("X is fragile", "don't use X mid-session").
2. The same API is already used elsewhere in this integration and works.
3. The breakage came from a change that **added** a new use of it.

If they all hold, the recommendation is almost certainly an overgeneralization, and adopting it costs the
integration architecture for the wrong reason.

## The pattern

A change adds a new use of API X, and something breaks downstream. X was the new ingredient, so the conclusion is
"X is fragile, avoid it". The next agent reads the handoff and designs around the prohibition. What was actually
wrong was a **specific shape** of that one use. It's most likely with APIs whose failures are silent and
downstream: the call returns success while something unrelated degrades.

## How to apply

1. **Count the existing call sites of X.** If X is used in N places and works, "X in general" isn't the problem.
2. **Diff the new use against the working ones.** Different identity key? Argument type? Ordering? Lifecycle
   phase? That difference is your bug.
3. **If the precondition fails, reject the recommendation explicitly**, and tell the user you're departing from
   the prior framing and why.

## Example

A handoff said: "drop the per-entity dead-body objects until mid-session `ludeo_DataWriter_CreateObject` /
`DestroyObject` is understood; ask the SDK team whether it's supported." The same integration already created
tracked objects mid-session for **every** spawned enemy, bystander, vehicle and deployable (dozens per mission),
and had for weeks. The "mid-session `CreateObject` is fragile" theory didn't survive a 30-second grep.

The real bug: the new corpse object reused the **identity key of an entity that was already tracked** (the
still-registered live enemy), so two tracked objects collided on one key. Every working call site used a unique
key per tracked object. The fix, a distinct identity per corpse, was about 15 lines. The misframing had already
cost a long handoff doc and an abandoned implementation, and nearly locked the architecture into an inferior shape.

**Anti-rule:** this isn't permission to ignore handoffs. They often carry hard-won knowledge. Read them, then check
their claims against the current code before adopting them. Same discipline as for learnings:
`learnings/common-mistakes/do-not-trust-learning-without-verifying-precondition.md`.
