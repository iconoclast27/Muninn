// =============================================================================
// Muninn — F31: ranking honesty behind the door (T58 Stage A) — RED fixture
// src/fixtures/f31.ts
//
// Authored from the contract text in docs/T58 Implementation Design (draft -
// not canon).md (A1–A4 and its fixture plan, lines quoted below), NOT from
// observed behavior (ADR-10); assertions enter through the public door only
// (ADR-7). The draft is the contract of record for this act, NOT canon: there
// is no ADR yet, the docket's T58 row stays OPEN, and closure is Dan's.
// Field names (`tie`, `atScore`, `returnedAtScore`), the band reason ('below
// margin') and the anchor-guard reason are the draft's proposals — Dan's to
// fix at ruling (draft :121-129, items 1–3).
//
// The draft's fixture paragraph (:103-107): "earned red against HEAD (total
// order, disclosure fields, band null-with-reason, prefixed query text
// against a fake store carrying equal-scored chunks)". HEAD at authoring
// (measured): d704d59 — the committed door answers `{ hits }` only, scores
// with a score-only comparator and no ORDER BY before the cap, embeds raw
// query text, and answers an unembedded anchor with an empty neighbor set.
// RED legs, to be earned at Muninn HEAD d704d59 against the committed door
// (measured at authoring: run against a scratch copy of HEAD's src/ —
// receipt in the report):
//   R1  A2 — the ranking answers carry the disclosure member `tie`
//       (adr-37 doctrine: a ranking discloses).
//   R2  A2 at the cut — against the fake store carrying equal-scored chunks,
//       the disclosure is exact: atScore 5, returnedAtScore 2 at the door's
//       fixed k=20 cut (the door scores the whole join, so counts are exact,
//       not estimated — draft :32-36).
//   R3  A2 honest-null — a cut at a unique score discloses nothing: `tie`
//       present and null.
//   R4  A1 — total order (score desc, path asc, ord asc): the tie-block rows
//       the cut returns come back path-ascending. The block is inserted in
//       scrambled path order (z,x,y,b,a) so the committed door's row order
//       cannot satisfy this by luck of insertion.
//   R5  A3 — band null-with-reason: a door built with margin 0.9 over a
//       corpus whose top score is ≈ 0.374 answers the null channel
//       ('below margin', the adr-49 precedent), not a slice of a tie block.
//   R6  A4 — `searchSemantic` sends the locked TaskPrefix as embed TEXT
//       ('search_query:' + trimmed, render.ts:53 — today the label carries
//       it, the text never did; draft :54-58).
//   R7  A4 — the `listNotes` {like} leg carries the same prefix (both legs,
//       draft :55 and ruling-list item 3 — both, not one).
//   R8  anchor guard, reworded to the (b) whole-note law (ruling item 8,
//       2026-11-26): a note with NO embedded chunk at all answers dark-safe
//       with reason, NEVER an empty neighbor set. The seed contract here is
//       unchanged — notes/tie-a.md and friends are ord-0-only single-chunk
//       notes, and under (b) every embedded chunk of the anchor is a seed,
//       so these legs hold identically under BOTH anchor laws. The legs that
//       SEPARATE the laws — middle-only relation, per-note collapse, note-
//       wide self-exclusion — are (b)'s own fixture territory (a red at
//       HEAD AND at the landed ord-0 anchor), owed separate authorization,
//       not manufactured here.
//
// FIRST-GREEN guards, justified here (R14 — a first-green guard needs written
// justification) because they pin behavior the act keeps unchanged:
//   G1  The band lands UNCONFIGURED (draft :47-52: the value is a receipt
//       owed after B's re-embed — the fixture must not fix a value): the
//       unconfigured door answers the mini store in full.
//   G2  Ephemerality (f18 doctrine): the prefixed query legs must not
//       persist query vectors — the embeddings count stays 23.
//   G3  The anchor guard must not eat the embedded-anchor leg: an anchor
//       that carries a vector still answers neighbors, self excluded.
//   G4  The frozen surface stays six doors (f24/f30 precedent — this act
//       adds none).
//   G5  The text lane is untouched: BM25 still finds the block rows (Stage
//       A touches ranking only; the B3 doctrine keeps chunk rows and FTS
//       while declining vectors).
//
// Referee doctrine (draft :106-107): the harness surfaces (reference
// counting, dwell, registry, approval, prompt safety) stay policed by M-f25/
// M-f26; this fixture imports no harness, entering through the public door
// alone. The lane-side B3 floor and the B4 epoch levers are NOT policed here
// — the draft (:108-111) keeps the chunker/double-fence leg as owed,
// unnumbered fixture territory (ruling-list item 6, unanswered).
//
// Corpus (fake store, seeded through the store's record API — the lane is
// not exercised here): 18 unique chunks (one-hot vectors, distinct scores,
// weights 20..3 riding a fixed query vector), a 5-row tie block of
// byte-identical vectors (one-hot at dim 18) inserted scrambled, and one
// degenerate chunk row with NO embeddings row (the anchor-guard state). The
// query vector fixes the geometry: top ≈ 20/√2866 ≈ 0.374 (under the band
// leg's 0.9), block tied at ranks 19–23 of 23 joined candidates — the k=20
// cut sits inside the block, two returned. A second mini store (3 chunks,
// distinct scores) carries the R3/G1 unique-cut legs.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f31.ts
// =============================================================================

