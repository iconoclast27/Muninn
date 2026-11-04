// =============================================================================
// Muninn — F04: Frozen API Surface & Dark-Safe Wrappers
// fixtures/f04-api-surface.ts
//
// CONTRACT TEXT (store-spec.md §6.2):
//   PASS requires:
//     A1  searchText returns the frozen shape { hits, mode } for BM25
//     A2  searchText uses scan mode for 2-char queries
//     A3  searchText returns empty scan for 1-char queries
//     A4  searchText is dark-safe on empty/whitespace: null + reason
//     A5  searchSemantic is dark-safe when no embed client: null + reason
//     A6  searchSemantic embeds a new query and returns neighbors
//     A7  relatedChunks returns the frozen { neighbors } shape
//     A8  tagVocabulary returns the frozen { tags } shape
//     A9  forceReindex returns null + reason (not wired at this layer)
// =============================================================================

import { openStore, type Store, type EmbeddingRecord } from '../store/store.ts';
import { createMuninnApi, type MuninnApi } from '../api.ts';

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

function makeVector(seed: number): Uint8Array {
    const floats = new Float32Array(DIM);
    for (let i = 0; i < DIM; i++) {
        floats[i] = Math.sin(seed + i) * (i % 2 === 0 ? 1 : -1);
    }
    return new Uint8Array(floats.buffer);
}

class FakeEmbedder {
    async embed(inputs: string[]): Promise<EmbeddingRecord | null> {
        const input = inputs[0]?.trim() ?? '';
        // Deterministic "hash" for the fake embedder so repeated calls
        // for the same text produce the same vh in this fixture.
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        const seed = Math.abs(hash);
        // Use a simple string hash as a fake vh; the embedder is only
        // required to return a stable 16-hex vh for the input.
        const vh = Math.abs(seed).toString(16).padStart(16, '0').slice(0, 16);
        return {
            vh,
            vector: makeVector(seed),
            dim: DIM,
            model_tag: MODEL_TAG,
            epoch: 1,
        };
    }
}

async function main(): Promise<void> {
    console.log('[F04] frozen API surface & dark-safe wrappers');

    const store: Store = await openStore(':memory:');

    // Seed store with two files and their embeddings.
    const { renderEmbedInput, embedVh } = await import('../chunker/render.ts');
    const pA = 'notes/alpha.md';
    const pB = 'notes/beta.md';
    const textA = 'alpha document about machine learning';
    const textB = 'beta document about learning machines';
    const vhA = embedVh(renderEmbedInput('search_document:', [], null, textA));
    const vhB = embedVh(renderEmbedInput('search_document:', [], null, textB));
    store.insertChunks([
        { path: pA, ord: 0, bs: 0, be: textA.length, vh: vhA, text: textA, title: 'Alpha' },
        { path: pB, ord: 0, bs: 0, be: textB.length, vh: vhB, text: textB, title: 'Beta' },
    ]);
    store.insertEmbeddings([
        { vh: vhA, vector: makeVector(1), dim: DIM, model_tag: MODEL_TAG, epoch: 1 },
        { vh: vhB, vector: makeVector(2), dim: DIM, model_tag: MODEL_TAG, epoch: 1 },
    ]);

    const fake = new FakeEmbedder();
    const api = createMuninnApi(store, fake);

    // A1 / A2 / A3
    const bm25 = api.searchText('machine');
    check('A1 BM25 returns frozen shape',
        bm25 !== null && 'hits' in bm25 && bm25.mode === 'bm25',
        JSON.stringify(bm25));
    check('A1 BM25 finds content',
        bm25 !== null && bm25.hits.length > 0,
        JSON.stringify(bm25));
    const scan = api.searchText('ma');
    check('A2 2-char query uses scan mode',
        scan !== null && scan.mode === 'scan' && scan.hits.length > 0,
        JSON.stringify(scan));
    const one = api.searchText('m');
    check('A3 1-char query returns empty scan',
        one !== null && one.mode === 'scan' && one.hits.length === 0,
        JSON.stringify(one));

    // A4
    check('A4 empty query null', api.searchText('') === null);
    check('A4 whitespace query null', api.searchText('   ') === null);

    // A5
    const darkApi = createMuninnApi(store, null);
    check('A5 semantic null without embedder',
        await darkApi.searchSemantic('hello') === null);

    // A6
    const semantic = await api.searchSemantic('machine learning');
    check('A6 semantic returns frozen shape',
        semantic !== null && 'hits' in semantic,
        JSON.stringify(semantic));
    check('A6 semantic returns neighbors',
        semantic !== null && semantic.hits.length > 0,
        JSON.stringify(semantic));

    // A7
    const related = api.relatedChunks(pA, 2);
    check('A7 relatedChunks returns frozen shape',
        related !== null && 'neighbors' in related,
        JSON.stringify(related));
    check('A7 relatedChunks excludes self',
        related !== null && related.neighbors.every((n) => n.path !== pA),
        JSON.stringify(related));

    // A8
    const tags = api.tagVocabulary();
    check('A8 tagVocabulary returns frozen shape',
        tags !== null && 'tags' in tags && Array.isArray(tags.tags),
        JSON.stringify(tags));

    // A9
    const reindex = await api.forceReindex();
    check('A9 forceReindex returns null (not wired)', reindex === null);

    console.log(failures === 0
        ? '[F04] VERDICT: GREEN'
        : `[F04] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
