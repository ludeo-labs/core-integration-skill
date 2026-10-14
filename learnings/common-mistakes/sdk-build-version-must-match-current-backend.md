---
category: common-mistakes
tier: universal
sourceGame: multiple
phase: "1,3"
question: null
sanitized: true
origin: "unreal:common-mistakes/sdk-build-version-must-match-current-backend, unreal:common-mistakes/refresh-project-binaries-after-core-sdk-swap"
---

# A stale SDK build silently breaks notifications, and swapping it in needs every runtime copy refreshed

## What happened (log-verified over about 6 runs)

Creator-Flow recording never started. Activation succeeded, the room opened and `AddPlayer` succeeded, then:

```
[Ludeo] Session: Received event ludeo-play-ready
[Ludeo] Session: Warning: unknown event_name "ludeo-play-ready"
```

`RoomReady` never arrived, so `Begin` never ran. A known-good integration on the **same machine and account**
received `RoomReady` normally. The only difference was the **SDK build**: the broken one logged an older
`LudeoSDK v…` line (version, git hash, build date). The live backend had moved to an event the older build didn't
recognize, so it never turned the event into `RoomReady`. Moving to the current build fixed it immediately (`11 §9`).

**Don't misattribute.** The same symptom invites theories that waste hours: per-game Studio Lab config, room-open
timing, an unrelated overlay parse warning (a known-good run logs it too), auth. None of them were the cause.

## The rule

Before debugging a "notification never fires" problem in your own lifecycle, grep the run log for `LudeoSDK v` and
`unknown event_name`, and compare the build line with a currently-working integration or the latest release. If
yours is older, update to the current release first (phase 1 Step 2): headers, libraries and the whole runtime
folder. Never work around it by calling `Begin` yourself.

## Swapping the SDK: every runtime copy must change

After the swap, a rebuild reported 0 errors and the game **still logged the old `LudeoSDK v…`**. The SDK DLL is
copied into several output locations (the project's binary folder, per-configuration folders, staged and packaged
builds), and an incremental build doesn't necessarily overwrite them all. The copy the game actually loads stayed
stale. Packaging is worse: incremental staging compares timestamps and keeps the "newer-looking" old DLL.

- Do a **clean** rebuild and a clean repackage, or delete every staged copy of the SDK DLL first, for **each
  configuration you run** (dev and release DLLs differ).
- **Verify by the log, not by faith.** Grep the run log, and the packaged build's log, for the new
  `LudeoSDK v…` line. Listing every copy of the DLL with its size and timestamp shows which ones are stale.
