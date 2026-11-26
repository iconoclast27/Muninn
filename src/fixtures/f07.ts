// =============================================================================
// Muninn — F07: FTS Citation Exact Bytes
// fixtures/f07-citation-bytes.ts
//
// CONTRACT TEXT (store-spec.md §3, §5.7):
//   PASS requires:
//     C1  searchText BM25 hits carry (bs, be) that slice back to the
//         original file bytes (citation invariant)
//     C2  searchScan hits carry (bs, be) that slice back to the original
//         file bytes
//     C3  hit.text equals the decoded bytes of file.slice(bs, be)
// =============================================================================

import { chunkNote } from '../chunker/chunker.ts';
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

const enc = new TextEncoder();

function toRecords(path: string, bytes: Uint8Array): ChunkRecord[] {
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
    console.log('[F07] FTS citation exact bytes');

    const store: Store = await openStore(':memory:');

    const doc = [
        '---',
        'tags: [test]',
        '---',
        '# Intro',
        '',
        'The quick brown fox jumps over the lazy dog.',
        '',
        '## Middle',
        '',
        'Second paragraph contains the search target word.',
        '',
        '### End',
        '',
        'Final thoughts here.',
        '',
    ].join('\n');
    const bytes = enc.encode(doc);
    const path = 'notes/citation.md';
    const records = toRecords(path, bytes);
    store.replaceChunksForPath(path, records);
    store.recordFile(path, bytes.length, 1, 'deadbeefdeadbeef');

    // C1 — BM25
    const bm25 = store.searchText('target');
    check('C1 BM25 returns at least one hit', bm25.length > 0, JSON.stringify(bm25));
    if (bm25.length > 0) {
        const h = bm25[0];
        const sliced = Buffer.from(bytes.subarray(h.bs, h.be)).toString('utf-8');
        check('C1 BM25 bs/be slices exact bytes', sliced === h.text, `${JSON.stringify(sliced)} vs ${JSON.stringify(h.text)}`);
    }

    // C2 / C3 — scan
    const scan = store.searchScan('tar');
    check('C2 scan returns at least one hit', scan.length > 0, JSON.stringify(scan));
    if (scan.length > 0) {
        const h = scan[0];
        const sliced = Buffer.from(bytes.subarray(h.bs, h.be)).toString('utf-8');
        check('C2 scan bs/be slices exact bytes', sliced === h.text, `${JSON.stringify(sliced)} vs ${JSON.stringify(h.text)}`);
    }

    console.log(failures === 0
        ? '[F07] VERDICT: GREEN'
        : `[F07] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
