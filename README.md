# Muninn

Indexing plugin for Obsidian — paragraph-level vault chunking with SQLite WASM, FTS5 text search, and Ollama-powered semantic search.

## Current status

Plugin 1 (vault index) is implemented and fixture-green. The latest released prerelease is **0.2.0-test.13**. It includes the Plugin 2 harness skeleton and Skill #1 (tag assignment, read-only suggest mode) against the frozen Plugin 1 API.

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
