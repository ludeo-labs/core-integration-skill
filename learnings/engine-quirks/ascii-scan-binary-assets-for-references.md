---
category: engine-quirks
tier: generalizable
sourceGame: TacticsGame
phase: "2"
question: "Do you need the names an opaque binary data/asset file references (which levels a mode list includes, which classes a config asset names), with no lightweight tool to read the format?"
sanitized: true
origin: "unreal:engine-quirks/uasset-ascii-scan-for-datatable-references"
---

# A raw ASCII scan of binary asset files answers "what does this reference?" in seconds

**Precondition:** `phase 2` needs to know what a binary data/asset file refers to, and reading it properly means
booting the game's editor or writing a parser.

## The technique

Most binary asset formats store names and paths as plain narrow strings. A regex over the raw bytes extracts them:

```powershell
$text = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($assetPath))
[regex]::Matches($text, "<LevelNamePattern>|<ClassNamePattern>") | ForEach-Object Value | Sort-Object -Unique
```

(`strings -n 6 <file> | grep -E '<pattern>'` works too.)

It answered "which levels does the quick-play mode table include vs the demo-mode table?" across three tables in a
second. The demo table held a strict subset — telling us which levels the team considers demo-ready, a direct input
to choosing the capture level.

## Limits

- Names and paths only — no structure or values.
- Narrow strings only; compressed or encrypted packages show nothing.
- False positives happen; treat hits as leads to verify, not proof.

## When to prefer it

Any "what does X reference" question whose answer is a name list. Boot the editor or write a parser only when you
need structured values.
