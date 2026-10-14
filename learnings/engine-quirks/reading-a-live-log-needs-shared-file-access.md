---
category: engine-quirks
tier: generalizable
sourceGame: TPSSample
phase: "1,3,5,6"
question: "Are you writing tooling in .NET or PowerShell that reads a log file while the process writing it (the game, the game's editor) is still running?"
sanitized: true
origin: "unity:engine-quirks/reading-the-live-editor-log-needs-shared-file-access"
---

# Reading a live log from .NET needs `FileShare.ReadWrite`

Applies on Windows when your tooling uses the .NET file APIs. A running game or editor keeps its log open for writing
for its whole lifetime. A .NET read path that does not explicitly share the handle fails:

```powershell
[System.IO.File]::ReadLines($GameLog)
# Exception calling "ReadLines" with "1" argument(s):
# "The process cannot access the file '…\game.log' because it is being used by another process."
```

`File.ReadLines`, `File.ReadAllText` and friends open with `FileShare.Read`, which means *"I tolerate other
readers"* — not other **writers**. The game is a writer. Open with `FileShare.ReadWrite` and it works:

```powershell
$stream = [System.IO.FileStream]::new(
    $GameLog, [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$reader = [System.IO.StreamReader]::new($stream)
try   { while ($null -ne ($line = $reader.ReadLine())) { <# … #> } }
finally { $reader.Dispose(); $stream.Dispose() }
```

## Why it bites here

**The live session is exactly when you want the log** — the integrator has just played, the trace is fresh. Asking
them to close the game so your tool can read a file is absurd, and can be destructive: many games overwrite their log
on the next start.

It is also easy to miss in testing, because the casual ways of reading the file work. `grep`, `cat`, `tail` and most
Unix-lineage tools open with full sharing, so a parsing routine prototyped at the shell reads the live log without
complaint — and throws the moment the same logic moves into a script on the .NET API. The bug appears exactly where
you stop experimenting and start automating.

## Make it the default

The same rule applies to any engine- or tool-owned file you read while its writer runs. If your tooling reads such a
log at all, put shared access in the one helper you write, rather than remembering it per call site.

## When the read comes back without the line you expected

A shared read of a live log is a snapshot of a moving file; it ends wherever the writer had got to. If a line the
integrator *just* triggered is missing, it may not be flushed yet — re-read before concluding it was never emitted.
