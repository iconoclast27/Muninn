// =============================================================================
// Muninn — Frozen Plugin 1 Public API (spec §6.2)
// src/api.ts
//
// Dark-safe wrappers around the store layer. The shapes here are frozen
// forever for v0.2; breaking one is a version event. Frozen 2026-11-06.
// Every method returns `null + reason` on failure rather than throwing.
// =============================================================================

import type { Store, SearchResult, EmbeddingRecord } from './store/store.ts';
import { renderEmbedInput, embedVh } from './chunker/render.ts';
import type { IntakeLane } from './intake/lane.ts';
import type { ReindexProgress as LaneReindexProgress, ReindexResult as LaneReindexResult } from './intake/lane.ts';

// ---------------------------------------------------------------------------
// Frozen public shapes
// ---------------------------------------------------------------------------

export interface Hit {
    path: string;
    ord: number;
    bs: number;
    be: number;
    title: string;
    text: string;
}

export interface TextSearchResult {
    hits: Hit[];
    mode: 'bm25' | 'scan';
}

export interface SemanticSearchResult {
    hits: Hit[];
}

export interface ChunkRef {
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

// listNotes — the sixth door (adr-37.md, Accepted 2026-11-18).
export interface ListNotesFilter {
    folder?: string;    // vault-relative path prefix (folder boundary, not substring)
    filename?: string;  // basename substring
    tag?: string;       // exact vocabulary tag, no prefix match
    lexical?: string;   // body words → FTS5 MATCH
    scan?: string;      // body substring → LIKE
    like?: string;      // semantic → embedded query + capped brute-force kNN
    limit?: number;     // transport cap: rows handed back, optional, per recipe
    offset?: number;    // paging cursor over the same ORDER BY
}

export interface NotesRow {
    path: string;
    filename: string;   // basename, derived from path, never empty
    header: string;     // heading chain ('' when there is none)
    mtime: number;
    tags: string[];
}

export interface ListNotesResult {
    notes: NotesRow[];
    total?: number; // set size counted before limit/offset — absent for the semantic lane
    mode: 'path' | 'tag' | 'bm25' | 'scan' | 'semantic';
}

export interface MuninnApi {
    searchText(query: string): TextSearchResult | null;
    searchSemantic(text: string): Promise<SemanticSearchResult | null>;
    relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null;
    tagVocabulary(): { tags: TagInfo[] } | null;
    forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult | null>;
    listNotes(filter: ListNotesFilter): Promise<ListNotesResult | null>;
}

// ---------------------------------------------------------------------------
// Errors → null + reason
// ---------------------------------------------------------------------------

function fail<T>(reason: string): T | null {
    // Log the reason for diagnostics without breaking the frozen return shape.
    // Callers receive null; the reason is exposed only through the console.
    // eslint-disable-next-line no-console
    console.warn('[Muninn API] dark-safe failure:', reason);
    return null;
}

// ---------------------------------------------------------------------------
// Search result mapping
// ---------------------------------------------------------------------------

function toHit(r: SearchResult): Hit {
    return {
        path: r.path,
        ord: r.ord,
        bs: r.bs,
        be: r.be,
        title: r.title,
        text: r.text,
    };
}

// ---------------------------------------------------------------------------
// API implementation
// ---------------------------------------------------------------------------

export type Reindexer = (opts: {
    store: Store;
    embedClient: EmbedClient | null;
    onProgress?: (p: ReindexProgress) => void;
}) => Promise<ReindexResult | null>;

export function createMuninnApi(
    store: Store,
    embedClient: EmbedClient | null,
    reindexer: Reindexer = async () => fail('forceReindex not wired'),
): MuninnApi {
    return {
        searchText(query: string): TextSearchResult | null {
            if (!query || query.trim().length === 0) {
                return fail('empty query');
            }
            const q = query.trim();
            if (q.length === 1) {
                // Spec §5.7: 1-char query returns empty with reason hidden
                // inside mode. The frozen shape still requires a mode, so
                // we disclose 'scan' with zero hits.
                return { hits: [], mode: 'scan' };
            }
            if (q.length === 2) {
                return { hits: store.searchScan(q).map(toHit), mode: 'scan' };
            }
            return { hits: store.searchText(q).map(toHit), mode: 'bm25' };
        },

        async searchSemantic(text: string): Promise<SemanticSearchResult | null> {
            if (!text || text.trim().length === 0) {
                return fail('empty semantic query');
            }
            if (embedClient === null) {
                return fail('embedder unavailable');
            }
            const trimmed = text.trim();
            // Embed the query text. Keep the resulting vector in local scope
            // only; do not persist transient query embeddings in the store.
            // Persisting them would leak ~3KB per distinct query forever.
            const fetched = await embedClient.embed([{ vh: 'search_query:' + trimmed, text: trimmed }]);
            if (fetched === null || fetched.length === 0) {
                return fail('embedder failed on query');
            }
            const rec = fetched[0];
            if (rec.vector.length === 0 || rec.dim <= 0) {
                return fail('embedder returned invalid query vector');
            }
            const qv = new Float32Array(rec.vector.buffer, rec.vector.byteOffset, rec.dim);
            const neighbors = findSemanticNeighborsByVector(store, qv, 20);
            return { hits: neighbors.map(toHit) };
        },

        relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null {
            if (!path || path.trim().length === 0) {
                return fail('empty path');
            }
            if (!Number.isFinite(k) || k <= 0) {
                return fail('k must be positive');
            }
            const rows = store.query<[string, number]>(
                'SELECT vh, ord FROM chunks WHERE path = ? ORDER BY ord',
                path,
            );
            if (rows.length === 0) {
                return fail('no chunks for path');
            }
            const firstVh = String(rows[0][0]);
            const firstOrd = Number(rows[0][1]);
            const neighbors = findSemanticNeighbors(store, firstVh, k + 1)
                .filter((h) => !(h.path === path && h.ord === firstOrd))
                .slice(0, k)
                .map((h): ChunkRef => ({
                    path: h.path,
                    ord: h.ord,
                    bs: h.bs,
                    be: h.be,
                    title: h.title,
                    text: h.text,
                }));
            return { neighbors };
        },

        tagVocabulary(): { tags: TagInfo[] } | null {
            return { tags: store.tagVocabulary() };
        },

        // The sixth door (adr-37.md). Set lanes disclose total (the set size
        // counted before limit/offset) and share one stable ORDER BY path ASC;
        // the like lane returns a ranking — no total, limit is k. Composed from
        // store doors: files for path/mtime, chunks.title (ord = 0) for the
        // header, the chunks.vh -> tags.vh join for tags. Zero-chunk notes
        // appear (watermarks record every walked file).
        async listNotes(filter: ListNotesFilter): Promise<ListNotesResult | null> {
            const folder = filter.folder;
            const filename = filter.filename;
            const tag = filter.tag;
            const lexical = filter.lexical;
            const scan = filter.scan;
            const like = filter.like;
            const limit = filter.limit;
            const offset = filter.offset ?? 0;

            if (folder !== undefined && folder.length === 0) {
                return fail('listNotes: empty folder selector');
            }
            if (filename !== undefined && filename.length === 0) {
                return fail('listNotes: empty filename selector');
            }
            if (tag !== undefined && tag.length === 0) {
                return fail('listNotes: empty tag selector');
            }
            if (lexical !== undefined && lexical.length === 0) {
                return fail('listNotes: empty lexical selector');
            }
            if (scan !== undefined && scan.length === 0) {
                return fail('listNotes: empty scan selector');
            }
            if (like !== undefined && like.trim().length === 0) {
                return fail('listNotes: empty like selector');
            }
            if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
                return fail('listNotes: limit must be a positive integer');
            }
            if (!Number.isInteger(offset) || offset < 0) {
                return fail('listNotes: offset must be a non-negative integer');
            }

            const matchesPath = (path: string): boolean =>
                (folder === undefined || path === folder || path.startsWith(folder + '/'))
                && (filename === undefined || path.slice(path.lastIndexOf('/') + 1).includes(filename));

            if (like === undefined) {
                let mode: 'path' | 'tag' | 'bm25' | 'scan';
                let matchedPaths: Set<string> | null = null;
                let matchedHeaders: Map<string, string> | null = null;
                if (lexical !== undefined) {
                    mode = 'bm25';
                    matchedHeaders = new Map<string, string>();
                    for (const h of store.searchText(lexical)) {
                        if (!matchedHeaders.has(h.path)) {
                            matchedHeaders.set(h.path, h.title);
                        }
                    }
                    matchedPaths = new Set(matchedHeaders.keys());
                } else if (scan !== undefined) {
                    mode = 'scan';
                    matchedHeaders = new Map<string, string>();
                    for (const h of store.searchScan(scan)) {
                        if (!matchedHeaders.has(h.path)) {
                            matchedHeaders.set(h.path, h.title);
                        }
                    }
                    matchedPaths = new Set(matchedHeaders.keys());
                } else if (tag !== undefined) {
                    mode = 'tag';
                    matchedPaths = notePathsForTag(store, tag);
                } else {
                    mode = 'path';
                }
                const rows = listNoteRows(store, null)
                    .filter((row) => matchesPath(row.path) && (matchedPaths === null || matchedPaths.has(row.path)))
                    .map((row): NotesRow => {
                        if (matchedHeaders === null || !matchedHeaders.has(row.path)) {
                            return row;
                        }
                        // Matched-chunk heading chain for the search lanes.
                        return {
                            path: row.path,
                            filename: row.filename,
                            header: matchedHeaders.get(row.path) as string,
                            mtime: row.mtime,
                            tags: row.tags,
                        };
                    });
                const total = rows.length;
                const end = limit === undefined ? total : offset + limit;
                return {
                    notes: rows.slice(offset, Math.max(offset, end)),
                    total,
                    mode,
                };
            }

            // Ranking lane: the transport says "the closest k", never a set size.
            if (embedClient === null) {
                return fail('embedder unavailable');
            }
            const trimmed = like.trim();
            // Keep the query vector in local scope only; transient query
            // embeddings must never persist in the store (as searchSemantic).
            const fetched = await embedClient.embed([{ vh: 'search_query:' + trimmed, text: trimmed }]);
            if (fetched === null || fetched.length === 0) {
                return fail('embedder failed on listNotes query');
            }
            const rec = fetched[0];
            if (rec.vector.length === 0 || rec.dim <= 0) {
                return fail('embedder returned invalid query vector');
            }
            const qv = new Float32Array(rec.vector.buffer, rec.vector.byteOffset, rec.dim);
            const want = limit ?? 20;
            const ranked = findSemanticNeighborsByVector(store, qv, want * 4);
            const notes: NotesRow[] = [];
            const seen = new Set<string>();
            for (const h of ranked) {
                if (seen.has(h.path) || !matchesPath(h.path)) {
                    continue;
                }
                seen.add(h.path);
                const base = listNoteRows(store, h.path);
                if (base.length === 0) {
                    continue;
                }
                const row = base[0];
                notes.push({
                    path: row.path,
                    filename: row.filename,
                    header: h.title,
                    mtime: row.mtime,
                    tags: row.tags,
                });
                if (notes.length >= want) {
                    break;
                }
            }
            return { notes, mode: 'semantic' };
        },

        async forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult | null> {
            return reindexer({ store, embedClient, onProgress });
        },
    };
}

