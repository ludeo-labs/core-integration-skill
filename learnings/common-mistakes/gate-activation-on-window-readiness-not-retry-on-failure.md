---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/deferred-activation-design, unreal:common-mistakes/deferred-activation-retry-loop"
---

# Defer activation by checking readiness first, never by retrying in the failure callback

`ludeo_Session_Activate` needs the native window handle (`05 §5`), which often isn't ready at startup.

## Wrong: retry on failure

Call `Activate` unconditionally and schedule a retry in the failure callback. That retries on **every** failure,
including unfixable ones like a missing API key (`InvalidParameters`). Each failure schedules **another** retry,
so they stack into activation attempts every frame, forever.

## Right: check before the call

```cpp
void LudeoManager::ActivateWhenReady() {        // from the integration's per-frame tick
    if (m_activationRequested) return;
    void* hwnd = GetPlatformWindowHandle();
    if (!hwnd) return;                           // not ready: nothing sent, try next tick
    m_activationRequested = true;
    Activate(hwnd);                              // once
}
// OnActivated: on failure, log the resolved params and stop; never schedule a retry
```

If you need a retry for a known transient error, limit it to that result code, cap the attempts, and keep one
"retry pending" flag to prevent stacking.

**Verify:** run with an empty API key. The log must show one activation attempt.

Related (activation timing): `learnings/architecture/activate-late-or-the-cloud-selects-before-the-game-can-load.md`,
`learnings/architecture/sdk-activation-competes-with-game-boot.md`,
`learnings/architecture/cloud-needs-idle-ready-state-before-room-open.md`.
