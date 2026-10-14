---
category: common-mistakes
tier: universal
sourceGame: FPSGameStarterKit
phase: "1"
question: null
sanitized: true
origin: "unreal:common-mistakes/do-not-trust-learning-without-verifying-precondition"
---

# Learnings have preconditions: verify them before applying

## The mistake

The agent applied a build-setup learning verbatim ("don't create X for this kind of project") from another
integration. That learning held only because the other project had a plugin that auto-generated the build targets
X would have provided. The current project had no such plugin, so following the advice left the game without a
compiled target and broke packaging. Cycles went into debugging the symptoms before anyone revisited the
assumption.

What went wrong:

1. The agent read the learning's conclusion, not its body.
2. It missed the precondition ("when a plugin auto-generates the targets").
3. It applied the rule where the precondition didn't hold.
4. It debugged symptoms instead of re-checking the assumption.

## The rule

This is the SKILL.md rule (→ Learnings), learned the hard way:

1. Read the **full body**, never just the title or the index hook.
2. Identify the **precondition**: the `question` field for generalizable learnings, plus any "applies when" in the
   body.
3. **Verify it holds in this project with concrete evidence**: files read, a grep, a run observed, or the user's
   answer.
4. If you can't verify it, treat the learning as a hypothesis to test, not a rule to apply.

**Red flag:** an "always" or "never" with no stated scope. Check the `sourceGame` and the body before trusting it.
`universal` is a strong claim.

## When writing learnings

State the precondition in the **first lines** of the body, add a "does not apply when" note where it's easy to
over-apply, and cross-reference any learning it contradicts.
