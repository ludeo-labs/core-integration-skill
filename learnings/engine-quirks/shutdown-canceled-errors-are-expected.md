---
category: engine-quirks
tier: universal
sourceGame: ActionRoguelike
phase: "3"
question: null
sanitized: true
origin: "unreal:common-mistakes/shutdown-canceled-errors-are-expected"
---

# `LudeoResult::Canceled` errors at shutdown are expected, not bugs

When the game exits before the async teardown chain finishes (`End` → `RemovePlayer` → `CloseRoom` → session
release), the SDK cancels the operations still in flight and logs errors such as:

```
[Ludeo] Core: Error: ludeo_GameplaySession_End failed with LudeoResult::Canceled
[Ludeo] Session: Error: ...SessionDestroyTask: Finished with LudeoResult::Canceled
[Ludeo] Core: Error: ludeo_Room_Close failed with LudeoResult::Canceled
```

- **Ignore** them in the final log lines of a normal exit, or after a crash.
- **Investigate** if `Canceled` appears during active gameplay. That means the teardown chain started too early.

When triaging SDK errors, filter out `Canceled` near process exit and focus on errors during play.