/** Convenience reindexer backed by an IntakeLane. */
export function laneReindexer(lane: IntakeLane): Reindexer {
    return async ({ onProgress }) => {
        const r = await lane.forceReindex(onProgress);
        return {
            files: r.files,
            chunks: r.chunks,
            embedded: r.embedded,
            durationMs: r.durationMs,
        };
    };
}

// ---------------------------------------------------------------------------
// Embed client abstraction
// ---------------------------------------------------------------------------

export interface EmbedClient {
    /**
     * Embed a batch of chunks. Returns one record per input in the same order,
     * or null on failure. The caller supplies the pre-computed vh so the
     * embedder never re-derives it from the raw text.
     */
    embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


const SEMANTIC_SEARCH_HARD_CAP = 10000;

function findSemanticNeighbors(store: Store, queryVh: string, k: number): SearchResult[] {
    // Without a vector distance operator in SQLite, semantic search is
    // brute-force over embeddings joined to chunks. This is intentionally
    // simple: correctness first, acceleration later (epoch bump if we add
    // an ANN index). A hard cap limits the worst-case CPU/RAM cost in the
    // main thread; larger vaults need an ANN extension.
    const query = store.getEmbedding(queryVh);
    if (query === undefined) {
        return [];
    }
    const qv = new Float32Array(query.vector.buffer, query.vector.byteOffset, query.dim);
    return findSemanticNeighborsByVector(store, qv, k);
}

function findSemanticNeighborsByVector(store: Store, qv: Float32Array, k: number): SearchResult[] {
    const candidates = store.query<[string, string, number, number, number, string, string, Uint8Array, number]>(
        `SELECT c.path, c.vh, c.ord, c.bs, c.be, c.title, c.text, e.vector, e.dim
         FROM chunks c
         JOIN embeddings e ON c.vh = e.vh
         LIMIT ?`,
        SEMANTIC_SEARCH_HARD_CAP,
    );
    const scored = candidates.map((r): [SearchResult, number] => {
        const rec: SearchResult = {
            path: String(r[0]),
            vh: String(r[1]),
            ord: Number(r[2]),
            bs: Number(r[3]),
            be: Number(r[4]),
            title: String(r[5]),
            text: String(r[6]),
        };
        const dim = Number(r[8]);
        const ev = new Float32Array((r[7] as Uint8Array).buffer, (r[7] as Uint8Array).byteOffset, dim);
        return [rec, cosineSimilarity(qv, ev)];
    });
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k).map((s) => s[0]);
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
        return 0;
    }
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        aNorm += a[i] * a[i];
        bNorm += b[i] * b[i];
    }
    const denom = Math.sqrt(aNorm) * Math.sqrt(bNorm);
    return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// listNotes doors (adr-37.md): the enumeration composes store doors only —
