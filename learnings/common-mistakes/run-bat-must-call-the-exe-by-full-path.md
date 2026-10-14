---
category: common-mistakes
tier: universal
sourceGame: RoomActionSample
phase: "7"
question: null
sanitized: true
origin: "unity:common-mistakes/run-bat-must-call-the-exe-by-full-path"
---

# `run.bat` must call the exe by its full path (`"%~dp0Game.exe"`)

The phase-7 `run.bat` did `cd /d "%~dp0"` and then `"Game.exe" %*`. Launched from another folder in the agent's
shell, it failed with *'"Game.exe"' is not recognized*, although the exe sat next to the `.bat`. The shell had
`NoDefaultCurrentDirectoryInExePath=1` set — a hardening option some sandboxes and machines use. With it, `cmd` does
not search the current directory for a bare program name, so the `cd` doesn't help.

Don't rely on the current directory to find the executable:

```bat
@echo off
cd /d "%~dp0"
"%~dp0Game.exe" %* & exit /b %ERRORLEVEL%
```

- **Keep the `cd`** — the game may resolve data paths relative to its working directory.
- **Call the exe directly**, not through `start`, so stdout still reaches the cloud runner (`phase 7`).
- When smoke-testing locally, launch through a tiny wrapper (`call "<path>\run.bat" > out.txt 2>&1`) from a
  different working directory. `cmd /c` with a quoted path plus a redirect can mangle `%~dp0` and produce a false
  failure.

You can't know whether the cloud runner's environment sets that option, so the full-path form is the only one that
works everywhere.
