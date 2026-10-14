---
category: engine-quirks
tier: generalizable
sourceGame: EndlessFPS
phase: "1"
question: "Are you extracting a .zip (an SDK package the user supplied, a release asset) on Windows from Git Bash?"
sanitized: true
origin: "unreal:engine-quirks/git-bash-tar-cannot-extract-sdk-zip"
---

# Don't extract a .zip with Git Bash's `tar` — use a zip-aware extractor, then verify

**Precondition:** Windows, Git Bash, and a `.zip` to unpack (e.g. an SDK package the user hands over).

Git Bash's `tar` is GNU tar, which can't read zip containers:

```
tar: This does not look like a tar archive
```

It may exit having extracted nothing, or a partial tree. Use:

```bash
python -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" sdk.zip external/ludeo
```

or PowerShell `Expand-Archive`. Then verify the result, not the exit code: the target OS's `Include/`, `Lib/`,
`Bin/` exist and the SDK DLL is a real binary over 1 MB (`phase 1` Step 2).
