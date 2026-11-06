# Muninn

Indexing plugin for Obsidian — paragraph-level vault chunking with SQLite WASM, FTS5 text search, and Ollama-powered semantic search.

## Current status

Plugin 1 (vault index) is implemented and fixture-green. The latest released prerelease is **0.2.0-test.8**. Local `main` has additional unreleased work: edit-event coalescing, a Muninn settings tab with a Force reindex button, a sidebar search view with restored state, and the frozen public API surface (locked 2026-11-06 for Plugin 2).

## Smoke testing

See [`docs/TESTING1.md`](docs/TESTING1.md) for the manual Obsidian smoke-test scenario, including console API checks and the new sidebar UI scenario.

## Docs

- [`docs/Muninn Store Rewrite Specification.md`](docs/Muninn Store Rewrite Specification.md) — store schema, API surface, and behavioral invariants.
- [`docs/Unified Project Definition v0.2.md`](docs/Unified Project Definition v0.2.md) — project scope, Plugin 2 architecture, and build order.
- [`docs/LLM Coordination Protocol v1.0.md`](docs/LLM Coordination Protocol v1.0.md) — fixture-first and collaboration conventions.

## Build

```bash
npm install
npm run typecheck
npm run build
```

The production bundle is written to `main.js`.
