---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "2"
question: null
sanitized: true
origin: "unreal:common-mistakes/never-claim-sdk-behavior-without-citation, unreal:common-mistakes/fabricated-ludeo-tags, unreal:common-mistakes/speculative-compatibility-risks"
---

# Never claim SDK behavior, or create SDK artifacts, without a citation

## The mistakes

- Asked how Player Flow restores AI, the agent invented a "puppet mode" (AI disabled, transforms overridden every
  frame) without reading any documentation, and presented it confidently. No such mechanism exists
  (`learnings/common-mistakes/no-puppet-mode-ludeo-is-snapshot-restore.md`).
- The agent shipped a config file for "Ludeo tags" that corresponds to no SDK concept. A reviewer flagged it.
- The agent listed an engine-version compatibility risk with no evidence. The SDK claimed support for that
  version, and nothing in the build said otherwise.

## The rule

Before any claim about how the Ludeo SDK works, and before creating any file that represents an SDK concept,
**cite one of:**

1. a section of this skill's references (`references/ludeo-integration-docs/*`, a phase file);
2. the SDK headers of the cloned release (the source of truth for signatures, `12-SDK-API-REFERENCE.md`);
3. a learning whose precondition you verified; or
4. the human, when none of the above covers it.

If none confirms it, say "I don't know how this works in the SDK, let me check", then read before answering. Put
the citation inline ("per `07 §2.1`, …").

**Risks need evidence too.** List a compatibility or platform risk only when you have found a concrete API
conflict, a deprecation warning, a build error or a confirmed report. "This version might be a problem" is not a
finding.

## Scope

This covers Player-Flow mechanics, the reader/writer API, rooms/sessions/highlights/players, the callbacks and
notifications that exist, method parameters, and what the SDK does versus what the integration must do. General
engine behavior, and game architecture you've read in the code, are fine to reason about directly.

## Why

A wrong design discovered at implementation costs far more than "I don't know" during analysis.
