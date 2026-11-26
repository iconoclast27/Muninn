// =============================================================================
// Muninn — F33: the (b) whole-note anchor (separating legs) + the epoch-stamp
// consumption (lane seam) — T58 Stage B fixture arc
// src/fixtures/f33.ts
//
// CONTRACT (not observed behavior — ADR-10): docs/T58 Implementation Design
// (draft - not canon).md, amended in place by Dan's rulings 2026-11-26:
//   item 8, anchor shape (b): the ANCHOR IS THE WHOLE NOTE — seeds = EVERY
//     embedded chunk of the anchor; a candidate scores at its MAX OVER SEEDS;
//     neighbours COLLAPSE PER NOTE (one ChunkRef per path, its best chunk);
//     self-exclusion is NOTE-WIDE (the whole anchor note absent from its own
//     list); the guard refuses a note with NO embedded chunk at all (reason
//     'anchor chunk not embedded'), never an empty neighbour set.
//   B4, embedder epoch: the store's `embedder_model_tag` stamp (seeded honest
//     default at store.ts:196, measured ZERO readers before the bump) is
//     CONSUMED: the epoch pass fires on either staleness fact — chunker-cp
//     disagreement OR stored tag ≠ modelTag(settings) — and the lane RESTAMPS
//     the tag on every pass; orphan embeddings rows (vh under no chunk — 605
//     rode export/import at the smoke vault) are evicted on the epoch pass
//     ONLY; the startup/walk delta face stays delta: unchanged text keeps its
//     vector (the manual FULL rebuild is the healing face, Dan's ruling
//     "manual reindex = full reindex, WITH embeddings").
//
// REDS earned against the pre-T58 committed HEAD d704d59 (git-archive scratch
// copy of HEAD's src — cp 2 in the product code — with this fixture placed
// onto it; receipt /tmp/opencode/t58-f33-red.log, 8 FAIL, exit 1):
//   R  B1 middle-only relation — HEAD seeds ONLY the anchor's ord-0 vh; the
//       corpus leaves that chunk unembedded, so HEAD's join is empty
//       (measured detail []) and the candidate's only-embedded middle chunk
//       never rides → RED. Landed: seeds = every embedded chunk → rides.
//   R  B2 per-note collapse    — same empty seed join at HEAD (dup absent);
//       landed must answer exactly ONE entry at dup's BEST chunk (ord 1,
//       dim 3; the ord-0 dim-4 vector scores 0 under max-over-seed).
//   R  S1 total order at tie   — HEAD answers the empty list; landed ranks
//       both 1.0 neighbours, path ASC, capped at k.
//   R  B4 hollow refusal       — HEAD answers {"neighbors":[]} for a note of
//       two chunk rows, zero embedded (measured detail); the null-channel
//       refusal for zero-embedded anchors is NEW law → RED at HEAD, GREEN
//       landed. It separates under the SEED contract, so it earns rather
//       than guards.
//   R  E1-run1 tag restamp     — HEAD never writes embedder_model_tag (measured
//       zero mentions in HEAD's lane.ts) → meta stays the seeded default →
//       RED; the landed lane restamps every pass.
//   R  E1a orphan eviction     — HEAD's epoch fires on cp disagreement ONLY;
//       the walk here is fresh-tag-only staleness, so HEAD keeps the planted
//       orphan row (measured 2 vs 1) → RED.
//   R  E1b stamp CONSUMED      — the seeded default tag is read by nobody at
//       HEAD (measured); landed compares stored tag ≠ modelTag(settings) and
//       flips meta to the lane's tag → GREEN landed, RED at HEAD.
//   R  E3 FULL-rebuild face    — the trailing rebuild param does not exist at
//       HEAD; the call rides through a structural indirection so it COMPILES
//       at both sides (receiver kept via .call), and at HEAD the extra arg is
//       simply ignored: no wipe, no re-embed (measured embedded=0, count=2,
//       chunks=1) → RED. Landed: wipe-before-walk, orphan gone by
//       construction, every chunk re-embedded from source.
// FIRST-GREEN guards, justified:
//   G  B3 note-wide self-exclusion — vacuous at HEAD (empty neighbour list);
//       landed must keep the anchor's own embedded ord-2 chunk (dim 3,
//       cosine 1.0 against its own seed) OUT of the list. The leg holds
//       under both readings; separation is carried by B1/B2/S1/B4 above.
//   G  E1c delta stays delta — embedNew 0 on the tag-face walk: unchanged
//       text keeps its vector under BOTH the standing and the epoch face
//       (the epoch face evicts and restamps; it does not manufacture a
//       re-embed — healing is the rebuild face). Named, not hidden.
//   G  E1d rows keep their OWN model_tag after the delta epoch — the mixed-
//       dialect state delta leaves is named; only the rebuild leg E3 rewrites
//       rows. True at HEAD and landed alike.
//   G  E2 no manufactured epoch — seeded honest default (store.ts:196 META) +
//       default-tag lane fires nothing: planted orphans SURVIVE the delta
//       walk, embedNew 0 on the unchanged re-walk. The seed exists precisely
//       so a fresh/unchanged store never manufactures a re-embed — true at
//       both sides by the same construction.
//
// Corpus (door seam, seeded through the store's record API — the lane is not
// exercised there; lane seam below uses a fake FileSource per f17's
// precedent). Frozen shapes: relatedChunks answers { neighbors: ChunkRef[] }
// (f04 A7) and ChunkRef is the frozen quintet (path, ord, bs, be, title,
// text); assertions enter through the public door only (ADR-7).
//
// Run: npx tsx src/fixtures/f33.ts
// =============================================================================

