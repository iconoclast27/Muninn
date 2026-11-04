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

import { chunkNote, CHUNKER_CP } from '../chunker/chunker.ts';
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

    private pending = new Map<string, PathState>();
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
        // If the new path itself has pending operations, fold them so a
        // delete-after-rename sequence resolves against the final path.
        const destPending = this.pending.get(newPath);
        if (destPending) {
            // The logical outcome for oldPath now depends on whatever is
            // queued for newPath. Delete dominates; touch is a no-op because
            // the rename already moved the rows.
            if (destPending.kind === 'delete') {
                this.pending.delete(newPath);
                this.pending.set(oldPath, { kind: 'delete' });
                return;
            }
            // Any touch/destination rename becomes a rename of oldPath to the
            // same newPath (idempotent).
        }
        this.schedule(oldPath, { kind: 'rename', newPath });
    }

    private schedule(path: string, op: IntakeOp): void {
        if (this.stopped) return;
        // Fold the new event into the existing pending state for this path.
        const existing = this.pending.get(path);
        if (existing) {
            this.pending.set(path, foldState(existing, op));
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
            // Read all current paths.
            const paths = await this.source.listFiles();
            const currentPaths = new Set(paths);

            // Wipe index state for anything no longer in the source.
            // Embeddings stay as a lazy cache per spec §5.4.1.
            const stalePaths = this.store.query<[string]>('SELECT DISTINCT path FROM chunks')
                .map((r) => r[0])
                .filter((p) => !currentPaths.has(p));
            await this.store.transaction(async () => {
                for (const path of stalePaths) {
                    this.store.deleteChunksForPath(path);
                }
                this.store.clearFiles();
            });

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
                    onProgress({ phase: 'embed', done: walked, total: paths.length });
                }
            }
            if (onProgress) {
                onProgress({ phase: 'embed', done: paths.length, total: paths.length });
            }
            this.store.setMeta('chunker_epoch', String(this.chunkerCp));
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

    private applyOp(path: string, op: PathState): void {
        switch (op.kind) {
            case 'touch':
                this.ingestTouch(path).catch((e: unknown) => {
                    // eslint-disable-next-line no-console
                    console.error(`[Muninn] intake error for ${path}:`, e);
                });
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
        const storedCp = Number(this.store.getMeta('chunker_epoch') ?? String(CHUNKER_CP));
        const chunkerStale = this.chunkerCp !== storedCp;
        const watermark = this.store.getFile(path);
        const contentHash = contentSha(entry.bytes);
        if (!chunkerStale &&
            watermark !== undefined &&
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
        await this.store.transaction(() => {
            this.store.replaceChunksForPath(path, records);
            this.store.recordFile(path, entry.bytes.length, entry.mtime, contentSha(entry.bytes));
        });
        return { chunks: records.length, embedded };
    }

    private async embedMissing(missing: Array<{ vh: string; text: string }>): Promise<number> {
        if (missing.length === 0 || this.embedClient === null) return 0;
        let embedded = 0;
        for (const batch of chunk(missing, 8)) {
            const fetched = await this.embedClient.embed(batch);
            if (fetched === null) continue;
            const valid = fetched.filter((r) => this.isValidEmbedding(r));
            this.store.insertEmbeddings(valid);
            embedded += valid.length;
        }
        return embedded;
    }

    private isValidEmbedding(r: EmbeddingRecord): boolean {
        return r.dim === this.expectedDim()
            && r.model_tag === this.modelTag
            && r.epoch === this.epoch
            && r.vh.length > 0
            && r.vector.length > 0;
    }

    private expectedDim(): number {
        const metaDim = this.store.getMeta('embedder_dim');
        if (metaDim !== undefined) return Number(metaDim);
        // Default for the bundled model tag.
        return 768;
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

type PathState =
    | { kind: 'touch' }
    | { kind: 'delete' }
    | { kind: 'rename'; newPath: string };

/** External event arriving from Obsidian. Same shape as PathState but kept
 *  distinct to make the fold direction obvious. */
type IntakeOp = PathState;

function foldState(oldState: PathState, event: IntakeOp): PathState {
    // The map key is always the path the event was reported against.
    // We model the logical outcome for that original path.
    if (event.kind === 'delete') return { kind: 'delete' };
    if (event.kind === 'rename') {
        // A rename of a path currently targeted at `newPath` means the
        // logical destination becomes the new rename target.
        if (oldState.kind === 'rename') return { kind: 'rename', newPath: event.newPath };
        return { kind: 'rename', newPath: event.newPath };
    }
    // Touch on top of anything: keep the current logical state.
    return oldState;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}
