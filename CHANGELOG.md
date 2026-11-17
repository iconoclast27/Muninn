# Muninn Changelog

Entries by release tag. Dates and the tag-target commit are measured from
`git for-each-ref --format='%(refname:short) %(creatordate:short) %(objectname:short)' refs/tags`
(2026-11-16) [R]; headlines are the tag commit's subject, measured with `git log -1 --format=%s` [R].
Release assets are `main.js`, `manifest.json`, `versions.json`, `styles.css` (Muninn ADR-8,
`docs/Release Ritual -- Walkthrough.md`). Tags are immutable; never force-push.

**Latest release:** `0.2.0-test.15` — https://github.com/iconoclast27/Muninn/releases/tag/0.2.0-test.15

| Tag | Date | Headline [R] |
|---|---|---|
| `0.2.0-test.1` | 2026-11-04 | `4922e8d` docs: add handover note for next instance |
| `0.2.0-test.2` | 2026-11-04 | `9f3462f` docs: update handover for in-memory SQLite fallback |
| `0.2.0-test.3` | 2026-11-04 | `de1b61d` chore(release): bump to 0.2.0-test.3 |
| `0.2.0-test.4` | 2026-11-04 | `6faeb96` fix(plugin): copy serialized bytes before write, add load/reindex logging |
| `0.2.0-test.5` | 2026-11-04 | `addcd3b` chore(plugin): add diagnostic logging for vault events and intake lane |
| `0.2.0-test.6` | 2026-11-05 | `c3a6666` fix(plugin): interrupt forceReindex on stop, defer store.close until async work settles |
| `0.2.0-test.7` | 2026-11-05 | `175a04d` fix(plugin): close Lumo review holes H3/M1/M3/M4/L1/L6 |
| `0.2.0-test.8` | 2026-11-05 | `06b26cc` chore(release): bump to 0.2.0-test.8 for manual testing |
| `0.2.0-test.9` | 2026-11-06 | `8cede05` chore(release): bump for K/L fix and API freeze testing |
| `0.2.0-test.10` | 2026-11-06 | `633a950` chore(release): bump for Plugin 2 harness + Skill #1 testing |
| `0.2.0-test.11` | 2026-11-06 | `d6f87b8` chore(release): bump for recipe-folder fix |
| `0.2.0-test.12` | 2026-11-06 | `7489213` chore(release): bump for Huginn recipe-folder layout |
| `0.2.0-test.13` | 2026-11-06 | `fb33b97` fix(llm): remove format:json from Ollama chat and strip JSON fences |
| `0.2.0-test.14` | 2026-11-06 | `f58f4e2` chore(release): bump for chat model split |
| `0.2.0-test.15` | 2026-11-06 | `084a076` refactor: move chat/skills to Huginn; expose API door only in Muninn |

**Facts of record for the `test.15` release act:** chat and skills leave Muninn for Huginn; Muninn exposes
only the frozen `MuninnApi` door via `getMuninnApi()` (ADR-36, ADR-31); `main.ts:90-91` states the harness
has moved (T1, ruling owed on the Plugin 2 modules that remain in `src/`).

**Release hygiene, ruling owed (T24):** `versions.json` has 13 entries against 15 tags — `0.2.0-test.1`
and `0.2.0-test.2` are missing. Completing the file is a release act, Dan's, not a doc edit.

## Docs record (not a release act)

**2026-11-17, Phase 4** — commit `9b2a2bd`, `docs(rationalisation): phase 4 canonical set — ADRs, Design
Report, archive with tombstones`: **111 files, 2391+/5526−** [R], pushed `b75c408..9b2a2bd main -> main`
[R]. Written: `docs/decisions/` ADR-1 … ADR-37 + `index.md`, `docs/Initial Design Report.md`,
`CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` (repo root), `README.md` Docs section, `TESTING1.md`
version-of-record header (`0.2.0-test.15`, tag commit `084a076`), `docs/archive/` with tombstones,
`docs/archive/README.md`; the empty untracked `docs/AGENTS/SKILLS/` deleted. Receipts tied to the commit:
`TYPECHECK EXIT:0`, **26 `VERDICT: GREEN`**, `FIXTURES LOOP DONE` [R]. No bump, no tag, no release.

**2026-11-17, Phase 5** — archive→delete, Dan's act on Dan's authorization (ruling 13): `git rm -r
docs/archive` = **34 tracked files** [R], every tombstone dated 2026-11-17; content recoverable from the
git history. Live docs conformed in the same commit: `README.md`, `CONTRIBUTING.md`, `docs/TESTING1.md:325`,
`docs/Unified Project Definition v0.2.md:7` (the store-spec supersession note), `docs/Initial Design
Report.md` (header companion, §18 item 11, §20 registry rows, §21, new §22), this record, and
`docs/decisions/index.md`'s dated addendum. **No ADR body edited** (ruling 2, ADR-6). Live doc set after:
**47 tracked files** [R]. No bump, no tag, no release.
