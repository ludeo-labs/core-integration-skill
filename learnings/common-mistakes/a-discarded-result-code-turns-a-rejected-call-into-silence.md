---
category: common-mistakes
tier: universal
sourceGame: PlatformerSample
phase: "6"
question: null
sanitized: true
origin: "unity:common-mistakes/a-discarded-result-code-turns-a-rejected-call-into-silence"
---

# A wrapper that discards the result code makes a rejected call indistinguishable from a working one

An action was emitting, its trigger was configured, and the effect never happened. Comparison against a known-good
integration ruled out every candidate: the action names were registered, the call path reached
`ludeo_DataWriter_SendAction`, the playback room did set its data-writer handle.

What was left was a blind spot in the integration's own instrumentation: the convenience wrapper in use **dropped the
`LudeoResult`**. A rejected action was completely invisible — the integration's log printed, the SDK logged nothing,
the backend never saw it. Every `action: X` line meant *"we called it"*, not *"it was accepted"*.

## The rule

Every C API call returns a `LudeoResult`; the `LudeoManager` wrapper must check it and log anything that is not
`Success`, with the identifiers passed (`06 §7.1` shows the canonical `SendAction`):

```cpp
LudeoResult r = ludeo_DataWriter_SendAction(m_data_writer, &params);
if (r != LudeoResult::Success)
    LogError("[LUDEO] action '%s' REJECTED: %d (player '%s')", params.action, r, params.playerId);
```

The next run then produces one of two outcomes, and **both are progress**: a `REJECTED` line names the real cause,
or none appears and the client side is provably complete — a far stronger thing to hand the platform team than "we
call it and nothing happens". Apply the same audit to every SDK call the layer makes; anywhere a result is dropped,
there is a failure mode no amount of reading the code will reveal (`11 §2`).

## The sibling habit: log the drop, not just the send

A wrapper that gates calls should log the *gate* too (at debug level is fine). The no-session early return in
`SendAction` is correct by design (`06 §7.1`), but silent: adding a `DROPPED — no gameplay session active` line
immediately explained two separate bugs — a span opened before the room existed, and a span closed in the same frame
it opened — that had each read as "the call site never runs". Related:
`learnings/common-mistakes/a-guard-that-cannot-fire-is-not-evidence.md`.
