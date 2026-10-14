---
category: engine-quirks
tier: generalizable
sourceGame: PlatformerSample
phase: "4,5"
question: "Are you about to edit level, data or project-settings files from outside while the game's editor or another tool has the project open — or waiting on a Windows process from Git Bash?"
sanitized: true
origin: "unity:engine-quirks/which-project-files-you-may-edit-under-a-live-editor"
---

# Editing project files under a live editor: which are safe, and the PID check that lies

Applies when the game's own editor (or any tool that loads project files into memory) may be open while you edit
serialized data from outside — minting identity fields into level data, restoring a settings file, fixing a flag. The
editor is a **second writer**, and file classes behave differently:

| File | Safe to edit while the editor is open? | Why |
|---|---|---|
| A level the editor does **not** have open | Usually **yes** | No in-memory copy; a file watcher reloads it, as after a version-control checkout. |
| The level the editor **does** have open | **No** | The in-memory copy wins: a save overwrites your edit, and the human may lose unsaved work to a reload prompt. |
| Project / editor settings files | **No** | Held in memory for the session and rewritten on save or exit — your change is silently reverted. |

So "is the editor running?" is the wrong question. **"Does the editor currently own this file?"** is the right one.
That distinction let a nine-entry insert into two *unopened* levels proceed safely while the editor sat on a third.
Confirm the editor's actual behaviour (file watcher, save-on-exit) for this engine before relying on the table.

## The trap: `kill -0 <windows-pid>` from Git Bash always reports "gone"

The natural guard for the unsafe edits is "wait for the editor to exit, then write". On Windows it fails **open**:

```bash
while kill -0 "$PID" 2>/dev/null; do sleep 5; done    # $PID from a Windows process list
echo "Editor exited"                                   # ...prints immediately. It never exited.
```

Git Bash / MSYS keeps **its own PID namespace**; a Windows PID is not an MSYS PID, so `kill -0` fails on the first
iteration and the wait falls straight through. The writes then run against a live editor, and nothing warns you — in
the observed case the process had been running ~46 hours while the script announced it had exited. Check a Windows
PID with a Windows tool, and verify identity, not just existence (Windows reuses PIDs):

```powershell
while (Get-Process -Id $EditorPid -ErrorAction SilentlyContinue) { Start-Sleep 5 }
Get-Process -Id $EditorPid | Select-Object StartTime   # a start time far in the past = your wait never waited
```

## If it happens anyway

1. **Re-verify the file on disk** by content, not mtime — it is probably still correct.
2. **State the exposure precisely**: the edit is *unprotected*, not lost — the next editor save re-clobbers it. Give
   the one-line redo.
3. **Correct the earlier claim.** "Applied after the editor was closed" is now false provenance in the progress notes,
   and the next agent will trust it. Fix the document, not just the file.

## Two smaller things in the same pass

- **Never write a backup inside the project's content tree.** An asset scanner may import `Level.dat.bak` as a new
  asset. Back up to a temp directory outside the project.
- **Prefer a targeted edit to the game's "regenerate everything" tool.** A regenerate-all id tool re-mints every id in
  the level; a script that fixes only the broken entries keeps the diff the size of the defect. Verify the diff is as
  small as you claim (same-width replacement → identical size and line count; insert → pure addition).

Related: `learnings/save-systems/serialized-id-keys-collapse-where-the-id-minter-never-ran.md`.
