---
source:
status: pending
para:
context:
description:
Topics:
Concepts:
Meeting notes:
Permanent: false
type: note
word_count: 1
language: en
updated:
modified: 2026-10-26T17:58:14+00:00
---
# Release Ritual — Walkthrough

## Why a ritual exists at all

Nothing downstream ever looks at my laptop. BRAT and Obsidian look at a **GitHub release** — a page on the internet with files attached to it. So "it works when I run it here" is worth exactly nothing. The only thing that counts is what's attached to a release on GitHub.

Every step below exists to guarantee one property: **the thing on GitHub is provably the thing I tested.** When a step feels redundant, that's why it's there.

## The cast of files

- **`manifest.json`** — the plugin's ID card. Obsidian and BRAT read `version` and `minAppVersion` from here. This is the _authority_ on what version we're releasing.
- **`package.json`** — npm's bookkeeping. Carries the same version number (kept in sync by convention) plus the `dev` and `build` scripts.
- **`versions.json`** — Obsidian's release ledger: a map of version → minimum Obsidian version. It exists so upgrade paths can be computed. Ours had drifted badly (only `0.1.0` was listed); as of 0.1.6 it's backfilled through the full history.
- **`main.js`** — the actual compiled plugin. The TypeScript in `src/` is _not_ what Obsidian runs; esbuild squashes it all into this single file. Committed to the repo by convention, so the repo is self-describing.

## The sequence

**1. Bump the version.** Edit `manifest.json` and `package.json`, and add the new entry to `versions.json`. _Why:_ the version is the label on the box. Nothing downstream can refer to the release until the label exists.

**2. Build.** `npm run build` → turns `src/*.ts` into `main.js`. Production mode means minified, no sourcemaps. _Why:_ the plugin Obsidian loads is the built file, not the source.

**3. Inspect.** `git diff --stat`. _Why:_ see the blast radius before freezing it. Cheap insurance against committing something unintended.

**4. Commit.** `git commit`. _Why:_ a commit is a named snapshot of the entire tree, permanently recoverable. Note: nothing has left the machine yet.

**5. Push the branch.** `git push origin main`. _Why:_ publishes commits to GitHub. Until this, GitHub has no idea they exist.

**6. Tag.** `git tag 0.1.6`. _Why:_ a tag is a sticky note pointing at one specific commit — "this exact snapshot _is_ release 0.1.6." A branch pointer moves as you keep working; a tag never does.

**7. Push the tag.** `git push origin 0.1.6`. _Why:_ the tag has to exist **on GitHub** for a release to hang off it. This is the step that got missed tonight — and the reason the whole ritual stalled.

**8. Run the release.** `vo-release`. _Why:_ it's the wrapper that enforces the discipline. It refuses to proceed if the tree is dirty, if HEAD isn't pushed, or if the tag disagrees with `manifest.json`. Then it rebuilds from scratch — so the asset provably comes from this commit — creates the GitHub release with `main.js` and `manifest.json` attached, and finally re-reads the release _the way BRAT would_. It only says GREEN if the client's view is correct.

## Tonight's failure, decoded

```card
tag 0.1.6 exists locally but has not been pushed
```

Two places a tag can live: my machine, and GitHub. `git tag` only made the local one. `gh release create` needed the remote one. Fix: `git push origin 0.1.6`, then re-run.

Lesson worth keeping: **local success is not remote state.** Almost every confusing failure in this workflow is that same confusion wearing a different hat.

## Vocabulary worth keeping straight

- **Working tree** — the files as they sit on disk right now.
- **Commit** — a saved snapshot plus a message.
- **Branch (`main`)** — a _movable_ pointer to the newest commit.
- **Tag** — a _fixed_ pointer to one commit.
- **Remote (`origin`)** — GitHub's copy of the repo.
- **Release** — a GitHub page attached to a tag, with downloadable files.
- **Asset** — a file attached to a release. BRAT downloads `main.js` and `manifest.json` from here.
- **Dirty tree** — uncommitted changes present.

## Rules of thumb

- The version lives in three files. They must agree, or the ritual stops.
- Never release from a dirty tree.
- The asset must come from the tagged commit — hence the forced rebuild every time.
- Verify as the _client_ reads it, not as I assume it was written.
- A release with missing or unlisted assets is exactly the brick BRAT chokes on.

## Known rough edges (observations, not fixes)

- `vo-release` checks that the branch is pushed but never that the **tag** is. Tonight's stall is the proof. Resolved in Rev 3.
- The script's own error text suggests `vo-release --verify-only <tag>`, but the argument parsing binds the first positional to the tag slot, so the tag in that form is ignored. Cosmetic, but misleading.  

## What 0.1.6 actually shipped

Two live-verified features since 0.1.5: the extracted live-set path projection (F03 rev B) that killed the perpetual "file absent" corpse reports, and the watcher reconcile lane (F12 rev C) that backfills on first contact and offers a manual "Reconcile with vault" door. Boot-2 idempotence held across multiple reloads — zero reconcile creates, heal catch-up only.