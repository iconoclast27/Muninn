# Muninn Rebuild Assessment — Report

Date: 2026-11-04
Repo: `/home/danf/Projects/Muninn`
Commit: `5516fa3bd47a696c530ebf004304a0b6397bdae3`
Scope: Determine whether the existing files are useful for finishing Plugin 1 (Muninn), and outline the procedure to do so.

## Executive summary

The repository is a deliberately minimal skeleton. The **chunker and render contract are intact and reusable** — they are the only production-quality modules on disk. Most of the rest are either placeholder directories, legacy fixtures wired to deleted modules, or spike files proving engine viability. Nothing implements the index store, the public API, the intake lane, or the Obsidian plugin entry point.

Verdict: the existing files **are useful**, but narrowly. The rebuild is not a recovery job; it is the next planned phase. The path is clear because `docs/Muninn Store Rewrite Specification.md` (v3) defines the schema, API, and invariants, and `src/fixtures/f01.ts` already states the first failing test.

## Inventory of existing files

### Salvageable / directly useful

| File | Status | Usefulness |
|------|--------|------------|
| `src/chunker/chunker.ts` | Complete, committed | Core production module. Pure, deterministic paragraph-level chunker. Exports `CHUNKER_CP = 2`, `chunkNote`, `Chunk`, `ChunkResult`. Drop-in for the intake lane. |
| `src/chunker/render.ts` | Complete, committed | Render contract + `embedVh` (SHA-256 → 16 hex). Canonical fm_context serialisation. Single source of truth for vector hashes. |
| `docs/Muninn Store Rewrite Specification.md` | Draft v3, committed | The implementation contract for the store layer, FTS5 table, API surface, epochs, rename/delete semantics, and dark-safe wrappers. |
| `spike-node.mjs` | Throwaway, but proven | Confirms `@sqlite.org/sqlite-wasm` 3.54.1 loads in Node, FTS5 is compiled in, trigram tokeniser works, DB export works, `'c'` flag is correct. |
| `spike-plugin.js` | Throwaway, but proven | Confirms the same SQLite engine can be bundled into an Obsidian plugin with base64-embedded WASM and `wasmBinary` + `locateFile` options. |
| `spike-esbuild.config.mjs` | Throwaway | Shows the exact esbuild loader line needed: `loader: { ".wasm": "base64" }`. Useful as a template for the real `esbuild.config.mjs`. |
| `src/fixtures/f01.ts` | Incomplete but valuable | First fixture for the store layer. States the contract (S1–S5). Currently red because `src/store/store.ts` does not exist. |
| `package.json` | Exists | Declares `0.2.0`, scripts, SQLite WASM dependency, esbuild, obsidian. Missing `esbuild.config.mjs` and `manifest.json`. |
| `tsconfig.json` | Exists | Modern TS/ESM/Bundler config, `allowImportingTsExtensions`, `strict`. Fits the project. |

### Not directly useful for Muninn (legacy residue)

| File | Status | Issue |
|------|--------|-------|
| `src/fixtures/csuite.ts` | Broken imports | Imports `../indexer/emit.ts`, which does not exist. References event-log vocabulary from the old project. Not needed for Plugin 1 unless the log lane is revived. |
| `src/fixtures/props.ts` | Broken imports | Imports `./gen-corpus.ts`, which does not exist. Property harness for the chunker, but the chunker is already certified; it can be rewritten later if regression coverage is wanted. |
| `src/fixtures/test-harness.ts` | Broken imports | Imports `./eventlog/eventlog.ts`, which does not exist. Legacy FakeFileSystem/FakeAdapter may be reused for vault simulation, but only after decoupling from `EventLog`. |
| `docs/ARCHIVE/*` | Sealed | Per `docs/Session Handover 2026-11-03 Evening.md`, archives are "the morgue" — read selectively, never treat as current state. |

### Missing files required for a working plugin

- `src/store/store.ts` — SQLite WASM index database implementing spec v3.
- `src/api.ts` — frozen public API (`searchText`, `searchSemantic`, `relatedChunks`, `tagVocabulary`, `forceReindex`).
- `src/intake/lane.ts` — vault event intake / reconcile lane.
- `src/main.ts` — Obsidian `Plugin` subclass entry point.
- `esbuild.config.mjs` — production + dev build.
- `manifest.json` — Obsidian plugin manifest.
- `versions.json` — Obsidian release ledger.
- `styles.css` — likely needed for Obsidian UI (even if empty).

