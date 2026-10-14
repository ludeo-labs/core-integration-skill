---
category: engine-quirks
tier: generalizable
sourceGame: multiple
phase: "7"
question: "Do you need integration diagnostics from a Ludeo cloud run (a Windows build under Proton on a cloud VM), and have you confirmed that a line only your game could print actually reaches the collected cloud log?"
sanitized: true
origin: "unreal:engine-quirks/diagnostics-to-stdout-for-cloud-logs, unity:engine-quirks/cloud-proton-drops-unity-stdout-so-logfile-dash-buys-nothing"
---

# Get the integration's lines into the cloud log: stdout and the debug channel, flushed — then prove one arrived

**Precondition:** you are diagnosing the integration on a Ludeo cloud run — the game on a cloud VM under Proton, not
on your machine. Locally every logging channel is readable in one place, so the difference never shows; on the cloud
the channels diverge, most of them die with the VM, and cloud-only bugs are exactly the ones that need observing.

## Two observations that pull in opposite directions

`phase 7` Step 4 says the runner collects the launched process's stdout — route the game's log there and call the
executable directly from `run.bat`. Both of these were then observed:

- **Only stdout reached the central store.** The game's log file stayed on the VM's disk; `OutputDebugString` under
  Proton landed only in a VM-local capture; integration markers appeared centrally only once they were also written
  to stdout. Fetching logs from the live VM looks fine — but you are racing the VM's lifetime.
- **stdout was dropped, the debug channel survived.** On another cast session the collected `steam-game.log` held 668
  lines, **all** from the Ludeo SDK, each arriving as `warn:seh:OutputDebugStringA/W`; lines only the game prints (its
  startup banner, its own log prefix) had zero hits. That build was a GUI-subsystem Windows game writing its log to
  stdout, launched through a wrapper chain (`explorer.exe /desktop=… cmd /c <wrapper>.bat …\run.bat`), and its stdout
  survived into no collected artifact. The SDK's lines survive because its logger writes to the Windows debug channel
  (which Proton logs) and ships its own lines to Ludeo's log collector.

Which channel survives depends on the runner and the executable — **check, don't assume**.

## What to do

Write the integration's diagnostics to **both** channels, filtered and flushed, alongside the game's normal logging:

```cpp
void LudeoDiag(bool isError, const char* fmt, ...) {
    char buf[1024];
    va_list ap; va_start(ap, fmt); vsnprintf(buf, sizeof buf, fmt, ap); va_end(ap);
    GameLog(buf);                        // the game's own log (local file)
    std::printf("[Ludeo] %s\n", buf);
    std::fflush(stdout);                 // an unflushed buffer dies with a crash or a kill
#if defined(_WIN32)
    OutputDebugStringA("[Ludeo] "); OutputDebugStringA(buf); OutputDebugStringA("\n");
#endif
}
```

- Keep a fixed, grep-able prefix so the trace is trivial to isolate in the central store.
- `fflush` matters: the moments you most want traced (a crash, the runner killing the process) are exactly when an
  unflushed buffer is lost.
- **Filter the debug-channel mirror** to integration-prefixed lines plus errors. Under Proton each call lands **four
  times** in the log (A and W variants × two channels), so mirroring ordinary game logging buys volume and nothing
  else.
- **On the first cloud run, grep the collected log for a line only your game could print.** Until you have, you
  don't have a cloud log. Then keep the channel that arrives; drop the other if it only adds noise.

## Keep it a diagnostic — but don't compile the instruments out of the cloud build

The mirror is debugging scaffolding: once the issue is resolved, keep only the few genuinely useful lifecycle
markers. Verbose SDK-side logging belongs behind a `ludeo.ini` toggle so it can be flipped on for one cloud run without
a rebuild — not shipped on. Likewise, if the restore self-check exists only in development builds, the release build
the cloud runs has none of it at the moment a cloud-only bug appears: put it behind a **runtime flag** passed by the
`run.bat` that ships with the build — off for real players, available on the artifact already uploaded.

For crashes, see `learnings/engine-quirks/the-cloud-crash-dump-is-inside-the-container.md`.
