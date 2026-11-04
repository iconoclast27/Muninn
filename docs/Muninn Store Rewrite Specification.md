# Muninn — Store Rewrite Specification

**Status:** Draft v3 — pending sign-off  
**Date:** 2026-11-03  
**Purpose:** Define the index database schema, API surface, and behavioral invariants for Muninn (v0.2, clean start). Supersedes legacy `src/fts/store.ts` and its schema.

```text
SUPERSESSION NOTE (added 2026-11-04, per Dan's ruling): This spec
supersedes the store/schema sections of docs/Unified Project Definition
v0.2 (4-table schema here vs. v0.2's 7-table sketch; path-keyed FTS vs.
vh-keyed; forceReindex resolved here). The Unified doc governs Plugin 2
and process doctrine; this doc governs the store. F01 was authored
against this spec.
```


**Draft v3 amendments (found while authoring F01 against real chunker receipts):**
1. Rename semantics previously had no doors — `renamePath` and `renamePrefix` added to §4.4.
2. Delete left a resurrection hole (watermark outliving rows) — §5.4 now purges all three, atomically, with the pairing invariant stated.
3. Per-row `cp` was vestigial spine furniture — dropped from the schema; `chunker_epoch` in meta is the sole authority (§2.4, §3).
4. WASM sqlite lacks better-sqlite3's automatic `.all()`-throws-on-mutation guard — §4.8 `query()` gets an explicit first-keyword allowlist.
5. **FTS5 virtual-table rename:** `UPDATE chunk_fts SET path = ...` is not reliable when the table has multiple `UNINDEXED` columns (§3, §5.3). Implementation renames the underlying `chunks`/`files` rows, then rebuilds affected FTS rows via `DELETE ... + INSERT ... SELECT ... FROM chunks`. The visible behavior — no re-chunk, no re-embed, identical content under the new path — remains unchanged.
6. **Persistence seam:** §4.1 `open()` now accepts `{ load?: Uint8Array }` and a `serialize()` API door returns the full database bytes. The runtime DB is `:memory:`; durability is provided by importing/exporting bytes through an external storage adapter (e.g. Obsidian `Vault.adapter`). WAL pragmas remain for compatibility but are inert on `:memory:`.

---

## 1. Engine

**SQLite WASM**, @sqlite.org/sqlite-wasm **3.54.1**, embedded base64 bytes (~879 KB), loaded with:
```javascript
wasmBinary: <embedded bytes>,
locateFile: () => 'sqlite3.wasm'  // short-circuits new URL(import.meta.url) CJS crash
```
DB flags **'c'** only, never **'ct'** (no threads, no worker). The runtime database is opened on `:memory:` and hydrated from a byte snapshot exported by `serialize()` / `sqlite3_js_db_export`. Zone 2 disposability holds: the persisted `cache/index.db` bytes are disposable and rebuildable per device.

---

## 2. Schema

Five tables. No companions, no external-content tricks.

### 2.1 Files (watermarks)

| Column | Type | Meaning |
|--------|------|---------|
| `path` | TEXT (PK) | Vault-relative path, POSIX separators |
| `size` | INTEGER | Bytes at observation time |
| `mtime` | INTEGER | Millisecond Unix timestamp at observation |
| `content_hash` | TEXT | SHA-256 hex, truncated 16 chars |

**Invariant:** A file's presence here means "we have observed this path and recorded its state." Absence means "never seen, or purged." Watermarks drive change detection — no file scanned unless its watermark differs.

### 2.2 Chunks (occurrences)

| Column | Type | Meaning |
|--------|------|---------|
| `path` | TEXT (PK part 1) | Vault-relative path |
| `ord` | INTEGER (PK part 2) | Chunk ordinal within file (0-based) |
| `vh` | TEXT (NON-UNIQUE INDEX) | Vector-hash of the rendered embed input (dedupe key) |
| `bs` | INTEGER | Byte offset (inclusive) into file |
| `be` | INTEGER | Byte offset (exclusive) into file |
| `text` | TEXT | Chunk content (self-contained FTS5 row) |
| `title` | TEXT | Heading-chain serialization for citation display |

**Primary key:** `(path, ord)` — **occurrence-keyed**, not content-keyed.  
**Index on `vh`:** non-unique, for dedupe lookup.  
**Rationale:** Identical content in two files (templates, boilerplate, quoted passages) produces two rows sharing one `vh`. No row-delete mapping table needed.

**Note on `cp`:** the legacy event log carried a per-row `cp` because any machine could derive chunks and they had to be comparable. Muninn has one derivation authority on one device — the meta table's `chunker_epoch` replaces `cp` entirely. The store never sees or stores it.

