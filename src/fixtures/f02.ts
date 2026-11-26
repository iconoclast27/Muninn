// =============================================================================
// Muninn — F02: Embeddings Round-Trip & Lazy Retention
// fixtures/f02-embeddings.ts
//
// CONTRACT TEXT (store-spec.md §2.3, §4.5, §5.4.1):
//   PASS requires:
//     E1  insertEmbeddings stores Float32 vectors keyed by vh
//     E2  getEmbedding returns identical bytes for the same vh
//     E3  deleteChunksForPath does NOT evict embeddings (lazy retention)
//     E4  deleteEmbeddingsForVh explicitly evicts a single vector
//     E5  identical content re-used after delete+recreate is a cache hit:
//         no second embed needed; getEmbedding still serves the retained vector
//     E6  countEmbeddings tracks inserts and explicit evictions
// =============================================================================

import { openStore, type Store, type EmbeddingRecord } from '../store/store.ts';

const MODEL_TAG = 'ollama/nomic-embed-text:v1.5';
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

function makeVector(seed: number): Uint8Array {
    const floats = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) {
        floats[i] = Math.sin(seed + i) * (i % 2 === 0 ? 1 : -1);
    }
    return new Uint8Array(floats.buffer);
}

function vectorsEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) return false;
    const fa = new Float32Array(a.buffer, a.byteOffset, a.byteLength / 4);
    const fb = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
    if (fa.length !== fb.length) return false;
    for (let i = 0; i < fa.length; i++) {
        if (fa[i] !== fb[i]) return false;
    }
    return true;
}

async function main(): Promise<void> {
    console.log('[F02] embeddings round-trip & lazy retention');

    const store: Store = await openStore(':memory:');
    const PATH = 'notes/embed-test.md';
    const vhA = 'aaaaaaaaaaaaaaaa';
    const vhB = 'bbbbbbbbbbbbbbbb';
    const vecA = makeVector(1);
    const vecB = makeVector(2);

    // E1 / E2 — insert and retrieve
    store.insertEmbeddings([
        { vh: vhA, vector: vecA, dim: DIM, model_tag: MODEL_TAG, epoch: 1 },
        { vh: vhB, vector: vecB, dim: DIM, model_tag: MODEL_TAG, epoch: 1 },
    ]);
    const gotA = store.getEmbedding(vhA);
    const gotB = store.getEmbedding(vhB);
    check('E1/E2 getEmbedding returns stored vectors',
        gotA !== undefined && gotB !== undefined &&
        vectorsEqual(gotA.vector, vecA) && vectorsEqual(gotB.vector, vecB));
    check('E2 metadata preserved',
        gotA?.dim === DIM && gotA?.model_tag === MODEL_TAG && gotA?.epoch === 1);
    check('E6 count after insert', store.countEmbeddings() === 2);

    // Wire up a chunk referencing vhA, then delete the file — embedding must survive.
    store.replaceChunksForPath(PATH, [
        { path: PATH, ord: 0, bs: 0, be: 10, vh: vhA, text: 'hello world', title: 'T' },
    ]);
    store.deleteChunksForPath(PATH);
    check('E3 embedding survives chunk/watermark delete',
        store.getEmbedding(vhA) !== undefined && store.countEmbeddings() === 2);

    // Recreate identical content — same vh, embedding still there.
    store.replaceChunksForPath(PATH, [
        { path: PATH, ord: 0, bs: 0, be: 10, vh: vhA, text: 'hello world', title: 'T' },
    ]);
    check('E5 recreated chunk reuses retained embedding',
        store.getEmbedding(vhA) !== undefined &&
        vectorsEqual(store.getEmbedding(vhA)!.vector, vecA));

    // E4 — explicit eviction
    store.deleteEmbeddingsForVh(vhB);
    check('E4 explicit eviction removes vector',
        store.getEmbedding(vhB) === undefined);
    check('E6 count after eviction', store.countEmbeddings() === 1);

    console.log(failures === 0
        ? '[F02] VERDICT: GREEN'
        : `[F02] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
