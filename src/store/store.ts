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

export interface FileWatermark {
    size: number;
    mtime: number;
    content_hash: string;
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

    // FTS5
    searchText(query: string): SearchResult[];
    searchScan(query: string): SearchResult[];
    deleteRowsForPath(path: string): number;

    // Transactions
    transaction<T>(fn: () => T): T;

    // Diagnostic (read-only, allowlisted)
    query<T>(sql: string, ...params: unknown[]): T[];
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

function ensureReadOnly(sql: string): void {
    const kw = firstSqlKeyword(sql);
    if (kw === '--') {
        throw new ReadOnlyDoorViolation('comment-prefixed statement rejected');
    }
    if (kw !== 'SELECT' && kw !== 'WITH') {
        throw new ReadOnlyDoorViolation(kw);
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

    constructor(db: Database) {
        this.db = db;
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
            'INSERT INTO chunks(path, ord, vh, bs, be, text, title) VALUES (?, ?, ?, ?, ?, ?, ?)',
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
        const chunksBefore = this.countChunks();
        runPrepared(this.db, 'DELETE FROM chunks WHERE path = ?', [path]);
        const chunksDeleted = chunksBefore - this.countChunks();
        const ftsBefore = this.countFtsRows();
        runPrepared(this.db, 'DELETE FROM chunk_fts WHERE path = ?', [path]);
        const ftsDeleted = ftsBefore - this.countFtsRows();
        return { chunks: chunksDeleted, ftsRows: ftsDeleted };
    }

    countChunks(): number {
        const s = this.db.prepare('SELECT COUNT(*) FROM chunks');
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? Number(row[0]) : 0;
    }

    renamePath(oldPath: string, newPath: string): number {
        let rows = 0;
        rows += runPreparedReturnCount(this.db,
            'UPDATE chunks SET path = ? WHERE path = ?', [newPath, oldPath]);
        rows += runPreparedReturnCount(this.db,
            'UPDATE chunk_fts SET path = ? WHERE path = ?', [newPath, oldPath]);
        rows += runPreparedReturnCount(this.db,
            'UPDATE files SET path = ? WHERE path = ?', [newPath, oldPath]);
        return rows;
    }

    renamePrefix(_fromFolder: string, _toFolder: string): number {
        throw new Error('renamePrefix not implemented');
    }

    // -----------------------------------------------------------------------
    // Embeddings — stubs
    // -----------------------------------------------------------------------

    insertEmbeddings(_records: EmbeddingRecord[]): number {
        throw new Error('insertEmbeddings not implemented');
    }

    deleteEmbeddingsForVh(_vh: string): void {
        throw new Error('deleteEmbeddingsForVh not implemented');
    }

    getEmbedding(_vh: string): EmbeddingRecord | undefined {
        throw new Error('getEmbedding not implemented');
    }

    countEmbeddings(): number {
        const s = this.db.prepare('SELECT COUNT(*) FROM embeddings');
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? Number(row[0]) : 0;
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
        const sql = `
            SELECT vh, path, ord, bs, be, title, text
            FROM chunk_fts
            WHERE chunk_fts MATCH ?
            ORDER BY rank
        `;
        const s = this.db.prepare(sql);
        const rows: SearchResult[] = [];
        try {
            s.bind([query]);
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
            WHERE text LIKE ?
            LIMIT 100
        `;
        const s = this.db.prepare(sql);
        const rows: SearchResult[] = [];
        try {
            s.bind([`%${query}%`]);
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
        const before = this.countFtsRows();
        runPrepared(this.db, 'DELETE FROM chunk_fts WHERE path = ?', [path]);
        return before - this.countFtsRows();
    }

    private countFtsRows(): number {
        const s = this.db.prepare('SELECT COUNT(*) FROM chunk_fts');
        const row = s.step() ? s.get([]) : null;
        s.finalize();
        return row ? Number(row[0]) : 0;
    }

    // -----------------------------------------------------------------------
    // Transactions
    // -----------------------------------------------------------------------

    transaction<T>(fn: () => T): T {
        this.db.exec('BEGIN');
        try {
            const result = fn();
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
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let wasmBytes: Uint8Array | null = null;

async function getWasmBytes(): Promise<Uint8Array> {
    if (wasmBytes === null) {
        // At build time esbuild's `loader: { ".wasm": "base64" }` turns the
        // .wasm file into a string export. At fixture time in tsx/Node we
        // read the raw bytes directly.
        try {
            const wasmModule: { default: string } = await import('@sqlite.org/sqlite-wasm/sqlite3.wasm' as string);
            wasmBytes = b64ToBytes(wasmModule.default);
        } catch {
            const { readFileSync } = await import('node:fs');
            const { resolve } = await import('node:path');
            const wasmPath = resolve(
                process.cwd(),
                'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
            );
            wasmBytes = readFileSync(wasmPath);
        }
    }
    return wasmBytes;
}

export async function openStore(path: string): Promise<Store> {
    const wasmBinary = await getWasmBytes();
    const sqlite3 = await (sqlite3InitModule as unknown as (cfg?: { wasmBinary?: Uint8Array; locateFile?: () => string }) => Promise<{ oo1: { DB: new (path: string, flags: string) => Database }; version: { libVersion: string } }>)({
        wasmBinary,
        locateFile: () => 'sqlite3.wasm',
    });
    const db = new sqlite3.oo1.DB(path === ':memory:' ? ':memory:' : path, 'c');
    const store = new StoreImpl(db);
    store.initPragmas();
    store.initSchema();
    store.setMeta('sqlite_version', sqlite3.version.libVersion);
    return store;
}
