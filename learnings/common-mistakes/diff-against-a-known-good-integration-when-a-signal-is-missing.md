---
category: common-mistakes
tier: universal
sourceGame: Lyra
phase: "3,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/diff-against-reference-sample-when-runtime-signal-missing, unreal:common-mistakes/always-check-reference-sample-first"
---

# When an SDK signal never fires but every call succeeded, diff your sequencing against a known-good flow first

## What happened

Creator-Flow recording didn't work. Activation, `OpenRoom` and `AddPlayer` all succeeded, but `RoomReady` never
arrived, so `Begin` never ran. The agent chased the wrong layers, in order:

1. An overlay warning in the log. It was a red herring: a known-good run shows the same warning.
2. Swapping the SDK to another version. Same result.
3. A backend / Studio Lab configuration problem. The integrator rejected that outright.

Diffing against a **known-good integration of the same architecture** found the cause in two reads. The good flow
opens the Creator room **when the level starts loading**. This integration delayed `OpenRoom` until the gameplay
phase began, and `RoomReady` never arrived for the late-opened room. The core rule already says so: `OpenRoom`
at level-load start, with a warm-up or countdown gating only `Begin` (CR-009, `know-your-game.md` CTR-1).

## The rule

When an SDK **notification never fires but every preceding call returned success**, assume a
sequencing/timing difference in **your** integration. The fastest oracle is a known-good flow. In order:

1. This skill's canonical flow: `05 §6.12` (flow spines), CR-009 / CR-010.
2. A previous working integration on the same engine family, or the SDK's own sample if one ships with the
   release.
3. Only then: the SDK build against the backend (`11 §9`, an SDK too old for the backend also silences
   notifications; check the `LudeoSDK v…` line), and backend configuration.

Log every call and callback with a timestamp, lay your sequence next to the reference, and find the first point
where they differ.

**Don't paper over it:** never call `Begin` yourself without `RoomReady`. Fix the cause (see
`learnings/common-mistakes/dont-bypass-sdk-when-your-lifecycle-is-broken.md`).

## "Write it from scratch" governs authoring, not diagnosis

A user may ask you to write the integration from scratch rather than copy a reference. Honor that for authoring.
When something is broken at runtime, though, reading a known-good flow to find the divergence is debugging, not
leaning on it. Read the reference **before** implementing the non-gameplay handling too (pause, non-ludeoable
areas, overlay pause timing). It prevents several rounds of broken approaches.
