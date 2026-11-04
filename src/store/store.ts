// =============================================================================
// Muninn — Store Skeleton (spec v3)
// src/store/store.ts
//
// Async SQLite WASM store with DDL and stubbed API doors. This module is
// intentionally incomplete: it exists so fixtures can import the Store
// interface and run against a real schema, failing on unimplemented
// behaviour rather than a missing module.
//
// Implementation fills in from the outside in: DDL + pragmas, then
// meta, watermarks, chunks, FTS5, embeddings, rename/delete, and finally
// the read-only query guard.
// =============================================================================

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { Database, BindableValue } from '@sqlite.org/sqlite-wasm';
import { CHUNKER_CP } from '../chunker/chunker.ts';

// ---------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------

export interface ChunkRecord {
    path: string;
    ord: number;
    bs: number;
    be: number;
    vh: string;
    text: string;
    title: string;
}

export interface EmbeddingRecord {
    vh: string;
    vector: Uint8Array;
    dim: number;
    model_tag: string;
    epoch: number;
}

export interface SearchResult {
    vh: string;
    path: string;
    ord: number;
    bs: number;
    be: number;
    title: string;
    text: string;
}

export interface TagInfo {
    tag: string;
    files: number;
    chunks: number;
}

export interface FileWatermark {
    size: number;
    mtime: number;
    content_hash: string;
}

export interface TagRecord {
    vh: string;
    tags: string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReadOnlyDoorViolation extends Error {
    constructor(verb: string) {
        super(`ReadOnlyDoorViolation: ${verb}`);
        this.name = 'ReadOnlyDoorViolation';
    }
}

// ---------------------------------------------------------------------------
// Store interface (frozen per spec §4)
// ---------------------------------------------------------------------------

export interface Store {
    /** Close the underlying database. Idempotent. */
    close(): void;

    // Meta
    getMeta(key: string): string | undefined;
    setMeta(key: string, value: string): void;
    sqliteVersion(): string;

    // Watermarks
    recordFile(path: string, size: number, mtime: number, content_hash: string): void;
    getFile(path: string): FileWatermark | undefined;
    deleteFile(path: string): void;
    clearFiles(): void;

    // Chunks
    insertChunks(records: ChunkRecord[]): number;
    replaceChunksForPath(path: string, records: ChunkRecord[]): number;
    deleteChunksForPath(path: string): { chunks: number; ftsRows: number };
    countChunks(): number;
    renamePath(oldPath: string, newPath: string): number;
    renamePrefix(fromFolder: string, toFolder: string): number;

    // Embeddings
    insertEmbeddings(records: EmbeddingRecord[]): number;
    deleteEmbeddingsForVh(vh: string): void;
    getEmbedding(vh: string): EmbeddingRecord | undefined;
    countEmbeddings(): number;

    // Tags
    insertTags(records: TagRecord[]): number;
    getTags(vh: string): string[] | undefined;
    tagVocabulary(): TagInfo[];

    // FTS5
    searchText(query: string): SearchResult[];
    searchScan(query: string): SearchResult[];
    deleteRowsForPath(path: string): number;

    // Transactions
    transaction<T>(fn: () => T | Promise<T>): Promise<T>;

    // Diagnostic (read-only, allowlisted)
    query<T>(sql: string, ...params: unknown[]): T[];

