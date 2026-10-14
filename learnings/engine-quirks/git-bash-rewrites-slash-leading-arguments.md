---
category: engine-quirks
tier: generalizable
sourceGame: VoyagerV2
phase: "1,3"
question: "Are you running Windows tools from Git Bash (MSYS) with arguments that begin with '/'?"
sanitized: true
origin: "unreal:engine-quirks/git-bash-expands-game-paths"
---

# Git Bash rewrites slash-leading arguments

**Precondition:** Git Bash on Windows passes a `/`-leading argument to a native tool.

MSYS converted the virtual path `/Content/Units/Health` into `C:/Program Files/Git/Content/...`, so the tool failed
with *Can't convert the path 'C:/Program'*.

**Fix:** prefix the command with `MSYS_NO_PATHCONV=1`, or run it from PowerShell. To escape a single argument,
double its leading slash (`//Content/...`). The same conversion can hit MSVC-style switches (`cl /Zm50`) passed from
Git Bash — if a native tool reports a nonsense path where you passed a switch, suspect this first.
