// =============================================================================
// Muninn — Intake / Reconcile Lane
// src/intake/lane.ts
//
// Owns the vault-to-store pipeline: read files, compare watermarks,
// re-chunk changed files, embed new vectors, and apply deletes/renames.
// Designed to run inside Obsidian's event bus or a fake filesystem in tests.
// All filesystem access is abstracted behind FileSource so fixtures can
// drive it without Obsidian APIs.
// =============================================================================

import { chunkNote } from '../chunker/chunker.ts';
import { contentSha, renderEmbedInput, embedVh } from '../chunker/render.ts';
import type {
    Store,
    ChunkRecord,
    EmbeddingRecord,
    FileWatermark,
} from '../store/store.ts';
import type { EmbedClient } from '../api.ts';

// ---------------------------------------------------------------------------
// File source abstraction
// ---------------------------------------------------------------------------

export interface FileEntry {
    path: string;
    bytes: Uint8Array;
    mtime: number;
}

export interface FileSource {
    /** Enumerate all markdown file paths in the vault. */
    listFiles(): Promise<string[]>;
    /** Read a single file by path. Returns null if the file is gone. */
    readFile(path: string): Promise<FileEntry | null>;
}

// ---------------------------------------------------------------------------
// Reindex progress
// ---------------------------------------------------------------------------

export interface ReindexProgress {
    phase: 'wipe' | 'walk' | 'embed';
    done: number;
    total: number;
}

export interface ReindexResult {
    files: number;
    chunks: number;
    embedded: number;
    durationMs: number;
}

// ---------------------------------------------------------------------------
// Intake lane
// ---------------------------------------------------------------------------

export class IntakeLane {
    private store: Store;
    private source: FileSource;
    private embedClient: EmbedClient | null;
    private modelTag: string;
    private epoch: number;
    private chunkerCp: number;

    private pending = new Map<string, IntakeOp>();
    private reindexing = false;
    private stopped = false;

    constructor(opts: {
        store: Store;
        source: FileSource;
        embedClient: EmbedClient | null;
        modelTag: string;
        epoch: number;
        chunkerCp: number;
    }) {
        this.store = opts.store;
        this.source = opts.source;
        this.embedClient = opts.embedClient;
        this.modelTag = opts.modelTag;
        this.epoch = opts.epoch;
        this.chunkerCp = opts.chunkerCp;
    }

    // -----------------------------------------------------------------------
    // Event-driven API
    // -----------------------------------------------------------------------

    onCreate(path: string): void {
        this.schedule(path, { kind: 'touch' });
    }

    onModify(path: string): void {
        this.schedule(path, { kind: 'touch' });
    }

    onDelete(path: string): void {
        this.schedule(path, { kind: 'delete' });
    }

    onRename(oldPath: string, newPath: string): void {
        this.schedule(oldPath, { kind: 'rename', newPath });
    }

    private schedule(path: string, op: IntakeOp): void {
        if (this.stopped) return;
        // Merge with an existing pending op for the same path.
        const existing = this.pending.get(path);
        if (existing) {
            this.pending.set(path, mergeOps(existing, op));
        } else {
            this.pending.set(path, op);
        }
        if (!this.reindexing) {
            // Drain the buffer on the next microtask.
            queueMicrotask(() => this.drain());
        }
    }

    /** Drain buffered events idempotently. Called automatically or manually. */
    drain(): void {
        if (this.stopped || this.reindexing) return;
        while (this.pending.size > 0) {
            const [path, op] = this.pending.entries().next().value as [string, IntakeOp];
            this.pending.delete(path);
            this.applyOp(path, op);
        }
    }

    // -----------------------------------------------------------------------
    // Full reindex
    // -----------------------------------------------------------------------