### 2.3 Embeddings (content)

| Column | Type | Meaning |
|--------|------|---------|
| `vh` | TEXT (PK) | Vector-hash (16-hex) |
| `vector` | BLOB | Float32 array |
| `dim` | INTEGER | Dimensionality (768 for nomic:v1.5) |
| `model_tag` | TEXT | `ollama/nomic-embed-text:v1.5` — explicit provenance |
| `epoch` | INTEGER | Embedder epoch at embed time |

**Primary key:** `vh` — content-keyed, one vector per unique rendered input.  
**Invariant:** same `vh` + same `model_tag` + same `epoch` = identical vector. Determinism is the license for deduplication (chunker Spec P3/P6 supply it upstream).

### 2.4 Tags

| Column | Type | Meaning |
|--------|------|---------|
| `vh` | TEXT (PK) | Vector-hash of the rendered embed input |
| `tags` | TEXT | JSON array of canonical tag strings |

**Primary key:** `vh` — content-keyed, one tag set per unique rendered input.
**Rationale:** Tags travel with the chunk's rendered content, not with the file path. Identical content in multiple files shares tag metadata, while `tagVocabulary()` joins against `chunks` to count distinct files and occurrences correctly.

### 2.5 Meta

| Column | Type | Meaning |
|--------|------|---------|
| `key` | TEXT (PK) | see below |
| `value` | TEXT | Serialized value |

**Required keys:**
- `schema_version = '3'` (this spec)
- `chunker_epoch` — bump on any chunker behavioral change (replaces legacy `cp`); mismatch forces full re-chunk
- `embedder_epoch` — bump on model/dimension/prefix change; mismatch forces full re-embed
- `embedder_model_tag`
- `embedder_dim` — optional; when present, intake lane validates embedding dimension against it

---

## 3. FTS5 Table (self-contained)

```sql
CREATE VIRTUAL TABLE chunk_fts USING fts5(
  text,
  title,
  path UNINDEXED,
  ord UNINDEXED,
  bs UNINDEXED,
  be UNINDEXED,
  vh UNINDEXED,
  tokenize = 'trigram'
);
```

**Self-contained:** no external content table — `text` lives here. Trigram tokenizer, per the locked decision. No `cp` column — chunker_epoch in meta is the sole policy authority.  
**Citation invariant:** `file.slice(bs, be)` == served text, policed at the search boundary.  
**Deletion mapping:** `DELETE FROM chunk_fts WHERE path = ?` — path-keyed, matches `chunks.path`, no rowid bookkeeping.
**Rename mapping:** `UPDATE chunks SET path = ? WHERE path = ?` and `UPDATE files SET path = ? WHERE path = ?`, followed by `DELETE FROM chunk_fts WHERE path = ?` and re-insert from the updated `chunks` rows. Direct `UPDATE` of `chunk_fts` is avoided because FTS5 virtual tables with multiple `UNINDEXED` columns do not reliably support it.

---

## 4. API Doors (typed, dark-safe)

All mutations go through **named methods**. `query()` is read-only, policed by an explicit guard (§4.8).

### 4.1 Lifecycle

```typescript
open(path: string, opts?: { load?: Uint8Array }): Promise<Store>
serialize(): Uint8Array
close(): void  // idempotent
```