import { openStore, type Store, type ChunkRecord, type EmbeddingRecord } from '../store/store.ts';
import { createMuninnApi, type Reindexer, type EmbedClient } from '../api.ts';

const DIM = 768;
const MODEL_TAG = 'ollama/nomic-embed-text:v1.5';

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

// Query geometry: weights 20..3 over dims 0..17, weight 1 over dim 18.
// |q| = sqrt(3^2+...+20^2 + 1) = sqrt(2866): unique scores strictly
// decreasing (20/√2866 … 3/√2866), block tied at 1/√2866 — below the
// uniques, above nothing else; top ≈ 0.374.
function makeQueryVector(): Uint8Array {
    const floats = new Float32Array(DIM);
    for (let i = 0; i < 18; i++) floats[i] = 20 - i;
    floats[18] = 1;
    return new Uint8Array(floats.buffer);
}

class FakeEmbedClient {
    log: { vh: string; text: string }[] = [];
    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        for (const i of inputs) this.log.push({ vh: i.vh, text: i.text });
        const vector = makeQueryVector();
        return inputs.map((i) => ({
            vh: i.vh,
            vector,
            dim: DIM,
            model_tag: MODEL_TAG,
            epoch: 1,
        }));
    }
}

function chunk(path: string, text: string, vh: string): ChunkRecord {
    return { path, ord: 0, bs: 0, be: text.length, vh, text, title: 'T' };
}

function makeEmbedding(vh: string, dim: number): EmbeddingRecord {
    return { vh, vector: oneHot(dim), dim: DIM, model_tag: MODEL_TAG, epoch: 1 };
}

const noopReindexer: Reindexer = (opts: {
    store: Store;
    embedClient: EmbedClient | null;
    onProgress?: unknown;
}) => Promise.resolve(null);