## Current build / typecheck state

`npm run typecheck` reports 11 errors in 4 files:

- `src/fixtures/csuite.ts`: missing `../indexer/emit.ts`
- `src/fixtures/props.ts`: missing `./gen-corpus.ts`
- `src/fixtures/test-harness.ts`: missing `./eventlog/eventlog.ts`
- `src/fixtures/f01.ts`: missing `../store/store.ts` plus several implicit-`any` errors in `.map()` callbacks.

The broken legacy fixtures should be removed or quarantined before they pollute the typecheck baseline. Once they are gone, only `f01.ts` should remain red until `store.ts` exists.

## Procedure to finish Plugin 1 (Muninn)

Following the fixture-first doctrine from `docs/LLM Coordination Protocol v1.0.md` and the handover note.

### Phase 0 — Clean the workspace

1. Remove or move the three broken legacy fixtures (`csuite.ts`, `props.ts`, `test-harness.ts`) from `src/fixtures/`.
2. Add a minimal fixture harness helper if needed, but keep it inside `src/fixtures/`.
3. Verify `npm run typecheck` now fails only on `src/fixtures/f01.ts` because `../store/store.ts` is missing.
4. Create `esbuild.config.mjs` with `loader: { ".wasm": "base64" }`, external `obsidian`, output `main.js`, and a dev mode with watch.
5. Create `manifest.json` with a plugin id, version matching `package.json` (`0.2.0`), and `minAppVersion`.
6. Create `versions.json` with the initial version entry.
7. Create an empty `styles.css` if UI will be added later.

### Phase 1 — Implement `src/store/store.ts`

This is the critical path. Use the spec as the contract and `f01.ts` as the first receipt target.

1. **Dependencies**
   - Import SQLite WASM: `import sqlite3InitModule from '@sqlite.org/sqlite-wasm'`.
   - Embed WASM bytes via esbuild base64 loader (proven in `spike-plugin.js`).
   - Use `node:crypto` only via `chunker/render.ts` if needed (already there).