    // Persistence API doors
    serialize(): Uint8Array;
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

const DDL = `
CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    mtime INTEGER NOT NULL,
    content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    path TEXT NOT NULL,
    ord INTEGER NOT NULL,
    vh TEXT NOT NULL,
    bs INTEGER NOT NULL,
    be INTEGER NOT NULL,
    text TEXT NOT NULL,
    title TEXT NOT NULL,
    PRIMARY KEY (path, ord)
);

CREATE INDEX IF NOT EXISTS idx_chunks_vh ON chunks(vh);

CREATE TABLE IF NOT EXISTS embeddings (
    vh TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    dim INTEGER NOT NULL,
    model_tag TEXT NOT NULL,
    epoch INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    vh TEXT PRIMARY KEY,
    tags TEXT NOT NULL,
    FOREIGN KEY (vh) REFERENCES embeddings(vh)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    text,
    title,
    path UNINDEXED,
    ord UNINDEXED,
    bs UNINDEXED,
    be UNINDEXED,
    vh UNINDEXED,
    tokenize = 'trigram'
);
`;

const META_DEFAULTS: Record<string, string> = {
    schema_version: '3',
    chunker_epoch: String(CHUNKER_CP),
    embedder_epoch: '1',
    embedder_model_tag: 'ollama/nomic-embed-text:v1.5',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function firstSqlKeyword(sql: string): string {
    return sql.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
}

/** Quote an FTS5 token so it is matched literally. */
function escapeFts5Token(token: string): string {
    return `"${token.replace(/"/g, '""')}"`;
}

/** Build a safe FTS5 MATCH expression: tokens are literal, joined with implicit AND. */
function buildFts5Query(query: string): string {
    return query.trim()
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map(escapeFts5Token)
        .join(' ');
}

/** Escape special LIKE wildcard characters and the chosen escape char. */
function escapeLikePattern(raw: string): string {
    return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function ensureReadOnly(sql: string): void {
    const kw = firstSqlKeyword(sql);
    if (kw === '--') {
        throw new ReadOnlyDoorViolation('comment-prefixed statement rejected');
    }
    if (kw !== 'SELECT' && kw !== 'WITH') {
        throw new ReadOnlyDoorViolation(kw);
    }
    // Multi-statement strings can bypass the keyword check (e.g. "SELECT 1; DROP TABLE t").
    // The diagnostic door is single-statement only.
    if (sql.includes(';')) {
        throw new ReadOnlyDoorViolation('semicolon');
    }
}

function runPrepared(db: Database, sql: string, params: BindableValue[] = []): void {
    const s = db.prepare(sql);
    try {
        s.bind(params);
        while (s.step()) { /* consume */ }
    } finally {
        s.finalize();
    }
}

function runPreparedReturnCount(db: Database, sql: string, params: BindableValue[] = []): number {
    const s = db.prepare(sql);
    try {
        s.bind(params);
        while (s.step()) { /* consume */ }
    } finally {
        s.finalize();
    }
    return db.changes();
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

class StoreImpl implements Store {
    db: Database;
    sqlite3: Sqlite3Module;

    constructor(db: Database, sqlite3: Sqlite3Module) {
        this.db = db;
        this.sqlite3 = sqlite3;
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    initPragmas(): void {
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA synchronous = NORMAL');
        this.db.exec('PRAGMA busy_timeout = 5000');
    }

    initSchema(): void {
        this.db.exec(DDL);
        for (const [key, value] of Object.entries(META_DEFAULTS)) {
            runPrepared(this.db,
                'INSERT OR IGNORE INTO meta(key, value) VALUES(?, ?)',
                [key, value],
            );
        }
    }

    close(): void {
        this.db.close();
    }

    // -----------------------------------------------------------------------
    // Meta
    // -----------------------------------------------------------------------

    getMeta(key: string): string | undefined {
        const s = this.db.prepare('SELECT value FROM meta WHERE key = ?');
        s.bind([key]);
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? String(row[0]) : undefined;
    }

    setMeta(key: string, value: string): void {
        runPrepared(this.db, 'INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', [key, value]);
    }

    sqliteVersion(): string {
        return this.getMeta('sqlite_version') ?? 'unknown';
    }

    // -----------------------------------------------------------------------
    // Watermarks
    // -----------------------------------------------------------------------

    recordFile(path: string, size: number, mtime: number, content_hash: string): void {
        runPrepared(this.db,
            'INSERT OR REPLACE INTO files(path, size, mtime, content_hash) VALUES (?, ?, ?, ?)',
            [path, size, mtime, content_hash],
        );
    }

    getFile(path: string): FileWatermark | undefined {
        const s = this.db.prepare('SELECT size, mtime, content_hash FROM files WHERE path = ?');
        s.bind([path]);
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        if (!row) return undefined;
        return {
            size: Number(row[0]),
            mtime: Number(row[1]),
            content_hash: String(row[2]),
        };
    }

    deleteFile(path: string): void {
        runPrepared(this.db, 'DELETE FROM files WHERE path = ?', [path]);
    }

    clearFiles(): void {
        this.db.exec('DELETE FROM files');
    }

    // -----------------------------------------------------------------------
    // Chunks API doors
    // -----------------------------------------------------------------------

    insertChunks(records: ChunkRecord[]): number {
        let inserted = 0;
        const chunkStmt = this.db.prepare(
            'INSERT OR REPLACE INTO chunks(path, ord, vh, bs, be, text, title) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        const ftsStmt = this.db.prepare(
            'INSERT INTO chunk_fts(text, title, path, ord, bs, be, vh) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        try {
            for (const r of records) {
                chunkStmt.bind([r.path, r.ord, r.vh, r.bs, r.be, r.text, r.title]);
                while (chunkStmt.step()) { /* no-op */ }
                chunkStmt.reset();
                chunkStmt.clearBindings();
                ftsStmt.bind([r.text, r.title, r.path, r.ord, r.bs, r.be, r.vh]);
                while (ftsStmt.step()) { /* no-op */ }
                ftsStmt.reset();
                ftsStmt.clearBindings();
                inserted++;
            }
        } finally {
            chunkStmt.finalize();
            ftsStmt.finalize();
        }
        return inserted;
    }

    replaceChunksForPath(path: string, records: ChunkRecord[]): number {
        // Preserve any existing watermark — a rescan of unchanged bytes
        // must not erase the file's observation state.
        const watermark = this.getFile(path);
        this.deleteChunksAndFtsForPath(path);
        const inserted = this.insertChunks(records);
        if (watermark !== undefined) {
            this.recordFile(path, watermark.size, watermark.mtime, watermark.content_hash);
        }
        return inserted;
    }

    deleteChunksForPath(path: string): { chunks: number; ftsRows: number } {
        const result = this.deleteChunksAndFtsForPath(path);
        this.deleteFile(path); // watermark purge — pairing invariant
        return result;
    }

    private deleteChunksAndFtsForPath(path: string): { chunks: number; ftsRows: number } {
        const chunksDeleted = runPreparedReturnCount(this.db, 'DELETE FROM chunks WHERE path = ?', [path]);
        const ftsDeleted = runPreparedReturnCount(this.db, 'DELETE FROM chunk_fts WHERE path = ?', [path]);
        return { chunks: chunksDeleted, ftsRows: ftsDeleted };
    }

    countChunks(): number {
        const s = this.db.prepare('SELECT COUNT(*) FROM chunks');
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? Number(row[0]) : 0;
    }

    renamePath(oldPath: string, newPath: string): number {
        // FTS5 virtual tables with multiple UNINDEXED columns do not reliably
        // support UPDATE on those columns. We rename the real tables, then
        // rebuild the affected FTS rows by delete+reinsert from chunks.
        const chunksMoved = runPreparedReturnCount(this.db,
            'UPDATE chunks SET path = ? WHERE path = ?', [newPath, oldPath]);
        const filesMoved = runPreparedReturnCount(this.db,
            'UPDATE files SET path = ? WHERE path = ?', [newPath, oldPath]);
        const ftsDeleted = runPreparedReturnCount(this.db,
            'DELETE FROM chunk_fts WHERE path = ?', [oldPath]);
        this.insertFtsFromChunks(newPath);
        return chunksMoved + filesMoved + ftsDeleted;
    }

    renamePrefix(fromFolder: string, toFolder: string): number {
        // Boundary match: `Area/` never captures `Area 2/`.
        const oldPrefix = fromFolder.endsWith('/') ? fromFolder : `${fromFolder}/`;
        const newPrefix = toFolder.endsWith('/') ? toFolder : `${toFolder}/`;
        const pattern = `${oldPrefix}%`;

        // Capture the exact old paths that will move.
        const oldPaths = this.query<[string]>(
            'SELECT DISTINCT path FROM chunks WHERE path LIKE ?', pattern,
        ).map((r) => r[0]);

        runPreparedReturnCount(this.db,
            'UPDATE chunks SET path = ? || substr(path, ?) WHERE path LIKE ?',
            [newPrefix, oldPrefix.length + 1, pattern],
        );
        runPreparedReturnCount(this.db,
            'UPDATE files SET path = ? || substr(path, ?) WHERE path LIKE ?',
            [newPrefix, oldPrefix.length + 1, pattern],
        );
        // FTS5 virtual tables do not reliably delete by LIKE on UNINDEXED
        // columns. Delete affected rows by exact path, then rebuild from
        // the updated chunks table.
        for (const oldPath of oldPaths) {
            runPreparedReturnCount(this.db, 'DELETE FROM chunk_fts WHERE path = ?', [oldPath]);
        }
        for (const oldPath of oldPaths) {
            const newPath = newPrefix + oldPath.slice(oldPrefix.length);
            this.insertFtsFromChunks(newPath);
        }
        return oldPaths.length;
    }

    private insertFtsFromChunks(path: string): void {
        const s = this.db.prepare(
            `INSERT INTO chunk_fts(text, title, path, ord, bs, be, vh)
             SELECT text, title, path, ord, bs, be, vh FROM chunks WHERE path = ?`,
        );
        try {
            s.bind([path]);
            while (s.step()) { /* no-op */ }
        } finally {
            s.finalize();
        }
    }

    // -----------------------------------------------------------------------
    // Embeddings API doors
    // -----------------------------------------------------------------------

    insertEmbeddings(records: EmbeddingRecord[]): number {
        let inserted = 0;
        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO embeddings(vh, vector, dim, model_tag, epoch) VALUES (?, ?, ?, ?, ?)',
        );
        try {
            for (const r of records) {
                stmt.bind([r.vh, r.vector, r.dim, r.model_tag, r.epoch]);
                while (stmt.step()) { /* no-op */ }
                stmt.reset();
                stmt.clearBindings();
                inserted++;
            }
        } finally {
            stmt.finalize();
        }
        return inserted;
    }

    deleteEmbeddingsForVh(vh: string): void {
        runPrepared(this.db, 'DELETE FROM embeddings WHERE vh = ?', [vh]);
    }

    getEmbedding(vh: string): EmbeddingRecord | undefined {
        const s = this.db.prepare(
            'SELECT vector, dim, model_tag, epoch FROM embeddings WHERE vh = ?',
        );
        s.bind([vh]);
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        if (!row) return undefined;
        return {
            vh,
            vector: row[0] as Uint8Array,
            dim: Number(row[1]),
            model_tag: String(row[2]),
            epoch: Number(row[3]),
        };
    }

    countEmbeddings(): number {
        const s = this.db.prepare('SELECT COUNT(*) FROM embeddings');
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? Number(row[0]) : 0;
    }

    // -----------------------------------------------------------------------
    // Tags API doors
    // -----------------------------------------------------------------------

    insertTags(records: TagRecord[]): number {
        let inserted = 0;
        const stmt = this.db.prepare(
            'INSERT OR REPLACE INTO tags(vh, tags) VALUES (?, ?)',
        );
        try {
            for (const r of records) {
                const canonical = [...new Set(r.tags)].sort();
                stmt.bind([r.vh, JSON.stringify(canonical)]);
                while (stmt.step()) { /* no-op */ }
                stmt.reset();
                stmt.clearBindings();
                inserted++;
            }
        } finally {
            stmt.finalize();
        }
        return inserted;
    }

    getTags(vh: string): string[] | undefined {
        const s = this.db.prepare('SELECT tags FROM tags WHERE vh = ?');
        s.bind([vh]);
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        if (!row) return undefined;
        try {
            return JSON.parse(String(row[0])) as string[];
        } catch {
            return undefined;
        }
    }

    tagVocabulary(): TagInfo[] {
        const sql = `
            SELECT json_each.value AS tag, COUNT(DISTINCT c.path) AS files, COUNT(*) AS chunks
            FROM chunks c
            JOIN tags t ON c.vh = t.vh
            CROSS JOIN json_each(t.tags)
            GROUP BY json_each.value
            ORDER BY tag
        `;
        const s = this.db.prepare(sql);
        const rows: TagInfo[] = [];
        try {
            while (s.step()) {
                const r = s.get([]);
                rows.push({
                    tag: String(r[0]),
                    files: Number(r[1]),
                    chunks: Number(r[2]),
                });
            }
        } finally {
            s.finalize();
        }
        return rows;
    }

    // -----------------------------------------------------------------------
    // FTS5 API doors
    // -----------------------------------------------------------------------

    searchText(query: string): SearchResult[] {
        if (query.length === 1) {
            return [];
        }
        if (query.length === 2) {
            return this.searchScan(query);
        }
        const safeQuery = buildFts5Query(query);
        if (safeQuery.length === 0) {
            return [];
        }
        const sql = `
            SELECT vh, path, ord, bs, be, title, text
            FROM chunk_fts
            WHERE chunk_fts MATCH ?
            ORDER BY rank
        `;
        const s = this.db.prepare(sql);
        const rows: SearchResult[] = [];
        try {
            s.bind([safeQuery]);
            while (s.step()) {
                const r = s.get([]);
                rows.push({
                    vh: String(r[0]),
                    path: String(r[1]),
                    ord: Number(r[2]),
                    bs: Number(r[3]),
                    be: Number(r[4]),
                    title: String(r[5]),
                    text: String(r[6]),
                });
            }
        } finally {
            s.finalize();
        }
        return rows;
    }

    searchScan(query: string): SearchResult[] {
        const sql = `
            SELECT vh, path, ord, bs, be, title, text
            FROM chunk_fts
            WHERE text LIKE ? ESCAPE '\\'
            LIMIT 100
        `;
        const s = this.db.prepare(sql);
        const rows: SearchResult[] = [];
        try {
            const escaped = escapeLikePattern(query);
            s.bind([`%${escaped}%`]);
            while (s.step()) {
                const r = s.get([]);
                rows.push({
                    vh: String(r[0]),
                    path: String(r[1]),
                    ord: Number(r[2]),
                    bs: Number(r[3]),
                    be: Number(r[4]),
                    title: String(r[5]),
                    text: String(r[6]),
                });
            }
        } finally {
            s.finalize();
        }
        return rows;
    }

    deleteRowsForPath(path: string): number {
        return runPreparedReturnCount(this.db, 'DELETE FROM chunk_fts WHERE path = ?', [path]);
    }

    // -----------------------------------------------------------------------
    // Transactions
    // -----------------------------------------------------------------------

    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
        this.db.exec('BEGIN');
        try {
            const result = await fn();
            this.db.exec('COMMIT');
            return result;
        } catch (e) {
            this.db.exec('ROLLBACK');
            throw e;
        }
    }

    // -----------------------------------------------------------------------
    // Diagnostic read-only door
    // -----------------------------------------------------------------------

    query<T>(sql: string, ...params: BindableValue[]): T[] {
        ensureReadOnly(sql);
        const s = this.db.prepare(sql);
        const rows: T[] = [];
        try {
            if (params.length > 0) s.bind(params);
            while (s.step()) {
                rows.push(s.get([]) as T);
            }
        } finally {
            s.finalize();
        }
        return rows;
    }

    // -----------------------------------------------------------------------
    // Persistence API doors
    // -----------------------------------------------------------------------

    serialize(): Uint8Array {
        if (this.db.pointer === undefined) {
            throw new Error('Store.serialize called on closed database');
        }
        return this.sqlite3.capi.sqlite3_js_db_export(this.db.pointer, 0);
    }
}

// ---------------------------------------------------------------------------
// SQLite WASM module types (kept minimal; the library types are huge)
// ---------------------------------------------------------------------------

type WasmPointer = number;

interface Sqlite3CAPI {
    sqlite3_js_db_export: (db: WasmPointer, schema?: string | WasmPointer) => Uint8Array;
    sqlite3_deserialize: (
        db: WasmPointer,
        schema: string | WasmPointer,
        data: WasmPointer,
        dbSize: number,
        bufferSize: number,
        flags: number,
    ) => number;
    SQLITE_DESERIALIZE_FREEONCLOSE: number;
    SQLITE_DESERIALIZE_RESIZEABLE: number;
}

interface Sqlite3Wasm {
    alloc: (n: number) => WasmPointer;
    heap8u: () => Uint8Array;
    dealloc: (p: WasmPointer) => void;
}

interface Sqlite3Module {
    capi: Sqlite3CAPI;
    wasm: Sqlite3Wasm;
    oo1: {
        DB: new (path: string, flags: string) => Database;
    };
    version: { libVersion: string };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let wasmBytes: Uint8Array | null = null;
let moduleInstance: Sqlite3Module | null = null;

async function getWasmBytes(): Promise<Uint8Array> {
    if (wasmBytes === null) {
        // At build time esbuild's `loader: { ".wasm": "base64" }` turns the
        // .wasm file into a string export. At fixture time in tsx/Node we
        // read the raw bytes directly.
        try {
            const wasmModule: { default: string } = await import('@sqlite.org/sqlite-wasm/sqlite3.wasm' as string);
            wasmBytes = b64ToBytes(wasmModule.default);
        } catch {
            // Node fallback is only valid in a real Node runtime. Obsidian's
            // renderer lacks process.cwd() / fs, so guard it explicitly.
            if (typeof process === 'undefined' || typeof process.cwd !== 'function') {
                throw new Error('sqlite3.wasm base64 load failed and Node fallback is unavailable');
            }
            const { readFileSync } = await import('fs');
            const { resolve } = await import('path');
            const wasmPath = resolve(
                process.cwd(),
                'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
            );
            wasmBytes = readFileSync(wasmPath);
        }
    }
    return wasmBytes;
}

async function getSqlite3Module(): Promise<Sqlite3Module> {
    if (moduleInstance === null) {
        const wasmBinary = await getWasmBytes();
        moduleInstance = await (sqlite3InitModule as unknown as (cfg?: {
            wasmBinary?: Uint8Array;
            locateFile?: () => string;
        }) => Promise<Sqlite3Module>)({
            wasmBinary,
            locateFile: () => 'sqlite3.wasm',
        });
    }
    return moduleInstance;
}

export interface OpenStoreOptions {
    /** Serialized database bytes to load into the new database. */
    load?: Uint8Array;
}

export async function openStore(path: string, opts: OpenStoreOptions = {}): Promise<Store> {
    const sqlite3 = await getSqlite3Module();
    const db = new sqlite3.oo1.DB(path === ':memory:' ? ':memory:' : path, 'c');

    if (opts.load !== undefined && opts.load.length > 0) {
        if (db.pointer === undefined) {
            db.close();
            throw new Error('Database pointer unavailable during deserialize');
        }
        const ptr = sqlite3.wasm.alloc(opts.load.length);
        try {
            sqlite3.wasm.heap8u().set(opts.load, ptr);
            const rc = sqlite3.capi.sqlite3_deserialize(
                db.pointer,
                0,
                ptr,
                opts.load.length,
                opts.load.length,
                sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
            );
            if (rc !== 0) {
                throw new Error(`sqlite3_deserialize failed with code ${rc}`);
            }
        } catch (e) {
            sqlite3.wasm.dealloc(ptr);
            db.close();
            throw e;
        }
    }

    const store = new StoreImpl(db, sqlite3);
    store.initPragmas();
    store.initSchema();
    store.setMeta('sqlite_version', sqlite3.version.libVersion);
    return store;
}

