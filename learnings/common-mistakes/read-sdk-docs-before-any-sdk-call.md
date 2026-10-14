---
category: common-mistakes
tier: universal
sourceGame: FTPS_Online
phase: "3,5,6"
question: null
sanitized: true
origin: "unreal:common-mistakes/always-read-sdk-docs-before-sdk-api-calls"
---

# Read the SDK docs before writing any SDK call; don't infer semantics from parameter names

## The pattern of failure

In one integration the agent made three errors across three phases, and reading the docs first would have
prevented every one:

1. **Lifecycle:** skipped auth entirely ("not a Steam game, so no auth"). Every session authenticates; the only
   question is implicit or explicit (see `learnings/common-mistakes/activation-params-and-auth-must-be-complete.md`).
2. **Tracking:** used a unique per-instance name as `objectType`, reading the parameter name as "a unique type
   per object". `objectType` is a **shared category** string ("Player", "Enemy"); per-instance identity is the
   stable id (`06 §4`).
3. **Actions:** used a per-entity id as `playerId` in `SendAction`, reading it as "the entity that performed the
   action". It must be the id passed to `ludeo_Room_AddPlayer` (`06 §7.1`).

Each time, the agent guessed the API's meaning from a parameter name instead of reading the documentation.
Parameter names suggest; they don't define.

## The rule

Before writing any code that calls an SDK function:

1. Search the `sdk-docs` MCP for the function name and read the full page: usage notes, examples and callouts,
   not just the signature.
2. Check this skill's references: `12-SDK-API-REFERENCE.md` for which names exist, and the matching section of
   `05`/`06`/`07` for the integration pattern.
3. Confirm the signature against the **cloned SDK headers** (`06 §7` warns that parameter lists drift between
   releases).
4. Write the code, then compare it to the doc example.

This takes a minute and saves hours. "I know what this parameter means from its name" failed three times out of
three in one integration.

Related: the skill's own learnings index pointed at the auth lesson during phase 1, and it went unread. Read the
bodies of the learnings that match the phase (SKILL.md → Learnings).
