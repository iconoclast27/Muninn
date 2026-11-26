// =============================================================================
// Muninn — F19: FTS5 idempotent chunk writes and atomic path replacement
// fixtures/f19-chunk-idempotency.ts
//
// CONTRACT TEXT (Lumo M3/M4):
//   PASS requires:
//     I1  Calling insertChunks twice with the same records does not duplicate
//         FTS5 rows for the affected paths.
//     I2  Calling replaceChunksForPath twice with the same records does not
//         duplicate chunks or FTS rows, and preserves the file watermark.
//     I3  A replaceChunksForPath call that returns successfully has committed
//         both the delete of old rows and the insert of new rows as a unit.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f19.ts
// =============================================================================

import { openStore, type Store, type ChunkRecord } from '../store/store.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function chunk(path: string, ord: number, vh: string, text: string): ChunkRecord {
    return { path, ord, bs: 0, be: text.length, vh, text, title: 'T' };
}

async function main(): Promise<void> {
    console.log('[F19] FTS5 idempotent chunk writes and atomic path replacement');

    const store = await openStore(':memory:');

    // I1: double insertChunks must leave exactly one FTS row per path.
    const r1 = chunk('notes/x.md', 0, '1111111111111111', 'hello world');
    store.insertChunks([r1]);
    const first = store.searchText('hello').length;
    store.insertChunks([r1]);
    const second = store.searchText('hello').length;
    check('I1 repeated insertChunks keeps one FTS row',
        first === 1 && second === 1, `first=${first}, second=${second}`);
    check('I1 repeated insertChunks keeps one chunk row',
        store.countChunks() === 1, `${store.countChunks()}`);

    // I2/I3: replaceChunksForPath is self-transactioning and idempotent.
    store.recordFile('notes/x.md', 100, 1, 'aaaaaaaaaaaaaaaa');
    store.replaceChunksForPath('notes/x.md', [
        chunk('notes/x.md', 0, '2222222222222222', 'replacement text'),
        chunk('notes/x.md', 1, '3333333333333333', 'second paragraph'),
    ]);
    const afterFirstReplace = store.searchText('replacement').length;
    const watermarkAfterFirst = store.getFile('notes/x.md')?.content_hash;
    check('I3 first replace commits new rows',
        afterFirstReplace === 1, `${afterFirstReplace}`);
    check('I3 first replace preserves watermark',
        watermarkAfterFirst === 'aaaaaaaaaaaaaaaa', `${watermarkAfterFirst}`);

    store.replaceChunksForPath('notes/x.md', [
        chunk('notes/x.md', 0, '2222222222222222', 'replacement text'),
        chunk('notes/x.md', 1, '3333333333333333', 'second paragraph'),
    ]);
    const afterSecondReplace = store.searchText('replacement').length;
    check('I2 second replace does not duplicate FTS rows',
        afterSecondReplace === 1, `${afterSecondReplace}`);
    check('I2 second replace does not duplicate chunk rows',
        store.countChunks() === 2, `${store.countChunks()}`);
    check('I2 second replace preserves watermark',
        store.getFile('notes/x.md')?.content_hash === 'aaaaaaaaaaaaaaaa',
        `${store.getFile('notes/x.md')?.content_hash}`);

    // I3: a replace with different content removes the old rows entirely.
    store.replaceChunksForPath('notes/x.md', [
        chunk('notes/x.md', 0, '4444444444444444', 'completely different'),
    ]);
    check('I3 replace removes old FTS rows',
        store.searchText('replacement').length === 0,
        `${store.searchText('replacement').length}`);
    check('I3 replace removes old chunk rows',
        store.countChunks() === 1, `${store.countChunks()}`);
    check('I3 replace keeps watermark after content swap',
        store.getFile('notes/x.md')?.content_hash === 'aaaaaaaaaaaaaaaa',
        `${store.getFile('notes/x.md')?.content_hash}`);

    store.close();

    console.log(failures === 0
        ? '[F19] VERDICT: GREEN'
        : `[F19] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
