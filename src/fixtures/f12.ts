// =============================================================================
// Muninn — F12: SQLite WASM Serialize/Deserialize Round-Trip
// fixtures/f12-serialize-roundtrip.ts
//
// CONTRACT TEXT (store-spec.md §4.1 persistence seam):
//   PASS requires:
//     R1  store.serialize() returns a Uint8Array capturing the full database
//     R2  opening a new store with { load: bytes } restores all tables
//     R3  restored store preserves meta rows (schema_version, chunker_epoch,
//         embedder_model_tag, sqlite_version)
//     R4  restored store preserves files watermarks, chunks, embeddings, tags
//     R5  restored store preserves FTS5 index — searchText returns identical
//         hits for the same query
//     R6  round-trip is idempotent: serializing the restored DB and loading
//         it again yields the same state
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f12.ts
// =============================================================================

import { openStore, type Store, type ChunkRecord, type EmbeddingRecord } from '../store/store.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function makeChunks(path: string): ChunkRecord[] {
    return [
        {
            path,
            ord: 0,
            bs: 0,
            be: 20,
            vh: '1111111111111111',
            text: 'Round trip test one.',
            title: 'Alpha',
        },
        {
            path,
            ord: 1,
            bs: 21,
            be: 41,
            vh: '2222222222222222',
            text: 'Round trip test two.',
            title: 'Alpha > Beta',
        },
    ];
}

function makeEmbedding(vh: string): EmbeddingRecord {
    const floats = new Float32Array(768);
    for (let i = 0; i < 768; i++) floats[i] = (i % 2 === 0 ? 1 : -1) * 0.01;
    return {
        vh,
        vector: new Uint8Array(floats.buffer),
        dim: 768,
        model_tag: 'ollama/nomic-embed-text:v1.5',
        epoch: 1,
    };
}

async function seed(store: Store): Promise<void> {
    store.replaceChunksForPath('notes/alpha.md', makeChunks('notes/alpha.md'));
    store.recordFile('notes/alpha.md', 42, 1700000000000, 'aaaaaaaaaaaaaaaa');
    store.insertEmbeddings([
        makeEmbedding('1111111111111111'),
        makeEmbedding('2222222222222222'),
    ]);
    store.insertTags([
        { vh: '1111111111111111', tags: ['roundtrip', 'fixture'] },
        { vh: '2222222222222222', tags: ['fixture'] },
    ]);
}

async function main(): Promise<void> {
    console.log('[F12] SQLite WASM serialize/deserialize round-trip');

    // R1 — serialize returns bytes
    const store1: Store = await openStore(':memory:');
    await seed(store1);
    const hitsBefore = store1.searchText('Round');
    const bytes = store1.serialize();
    check('R1 serialize returns Uint8Array',
        bytes instanceof Uint8Array && bytes.length > 0, `length ${bytes.length}`);
    store1.close();

    // R2/R3/R4/R5 — load restores state
    const store2: Store = await openStore(':memory:', { load: bytes });

    check('R3 schema_version preserved',
        store2.getMeta('schema_version') === '3', store2.getMeta('schema_version'));
    check('R3 chunker_epoch preserved',
        store2.getMeta('chunker_epoch') !== undefined, store2.getMeta('chunker_epoch'));
    check('R3 embedder_model_tag preserved',
        store2.getMeta('embedder_model_tag') === 'ollama/nomic-embed-text:v1.5',
        store2.getMeta('embedder_model_tag'));
    check('R3 sqlite_version preserved',
        store2.sqliteVersion() !== 'unknown', store2.sqliteVersion());

    check('R4 watermark preserved',
        store2.getFile('notes/alpha.md')?.content_hash === 'aaaaaaaaaaaaaaaa');
    check('R4 chunk count preserved',
        store2.countChunks() === 2, `${store2.countChunks()}`);
    check('R4 embeddings preserved',
        store2.countEmbeddings() === 2, `${store2.countEmbeddings()}`);
    check('R4 tags preserved',
        store2.getTags('1111111111111111')?.includes('roundtrip') ?? false,
        JSON.stringify(store2.getTags('1111111111111111')));

    const hitsAfter = store2.searchText('Round');
    check('R5 FTS5 index preserved',
        hitsAfter.length === hitsBefore.length &&
        JSON.stringify(hitsAfter.map((h) => h.path).sort()) ===
        JSON.stringify(hitsBefore.map((h) => h.path).sort()),
        `${hitsBefore.length} before, ${hitsAfter.length} after`);

    // R6 — idempotent round-trip
    const bytes2 = store2.serialize();
    store2.close();
    const store3: Store = await openStore(':memory:', { load: bytes2 });
    check('R6 idempotent chunk count',
        store3.countChunks() === 2, `${store3.countChunks()}`);
    check('R6 idempotent search',
        store3.searchText('Round').length === hitsBefore.length,
        `${store3.searchText('Round').length}`);
    check('R6 idempotent embeddings',
        store3.countEmbeddings() === 2, `${store3.countEmbeddings()}`);
    store3.close();

    console.log(failures === 0
        ? '[F12] VERDICT: GREEN'
        : `[F12] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
