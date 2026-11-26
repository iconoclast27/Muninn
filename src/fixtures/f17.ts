// =============================================================================
// Muninn — F17: Per-path ingestion serialization prevents resurrection races
// fixtures/f17-path-serialization.ts
//
// CONTRACT TEXT (Lumo H3):
//   PASS requires:
//     R1  A modify event followed quickly by a delete for the same path does
//         NOT resurrect the file after deletion, even if the modify's
//         ingest is still in flight when the delete is applied.
//     R2  A rename event waits for an in-flight ingest of the old path before
//         moving rows, so no rows remain under the old path.
//     R3  A later modify for the same path still processes after the delete
//         (i.e., serialization does not stall the queue forever).
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f17.ts
// =============================================================================

import { openStore, type Store } from '../store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from '../intake/lane.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

class SlowSource implements FileSource {
    files = new Map<string, string>();
    readDelayMs = 0;

    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }

    async readFile(path: string): Promise<FileEntry | null> {
        await new Promise((resolve) => setTimeout(resolve, this.readDelayMs));
        const text = this.files.get(path);
        if (text === undefined) return null;
        return { path, bytes: new TextEncoder().encode(text), mtime: 1 };
    }
}

async function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    console.log('[F17] Per-path ingestion serialization');

    const store = await openStore(':memory:');
    const source = new SlowSource();
    source.files.set('notes/victim.md', 'First content includes resurrection bait.');
    source.readDelayMs = 100;

    const lane = new IntakeLane({
        store,
        source,
        embedClient: null,
        modelTag: 'ollama/nomic-embed-text:v1.5',
        epoch: 1,
        chunkerCp: 2,
        debounceMs: 0,
    });

    // R1: schedule a modify, then a delete while the modify is still reading.
    lane.onModify('notes/victim.md');
    await wait(20); // modify read is in flight
    lane.onDelete('notes/victim.md');
    await lane.drain();

    check('R1 no chunks remain after delete during in-flight modify',
        store.countChunks() === 0, `${store.countChunks()}`);
    check('R1 no watermark remains after delete during in-flight modify',
        store.countFiles() === 0, `${store.countFiles()}`);
    check('R1 search finds nothing after delete during in-flight modify',
        store.searchText('resurrection').length === 0, `${store.searchText('resurrection').length}`);

    // R2: schedule a modify, then a rename while the modify is in flight.
    source.files.set('notes/old.md', 'Movable content about girders.');
    lane.onModify('notes/old.md');
    await wait(20);
    lane.onRename('notes/old.md', 'notes/new.md');
    await lane.drain();

    const hits = store.searchText('girders');
    check('R2 search finds renamed content under new path',
        hits.length === 1 && hits[0].path === 'notes/new.md',
        JSON.stringify(hits.map((h) => h.path)));
    check('R2 no chunks remain under old path',
        store.query<[number]>('SELECT COUNT(*) FROM chunks WHERE path = ?', 'notes/old.md')[0][0] === 0);

    // R3: a later modify for a different path still works.
    source.files.set('notes/later.md', 'Later content about spaniels.');
    lane.onModify('notes/later.md');
    await lane.drain();
    check('R3 later modify for another path is processed',
        store.searchText('spaniels').length === 1, `${store.searchText('spaniels').length}`);

    store.close();

    console.log(failures === 0
        ? '[F17] VERDICT: GREEN'
        : `[F17] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
