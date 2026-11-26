# Muninn

Indexing plugin for Obsidian — vault chunking with SQLite WASM, FTS5 text search, and Ollama-powered
semantic search. Exposes the Muninn door (`getMuninnApi()`) to the companion plugin **Huginn** (chat,
skills, approval gate).

## Current status

The project restarted 2026-11-26 (Dan's demolition act): the codebase sits at its **ground state** —
the vault index, intake lane, and door stand intact; the old harness, recipes, and op-loop machinery
were removed with their receipts (the disposition record: `docs/Restart Ledger.md`). The rebuild
proceeds red-first at the new seams (manifest → validator → gate legs → client wiring → recipes).

There are **no releases in the new lineage** yet; the pre-restart tags/releases were removed by the
history-surgery act of 2026-11-26, and the new version/tag lineage starts only at the first
post-restart release.

## Docs (the new canon)

- [`docs/Design Report.md`](docs/Design%20Report.md) — **the design law of the new world** (turn anatomy,
  the three layers TEACH/VALIDATE/GATE, authority doctrine, the verb-family manifest, the narrowed door,
  memory, thin tiers, fixture plan). Huginn keeps a pointer stub to it.
- [`docs/Restart Ledger.md`](docs/Restart%20Ledger.md) — the ruling document: Dan's acts D-1…D-19 verbatim,
  the ratified dispositions for every file and fixture in both roots, the restart procedure. **The single
  home of the restart rulings.**
- [`docs/decisions/index.md`](docs/decisions/index.md) — the law apparatus, reborn; new ADRs start here.
- [`docs/Tracked Issues.md`](docs/Tracked%20Issues.md) — the docket, canonical for both projects (fresh
  post-restart rows; Huginn keeps a pointer stub).
- [`docs/Release Ritual -- Walkthrough.md`](docs/Release%20Ritual%20--%20Walkthrough.md) — release doctrine
  (conformed to the new lineage; Huginn keeps a pointer stub).
- [`docs/Combined Testing Schedule.md`](docs/Combined%20Testing%20Schedule.md) — the living manual-smoke
  contract, restarted with the new turn anatomy.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions, fixture discipline, the authorization chain.
- [`CHANGELOG.md`](CHANGELOG.md) — the new lineage (the old one is retired; its record is the git history
  and the Restart Ledger).
- [`SECURITY.md`](SECURITY.md) — private/experimental posture, the write lane, the model layer.

## Build

```bash
npm install
npm run typecheck
npm run fixtures
npm run build
```

The production bundle is written to `main.js`.
