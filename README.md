# Muninn

Indexing plugin for Obsidian — paragraph-level vault chunking with SQLite WASM, FTS5 text search, and Ollama-powered semantic search.

## Current status

Plugin 1 (vault index) is implemented and fixture-green. The latest released prerelease is **0.2.0-test.15**. Plugin 2 skills and chat completions have moved to the separate **Huginn** plugin; Muninn exposes the frozen `MuninnApi` door via `getMuninnApi()`.

## Smoke testing

See [`docs/TESTING1.md`](docs/TESTING1.md) for the manual Obsidian smoke-test scenario, including console API checks and the new sidebar UI scenario.

## Docs

Canonical set (single source of truth — every durable fact is mined into these docs):

- [`docs/Initial Design Report.md`](docs/Initial Design Report.md) — the as-built description at
  `b75c408` / `0.2.0-test.15` (recorded 2026-11-16).
- [`docs/decisions/index.md`](docs/decisions/index.md) — the 40 ADRs, numbered from 1, status table and
  supersession map. **An ADR is never edited after acceptance.**
- [`docs/Tracked Issues.md`](docs/Tracked%20Issues.md) — **the tracked-issues docket, canonical for both
  projects** (Muninn and Huginn). Raised findings stay on the docket until investigated; Huginn keeps a
  pointer stub. Findings are measured receipts, Dan's rulings verbatim, and pointers to the committed record
  — the docket copies nothing that this report already states.
- [`docs/TESTING1.md`](docs/TESTING1.md) — the living manual-smoke contract, version-pinned.
- [`docs/Release Ritual -- Walkthrough.md`](docs/Release%20Ritual%20--%20Walkthrough.md) — release doctrine
  (Huginn keeps a pointer stub to it).
- [`docs/Unified Project Definition v0.2.md`](docs/Unified%20Project%20Definition%20v0.2.md) and
  [`docs/LLM Coordination Protocol v1.0.md`](docs/LLM%20Coordination%20Protocol%20v1.0.md) — owned by
  Muninn; Huginn keeps pointer stubs.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions, fixture discipline, the authorization chain.
- [`CHANGELOG.md`](CHANGELOG.md) — entries by release tag, dates and tag commits measured.
- [`SECURITY.md`](SECURITY.md) — private/experimental posture, the write lane, the model layer.
- **The archive is deleted** (2026-11-17, Phase 5, Dan's authorization): `docs/archive/` held **34 tracked
  files**, each stamped with the tombstone *"Archived 2026-11-17. Superseded by \<doc\>. Not
  authoritative."* The mining destinations are in `docs/Initial Design Report.md` §20; the deletion record
  is §22 and `CHANGELOG.md`. Deleted files are recoverable from the git history. ADR evidence lines cite
  files that existed at acceptance (88 lines in 34 ADRs [R]) and are **not edited** (ruling 2, ADR-6).

## Build

```bash
npm install
npm run typecheck
npm run build
```

The production bundle is written to `main.js`.
