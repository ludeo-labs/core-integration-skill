---
category: engine-quirks
tier: generalizable
sourceGame: RoguelikeSample
phase: "7,8"
question: "Chasing a crash on a Ludeo cloud machine and only pulling the session log folder? The game's crash dump is written inside the Wine prefix in the game's container, which is deleted when the session ends."
sanitized: true
origin: "unity:engine-quirks/the-cloud-crash-dump-is-inside-the-container"
---

# The cloud crash dump lives inside the container, not the session log folder

Applies when you can reach a cloud machine while a crashed session's container is still up. The three files in
`/home/ubuntu/game-logs/<session>/` — `steam-game.log`, `selkies-gstreamer.log`, `<session>.txt` — contain **no crash
dump**. The game's crash handler writes its dump wherever it would on Windows, and under Proton that path is inside
the Wine prefix, inside the game's Docker container:

```
/home/ubuntu/runner/proton/compatdata/pfx/drive_c/users/steamuser/
    AppData/Local/...          # wherever the game's crash handler writes (often a Temp or Crashes folder)
```

Pulling only the session folder costs hours: you infer a root cause from a single `warn:seh` backtrace line in
`steam-game.log` instead of reading the exception record. Worse, the Wine log raises the *same* exception code in
benign paths, so "the only exception in the file" is not evidence of the crash — in one session the game logged
happily past an identical raise.

**The container is removed when the session ends.** Check `docker ps` first; if the container is gone, so is the dump.

## Getting it out

Stream it as an archive through the remote shell, base64-encoded so it survives the quoting chain:

```
ssh <machine> "sudo docker exec <session> sh -c 'cd <prefix>/.../Temp && tar czf - <Company>*' | base64 -w0" > crash.b64
```

Then decode and untar locally. Quoting notes that cost real attempts: a remote `$(...)` is expanded by the *local*
shell, and a path containing spaces is split by the nested `sh -c` however you quote it — use a trailing glob
(`<Company>*`) rather than quoting the space.

## Reading it without a debugger

A minidump's exception record and module list parse in ~30 lines of a script: header at offset 0 (`MDMP`, stream
count, directory RVA), directory entries of `(type, size, rva)`; stream type **6** is the exception (`ThreadId`, then
`ExceptionCode`, `ExceptionFlags`, `ExceptionRecord`, `ExceptionAddress`), stream type **4** the module list (112-byte
entries; `ModuleNameRva` at +20 points at a length-prefixed UTF-16 string). Matching `ExceptionAddress` against module
ranges names the faulting module, and the module list alone tells you which subsystems were live — that is what
identified Media Foundation in `learnings/engine-quirks/a-looping-autoplay-video-crashes-the-cloud-build.md`.

## Do before the next crash, not after

- **Make the game write a real log file into a directory that lands in the session folder you already fetch**, in
  addition to stdout — with the game's own crash output in it
  (`learnings/engine-quirks/diagnostics-to-stdout-for-cloud-logs.md`).
- **Add the container crash path to your fetch script**, so a dump is captured automatically while the machine is
  still alive.
- Keep the build's debug symbols locally (never shipped, `phase 7`) so the faulting address can be symbolicated.
