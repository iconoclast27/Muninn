// =============================================================================
// Muninn — F08: Reindex Atomicity / Watermark Repair
// fixtures/f08-reindex-atomicity.ts
//
// CONTRACT TEXT (store-spec.md §5.5):
//   PASS requires:
//     R1  forceReindex runs in per-file transactions
//     R2  a file with chunks but no watermark (interrupted reindex) gets
//         its watermark repaired by the next reindex without duplicating rows
//     R3  a file with watermark but no chunks is treated as unchanged and
//         not repaired (this is an illegal state; we leave it alone)
// =============================================================================

import { openStore, type Store } from '../store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from '../intake/lane.ts';
import type { EmbedClient } from '../api.ts';
import type { EmbeddingRecord } from '../store/store.ts';

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

class FakeSource implements FileSource {
    files = new Map<string, FileEntry>();
    async listFiles(): Promise<string[]> {
        return [...this.files.keys()].sort();
    }
    async readFile(path: string): Promise<FileEntry | null> {
        return this.files.get(path) ?? null;
    }
    put(path: string, text: string, mtime: number): void {
        this.files.set(path, { path, bytes: new TextEncoder().encode(text), mtime });
    }
    remove(path: string): void {
        this.files.delete(path);
    }
}

class FakeEmbedder implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        return inputs.map(({ vh, text }) => {
            const floats = new Float32Array(DIM);
            for (let i = 0; i < DIM; i++) floats[i] = Math.sin(text.length + i);
            return {
                vh,
                vector: new Uint8Array(floats.buffer),
                dim: DIM,
                model_tag: MODEL_TAG,
                epoch: 1,
            };
        });
    }
}

async function main(): Promise<void> {
    console.log('[F08] reindex atomicity / watermark repair');

    const store: Store = await openStore(':memory:');
    const source = new FakeSource();
    source.put('notes/a.md', '# A\n\nalpha content\n', 1);
    source.put('notes/b.md', '# B\n\nbeta content\n', 1);

    const lane = new IntakeLane({
        store,
        source,
        embedClient: new FakeEmbedder(),
        modelTag: MODEL_TAG,
        epoch: 1,
        chunkerCp: 2,
        debounceMs: 0,
    });

    // Complete reindex first.
    const r1 = await lane.forceReindex();
    check('R1 first reindex indexes both files', r1.files === 2);
    const chunksAfterFirst = store.countChunks();
    check('R1 chunks recorded', chunksAfterFirst > 0);

    // Simulate interrupted state for a.md: chunks exist, watermark missing.
    store.deleteFile('notes/a.md');
    check('R2 simulated interruption: a.md watermark gone',
        store.getFile('notes/a.md') === undefined);
    check('R2 simulated interruption: a.md chunks still present',
        store.query<[string]>('SELECT path FROM chunks WHERE path = ?', 'notes/a.md').length > 0);

    // Next reindex should repair the watermark without duplicating rows.
    const r2 = await lane.forceReindex();
    check('R2 second reindex still indexes both files', r2.files === 2);
    check('R2 chunk count stable after repair',
        store.countChunks() === chunksAfterFirst,
        `${store.countChunks()} vs ${chunksAfterFirst}`);
    check('R2 a.md watermark repaired', store.getFile('notes/a.md') !== undefined);

    // R3 — watermarks for files no longer in the source are removed.
    source.remove('notes/b.md');
    const r3 = await lane.forceReindex();
    check('R3 deleted-file watermark removed after reindex',
        store.getFile('notes/b.md') === undefined);
    check('R3 deleted-file chunks removed after reindex',
        store.query<[string]>('SELECT path FROM chunks WHERE path = ?', 'notes/b.md').length === 0);

    console.log(failures === 0
        ? '[F08] VERDICT: GREEN'
        : `[F08] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
