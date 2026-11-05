// =============================================================================
// Muninn — F16: Intake lane shutdown during forceReindex
// fixtures/f16-shutdown-race.ts
//
// CONTRACT TEXT (live BRAT reload crash, 2026-11-05):
//   PASS requires:
//     R1  lane.forceReindex() is interruptible: calling lane.stop() mid-flight
//         causes the promise to settle (resolve or reject) promptly.
//     R2  After stop(), the store is not accessed again by the interrupted
//         reindex, so closing the store does not throw SQLite3Error.
//     R3  The rejection reason is a controlled shutdown signal, not a raw
//         SQLite "DB has been closed" error.
//     R4  The store remains queryable after stop() and before close().
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f16.ts
// =============================================================================

import { openStore, type Store, type EmbeddingRecord } from '../store/store.ts';
import { IntakeLane, type FileSource, type FileEntry, type ReindexResult } from '../intake/lane.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

class SlowFileSource implements FileSource {
    files = new Map<string, string>();

    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }

    async readFile(path: string): Promise<FileEntry | null> {
        const text = this.files.get(path);
        if (text === undefined) return null;
        return { path, bytes: new TextEncoder().encode(text), mtime: 1 };
    }
}

class SlowEmbedClient {
    constructor(private delayMs: number) {}

    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        // Simulate an Ollama round-trip. This is where the real Obsidian
        // crash occurs: the embed batch is in flight when onunload fires.
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
        return inputs.map(({ vh }) => {
            const floats = new Float32Array(768);
            for (let i = 0; i < floats.length; i++) floats[i] = 0.01;
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
    console.log('[F16] Intake lane shutdown during forceReindex');

    const source = new SlowFileSource();
    source.files.set('notes/a.md', 'First note content with defenestration.');
    source.files.set('notes/b.md', 'Second note content is unrelated.');
    source.files.set('notes/c.md', 'Third note sits between batches.');

    const store = await openStore(':memory:');
    const lane = new IntakeLane({
        store,
        source,
        embedClient: new SlowEmbedClient(150),
        modelTag: 'ollama/nomic-embed-text:v1.5',
        epoch: 1,
        chunkerCp: 2,
        debounceMs: 0,
    });

    // Start a full reindex. With a 150ms embed delay, it will not finish
    // before we call stop().
    const reindexPromise = lane.forceReindex();

    // Let the walk begin, then signal shutdown exactly as main.ts does.
    await new Promise((resolve) => setTimeout(resolve, 50));
    lane.stop();

    let settled = false;
    let error: unknown = null;
    reindexPromise
        .then(() => { settled = true; })
        .catch((e: unknown) => { settled = true; error = e; });

    // Give the lane a window to notice the stop signal and abort. The slow
    // embed client sleeps 150ms, so wait long enough for the in-flight batch
    // to return and the lane to check the stop flag.
    await new Promise((resolve) => setTimeout(resolve, 250));

    check('R1 forceReindex settled after stop()', settled,
        settled ? undefined : 'promise still pending');

    // R4: store is still usable before we close it.
    let count = -1;
    let storeUsable = false;
    try {
        count = store.countChunks();
        storeUsable = true;
    } catch (e) {
        storeUsable = false;
    }
    check('R4 store remains usable after stop()', storeUsable && count >= 0,
        `count=${count}, usable=${storeUsable}`);

    // R2: close the store without an SQLite crash.
    let closeError: unknown = null;
    try {
        store.close();
    } catch (e) {
        closeError = e;
    }
    check('R2 store closes cleanly after interrupted reindex', closeError === null,
        closeError instanceof Error ? closeError.message : String(closeError));

    // R3: if it rejected, the reason must be the controlled shutdown signal.
    if (error !== null) {
        const msg = error instanceof Error ? error.message : String(error);
        const isShutdown = msg.toLowerCase().includes('shutdown') || msg.toLowerCase().includes('stopped');
        const isSqliteClosed = msg.includes('DB has been closed');
        check('R3 rejection reason is controlled shutdown signal, not SQLite error',
            isShutdown && !isSqliteClosed, msg);
    } else {
        // Resolving after stop is acceptable if it aborted early and returned
        // partial results; the important thing is it settled and left the
        // store usable.
        check('R3 promise resolved after stop() without SQLite error', true);
    }

    console.log(failures === 0
        ? '[F16] VERDICT: GREEN'
        : `[F16] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
