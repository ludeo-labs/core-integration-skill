---
category: common-mistakes
tier: universal
sourceGame: ActionRoguelike
phase: "3,5"
question: null
sanitized: true
origin: "unreal:common-mistakes/check-sdk-logs-not-just-game-logs"
---

# Check the SDK's own log lines, not just the integration's

Integration logs show what your code **did**. The SDK's `[Ludeo]` lines show what it **accepted**.

**Example:** every integration log line was green (room opened, player added, `Begin`, actions sent), yet a
`[Ludeo] Data: Error:` showed a writer call rejected for a missing `ludeo_DataWriter_EnterObject`. The data never
landed.

Grep for:

- `[Ludeo] Data: Error:`: reader/writer failures
- `[Ludeo] Core: Error:`: rejected parameters, configuration
- `[Ludeo] Session: Error:`: lifecycle failures
- `[Ludeo] Http:`: backend traffic

Filter out the overlay UI's style-parsing warnings; they're noise.

On any silent failure, grep these lines before theorizing (`11` verification checklist).