2. **Lifecycle**
   - `open(path)` is **asynchronous** because `sqlite3InitModule()` is async (per spike receipts and handover §3).
   - If path is `:memory:`, still create the DB.
   - Run pragmas: `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `busy_timeout 5000`.
   - Create schema if tables missing (`files`, `chunks`, `embeddings`, `meta`, `chunk_fts`).
   - Initialise meta keys: `schema_version = '3'`, `chunker_epoch`, `embedder_epoch`, `embedder_model_tag`.

3. **Type exports needed by F01**
   - `Store` interface.
   - `openStore(path)` async factory.
   - Methods: `replaceChunksForPath`, `recordFile`, `getFile`, `countChunks`, `searchText`, `deleteChunksForPath`, `renamePath`, `query`.

4. **Implementation order inside the store**
   a. DDL + meta.
   b. Watermark doors (`recordFile`, `getFile`, `deleteFile`, `clearFiles`).
   c. Chunk doors (`insertChunks`, `replaceChunksForPath`, `deleteChunksForPath`, `countChunks`).
   d. FTS5 doors (`searchText`, `searchScan`, `deleteRowsForPath`).
   e. Rename doors (`renamePath`, `renamePrefix`).
   f. Embedding doors (`insertEmbeddings`, `getEmbedding`, `deleteEmbeddingsForVh`, `countEmbeddings`).
   g. `query` read-only guard with first-keyword allowlist (`SELECT`, `WITH`) throwing `ReadOnlyDoorViolation`.

5. **Query shape**
   - SQLite WASM returns arrays, not objects (receipted in spike-node.mjs and handover). Map positional results explicitly in every wrapper.

6. **Transactions**
   - Use `db.exec('BEGIN')` / `COMMIT` / `ROLLBACK` or the SQLite WASM `transaction()` helper if available. Ensure `deleteChunksForPath` removes chunks, FTS rows, and watermark atomically.

### Phase 2 — Fix F01 and make it green

1. Make `openStore()` async in the fixture.
2. Fix implicit `any` types in `.map()` callbacks (declare `Hit` / row shapes).
3. Expect array-shaped query results in S4/S5.
4. Run `npx tsx src/fixtures/f01.ts` until green.
5. Commit with a clear receipt.

### Phase 3 — Public API (`src/api.ts`)

Implement the frozen surface from spec §6.2:

- `searchText(query)` → `{ hits: Hit[], mode: 'bm25' | 'scan' } | null`
- `searchSemantic(text)` → `{ hits: Hit[] } | null`
- `relatedChunks(path, k)` → `{ neighbors: ChunkRef[] } | null`
- `tagVocabulary()` → `{ tags: TagInfo[] } | null`
- `forceReindex(onProgress?)` → `Promise<ReindexResult>`

All failures return `null` + `reason` (dark-safe). Semantic search requires an Ollama client; reuse the spike shape: `POST /api/embed` with `input: [texts]` and `keep_alive: '-1m'`, model `nomic-embed-text:v1.5`, 768 dims.

### Phase 4 — Intake lane (`src/intake/lane.ts`)

1. Subscribe to Obsidian vault events (`create`, `modify`, `delete`, `rename`).
2. Maintain a per-path deferred buffer so events arriving during `forceReindex` are replayed idempotently (spec §5.6).
3. For each path:
   - Read file bytes.
   - Compare `(size, mtime, content_hash)` with watermark.
   - If changed, run `chunkNote`, then `replaceChunksForPath` + `recordFile`.
   - For deletes, call `deleteChunksForPath`.
   - For renames, call `renamePath` / `renamePrefix`.
4. Keep embed calls batched where possible.

### Phase 5 — Obsidian plugin entry point (`src/main.ts`)

1. Subclass `Plugin` from `obsidian`.
2. `onload()`:
   - Open the store at a plugin-folder path (e.g. `this.pluginDir + '/cache/index.db'`).
   - Spawn the intake lane.
   - Register commands: "Reindex vault", "Search text", "Search semantic".
3. `onunload()`:
   - Stop intake, close store.
4. Build with `npm run build` and produce `main.js`.
5. Install into the test vault, delete the old spike plugins first.

### Phase 6 — Additional fixtures

Add focused fixtures before each new behaviour lands:

- Rename without re-embed (store).
- Prefix rename subtree boundary matching.
- 2-char trigram fallback and 1-char empty result.
- Reindex atomicity / interrupt safety.
- Ollama dark-safe failure (null + reason when host absent).
- FTS search reproduces exact chunk bytes via `(bs, be)`.

### Phase 7 — Release readiness

Per `docs/Release Ritual -- Walkthrough.md`:

1. Keep `manifest.json`, `package.json`, `versions.json` versions in sync.
2. Run `npm run build` to produce `main.js`.
3. Inspect `git diff --stat`.
4. Commit, push, tag, push tag, then run the release wrapper (or create the GitHub release manually with `main.js` + `manifest.json` attached).

## Risks and recommendations

1. **Async `openStore` is not optional.** F01 currently calls it synchronously. The handover explicitly flags this as a known defect. Fix it before writing the store.
2. **Array-shaped SQLite results.** The old codebase expected objects; this engine returns positional arrays. Every wrapper must map columns explicitly or fixtures will pass for the wrong reason.
3. **Legacy fixtures are noise.** They will continue to break typecheck until removed or repaired. They should not be repaired to their original event-log form; that architecture was killed ("Dwell dies entire" in the handover).
4. **Base64 WASM embedding.** The spike already proved the loader line, but the real `esbuild.config.mjs` must also copy/decode the wasm correctly. If esbuild emits a string rather than a base64 string, `atob` may need adjustment.
5. **Ollama dependency is host-side.** The plugin must handle `localhost:11434` being absent gracefully. Do not block plugin load on Ollama.
6. **Schema migrations.** Spec v3 is the baseline. Future schema changes require bumping `schema_version` and epochs; build a migration path now, even if it is just "wipe and rebuild".
7. **Zone discipline.** Keep derived state (`cache/index.db`) in the plugin folder (Zone 2), never in the vault. Governance stays in `Agents/` inside the vault (Zone 1).

## Conclusion

The rebuild is feasible and the next steps are unambiguous. The most valuable existing assets are the chunker, the render contract, the store spec, and the engine spikes. The main work remaining is implementing `src/store/store.ts`, wiring the public API and intake lane, and standing up the Obsidian plugin shell. Doing this fixture-first — starting with a green F01 — keeps the project aligned with its own coordination protocol and prevents the compounding-error cascades the protocol was written to stop.