import { openStore, type Store, type ChunkRecord, type EmbeddingRecord } from '../store/store.ts';
import { createMuninnApi, type Reindexer } from '../api.ts';
import { IntakeLane, type FileSource, type FileEntry, type ReindexResult } from '../intake/lane.ts';
import { CHUNKER_CP } from '../chunker/chunker.ts';
import { DEFAULT_SETTINGS } from '../settings.ts';

const DIM = 768;

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function oneHot(dim: number): Uint8Array {
    const floats = new Float32Array(DIM);
    floats[dim] = 1;
    return new Uint8Array(floats.buffer);
}

// ---------------------------------------------------------------------------
// Door corpus: (b) separating geometry
// ---------------------------------------------------------------------------

function chunkRec(path: string, ord: number, text: string, vh: string): ChunkRecord {
    return {
        path,
        ord,
        bs: 0,
        be: text.length,
        vh,
        text,
        title: path.replace(/[^a-z]+/g, ' ').trim(),
    };
}

function makeEmbedding(vh: string, dim: number, tag: string): EmbeddingRecord {
    return { vh, vector: oneHot(dim), dim: DIM, model_tag: tag, epoch: 1 };
}

const DOOR_TAG = 'ollama/nomic-embed-text:v1.5';

async function doorSection(asyncApi: boolean): Promise<void> {
    void asyncApi;
    console.log('[F33] door — (b) whole-note anchor separating legs');

    const store: Store = await openStore(':memory:');
    store.insertChunks([
        // anchor: ord-0 NOT embedded (a declined/unembedded opening), ord-1
        // and ord-2 embedded (dim 3). Middle-only seeds must fire.
        chunkRec('notes/anchor.md', 0, 'anchor opening stanza, no vector.', '000000000000a000'),
        chunkRec('notes/anchor.md', 1, 'anchor middle stanza about widgets.', '000000000000a001'),
        chunkRec('notes/anchor.md', 2, 'anchor closing stanza about widgets.', '000000000000a002'),
        // candidate: its ONLY embedded chunk is a middle one — the relation
        // (b) must carry that ord-0-only reading would miss.
        chunkRec('notes/mid.md', 0, 'mid opening stanza, no vector here.', '000000000000b000'),
        chunkRec('notes/mid.md', 1, 'mid only embedded stanza about widgets.', '000000000000b001'),
        // dup: TWO embedded chunks; per-note collapse keeps only the best
        // (ord 1 at dim 3; ord 0 at dim 4 scores 0 against the dim-3 seeds).
        chunkRec('notes/dup.md', 0, 'dup opening part, poor match.', '000000000000c000'),
        chunkRec('notes/dup.md', 1, 'dup best part about widgets.', '000000000000c001'),
        // hollow: two chunk rows, zero embedded — the guard refuses.
        chunkRec('notes/hollow.md', 0, 'hollow first half, no vectors.', '000000000000d000'),
        chunkRec('notes/hollow.md', 1, 'hollow second half, none either.', '000000000000d001'),
    ]);
    store.insertEmbeddings([
        makeEmbedding('000000000000a001', 3, DOOR_TAG),
        makeEmbedding('000000000000a002', 3, DOOR_TAG),
        makeEmbedding('000000000000b001', 3, DOOR_TAG),
        makeEmbedding('000000000000c000', 4, DOOR_TAG),
        makeEmbedding('000000000000c001', 3, DOOR_TAG),
    ]);

    const noopReindexer: Reindexer = (opts) => Promise.resolve(null);
    void noopReindexer;
    const api = createMuninnApi(store, null, noopReindexer);

    const r = api.relatedChunks('notes/anchor.md', 4);

    check('B1 middle-only relation: the anchor answers neighbours from its embedded middle chunks (b)',
        r !== null && r.neighbors.some((n) => n.path === 'notes/mid.md'),
        JSON.stringify(r === null ? null : r.neighbors.map((n) => n.path)));

    check('B2 per-note collapse: dup rides EXACTLY ONCE, at its best chunk (ord 1)',
        r !== null && r.neighbors.filter((n) => n.path === 'notes/dup.md').length === 1 &&
        r.neighbors.find((n) => n.path === 'notes/dup.md')?.ord === 1,
        JSON.stringify(r === null ? null : r.neighbors.filter((n) => n.path === 'notes/dup.md').map((n) => n.ord)));

    check('B3 note-wide self-exclusion: the anchor note is absent from its own list (no path hits)',
        r !== null && r.neighbors.every((n) => n.path !== 'notes/anchor.md'),
        JSON.stringify(r === null ? null : r.neighbors.map((n) => n.path)));

    check('S1 neighbours total order at tie 1.0: path ASC (dup, mid) and the door caps at k',
        r !== null && r.neighbors.length === 2 &&
        r.neighbors[0].path === 'notes/dup.md' && r.neighbors[1].path === 'notes/mid.md',
        JSON.stringify(r === null ? null : r.neighbors.map((n) => `${n.path}:${n.ord}`)));

    const hollow = api.relatedChunks('notes/hollow.md', 2);
    check('G-B4 hollow note (two rows, zero embedded) answers the null channel, never { neighbors: [] }',
        hollow === null,
        JSON.stringify(hollow));
}