`open()` creates or opens the database at `path`. When `opts.load` is provided, the serialized database bytes are deserialized into the new connection before schema initialization. This is the persistence seam: the runtime database is opened from a byte snapshot exported by `serialize()` and flushed through an external storage layer (e.g. Obsidian's `Vault.adapter`).

`serialize()` exports the full database as a `Uint8Array` via SQLite WASM `sqlite3_js_db_export`. The returned bytes are the authoritative snapshot to persist.

`close()` is idempotent and releases the connection. Callers must arrange for any pending `serialize()` / flush to complete before `close()` if durability is required.

### 4.2 Meta

```typescript
getMeta(key: string): string | undefined
setMeta(key: string, value: string): void
sqliteVersion(): string
```

### 4.3 Watermarks

```typescript
recordFile(path: string, size: number, mtime: number, hash: string): void
getFile(path: string): { size: number; mtime: number; content_hash: string } | undefined
deleteFile(path: string): void   // watermark purge; called by deleteChunksForPath
clearFiles(): void               // full reindex wipe
```

### 4.4 Chunks (occurrence)

```typescript
insertChunks(records: ChunkRecord[]): number                       // transaction, batch
replaceChunksForPath(path: string, records: ChunkRecord[]): number // delete+insert, atomic
deleteChunksForPath(path: string): { chunks: number; ftsRows: number }  // see §5.4
countChunks(): number
renamePath(oldPath: string, newPath: string): number              // rows re-addressed; see §5.3
renamePrefix(fromFolder: string, toFolder: string): number         // subtree re-address; see §5.3
```

`deleteChunksForPath` purges **chunks + FTS rows + watermark** in one transaction. It is the only door that removes a watermark, and it removes all three or none.

### 4.5 Embeddings (content)

```typescript
insertEmbeddings(records: EmbeddingRecord[]): number   // transaction, batch
deleteEmbeddingsForVh(vh: string): void               // explicit single-vector eviction only
getEmbedding(vh: string): EmbeddingRecord | undefined
countEmbeddings(): number
```

### 4.6 Tags

```typescript
insertTags(records: TagRecord[]): number   // transaction, batch; canonicalises tags per vh
getTags(vh: string): string[] | undefined  // parsed JSON array
tagVocabulary(): TagInfo[]                 // per-tag file and chunk counts
```

### 4.7 FTS5

```typescript
searchText(query: string): SearchResult[]   // MATCH, trigram, bm25 rank
searchScan(query: string): SearchResult[]   // LIKE '%q%', disclosed mode='scan'
deleteRowsForPath(path: string): number     // cascade from deleteChunksForPath
```

### 4.8 Transactions

```typescript
transaction<T>(fn: () => T | Promise<T>): Promise<T>
```

The body is awaited before commit, so asynchronous work stays inside the transaction boundary.

### 4.9 Diagnostic — read-only, explicitly policed

```typescript
query<T>(sql: string, ...params: unknown[]): T[]
```

WASM sqlite will happily execute mutations through any statement API — there is no better-sqlite3-style `.all()`-throws-on-mutation guarantee. So the door guards itself: the **first keyword** of `sql` must be `SELECT` or `WITH` (after trim; a leading `--` comment is a rejection, not a parse), and the statement must contain **no semicolon** — multi-statement strings are rejected as `semicolon`. Anything else throws `ReadOnlyDoorViolation` naming the rejected verb. The verb list is an allowlist, not a denylist — new verbs are rejected by default.

---

## 5. Behavioral Invariants

### 5.1 Watermark Discipline

A file is scanned iff:
1. No watermark exists, OR
2. Stored `content_hash` differs from present-day file hash, OR
3. Epoch mismatch (`chunker_epoch` or `embedder_epoch` changed since watermark was recorded)

Scanning = re-chunk → vh diff → replaceChunksForPath. **Idempotence:** re-chunking identical bytes yields identical chunk list bit-for-bit (chunker P3), so replacing chunks for an unchanged file is a no-op in content terms. Fixture F01 proves it end-to-end.

### 5.2 Epoch Bump Rule

Any change to chunker behavior or embedder model/dimension/prefix **must** bump the respective meta epoch. Failure to bump is a bug, not a configuration option. The chunker's own `CHUNKER_CP` constant is the seed value for `chunker_epoch` at first run.

### 5.3 Rename Semantics

Single path (`renamePath`):
1. `UPDATE chunks SET path = ? WHERE path = ?`
2. `UPDATE files SET path = ? WHERE path = ?`
3. `DELETE FROM chunk_fts WHERE path = ?`
4. `INSERT INTO chunk_fts(text,title,path,ord,bs,be,vh) SELECT ... FROM chunks WHERE path = ?`
5. No re-chunk, no re-embed — `vh` is path-independent by construction (chunker takes only bytes; C06's certified premise)

Subtree (`renamePrefix`): `UPDATE chunks ...` and `UPDATE files ...` use boundary-matched prefix + `'/'` — `Area/` never captures `Area 2/` (legacy `asPrefix`/`reAddress` semantics). FTS5 rows are deleted by exact `path` (LIKE on `UNINDEXED` columns is unreliable in FTS5), then rebuilt by inserting from the updated `chunks` rows for each moved path. A file at `old/note.md` before and `new/note.md` after must show identical chunk rows except `path`. Returns count of moved paths.

### 5.4 Deletion Semantics

Delete triggers, in ONE transaction:
1. `DELETE FROM chunks WHERE path = ?`
2. `DELETE FROM chunk_fts WHERE path = ?`
3. `DELETE FROM files WHERE path = ?` (watermark purge)
4. **Embeddings untouched** — §5.4.1

**Pairing invariant:** a delete removes all three or none. A path may hold a watermark with zero chunk rows (a file with nothing chunkable — headings-only, empty), but a deleted path must retain **nothing**. This closes the resurrection hole: a deleted-then-recreated identical file has no watermark, so the walk rescans it and re-derives rows. A stale watermark surviving a delete would make the walk skip the recreation and serve a hole.

### 5.4.1 Orphaned embeddings are a cache, not a leak

**Ruled: lazy retention.**
- Search joins `chunks → embeddings` on `vh`; an orphaned vector is invisible to every query.
- If identical content reappears, the retained vector is a cache hit — zero embed calls.
- Collection happens wholesale: epoch bump and manual reindex (full wipe).
- No per-delete cost. No orphan-detection query. No correctness impact.

### 5.5 Atomicity

Full reindex runs in **per-file transactions** — chunks, embeddings, watermarks commit together. Interruption is benign: incomplete files have no watermark and get picked up by the next walk.

### 5.6 Intake Lane During Reindex

Events arriving during reindex are **deferred**, not dropped. Buffered per-path triggers; replay is idempotent (watermark check → no-op if unchanged).

### 5.7 Trigram Fallback

Query length < 3 characters:
- 2 chars: `LIKE '%q%'` scan, disclosed `mode: 'scan'` (unranked, arbitrary order, capped)
- 1 char: empty, disclosed reason `"Query too short for trigram (≥2 chars required)"`

API freezes the `mode` field: `Result { hits: Hit[], mode: 'bm25' | 'scan' }`.

---

## 6. Integration Points

### 6.1 Ollama Client Shape (from spike receipt, 2026-11-03, amended 2026-11-04)

The embedder contract is internal to Plugin 1; the frozen API only consumes its output.

```typescript
interface EmbedClient {
  embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null>
}
```

The caller supplies the pre-computed `vh` from the render contract, so the embedder never re-derives it from raw text. The bundled Ollama client POSTs to `localhost:11434/api/embed`:

```javascript
POST /api/embed
{
  model: 'nomic-embed-text:v1.5',
  input: inputs.map(i => i.text),  // batch array — confirmed working from renderer
  keep_alive: '-1m'
}
// Response: { embeddings: [Float32[768]...], model, total_duration }
```

**Dark-safe:** Ollama absent → promise rejects / fetch aborts → returns `null`. Plugin 1 API returns `null + reason`, never throws. The bundled client uses a 30-second `AbortController` timeout. Confirmed by spike: renderer fetch to `localhost:11434` succeeds and returns `dims: 768, ok: true`.

### 6.2 Frozen API Surface (Plugin 1)

```typescript
interface MuninnApi {
  searchText(query: string): { hits: Hit[]; mode: 'bm25' | 'scan' } | null
  searchSemantic(text: string): { hits: Hit[] } | null
  relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null
  tagVocabulary(): { tags: TagInfo[] } | null
  forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult>
}

interface ReindexProgress { phase: 'wipe' | 'walk' | 'embed'; done: number; total: number }
interface ReindexResult { files: number; chunks: number; embedded: number; durationMs: number }
```

Shapes frozen forever. Breaking one = version event. Null + reason pattern for dark-safe. Never throws.

---

## 7. Rulings Incorporated

1. ✅ Schema split (chunks `(path, ord)`, embeddings `vh`)
2. ✅ Governance directory (`Agents/` in the vault; index never vault-resident)
3. ✅ Trigram floor (2-char fallback, 1-char empty)
4. ✅ Clean start (`Muninn` repo, legacy archived)
5. ✅ Ngram exploration unnecessary

Decided in-draft: lazy embedding retention (§5.4.1); `forceReindex` progress callback (§6.2); drop per-row `cp` for meta epoch (§2.4); read-only guard as allowlist (§4.8); delete purges watermark (§5.4).

---

## 8. Build Order

1. **F01 fixture** — authored before `store.ts` exists (this is the red it earns)
2. **`src/store/store.ts`** against this spec
3. **`src/api.ts`** — frozen surface, dark-safe wrappers
4. **`src/intake/lane.ts`** — intake lane
5. Additional fixtures as modules land (rename-without-re-embed, fallback-mode search, reindex atomicity, tag vocabulary, serialize/deserialize round-trip)
6. **Persistence seam in Obsidian** — `Vault.adapter.readBinary`/`writeBinary` wiring into `src/main.ts` using `openStore(..., { load })` and `store.serialize()`
7. **End-to-end Desktop smoke test** — install `main.js` + `manifest.json` in a test vault, verify load, persistence round-trip, manual reindex, and search
8. **Release for testing** — tag and attach build artifacts

---

**Footer:** This spec is the contract for Muninn's index layer. Any deviation requires a ruling, not an implementation decision. Receipts trump recollection; pastes trump ghosts.