// files for path/mtime (every walked file, zero-chunk notes included),
// chunks.title where ord = 0 for the header, the chunks.vh -> tags.vh join
// for tags. ORDER BY path ASC is the single stable order (ADR-37). SQL goes
// through the store's read-only query gateway, the pattern relatedChunks
// already rides (ADR-28).
// ---------------------------------------------------------------------------

function parseTagsColumn(json: unknown): string[] {
    try {
        const parsed = JSON.parse(String(json));
        if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
            return parsed as unknown as string[];
        }
    } catch {
        // fall through
    }
    return [];
}

function listNoteRows(store: Store, pathEq: string | null): NotesRow[] {
    const sql = `
        SELECT f.path, f.mtime,
          COALESCE((SELECT c.title FROM chunks c WHERE c.path = f.path AND c.ord = 0), ''),
          COALESCE((SELECT g.tags FROM chunks c JOIN tags g ON c.vh = g.vh WHERE c.path = f.path LIMIT 1), '[]')
        FROM files f${pathEq === null ? '' : ' WHERE f.path = ?'}
        ORDER BY f.path
    `;
    const rows = pathEq === null
        ? store.query<[string, number, string, string]>(sql)
        : store.query<[string, number, string, string]>(sql, pathEq);
    return rows.map((r): NotesRow => {
        const path = String(r[0]);
        return {
            path,
            filename: path.slice(path.lastIndexOf('/') + 1),
            header: String(r[2]),
            mtime: Number(r[1]),
            tags: parseTagsColumn(r[3]),
        };
    });
}

/** Paths of notes carrying an exact vocabulary tag (no prefix match). */
function notePathsForTag(store: Store, tag: string): Set<string> {
    const rows = store.query<[string]>(
        `SELECT DISTINCT c.path
         FROM chunks c JOIN tags g ON c.vh = g.vh
         CROSS JOIN json_each(g.tags)
         WHERE json_each.value = ?`,
        tag,
    );
    return new Set(rows.map((r) => String(r[0])));
}
