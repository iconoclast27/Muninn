# ADR-8: Release doctrine — manifest.json is the version authority, no release from a dirty tree, the tag must resolve

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-10-26 (walkthrough), Rev 3/Rev 4 tag-resolution requirement; deliberate version
restraint ruled 2026-10-30; assets ruled 2026-11-05.

## Context

Muninn cuts test prereleases by hand (BRAT is the consumer). The archive records what went wrong: a
tag pointing at a commit that is not the release commit, a dirty tree at release time, and a
`vo-release` that checked the branch push but not the tag.

## Decision

- **`manifest.json` is the version authority** and must agree with `package.json` and
  `versions.json` (measured in agreement at `0.2.0-test.15`).
- **"Never release from a dirty tree."**
- **The bump IS the release commit.** The tag is a fixed pointer; the release is built from the
  tagged commit (forced rebuild), and `vo-release` checks the branch push **and** the tag — the
  tag-check gap is "Resolved in Rev 3".
- Release assets are exactly three: `main.js`, `manifest.json`, `versions.json`. Build artifacts are
  committed by convention.
- Annotated tag notes carry the changelog **and the remaining owed items**: **"A release is not THE
  release."**
- Deliberate version restraint is legitimate: version 0.1.7, "no bump this session — deliberate".
- Deploy: BRAT at release; between releases, manual copy into the plugin folder. The plugin triggers
  on vault reload, not on install; **one reload after BRAT is the activation ritual.**
- The release bump touches `manifest.json`, `package.json`, `versions.json` (Muninn) and, in Huginn,
  `README.md`, `docs/TESTING1.md`, `manifest.json`, `package.json`.

## Consequences

Muninn owns the release doctrine for both projects. **Huginn has no release doc at all** while
cutting releases; it needs the pointer. `CHANGELOG.md` (Dan, 2026-11-16) becomes the canonical
release record in each project, "at least by releases".

## Sources

`docs/Release Ritual -- Walkthrough.md` (85 lines, 2026-10-26, Rev 3/Rev 4 requirement, lines 28/30/34
version authority, 44/48/65/75/81 tag mechanics); `docs/archive/Session Note 2026-10-30.md`
(deliberate no-bump); `docs/archive/HANDOVER - 2026-11-05.md` (three assets, tag notes carry owed
items, "A release is not THE release"); `docs/archive/HANDOVER - 2026-11-06.md` (tag pushed,
prerelease, assets).
