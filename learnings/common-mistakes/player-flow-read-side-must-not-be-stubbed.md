---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "5"
question: null
sanitized: true
origin: "unreal:common-mistakes/player-flow-read-side-required-not-stubs, unreal:common-mistakes/player-flow-read-side-required-stage3, unreal:common-mistakes/player-flow-stubbing-pattern"
---

# The Player-Flow read side must not be stubbed, and a compile pass doesn't prove it exists

Across several integrations, the agent implemented capture fully and **stubbed the restore**:
`// TODO: apply state`, an apply function that read values and never applied them, or a "play Ludeo" entry point
that logged and stored the id. Then it declared the phase complete. Stubs compile, so the compile gate passed
them.

## Why it keeps happening

1. **The compile gate passes stubs.** Build success feels like completion.
2. **Self-graded verification.** "Is it implemented?" checked against its own code: a function that *does
   something* feels implemented.
3. **Capture verifies itself from logs; restore needs a captured Ludeo to test.** So restore gets deferred.
4. **Phases merged into one plan.** With tracking and actions planned together, the hardest part (the restore)
   gets deferred so the more visible part (actions) can show progress. Actions without a working restore are
   meaningless: the Ludeo can't be played.
5. **The human checks capture first.** By the time restore would be tested, the agent has already claimed done.

## The rule

- A restore wave is done only when **its read-back applies values to live entities**, and the `5e` Step 7
  smoke test (re-run `--ludeo=<id>`) shows them restored. The `5d` Step 6 lifecycle test with the apply
  stubbed is a **separate, earlier** gate, not a substitute.
- Order inside a wave: capture → build → verify writes → read-back + apply → build → **capture, then play back,
  then confirm**. Only then move on to the next wave or to actions.

## Red flags

- "Capture verified, moving to actions."
- "The entry point exists; it'll connect when tested."
- "Restore deferred to the testing phase."
- "The apply is implemented: it calls `ludeo_DataReader_Get*`", when nothing is written to entities.