// ---------------------------------------------------------------------------
// Lane corpus: epoch-stamp consumption at the lane seam
// ---------------------------------------------------------------------------

class FakeSource implements FileSource {
    files = new Map<string, string>();
    mtime = 1000;
    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }
    async readFile(path: string): Promise<FileEntry | null> {
        const text = this.files.get(path);
        if (text === undefined) return null;
        return { path, bytes: new TextEncoder().encode(text), mtime: this.mtime };
    }
}

class LaneEmbedClient {
    calls: number[][] = [];
    async embed(inputs: { vh: string; text: string }[], tag: string, epoch: number): Promise<EmbeddingRecord[] | null> {
        void tag;
        void epoch;
        this.calls.push([inputs.length]);
        // Echo the lane's tag/epoch back (isValidEmbedding, lane.ts:477 at
        // HEAD, refuses a mismatched record — f13/f16's client precedent).
        return inputs.map((i) => ({
            vh: i.vh,
            vector: oneHot(7),
            dim: DIM,
            model_tag: tag,
            epoch,
        }));
    }
}

function makeLane(tag: string, epoch: number): { client: LaneEmbedClient; make: (store: Store, source: FakeSource) => IntakeLane } {
    const client = new LaneEmbedClient();
    const make = (store: Store, source: FakeSource) =>
        new IntakeLane({
            store,
            source,
            embedClient: { embed: (inputs) => client.embed(inputs, tag, epoch) },
            modelTag: tag,
            epoch,
            chunkerCp: CHUNKER_CP,
            debounceMs: 0,
        });
    return { client, make };
}

