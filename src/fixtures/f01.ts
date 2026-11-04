// =============================================================================
// Muninn — F01: Store Idempotence & Delete/Rename Integrity
// fixtures/f01-store-idempotence.ts
// Authored: 2026-11-03, BEFORE src/store/store.ts exists — this fixture's
// first red is ModuleNotFound, which is the red it must earn.
//
// CONTRACT TEXT (store-spec.md §5.1, §5.3, §5.4, §4.8):
//   PASS requires:
//     S1  chunkNote is deterministic: same bytes ⇒ bit-identical chunk list
//         (chunker P3 — already certified, re-proven here end-to-end)
//     S2  replaceChunksForPath with the same records twice is a no-op in
//         content terms: same chunk count, same search results, same water-
//         mark row (the unchanged-file rescan costs nothing)
//     S3  a deleted path retains NOTHING: chunks, FTS rows, and watermark
//         all gone (pairing invariant, closes the resurrection hole); the
//         recreated identical file is re-scanned and rows are restored
//     S4  renamePath re-addresses chunks, FTS, and watermark in one move;
//         vh set is unchanged (no re-chunk evidence); search still finds
//         the content under the new path; the old path serves nothing
//     S5  the diagnostic door is truly read-only: UPDATE/INSERT/DELETE/
//         DROP through query() throws ReadOnlyDoorViolation naming the verb
//
// RUNNER: plain Node via tsx (chunker needs node:crypto via render.ts).
//   npx tsx fixtures/f01-store-idempotence.ts
// Store targets an in-memory DB (':memory:' equivalent for WASM) — this
// fixture touches no disk. Wiring into the legacy harness family
// (test-harness.ts / csuite.ts) happens after their APIs are receipted.
// =============================================================================

import {
    chunkNote,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type Chunk,
} from '../chunker/chunker.ts';
import {
    openStore,
    type Store,
} from '../store/store.ts'; // <- DOES NOT EXIST YET. Earn the red.

// --- helpers ---------------------------------------------------------------

const enc = new TextEncoder();

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

interface ChunkRecord {
    path: string;
    ord: number;
    bs: number;
    be: number;
    vh: string;
    text: string;
    title: string;
}

interface Hit {
    vh: string;
}

function toRecords(path: string, result: ReturnType<typeof chunkNote>): ChunkRecord[] {
    return result.chunks.map((c) => ({
        path, ord: c.ord, bs: c.bs, be: c.be, vh: c.vh,
        text: '', // filled from bytes below; store must persist it
        title: '',
    })).map((r, i) => ({
        ...r,
        text: Buffer.from(TEST_BYTES!.subarray(r.bs, r.be)).toString('utf-8'),
        title: result.chunks[i].chain.join(' > '),
    }));
}

// Deterministic corpus: frontmatter + headings + paragraphs + a table +
// a fence + a CJK paragraph + a giant over-ceiling paragraph would make
// this slow; kept lean — heavy geometry is the chunker's suite, not ours.
const DOC = [
    '---',
'type: note',
'tags: [test, muninn]',
'---',
'# Alpha',
'',
'First paragraph. It has two sentences. Both are boring.',
'',
'Second paragraph merges with the first under the byte target.',
'',
'| col a | col b |',
'|-------|-------|',
'| 1     | 2     |',
'',
'```',
'fenced content is atomic',
'```',
'',
'## Beta',
'',
'中文段落也是段落。',
'',
].join('\n');

const TEST_BYTES = enc.encode(DOC);

// --- run --------------------------------------------------------------------

async function main(): Promise<void> {
console.log('[F01] store idempotence & delete/rename integrity');

const store: Store = await openStore(':memory:'); // or the WASM equivalent per spec §4.1
const PATH = 'notes/test-document.md';

// S1 — chunker determinism, end-to-end receipt
const chunkA = chunkNote(TEST_BYTES);
const chunkB = chunkNote(TEST_BYTES);
check('S1a chunkNote deterministic (bit-for-bit)',
      JSON.stringify(chunkA.chunks) === JSON.stringify(chunkB.chunks));

const records = toRecords(PATH, chunkA);

// S2 — replace idempotence
store.replaceChunksForPath(PATH, records);
store.recordFile(PATH, TEST_BYTES.length, 1700000000000, 'aaaaaaaaaaaaaaaa');
const count1 = store.countChunks();
const fts1 = store.searchText('paragraph').map((h: Hit) => h.vh).sort();
store.replaceChunksForPath(PATH, records); // rescan of unchanged bytes
const count2 = store.countChunks();
const fts2 = store.searchText('paragraph').map((h: Hit) => h.vh).sort();
check('S2a replace-twice chunk count stable',
      count1 === count2 && count1 > 0, `${count1} vs ${count2}`);
check('S2b replace-twice search results identical',
      JSON.stringify(fts1) === JSON.stringify(fts2));
check('S2c watermark survived rescan',
      store.getFile(PATH)?.content_hash === 'aaaaaaaaaaaaaaaa');

// S3 — resurrection hole
store.deleteChunksForPath(PATH);
check('S3a chunks purged on delete', store.countChunks() === 0);
check('S3b FTS purged on delete',
      store.searchText('paragraph').length === 0);
check('S3c watermark purged on delete',
      store.getFile(PATH) === undefined);
store.replaceChunksForPath(PATH, records);
store.recordFile(PATH, TEST_BYTES.length, 1700000000000, 'aaaaaaaaaaaaaaaa');
check('S3d recreated file re-derives rows',
      store.countChunks() === count1 &&
      JSON.stringify(store.searchText('paragraph').map((h: Hit) => h.vh).sort()) ===
      JSON.stringify(fts1));

// S4 — rename integrity
const vhBefore = new Set(records.map((r) => r.vh));
store.renamePath(PATH, 'notes/renamed-document.md');
const renamed = store.query<[string, string]>('SELECT path, vh FROM chunks');
check('S4a no rows under old path',
      renamed.every((r) => r[0] === 'notes/renamed-document.md'));
check('S4b vh set unchanged by rename',
      new Set(renamed.map((r) => r[1])).size === vhBefore.size &&
      renamed.every((r) => vhBefore.has(r[1])));
check('S4c watermark moved',
      store.getFile('notes/renamed-document.md')?.content_hash === 'aaaaaaaaaaaaaaaa');
check('S4d old watermark gone',
      store.getFile(PATH) === undefined);
check('S4e search finds content under new path',
      store.searchText('paragraph').length > 0);

// S5 — read-only door
for (const bad of [
    `UPDATE chunks SET path = 'x'`,
     `DELETE FROM chunks`,
     `INSERT INTO files VALUES ('x', 0, 0, 'x')`,
     `DROP TABLE chunks`,
     `-- comment then UPDATE chunks SET path = 'x'`,
]) {
    let threw = false;
    let verb = '';
    try { store.query(bad); } catch (e) {
        threw = true;
        verb = String(e);
    }
    check(`S5 read-only guard: ${bad.slice(0, 24)}…`,
          threw && verb.includes('ReadOnlyDoorViolation'), verb);
}

console.log(failures === 0
? '[F01] VERDICT: GREEN'
: `[F01] VERDICT: RED — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
}

main();
