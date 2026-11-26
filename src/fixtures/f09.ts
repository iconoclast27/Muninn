// =============================================================================
// Muninn — F09: Rename Without Re-Chunk / Re-Embed
// fixtures/f09-rename-no-reembed.ts
//
// CONTRACT TEXT (store-spec.md §5.3):
//   PASS requires:
//     N1  renamePath for a file moves chunks, FTS rows, and watermark
//     N2  no new vh is minted by renamePath (content unchanged)
//     N3  no new embedding is required; the moved chunks reuse retained vectors
//     N4  search still finds the content under the new path
// =============================================================================

import { openStore, type Store } from '../store/store.ts';
import { chunkNote } from '../chunker/chunker.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

const enc = new TextEncoder();

function toRecords(path: string, bytes: Uint8Array) {
    const result = chunkNote(bytes);
    return result.chunks.map((c, i) => ({
        path,
        ord: i,
        bs: c.bs,
        be: c.be,
        vh: c.vh,
        text: Buffer.from(bytes.subarray(c.bs, c.be)).toString('utf-8'),
        title: c.chain.join(' > '),
    }));
}

async function main(): Promise<void> {
    console.log('[F09] rename without re-chunk / re-embed');

    const store: Store = await openStore(':memory:');

    const doc = '# Title\n\nSome unique searchable content here.\n';
    const bytes = enc.encode(doc);
    const oldPath = 'notes/old.md';
    const newPath = 'notes/new.md';

    const records = toRecords(oldPath, bytes);
    store.replaceChunksForPath(oldPath, records);
    store.recordFile(oldPath, bytes.length, 1, 'deadbeefdeadbeef');

    // Pre-seed one embedding per unique vh so we can prove reuse.
    const uniqueVhs = [...new Set(records.map((r) => r.vh))];
    for (const vh of uniqueVhs) {
        const floats = new Float32Array(768);
        for (let i = 0; i < 768; i++) floats[i] = Math.sin(vh.charCodeAt(0) + i);
        store.insertEmbeddings([{
            vh,
            vector: new Uint8Array(floats.buffer),
            dim: 768,
            model_tag: 'test/model',
            epoch: 1,
        }]);
    }

    const vhsBefore = new Set(store.query<[string]>('SELECT vh FROM chunks').map((r) => r[0]));
    const embedCountBefore = store.countEmbeddings();

    // N1 / N2 / N3
    store.renamePath(oldPath, newPath);

    const vhsAfter = new Set(store.query<[string]>('SELECT vh FROM chunks').map((r) => r[0]));
    check('N1 chunks moved to new path',
        store.query<[string]>('SELECT path FROM chunks WHERE path = ?', newPath).length > 0);
    check('N1 old path empty', store.query<[string]>('SELECT path FROM chunks WHERE path = ?', oldPath).length === 0);
    check('N1 watermark moved', store.getFile(newPath) !== undefined);
    check('N1 old watermark gone', store.getFile(oldPath) === undefined);
    check('N2 vh set unchanged', vhsAfter.size === vhsBefore.size && [...vhsAfter].every((v) => vhsBefore.has(v)));
    check('N3 no new embeddings required', store.countEmbeddings() === embedCountBefore);

    // N4
    check('N4 search finds content under new path',
        store.searchText('unique').some((h) => h.path === newPath));
    check('N4 search no longer finds content under old path',
        !store.searchText('unique').some((h) => h.path === oldPath));

    console.log(failures === 0
        ? '[F09] VERDICT: GREEN'
        : `[F09] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
