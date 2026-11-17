# ADR-39: The three empty `src/` directories in Muninn are removed

**Status:** Accepted — Dan's ruling 2026-11-17. Recorded 2026-11-17.
**Ruled:** Dan, 2026-11-17: **"T2, remove the empty directories."**
**Extends:** ruling 10 of 2026-11-16 (`docs/AGENTS/SKILLS/` deleted, 0 files). Closes docket **T2**.

## Context

Spine-era layout leftovers. Measured 2026-11-17: `find src -maxdepth 1 -type d -empty` returned
`src/probe`, `src/rebuild`, `src/search`; `find src/probe src/rebuild src/search -type f | wc -l` = **0**;
`git ls-files src/probe src/rebuild src/search | wc -l` = **0** — no file, no import, and git cannot track
empty directories, so they were invisible to the repo. `docs/AGENTS/SKILLS/` had already been deleted under
ruling 10, on the same reasoning. Measured in Huginn: `find src -maxdepth 1 -type d -empty` → **no output**.

## Decision

The three directories are removed from the working tree (`rmdir`, 2026-11-17). Re-measured after the act:
`find src -maxdepth 1 -type d -empty` → no output; `git status --porcelain` → clean. **The act leaves no
commit**, because git cannot see a directory with no files in it; this ADR is the record.

`.qwen` was **not** in the original ruling's scope, and was raised as docket **T36**. Dan ruled on it the
same day: **"You can remove .qwen"** (2026-11-17). Executed: `find .qwen -type f` = **1 file**
(`.qwen/settings.json`, qwen-code permission settings: `Bash(cd *)`, `Bash(git status)`, `Bash(git log *)`,
`Bash(npx *)`, `Bash(npm run *)`, `$version: 4`) [R], `git ls-files .qwen | wc -l` = **0** [R];
`rm -r .qwen`. Re-measured: `find . -maxdepth 2 -type d -empty -not -path "./.git*"` → **no output**. Tool
residue from the qwen-code tooling Dan deleted on 2026-11-13 (`docs/archive/Handover 2026-11-13.md:55`,
archived then deleted, recoverable from history), not project layout. It leaves no commit, untracked.
