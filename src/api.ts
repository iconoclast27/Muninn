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

// T58 Stage A (2026-11-26 implementation pass — the docket's row stays OPEN,
// closure is Dan's; this is the authorized code act, the design draft is the
// contract text, not canon). A ranking discloses (adr-37 doctrine): `tie` is
// the honest tail of the cut when it sits inside a tie block — how many
// scored candidates sit at the last returned score, and how many of those
// the cut returned. The door scores the full chunks⋈embeddings join, so the
// counts are exact, not estimated. null when nothing at the cut is tied.
// The field names are the draft's proposal — Dan's to fix at ruling.
export interface TieDisclosure {
    score: number;            // the score the cut sits at
    atScore: number;          // scored candidates sitting at that score
    returnedAtScore: number;  // how many of those the cut returned
}

export interface SemanticSearchResult {
    hits: Hit[];
    tie: TieDisclosure | null;
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
    embedNew: number;   // adr-51.md: vectors THIS run had to create (VH-cache reuse contributes none) — the honest name for the third reading T47 recorded
    durationMs: number;
}

// listNotes — the sixth door (adr-37.md, Accepted 2026-11-18).
export interface ListNotesFilter {
    folder?: string;    // narrowing modifier only (adr-01 conform 2026-11-27; the law lives in docs/decisions/adr-01.md) — vault-relative path prefix (folder boundary, not substring); trailing separators name the same folder
    filename?: string;  // narrowing modifier only (adr-01 conform) — basename substring
    tag?: string;       // exact vocabulary tag, no prefix match
    lexical?: string;   // body words → FTS5 MATCH (unbounded); 2 characters delegate to the scan lane (ADR-25 floor)
    scan?: string;      // body substring → LIKE (row fetch capped at 100 chunk rows; total counts the whole set, ADR-45)
    like?: string;      // semantic → embedded query + capped brute-force kNN
    limit?: number;     // transport cap: rows handed back, optional, per recipe
    offset?: number;    // paging cursor over the same ORDER BY (set lanes; refused on the ranking lane)
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
    mode: 'tag' | 'bm25' | 'scan' | 'semantic';   // narrowed 2026-11-27 per docs/decisions/adr-01.md (Accepted): path-answer lane excised; pointer only, the law lives there
}

export interface MuninnApi {
    searchText(query: string): TextSearchResult | null;
    searchSemantic(text: string): Promise<SemanticSearchResult | null>;
    relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null;
    tagVocabulary(): { tags: TagInfo[] } | null;
    // T58 (2026-11-26), Dan's ruling: manual reindex = FULL re-embed. rebuild
    // rides the frozen door shape as a defaulted trailing option — callers
    // that pass onProgress stay source-compatible; the startup walk stays delta.
    forceReindex(onProgress?: (p: ReindexProgress) => void, rebuild?: boolean): Promise<ReindexResult | null>;
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

// ADR-02 (2026-11-27): the verbose lane trace — one discrete checkpoint line per
// answered door verb on THIS plugin's console log, gated by the factory flag at
// each call site. Refusals stay with the law-bearing fail() warn above. The tap
// never throws into a lane.
function laneTrace(detail: string): void {
    try {
        console.log(`[Muninn lanes] t=${Date.now()} ${detail}`);
    } catch { /* dark-safe: logging never breaks a lane */ }
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
    // Dan's ruling 2026-11-26: manual reindex = FULL re-embed. The door param
    // rides the frozen forceReindex shape as a defaulted trailing option so
    // the existing calls stay source-compatible; startup walk stays delta.
    rebuild?: boolean;
}) => Promise<ReindexResult | null>;

