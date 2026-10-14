---
category: common-mistakes
tier: generalizable
sourceGame: Lyra
phase: "6"
question: "Does the game deliver gameplay events (eliminations, scores) over a message/event bus where several processors can relay or rebroadcast the same event, so one occurrence may reach your listener more than once?"
sanitized: true
origin: "unreal:common-mistakes/elimination-debouncing-with-message-subsystem"
---

# Deduplicate bus events that get rebroadcast before turning them into actions

On a bus where several processors relay the same elimination, one kill produced several `Kill` and `Death`
actions.

**Fix:** deduplicate at the listener, before `SendAction`. The source dropped repeats within 0.5 s:

```cpp
if (now - m_lastElimTime < 0.5) return;   // duplicate relay
m_lastElimTime = now;
```

A global window can swallow a genuine multi-kill. Where the message carries identity, key the dedupe on the
(victim, instigator) pair.

Add it only where duplicates are confirmed in the log. A direct call from the death path doesn't need it.