async function main(): Promise<void> {
    console.log('[F31] ranking honesty behind the door (contract: T58 draft A1-A4 + anchor guard)');

    // --- Tie corpus: 18 uniques + 5-row tie block (scrambled) + degenerate anchor
    const store: Store = await openStore(':memory:');
    const uniqVh = (i: number) => String(i).padStart(16, '0');
    const blockVh = (j: number) => String(0x100 + j).padStart(16, '0');
    const degVh = 'f'.repeat(15) + '0';

    const chunks: ChunkRecord[] = [];
    for (let i = 0; i < 18; i++) {
        chunks.push(chunk(`notes/u-${String(i).padStart(2, '0')}.md`, `unique content number ${String(i).padStart(2, '0')}.`, uniqVh(i)));
    }
    // Insertion order scrambles the block paths: at the committed door the
    // tie block keeps this row order (score-only comparator, no ORDER BY),
    // so R4 cannot pass by luck of path-sorted insertion.
    for (const s of ['z', 'x', 'y', 'b', 'a']) {
        chunks.push(chunk(`notes/tie-${s}.md`, 'shared stanza about machine learning.', blockVh(s.charCodeAt(0))));
    }
    chunks.push(chunk('notes/degenerate.md', '----', degVh));
    store.insertChunks(chunks);

    const embeddings: EmbeddingRecord[] = [];
    for (let i = 0; i < 18; i++) embeddings.push(makeEmbedding(uniqVh(i), i));
    for (const s of ['z', 'x', 'y', 'b', 'a']) embeddings.push(makeEmbedding(blockVh(s.charCodeAt(0)), 18));
    // The degenerate chunk row gets NO embeddings row (the B3 lane decline
    // makes this state real; the join skips it, the FTS row stays).
    store.insertEmbeddings(embeddings);

    const client = new FakeEmbedClient();
    const api = createMuninnApi(store, client, noopReindexer);

    // R1/R2/R4 — the tie corpus through the door (query text: the block's
    // subject; the fake client answers with the fixed query geometry).
    const markBefore = client.log.length;
    const s = await api.searchSemantic('machine learning');
    const queryInputs = client.log.slice(markBefore);

    check('R1 the ranking answer carries the disclosure member tie (A2)',
        s !== null && 'tie' in s,
        s === null ? 'null' : JSON.stringify(Object.keys(s)));

    check('R2 the k=20 cut inside the tie block is disclosed exactly: atScore 5, returnedAtScore 2',
        s !== null && 'tie' in s && s.tie !== null && s.tie.atScore === 5 &&
        s.tie.returnedAtScore === 2 && s.hits.length === 20 && Number.isFinite(s.tie.score),
        s === null || s.tie === null || !('tie' in s) ? JSON.stringify(s === null ? null : { hits: s.hits.length }) : JSON.stringify(s.tie));

    const cutRows = s === null ? [] : [s.hits[18]?.path, s.hits[19]?.path];
    check('R4 total order (score desc, path asc, ord asc): the cut rows come back path-ascending (tie-a, tie-b)',
        s !== null && cutRows[0] === 'notes/tie-a.md' && cutRows[1] === 'notes/tie-b.md',
        JSON.stringify(cutRows));

    // R6 — the query leg embeds the TaskPrefix as TEXT (recorded inputs).
    check('R6 searchSemantic embed text carries the search_query: prefix (A4)',
        queryInputs.length === 1 && queryInputs[0].text === 'search_query:machine learning',
        JSON.stringify(queryInputs));

    // R7 — the listNotes {like} leg carries the same prefix.
    const markLike = client.log.length;
    const likeAnswer = await api.listNotes({ like: 'machine learning', limit: 5 });
    const likeInputs = client.log.slice(markLike);
    check('R7 the like lane embeds the same prefixed query text (A4, both legs)',
        likeInputs.length === 1 && likeInputs[0].text === 'search_query:machine learning',
        JSON.stringify(likeInputs));
    check('S0 the like lane still answers a frozen shape (guard)',
        likeAnswer !== null && likeAnswer.mode === 'semantic' && !Object.keys(likeAnswer).includes('total'),
        JSON.stringify(likeAnswer === null ? null : Object.keys(likeAnswer)));

    // R8 — anchor guard: the degenerate chunk row answers dark-safe with
    // reason, never an empty neighbor set.
    const anchor = api.relatedChunks('notes/degenerate.md', 2);
    check('R8 unembedded anchor refuses (null), not an empty neighbor set (B3 door item)',
        anchor === null,
        JSON.stringify(anchor));

    // G3 — an embedded anchor still answers, self excluded.
    const g3 = api.relatedChunks('notes/tie-a.md', 2);
    check('G3 embedded anchor still answers neighbors, self excluded (guard)',
        g3 !== null && g3.neighbors.length === 2 &&
        g3.neighbors.every((n: { path: string }) => n.path !== 'notes/tie-a.md'),
        JSON.stringify(g3 === null ? null : g3.neighbors.map((n: { path: string }) => n.path)));

    // G5 — the text lane is untouched.
    const g5 = api.searchText('stanza');
    check('G5 BM25 still finds the 5 block rows (guard)',
        g5 !== null && g5.mode === 'bm25' && g5.hits.length >= 5,
        g5 === null ? 'null' : `${g5.mode} ${g5.hits.length}`);

    // G4 — the frozen surface stays six doors.
    const doorKeys = Object.keys(api);
    check('G4 the frozen surface stays six doors (guard)',
        doorKeys.length === 6,
        JSON.stringify(doorKeys));

    // G2 — ephemerality: nothing persisted from the query legs.
    check('G2 embeddings count unchanged after query legs (23, guard)',
        store.countEmbeddings() === 23,
        `${store.countEmbeddings()} vs 23`);

    // R5 — the band: a door CONSTRUCTED with margin 0.9 over a corpus whose
    // top score ≈ 0.374 answers the null channel.
    const bandApi = createMuninnApi(store, new FakeEmbedClient(), noopReindexer, 0.9);
    const banded = await bandApi.searchSemantic('machine learning');
    check('R5 band 0.9 over top ≈ 0.374 answers null with reason (below margin)',
        banded === null,
        JSON.stringify(banded === null ? null : { hits: banded.hits.length }));

    // R3/G1 — the unique-cut mini store: disclosure present and null; the
    // UNCONFIGURED door answers in full (band inert until set).
    const mini: Store = await openStore(':memory:');
    mini.insertChunks([
        chunk('mini/p.md', 'mini one', '00000000000000a1'),
        chunk('mini/q.md', 'mini two', '00000000000000a2'),
        chunk('mini/r.md', 'mini three', '00000000000000a3'),
    ]);
    mini.insertEmbeddings([
        makeEmbedding('00000000000000a1', 0),
        makeEmbedding('00000000000000a2', 1),
        makeEmbedding('00000000000000a3', 2),
    ]);
    const miniApi = createMuninnApi(mini, new FakeEmbedClient(), noopReindexer);
    const m = await miniApi.searchSemantic('machine learning');
    check('R3 a unique-score cut discloses nothing: tie present and null (A2 honest-null)',
        m !== null && 'tie' in m && m.tie === null,
        m === null ? 'null' : JSON.stringify(Object.keys(m)) + ' ' + JSON.stringify('tie' in m ? m.tie : undefined));
    check('G1 the unconfigured door answers the mini store in full (band inert until configured, guard)',
        m !== null && m.hits.length === 3,
        m === null ? 'null' : `${m.hits.length} hits`);

    console.log(failures === 0
        ? '[F31] VERDICT: GREEN'
        : `[F31] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
