# ADR-19: Engine ruling — official SQLite WASM, embedded base64 in `main.js`, CJS loader, `'c'` flags, positional arrays

**Status:** Accepted (retrospective; recorded 2026-11-16); the strongest surviving ruling, live in
as-built.
**Ruled:** 2026-11-02 (Option A), verified live in Obsidian the same session.

## Context

Three engines were candidates: `better-sqlite3` (native), `sql.js` (WASM), official
`@sqlite.org/sqlite-wasm`. The native path died on packaging (an ELF binary cannot be bundled, and
staging `node_modules` into the plugin folder breaks BRAT and per-device installs); `sql.js` ships
without FTS5. Obsidian precedent plugins embed WASM in `main.js`.

## Decision

**Official `@sqlite.org/sqlite-wasm` (v3.54.1-build1), embedded as base64 in `main.js`.**
FTS5 ships with it; trigram is part of FTS5 (added SQLite 3.34.0), not a bolt-on. JSON1 is not
compiled in.

**Do-not-rediscover facts (measured live):**

- esbuild loader line proven: `loader: { ".wasm": "base64" }`; CJS format + base64 loader;
  **`locateFile` is mandatory** — `findWasmBinary()`'s `new URL('sqlite3.wasm', import.meta.url)`
  throws `Invalid URL` in CJS bundles because esbuild blanks `import.meta`; passing
  `wasmBinaryFile` from config is a dead end.
- **Open flag `'c'`, never `'ct'`** — the `t` flag installs `sqlite3_trace_v2()` and floods the console.
- Results are **positional arrays**, not row objects (ADR-16).
- `sqlite3InitModule` is **async**, so `openStore()` must be async.
- Persistence: `sqlite3_js_db_export(db)` → `Uint8Array` → `Vault.adapter` write. Bundle measured
  **1.6 MB** (esbuild-reported, not estimated); embedded wasm bytes 879,084; FTS5 compiled in: true.
- Renderer reality: esbuild `platform: 'browser'` + externalized Node built-ins (the renderer
  CORS-blocks dynamic `node:module` imports); Node `Buffer` replaced by
  `TextEncoder`/`TextDecoder` (not guaranteed in Electron renderer). The `:memory:` SQLite fallback
  for `SQLITE_CANTOPEN` is a named workaround, not a persistence solution (ADR-29).
- The `spike-node.mjs` one-command engine regression test (no Obsidian required) is recommended as a
  permanent artifact.

## Consequences

Zone 2 disposability now contains the whole engine failure mode: broken binary ⇒ search dark, durable
state unaffected, rebuild on repair (ADR-1). No native ABI, no per-device staging, no desktop/mobile
engine split. FTS5 is available on both devices.

## Sources

`docs/archive/Session Handover Note 2026-11-02.md` L25 (Option A), L62–L77 (candidates, precedent),
L82 (package version), L96 (bundle size), L109 (locateFile/`import.meta`), L111 (`'c'` flags),
L127 (JSON1 not compiled in), L131 (spike test), L164 (quartet), L58–64 (live containment receipt);
`docs/archive/REPORT.md` (loader line proven, positional arrays, pragmas, `openStore()` async);
`docs/archive/Session Note -- 2026-10-31.md` (SQL routing red: `UPDATE` through `.all()` — doors,
not raw SQL, ADR-28); `docs/Session Handover 2026-11-03 Evening.md` (engine API shape receipts);
`docs/HANDOVER - 2026-11-04.md` (renderer facts).