    async forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult> {
        const start = performance.now();
        this.reindexing = true;
        try {
            // Wipe index state (embeddings stay as lazy cache).
            this.store.transaction(() => {
                this.store.clearFiles();
                this.store.query('SELECT path FROM chunks');
            });
            // Read all current paths.
            const paths = await this.source.listFiles();
            let walked = 0;
            let totalChunks = 0;
            let totalEmbedded = 0;
            if (onProgress) {
                onProgress({ phase: 'wipe', done: 0, total: paths.length });
            }
            for (const path of paths) {
                const entry = await this.source.readFile(path);
                if (entry === null) continue;
                const { chunks, embedded } = await this.ingest(path, entry);
                walked++;
                totalChunks += chunks;
                totalEmbedded += embedded;
                if (onProgress) {
                    onProgress({ phase: 'walk', done: walked, total: paths.length });
                }
            }
            if (onProgress) {
                onProgress({ phase: 'embed', done: totalEmbedded, total: totalEmbedded });
            }
            return {
                files: walked,
                chunks: totalChunks,
                embedded: totalEmbedded,
                durationMs: Math.round(performance.now() - start),
            };
        } finally {
            this.reindexing = false;
            // Replay anything that arrived during reindex.
            this.drain();
        }
    }

    // -----------------------------------------------------------------------
    // Per-path ingestion
    // -----------------------------------------------------------------------

    stop(): void {
        this.stopped = true;
        this.pending.clear();
    }

    private applyOp(path: string, op: IntakeOp): void {
        switch (op.kind) {
            case 'touch':
                this.ingestTouch(path).catch(() => { /* dark-safe: ignore */ });
                break;
            case 'delete':
                this.store.deleteChunksForPath(path);
                break;
            case 'rename':
                this.store.renamePath(path, op.newPath);
                break;
        }
    }

    private async ingestTouch(path: string): Promise<void> {
        const entry = await this.source.readFile(path);
        if (entry === null) {
            this.store.deleteChunksForPath(path);
            return;
        }
        const watermark = this.store.getFile(path);
        const contentHash = contentSha(entry.bytes);
        if (watermark !== undefined &&
            watermark.size === entry.bytes.length &&
            watermark.mtime === entry.mtime &&
            watermark.content_hash === contentHash) {
            // Unchanged per watermark; no work.
            return;
        }
        await this.ingest(path, entry);
    }

    private async ingest(path: string, entry: FileEntry): Promise<{ chunks: number; embedded: number }> {
        const result = chunkNote(entry.bytes);
        const records: ChunkRecord[] = result.chunks.map((c, i) => {
            const text = Buffer.from(entry.bytes.subarray(c.bs, c.be)).toString('utf-8');
            return {
                path,
                ord: i,
                bs: c.bs,
                be: c.be,
                vh: c.vh,
                text,
                title: c.chain.join(' > '),
            };
        });
        const missingVhs = this.findMissingEmbeddings(records);
        const embedded = await this.embedMissing(missingVhs);
        this.store.transaction(() => {
            this.store.replaceChunksForPath(path, records);
            this.store.recordFile(path, entry.bytes.length, entry.mtime, contentSha(entry.bytes));
        });
        return { chunks: records.length, embedded };
    }

    private async embedMissing(missing: Array<{ vh: string; text: string }>): Promise<number> {
        if (missing.length === 0 || this.embedClient === null) return 0;
        let embedded = 0;
        for (const batch of chunk(missing, 8)) {
            const texts = batch.map((m) => m.text);
            const fetched = await this.embedClient.embed(texts);
            if (fetched === null) continue;
            const recs = Array.isArray(fetched) ? fetched : [fetched];
            this.store.insertEmbeddings(recs);
            embedded += recs.length;
        }
        return embedded;
    }

    private findMissingEmbeddings(records: ChunkRecord[]): Array<{ vh: string; text: string }> {
        const missing: Array<{ vh: string; text: string }> = [];
        const seen = new Set<string>();
        for (const r of records) {
            if (seen.has(r.vh)) continue;
            seen.add(r.vh);
            if (this.store.getEmbedding(r.vh) === undefined) {
                missing.push({ vh: r.vh, text: r.text });
            }
        }
        return missing;
    }
}

type IntakeOp =
    | { kind: 'touch' }
    | { kind: 'delete' }
    | { kind: 'rename'; newPath: string };

function mergeOps(oldOp: IntakeOp, newOp: IntakeOp): IntakeOp {
    // A delete after any op is a delete of the original path.
    if (newOp.kind === 'delete') return newOp;
    // A rename after a touch is a rename of the original path.
    if (newOp.kind === 'rename') return newOp;
    // Touch dominates touch / delete dominates touch handled above.
    return { kind: 'touch' };
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}