async function laneSection(): Promise<void> {
    console.log('[F33] lane — epoch-stamp consumption (tag face) + FULL-rebuild face');

    const DEFAULT_TAG = `ollama/${DEFAULT_SETTINGS.ollamaModel}`;
    const ALPHA = 'ollama/alpha-embed:v1';
    const BETA = 'ollama/beta-embed:v2';
    const store: Store = await openStore(':memory:');
    const source = new FakeSource();
    source.files.set('notes/alpha.md', 'Alpha alpha alpha paragraph content.\n\nSecond alpha paragraph about things.');

    // E1 setup: a first pass on a DIFFERENT tag stamps the store (the
    // seeded-default disagreement fires the epoch on this pass — legitimate
    // for setup; the consumed face below is what E1 asserts).
    const a = makeLane(ALPHA, 7);
    const lane1 = a.make(store, source);
    const run1 = await lane1.forceReindex();
    check('E1-run1 the first tagged pass embeds the walk (alpha rows)',
        run1.embedded > 0 && store.getMeta('embedder_model_tag') === ALPHA,
        `embedded=${run1.embedded} meta=${store.getMeta('embedder_model_tag')}`);

    const alphaRows = store.query<[string]>('SELECT DISTINCT model_tag FROM embeddings').map((r) => r[0]);
    const baseCount = store.countEmbeddings();

    // Plant orphans: embeddings rows whose vh belongs to no chunk (the 605-
    // row smoke state) — the epoch pass must evict them.
    store.insertEmbeddings([makeEmbedding('deadbeefdead0001', 20, ALPHA)]);

    // E1: DELTA walk (no rebuild arg), chunker epoch NOT stale (chunkerCp
    // === storedCp after run1), the ONLY staleness fact is the tag.
    const b = makeLane(BETA, 7);
    const lane2 = b.make(store, source);
    const run2 = await lane2.forceReindex();
    check('E1a the tag face alone fires the epoch: the planted orphan is evicted',
        store.countEmbeddings() === baseCount,
        `${store.countEmbeddings()} vs ${baseCount}`);
    check('E1b the stamp is CONSUMED and restamped: embedder_model_tag flipped to beta',
        store.getMeta('embedder_model_tag') === BETA,
        `meta=${store.getMeta('embedder_model_tag')}`);
    check('E1c delta stays delta: embedNew 0 — unchanged text kept its vector',
        run2.embedded === 0,
        `embedded=${run2.embedded}`);
    check('G-E1d the surviving rows keep their OWN model_tag (delta names, never rewrites)',
        store.query<[string]>('SELECT DISTINCT model_tag FROM embeddings').map((r) => r[0]).join() === alphaRows.join(),
        JSON.stringify(store.query<[string]>('SELECT DISTINCT model_tag FROM embeddings')));

    // E2: no manufactured epoch — the seeded honest default + default-tag
    // lane fire nothing; planted orphans SURVIVE a delta walk.
    const store2: Store = await openStore(':memory:');
    const source2 = new FakeSource();
    source2.files.set('notes/plain.md', 'Plain note paragraph about gadgets.');
    const c = makeLane(DEFAULT_TAG, 7);
    const lane3 = c.make(store2, source2);
    const run3 = await lane3.forceReindex();
    store2.insertEmbeddings([makeEmbedding('deadbeefdead0002', 21, DEFAULT_TAG)]);
    const withOrphan = store2.countEmbeddings();
    const lane4 = c.make(store2, source2);
    const run4 = await lane4.forceReindex();
    check('G-E2 default-tag walk manufactures no epoch: the orphan SURVIVES, embedNew 0',
        store2.countEmbeddings() === withOrphan && run4.embedded === 0 && run3.embedded > 0,
        `count=${store2.countEmbeddings()}/${withOrphan} embedded=${run4.embedded}/${run3.embedded}`);

    // E3: the FULL-rebuild face (the manual button passes rebuild=true):
    // wipe-before-walk — orphan gone by construction, every non-declined
    // chunk re-embedded from source.
    const totalChunks = store2.countChunks();
    const lane5 = c.make(store2, source2);
    // The trailing rebuild arg rides through a structural indirection so the
    // call COMPILES at the pre-T58 HEAD too (where the param does not exist):
    // the E3 red is then the runtime refusal (extra arg ignored — no wipe,
    // no re-embed), not a type error that would black out the fixture. .call
    // keeps the receiver so `this` stays the lane.
    const fullReindex: (onProgress: unknown, rebuild: boolean) => Promise<ReindexResult> =
        lane5.forceReindex as unknown as (onProgress: unknown, rebuild: boolean) => Promise<ReindexResult>;
    const run5 = await fullReindex.call(lane5, undefined, true);
    check('E3 rebuild=true wipes then re-embeds: embedded = every non-declined chunk, orphan gone',
        run5.embedded === totalChunks && store2.countEmbeddings() === totalChunks,
        `embedded=${run5.embedded} count=${store2.countEmbeddings()} chunks=${totalChunks}`);

    console.log(`[F33] lane corpus chunks: ${totalChunks}`);
}

async function main(): Promise<void> {
    console.log('[F33] T58 Stage B (b)-anchor separating legs + epoch-stamp consumption');
    await doorSection(true);
    await laneSection();
    console.log(failures === 0
        ? '[F33] VERDICT: GREEN'
        : `[F33] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
