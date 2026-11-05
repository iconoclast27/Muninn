// =============================================================================
// Muninn — F18: Semantic query embeddings are not persisted
// fixtures/f18-semantic-query-ephemeral.ts
//
// CONTRACT TEXT (Lumo M1):
//   PASS requires:
//     E1  After a successful semantic search, the embeddings table count is
//         unchanged (no transient query vector stored).
//     E2  Two different semantic queries both return frozen-shape results.
//     E3  Repeated semantic search still returns the same result shape and
//         does not accumulate embeddings.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f18.ts
// =============================================================================

import { openStore, type Store, type ChunkRecord, type EmbeddingRecord } from '../store/store.ts';
import { createMuninnApi, type EmbedClient } from '../api.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function chunk(path: string, text: string, vh: string): ChunkRecord {
    return {
        path,
        ord: 0,
        bs: 0,
        be: text.length,
        vh,
        text,
        title: 'T',
    };
}

function makeEmbedding(vh: string, value: number): EmbeddingRecord {
    const floats = new Float32Array(768);
    for (let i = 0; i < floats.length; i++) floats[i] = value;
    return {
        vh,
        vector: new Uint8Array(floats.buffer),
        dim: 768,
        model_tag: 'ollama/nomic-embed-text:v1.5',
        epoch: 1,
    };
}

class StaticEmbedClient implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        // Return a deterministic vector that is orthogonal-ish to the two
        // stored vectors so similarity ranking is stable.
        return inputs.map(({ vh }) => {
            const floats = new Float32Array(768);
            for (let i = 0; i < floats.length; i++) {
                floats[i] = (i % 2 === 0 ? 1 : -1) * 0.01;
            }
            return {
                vh,
                vector: new Uint8Array(floats.buffer),
                dim: 768,
                model_tag: 'ollama/nomic-embed-text:v1.5',
                epoch: 1,
            };
        });
    }
}

async function main(): Promise<void> {
    console.log('[F18] Semantic query embeddings are not persisted');

    const store = await openStore(':memory:');
    store.insertChunks([
        chunk('notes/alpha.md', 'alpha content about machine learning', '1111111111111111'),
        chunk('notes/beta.md', 'beta content about baking bread', '2222222222222222'),
    ]);
    store.insertEmbeddings([
        makeEmbedding('1111111111111111', 0.5),
        makeEmbedding('2222222222222222', -0.5),
    ]);

    const api = createMuninnApi(store, new StaticEmbedClient());

    const before = store.countEmbeddings();
    const r1 = await api.searchSemantic('machine');
    check('E1 semantic search returns frozen shape',
        r1 !== null && Array.isArray(r1.hits), r1 === null ? 'null' : undefined);
    const after = store.countEmbeddings();
    check('E1 embedding count unchanged after semantic search',
        after === before, `${before} before, ${after} after`);

    const r2 = await api.searchSemantic('bread');
    check('E2 second semantic query returns frozen shape',
        r2 !== null && Array.isArray(r2.hits), r2 === null ? 'null' : undefined);
    check('E2 embedding count still unchanged after second query',
        store.countEmbeddings() === before, `${store.countEmbeddings()}`);

    await api.searchSemantic('alpha');
    await api.searchSemantic('beta');
    await api.searchSemantic('gamma');
    check('E3 embedding count unchanged after multiple queries',
        store.countEmbeddings() === before, `${store.countEmbeddings()}`);

    store.close();

    console.log(failures === 0
        ? '[F18] VERDICT: GREEN'
        : `[F18] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
