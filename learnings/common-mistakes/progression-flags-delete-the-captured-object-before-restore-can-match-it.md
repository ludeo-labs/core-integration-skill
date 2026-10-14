---
category: common-mistakes
tier: generalizable
sourceGame: ActionAdventureSample
phase: "5"
question: "Does the game destroy or skip-spawn any entity at level load based on a PERSISTED progression flag (permanent death, chest opened, event fired, one-shot consumed) — and does the restore load that level against the VIEWER's save?"
sanitized: true
origin: "unity:common-mistakes/progression-flags-delete-the-captured-object-before-restore-can-match-it"
---

# The viewer's own progression can delete the captured entity during level load — neutralize existence flags before the load, never in the apply

Applies when entities self-destruct or skip spawning at level load based on persisted progression.

Restore plans reason about attributes — what was captured, which setter writes it back. That silently assumes **the
object exists to write to**. With permanent progression it may not:

```cpp
void Boss::OnStart() {
    // ... normal init, then:
    if (m_permanent_death && Progression::IsPermanentlyDead(m_key)) { Destroy(); return; }
    RegisterForCapture();   // never reached
}
```

The restore loads the captured level against the **viewer's** save. A Ludeo capturing a live boss restores into an
**empty arena** — and the same flag usually disarms the trigger that arms the encounter. The failure is silent in
every channel: no missing key, no missing attribute, just an "unmatched bucket entry" warning that a legitimate
content difference also produces. The human report: "the boss wasn't there."

## Why the fix can't live in the apply

The destroy runs **during level assembly**. Pass 1 and Pass 2 run after the game reaches active gameplay (`07 §2.1`
step 5) — structurally too late; there's no object left. The window is **between the commit and the level load**
(step 3 → step 4), which the restore layer already owns: set the neutralization up right after `SetRestoring(true)`.

## Two mechanisms — only one works

1. **Write the flag "off" into the save's runtime layer before the load.** Check the read first: here it was
   `persisted[key] || runtime[key]` — the runtime tier can only *add*, so writing `false` cannot override a persisted
   `true`, precisely the case that breaks.
2. **Gate the read.** One check at the top of the progression query, consulting `LudeoManager` while
   `IsRestoring()`. Read-only (can't corrupt the save), and the query is usually a **single funnel** every namespace
   routes through — one site instead of eight call sites, including subclasses that re-implement init inline.

The answer needs no new capture attribute: for a key naming an entity **present in the restore buckets**, answer "not
consumed" — the creator demonstrably had it. Everything else falls through to the game's own read. One stated
divergence remains (an entity the creator had consumed but the viewer hasn't still appears). **Don't close it by
deleting level objects with no bucket entry** — "absent" also means "capture missed it" (`07 §5.4`). Capture the
creator's flag set if it matters, and price the schema change honestly.

## The other half: the replay writes these flags too

When the viewer kills that entity during the replay, the progression write fires. A save-suppression guard keyed on
"a Ludeo is playing" keeps it out of the file during the replay — then the guard lifts and the runtime flag waits
for the next real save. Keep an **undo ledger** of keys this replay created and remove them in `EndCurrentLudeo`.

**Generalization:** any state that decides whether an object **exists** is a restore-flow concern with a pre-load
deadline, not an attribute. Re-sort the census's excluded progression flags by one question — does it gate
**existence** or **state**? — and find them by grepping the flag's **read**, not its writes.
