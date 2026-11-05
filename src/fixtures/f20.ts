// =============================================================================
// Muninn — F20: Modify Event Coalescing
// fixtures/f20-coalescing.ts
//
// CONTRACT TEXT (intake lane debouncing):
//   PASS requires:
//     C1  Five rapid onModify calls for the same path, with content changing
//         between calls, result in exactly one file read.
//     C2  The final content is indexed after the debounce window settles.
//     C3  Intermediate content versions are not left in the index.
//     C4  An onDelete immediately after an onModify cancels the debounced
//         touch and removes the path without an extra read.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f20.ts
// =============================================================================

import { openStore, type Store } from '../store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from '../intake/lane.ts';

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

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

class CountingSource implements FileSource {
    files = new Map<string, FileEntry>();
    readCount = new Map<string, number>();

    async listFiles(): Promise<string[]> {
        return [...this.files.keys()].sort();
    }

    async readFile(path: string): Promise<FileEntry | null> {
        this.readCount.set(path, (this.readCount.get(path) ?? 0) + 1);
        return this.files.get(path) ?? null;
    }

    put(path: string, text: string, mtime: number): void {
        this.files.set(path, { path, bytes: enc.encode(text), mtime });
    }
}

async function main(): Promise<void> {
    console.log('[F20] modify event coalescing');

    const store: Store = await openStore(':memory:');
    const source = new CountingSource();
    source.put('notes/a.md', '# A\n\nfirst\n', 1);

    const lane = new IntakeLane({
        store,
        source,
        embedClient: null,
        modelTag: 'test',
        epoch: 1,
        chunkerCp: 2,
        debounceMs: 50,
    });

    // C1 / C2 / C3 — simulate rapid keystrokes with content changes.
    lane.onModify('notes/a.md');
    await sleep(20);
    source.put('notes/a.md', '# A\n\nsecond\n', 2);
    lane.onModify('notes/a.md');
    await sleep(20);
    source.put('notes/a.md', '# A\n\nthird\n', 3);
    lane.onModify('notes/a.md');
    await sleep(20);
    source.put('notes/a.md', '# A\n\nfourth\n', 4);
    lane.onModify('notes/a.md');
    await sleep(20);
    source.put('notes/a.md', '# A\n\nfifth\n', 5);
    lane.onModify('notes/a.md');

    // Wait for the debounce window to settle.
    await sleep(150);

    const reads = source.readCount.get('notes/a.md') ?? 0;
    check('C1 rapid modifies coalesce into a single read', reads === 1, `reads=${reads}`);
    check('C2 final content is indexed', store.searchText('fifth').length > 0, JSON.stringify(store.searchText('fifth')));
    check('C3 intermediate content is not indexed', store.searchText('first').length === 0, JSON.stringify(store.searchText('first')));

    // C4 — delete cancels a pending debounced modify.
    source.put('notes/b.md', '# B\n\ncontent\n', 1);
    lane.onModify('notes/b.md');
    await sleep(10);
    lane.onDelete('notes/b.md');
    await sleep(100);
    check('C4 delete cancels pending debounced modify', source.readCount.get('notes/b.md') === undefined, `reads=${source.readCount.get('notes/b.md')}`);
    check('C4 path is removed after delete', store.searchText('content').length === 0, JSON.stringify(store.searchText('content')));

    store.close();

    console.log(failures === 0
        ? '[F20] VERDICT: GREEN'
        : `[F20] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
