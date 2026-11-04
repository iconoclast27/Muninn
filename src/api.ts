// =============================================================================
// Muninn — Frozen Plugin 1 Public API (spec §6.2)
// src/api.ts
//
// Dark-safe wrappers around the store layer. The shapes here are frozen
// forever for v0.2; breaking one is a version event. Every method returns
// `null + reason` on failure rather than throwing.
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

export interface MuninnApi {
    searchText(query: string): TextSearchResult | null;
    searchSemantic(text: string): Promise<SemanticSearchResult | null>;
    relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null;
    tagVocabulary(): { tags: TagInfo[] } | null;
    forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult | null>;
}

// ---------------------------------------------------------------------------
// Errors → null + reason
// ---------------------------------------------------------------------------

function fail<T>(reason: string): T | null {
    // Surface reason in a structured way without breaking the frozen shape.
    // Callers receive null; diagnostic tools can read the last logged reason.
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
            const queryVh = embedVh(renderEmbedInput('search_query:', [], null, trimmed));
            let queryEmbedding = store.getEmbedding(queryVh);
            if (queryEmbedding === undefined) {
                // Need to embed the query text first.
                const fetched = await embedClient.embed([{ vh: queryVh, text: trimmed }]);
                if (fetched === null) {
                    return fail('embedder failed on query');
                }
                const recs = fetched;
                store.insertEmbeddings(recs);
                queryEmbedding = store.getEmbedding(recs[0]?.vh ?? queryVh);
                if (queryEmbedding === undefined) {
                    return fail('query embedding missing after insert');
                }
            }
            const neighbors = findSemanticNeighbors(store, queryEmbedding.vh, 20);
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
            // Tags live in fm_context, which is not stored per row in the
            // current schema. We cannot reconstruct a tag vocabulary from
            // the database alone. Return empty rather than fake data.
            return { tags: [] };
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
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        aNorm += a[i] * a[i];
        bNorm += b[i] * b[i];
    }
    const denom = Math.sqrt(aNorm) * Math.sqrt(bNorm);
    return denom === 0 ? 0 : dot / denom;
}
