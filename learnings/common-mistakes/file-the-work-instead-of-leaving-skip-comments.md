---
category: common-mistakes
tier: universal
sourceGame: ActionGame
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/dont-leave-skip-this-comments-without-filing-the-work"
---

# Don't leave "skipping this for now" comments: implement it, or file it where it will resurface

## The mistake

```cpp
// ARMOR NOTE: don't set armor directly here; the game's armor is chunk-based and the setter
// asserts. Armor regenerates within seconds, so skipping it is negligible on a short replay.
(void)capturedArmor;   // captured for logging only; not applied
```

The author knew it was a gap ("not applied"), justified it ("negligible on a short replay") and filed it nowhere.
Six weeks later it was still there. Meanwhile the surrounding restore code had been extended several times by an
agent that treated the comment as settled design. Every replay where the captured player had taken armor damage
restored the wrong armor. The fix was four lines, using the game's own armor **initializer** instead of the
asserting setter. The hard part had been finding the right API, not writing it.

## Why it's especially bad in integrations

1. **The justification rots.** "Negligible on a short clip" stops being true the first time a longer clip is
   captured.
2. **Nobody remembers them.** A large integration accumulates dozens, and the author can't recall which ones
   became real bugs.
3. **Agents respect them.** An AI extending nearby code treats the comment as an immutable constraint, not a
   deferred task.
4. **Comments aren't work items.** They have no owner, no priority, and nothing that brings them back up.

## Do instead

When you're about to write `// not applied for now`, `// TODO: should …` or `(void)x; // skipped`:

1. **Implement it now.** Most skips are under an hour once you find the right API.
2. **Or file it:** add an entry to `risks` in `ludeo-integration-plan/integration.json` with the step that must
   resolve it, and tell the user. Then the comment can be a short pointer to that entry.

## When you find one

Raise it with the user at the start of the work ("this skips X because Y; is that still the right trade-off?") and
spend a few minutes checking whether the rationale still holds before you reason around it. Related:
`learnings/common-mistakes/do-not-stub-deliverables.md`.