export function createMuninnApi(
    store: Store,
    embedClient: EmbedClient | null,
    reindexer: Reindexer = async () => fail('forceReindex not wired'),
    // T58 A3 (2026-11-26): the semantic band — when the top relatedness of a
    // scored candidate set sits below this margin, the door answers the null
    // channel with reason ('below margin'), the adr-49 precedent, instead of
    // serving a slice of a tie block as if it were related. The factory
    // default null = the CALLER passed no band (the door is inert); the
    // ruled DEFAULT lives in DEFAULT_SETTINGS (Dan's ruling 2026-11-26:
    // absolute floor, 0.5 between the measured classes). Snapshot at
    // construction, like every other door wiring.
    semanticBand: number | null = null,
    // ADR-02 (2026-11-27): verbose lane trace flag; callers that pass nothing stay inert.
    traceOn: boolean = false,
): MuninnApi {
    return {
        searchText(query: string): TextSearchResult | null {
            if (!query || query.trim().length === 0) {
                return fail('empty query');
            }
            const q = query.trim();
            if (q.length === 1) {
                // ADR-49 (2026-11-23, Dan's ruling — "the null with reason
                // option"): sub-floor queries refuse dark-safe, parity with
                // every other invalid input this door refuses. ADR-25's floor
                // survives; the reason moves from inside the payload (the
                // empty disclosed scan set fabricated a truth consumers could
                // count) to the dark-safe channel. See adr-49.md.
                return fail('sub-floor query');
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
            // T58 A4 (2026-11-26): the embed TEXT carries the locked TaskPrefix
            // ('search_query:', render.ts:53 — it was never sent as text before,
            // only inside the vh label), so query-side and document-side inputs
            // speak the same dialect ('search_document:' rides inside
            // renderEmbedInput already).
            const fetched = await embedClient.embed([{
                vh: 'search_query:' + trimmed,
                text: 'search_query:' + trimmed,
            }]);
            if (fetched === null || fetched.length === 0) {
                return fail('embedder failed on query');
            }
            const rec = fetched[0];
            if (rec.vector.length === 0 || rec.dim <= 0) {
                return fail('embedder returned invalid query vector');
            }
            const qv = new Float32Array(rec.vector.buffer, rec.vector.byteOffset, rec.dim);
            const answer = rankSemanticCandidates(store, qv, 20);
            // T58 A3: the band — "nothing related", disclosed as such through
            // the null channel (the UI already renders a null door answer as
            // 'No results.', so the band makes that the door's honest answer).
            // Unconfigured (null) keeps today's surface untouched.
            if (semanticBand !== null && answer.topScore !== null && answer.topScore < semanticBand) {
                return fail('below margin');
            }
            if (traceOn) {
                laneTrace(`semantic answered top=${answer.topScore} hits=${answer.hits.length} ` +
                    `tie=${answer.tie === null ? '-' : `${answer.tie.atScore}|${answer.tie.returnedAtScore}`}`);
            }
            return { hits: answer.hits.map(toHit), tie: answer.tie };
        },

        relatedChunks(path: string, k: number): { neighbors: ChunkRef[] } | null {
            if (!path || path.trim().length === 0) {
                return fail('empty path');
            }
            if (!Number.isFinite(k) || k <= 0) {
                return fail('k must be positive');
            }
            // T58 ruling item 8 (2026-11-26), Dan's (b): the ANCHOR IS THE
            // WHOLE NOTE, so relatedness becomes note-to-note and unifies the
            // two doors' collapse — search ranks chunks and shows the best per
            // path (api.ts:450 seen-set), so relatedChunks must stop answering
            // from one ord-0 vector (the landed shape is non-canon, owed this
            // conform): seeds = EVERY embedded chunk of the anchor note; a
            // candidate scores at its max over the seeds (max-over-seed); and
            // neighbours COLLAPSE PER NOTE — one ChunkRef per path, its best
            // chunk. Self-exclusion is note-wide: the whole anchor note is
            // absent from its own list, not just its ord-0 chunk (the landed
            // door could show a multi-chunk note ITSELF in its own list —
            // measured at HEAD, api.ts:250 filtered only seed path+ord).
            const rows = store.query<[string, number]>(
                'SELECT vh, ord FROM chunks WHERE path = ? ORDER BY ord',
                path,
            );
            if (rows.length === 0) {
                return fail('no chunks for path');
            }
            // Guard (ruled with (b)): a note with NO embedded chunk at all —
            // all chunks declined, or none embedded yet — answers dark-safe
            // with a reason (null-channel precedent, adr-49), not an empty
            // neighbour set, which is a different truth ("nothing related").
            const seeds = store.query<[Uint8Array, number]>(
                'SELECT e.vector, e.dim FROM chunks c JOIN embeddings e ON c.vh = e.vh WHERE c.path = ? ORDER BY c.ord',
                path,
            );
            if (seeds.length === 0) {
                return fail('anchor chunk not embedded');
            }
            const seedVecs = seeds.map((r): Float32Array => {
                const dim = Number(r[1]);
                return new Float32Array((r[0] as Uint8Array).buffer, (r[0] as Uint8Array).byteOffset, dim);
            });
            // One join fetch for the candidate cone — scoring multi-vector
            // happens in JS, NOT by re-joining per seed (a per-seed join would
            // pay the cap scan once per seed chunk: cost, not truth).
            const candidates = store.query<[string, number, number, number, string, string, Uint8Array, number]>(
                'SELECT c.path, c.ord, c.bs, c.be, c.title, c.text, e.vector, e.dim' +
                " FROM chunks c JOIN embeddings e ON c.vh = e.vh WHERE c.path != ? ORDER BY c.path, c.ord LIMIT ?",
                path, SEMANTIC_SEARCH_HARD_CAP,
            );
            // Score each candidate at its max over the seeds, collapse per
            // NOTE (best chunk per path), then total order: score DESC, then
            // adr-37's stable key (path ASC, then the best chunk's ord).
            const best = new Map<string, { ref: ChunkRef; score: number; ord: number }>();
            for (const r of candidates) {
                const candPath = String(r[0]);
                const candOrd = Number(r[1]);
                const dim = Number(r[7]);
                const vec = new Float32Array((r[6] as Uint8Array).buffer, (r[6] as Uint8Array).byteOffset, dim);
                let top: number | null = null;
                for (const sv of seedVecs) {
                    const score = cosineSimilarity(sv, vec);
                    if (top === null || score > top) top = score;
                }
                const seen = best.get(candPath);
                if (seen === undefined || top! > seen.score) {
                    best.set(candPath, {
                        ref: {
                            path: candPath,
                            ord: candOrd,
                            bs: Number(r[2]),
                            be: Number(r[3]),
                            title: String(r[4]),
                            text: String(r[5]),
                        },
                        score: top!,
                        ord: candOrd,
                    });
                }
            }
            const ranked = [...best.values()]
                .sort((a, b) => b.score - a.score || String(a.ref.path).localeCompare(String(b.ref.path)) || a.ord - b.ord)
                .slice(0, k);
            return { neighbors: ranked.map((e) => e.ref) };
        },

        tagVocabulary(): { tags: TagInfo[] } | null {
            return { tags: store.tagVocabulary() };
        },

        // The sixth door (adr-37.md). Set lanes disclose total (the set size
        // counted before limit/offset) and share one stable ORDER BY path ASC;
        // for a lane whose row fetch is internally capped the count comes from
        // store.countScanMatches, not the fetched rows (ADR-45). The like lane
        // returns a ranking — no total, limit is k. Composed from
        // store doors: files for path/mtime, chunks.title (ord = 0) for the
        // header, the chunks.vh -> tags.vh join for tags. Zero-chunk notes
        // appear (watermarks record every walked file).
        async listNotes(filter: ListNotesFilter): Promise<ListNotesResult | null> {
            // A folder selector may be spelled with trailing separators
            // ('Project/HomeLabOps/'): the folder boundary is the prefix without
            // them, so the same folder answers either spelling. A selector of
            // only separators names no folder and fails dark-safe (M-f28 B5/B10).
            let folder = filter.folder;
            if (folder !== undefined) {
                const trimmedFolder = folder.replace(/\/+$/, '');
                if (trimmedFolder.length === 0) {
                    return fail('listNotes: empty folder selector');
                }
                folder = trimmedFolder;
            }
            const filename = filter.filename;
            const tag = filter.tag;
            const lexical = filter.lexical;
            const scan = filter.scan;
            const like = filter.like;
            const limit = filter.limit;
            const offset = filter.offset ?? 0;

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
            // ADR-47: co-occurring lane selectors are refused — one lane
            // selector per query. The refusal sits with the other selector
            // validations, before any lane work: the embedder is never
            // awaited for a refused query and no set is walked. folder and
            // filename are not lane selectors and compose as ruled (adr-37,
            // f27, ADR-46's door-side composition).
            const setSelectorCount =
                (lexical !== undefined ? 1 : 0) + (scan !== undefined ? 1 : 0) + (tag !== undefined ? 1 : 0);
            if (like !== undefined && setSelectorCount > 0) {
                return fail('listNotes: like cannot carry a set selector');
            }
            if (setSelectorCount > 1) {
                return fail('listNotes: set lanes cannot combine');
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
                let mode: 'tag' | 'bm25' | 'scan';
                let matchedPaths: Set<string> | null = null;
                let matchedHeaders: Map<string, string> | null = null;
                // Truth count for a lane whose row fetch is internally capped.
                // The scan lane (and the 2-character lexical delegation, which
                // routes to searchScan) counts the whole matching set through
                // the store's truth door, narrowed by the door's own folder and
                // basename rules, so notes.length against total self-discloses
                // partialness — a capped scan is never served as complete
                // (ADR-37's clause, mechanism ruled by ADR-45). The FTS and set
                // lanes are unbounded, so their rows are the truth.
                let cappedTruth: number | null = null;
                const scanTruth = (selector: string): number =>
                    store.scanMatchingPaths(selector, folder ?? undefined).filter(matchesPath).length;
                if (lexical !== undefined) {
                    // adr-50.md (landed 2026-11-23 under Dan's implementation authorization): mode names the
                    // MECHANISM that answered, not the selector asked. The exactly-2-character lexical selector
                    // delegates to the scan lane (ADR-25 floor, store.ts:632-638 below) and answers 'scan';
                    // adr-49.md (extended to this door 2026-11-23, same ruling): the 1-character selector never
                    // answers at all — it refuses below (guard above the assignment).
                    if (lexical.length === 1) {
                        return fail('sub-floor query');   // one flavor word with the searchText door (:155)
                    }
                    mode = lexical.length === 2 ? 'scan' : 'bm25';
                    matchedHeaders = new Map<string, string>();
                    for (const h of store.searchText(lexical)) {
                        if (!matchedHeaders.has(h.path)) {
                            matchedHeaders.set(h.path, h.title);
                        }
                    }
                    matchedPaths = new Set(matchedHeaders.keys());
                    // store.searchText delegates a 2-character query to
                    // searchScan (store.ts:632-638), inheriting its 100-row cap.
                    if (lexical.length === 2) {
                        cappedTruth = scanTruth(lexical);
                    }
                } else if (scan !== undefined) {
                    mode = 'scan';
                    matchedHeaders = new Map<string, string>();
                    for (const h of store.searchScan(scan)) {
                        if (!matchedHeaders.has(h.path)) {
                            matchedHeaders.set(h.path, h.title);
                        }
                    }
                    matchedPaths = new Set(matchedHeaders.keys());
                    cappedTruth = scanTruth(scan);
                } else if (tag !== undefined) {
                    mode = 'tag';
                    matchedPaths = notePathsForTag(store, tag);
                } else {
                    // Narrowed door 2026-11-27 (docs/decisions/adr-01.md, Accepted): the
                    // path-answer lane of the listNotes frame is excised; folder/filename
                    // survive as narrowing modifiers only (the lane branches above still
                    // compose them). Dark-safe refusal per the door law in adr-10.md.
                    return fail('listNotes: path-answer query excised — path questions answer natively (adr-01)');
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
                // The truth: the whole matching set, counted before any cap —
                // through the store door for a lane whose fetch is internally
                // capped, the row set itself for the unbounded lanes (ADR-45).
                const total = cappedTruth ?? rows.length;
                if (traceOn) {
                    laneTrace(`list answered mode=${mode} total=${total} capped=${cappedTruth !== null} ` +
                        `slice=${offset}|${limit === undefined ? 'rest' : limit}`);
                }
                const end = limit === undefined ? total : offset + limit;
                return {
                    notes: rows.slice(offset, Math.max(offset, end)),
                    total,
                    mode,
                };
            }

            // Ranking lane: the transport says "the closest k", never a set size.
            // `offset` is a cursor over the set lanes' ORDER BY; the ranking has
            // no such order and no total, so a cursor here cannot be honored —
            // it is refused before any embedder cost is paid, not dropped
            // silently (M-f28 B8; executor choice where adr-37 is silent).
            if (offset !== 0) {
                return fail('listNotes: offset is not a ranking cursor');
            }
            if (embedClient === null) {
                return fail('embedder unavailable');
            }
            const trimmed = like.trim();
            // Keep the query vector in local scope only; transient query
            // embeddings must never persist in the store (as searchSemantic).
            // T58 A4 (2026-11-26): this leg carries the same 'search_query:'
            // prefix as text as searchSemantic's does — both query legs speak
            // the document side's dialect.
            const fetched = await embedClient.embed([{
                vh: 'search_query:' + trimmed,
                text: 'search_query:' + trimmed,
            }]);
            if (fetched === null || fetched.length === 0) {
                return fail('embedder failed on listNotes query');
            }
            const rec = fetched[0];
            if (rec.vector.length === 0 || rec.dim <= 0) {
                return fail('embedder returned invalid query vector');
            }
            const qv = new Float32Array(rec.vector.buffer, rec.vector.byteOffset, rec.dim);
            const want = limit ?? 20;
            const ranked = rankSemanticCandidates(store, qv, want * 4).hits;
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
            if (traceOn) {
                laneTrace(`list answered mode=semantic rows=${notes.length}`);
            }
            return { notes, mode: 'semantic' };
        },

        // T58 (2026-11-26), Dan's ruling: manual reindex = FULL re-embed. The
        // param rides the frozen door shape as a defaulted trailing option;
        // callers that pass onProgress stay source-compatible; startup walk
        // stays delta.
        async forceReindex(onProgress?: (p: ReindexProgress) => void, rebuild?: boolean): Promise<ReindexResult | null> {
            return rebuild ? reindexer({ store, embedClient, onProgress, rebuild: true })
                : reindexer({ store, embedClient, onProgress });
        },
    };
}

/** Convenience reindexer backed by an IntakeLane. */
export function laneReindexer(lane: IntakeLane): Reindexer {
    // T58 (2026-11-26): the rebuild param rides THROUGH the adapter — the
    // manual button's rebuild:true must reach the lane, not be swallowed at
    // the door boundary (a swallowed param would make the button a lie).
    return async ({ onProgress, rebuild }) => {
        const r = await lane.forceReindex(onProgress, rebuild ?? false);
        return {
            files: r.files,
            chunks: r.chunks,
            embedNew: r.embedded,   // adr-51.md: lane internals keep their names; the boundary absorbs the door rename
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
    return rankSemanticCandidates(store, qv, k).hits;
}

function rankSemanticCandidates(
    store: Store,
    qv: Float32Array,
    k: number,
): { hits: SearchResult[]; tie: TieDisclosure | null; topScore: number | null } {
    const candidates = store.query<[string, string, number, number, number, string, string, Uint8Array, number]>(
        // T58 A1 (2026-11-26): the join gets a deterministic ORDER BY BEFORE
        // the hard LIMIT — the cap selects rows before any scoring happens,
        // so without ordering a cap-bite at large vaults (the 10 000-row
        // SEMANTIC_SEARCH_HARD_CAP) is nondeterministic. The stable key is
        // adr-37's set-lane precedent (ORDER BY path ASC), extended to chunk
        // rows by ord.
        `SELECT c.path, c.vh, c.ord, c.bs, c.be, c.title, c.text, e.vector, e.dim
         FROM chunks c
         JOIN embeddings e ON c.vh = e.vh
         ORDER BY c.path, c.ord
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
    // T58 A1: total order — score desc, then path asc, then ord asc. The old
    // comparator was stable but not total: byte-identical vectors (the smoke's
    // 19-deep tie blocks) kept SQLite's row order, so the cut inside a tie
    // block was arbitrary. Reproducibility alone buys zero relatedness —
    // honest only when paired with the disclosure below and the band above.
    scored.sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1];
        if (a[0].path !== b[0].path) return a[0].path < b[0].path ? -1 : 1;
        return a[0].ord - b[0].ord;
    });
    const hits = scored.slice(0, k);
    // T58 A2: disclosure of the tail — where the cut sits inside a tie
    // block. Exact counts: the door scores the whole join up to the cap.
    let tie: TieDisclosure | null = null;
    if (hits.length > 0) {
        const cut = hits[hits.length - 1][1];
        let atScore = 0;
        for (const s of scored) {
            if (s[1] === cut) atScore++;
        }
        if (atScore > 1) {
            let returnedAtScore = 0;
            for (const s of hits) {
                if (s[1] === cut) returnedAtScore++;
            }
            tie = { score: cut, atScore, returnedAtScore };
        }
    }
    return {
        hits: hits.map((s) => s[0]),
        tie,
        topScore: scored.length > 0 ? scored[0][1] : null,
    };
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
