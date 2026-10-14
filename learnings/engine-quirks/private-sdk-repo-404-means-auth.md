---
category: engine-quirks
tier: generalizable
sourceGame: TacticsGame
phase: "1"
question: "Is the SDK (or another Ludeo artifact) fetched from a GitHub repository or release that may be private?"
sanitized: true
origin: "unreal:engine-quirks/sdk-release-repo-is-private-use-gh-cli"
---

# A 404 from a private GitHub repo means "not authenticated", not "gone"

**Precondition:** the SDK comes from GitHub (the `phase 1` release repository, or a release asset).

**The mistake:** an anonymous `curl -L <download-url>` returned **404** although the release existed; the agent
concluded the asset was gone.

**Why:** GitHub answers unauthenticated requests for private repositories with 404, not 401/403. An anonymous
`git clone` fails the same way ("repository not found").

**Fix:** use the authenticated GitHub CLI:

```bash
gh auth status
gh release list -R <owner>/<repo> --limit 10
gh release download <tag> -R <owner>/<repo> -p "*.zip" -D <dest>
```

**Prevention:** treat a 404 as "probably auth" and check `gh release list` before concluding anything. If `gh` is
missing or unauthenticated, that is a `phase 1` blocker to raise with the human — not something to work around.
