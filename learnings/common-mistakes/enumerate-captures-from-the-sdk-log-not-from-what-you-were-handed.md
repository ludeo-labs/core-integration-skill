---
category: common-mistakes
tier: generalizable
sourceGame: TPSSample
phase: "5,7"
question: "Are you reasoning about which moments a session captured, from a platform UI list or from a folder of files someone collected for you? Enumerate them from the SDK's own onCaptureVideoRequest log lines first — the handed-over set is routinely incomplete, and the missing entries are disproportionately the informative ones."
sanitized: true
origin: "unity:common-mistakes/enumerate-captures-from-the-sdk-log-not-from-what-you-were-handed"
---

# Count the session's captures from the SDK log, not from the evidence you were handed

**Precondition:** you are investigating a session's moments from a list or folder someone else assembled.

One play session produced three answers to "how many moments did this capture?": the platform's Moments list as the
integrator saw it, **5**; the evidence folder collected from it, **6**; the SDK's own log, **8**.

The investigation ran for a day against the folder of six. The two never collected were the earliest of the session,
the only clips proving the recorder had worked at all, and checking them turned "we can't know when this started" into
a bounded window that refuted the leading theory. The answer sat one grep away in a log everyone had read.

## The rule

**The SDK log is the register of what was actually captured.** Every capture emits one line carrying both ids and a
timestamp:

```
VideoEncoderManager: onCaptureVideoRequest. gameplayId=<guid>, highlightId=<guid>, startTime=…
```

Enumerate from it, deduplicated by `highlightId`, before reasoning about a session's moments:

```
grep -oE 'onCaptureVideoRequest\. gameplayId=[0-9a-f-]{36}, highlightId=[0-9a-f-]{36}' <sdk-log> | sort -u
```

Everything downstream can lose entries for reasons unrelated to your investigation: a UI list pages, filters, or hides
moments that never reached `ready`; a moment that never finished encoding exists without video; a person assembling a
folder stops when it looks like enough. None of those omissions announce themselves.

## Two side-effects

- **Both ids arrive together.** Fetching a moment's assets needs the `(gameplayId, highlightId)` pair; take them as a
  pair from one line instead of hunting for the second.
- **You get capture times free**, which orders moments against everything else in the log (state writes, room
  open/close, errors). A folder sorted by name gives an order; the log gives a *timeline*.

**A set of artifacts someone assembled is a claim about the evidence, not the evidence.** Check it is complete against
what produced it — especially when the entries you have all agree, since a filtered sample is exactly what produces
false unanimity. Related: `learnings/common-mistakes/a-finished-moment-can-still-be-one-frozen-frame.md`.
