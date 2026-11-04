// =============================================================================
// Muninn — F10: Deferred Events During Reindex
// fixtures/f10-deferred-reindex.ts
//
// CONTRACT TEXT (store-spec.md §5.6):
//   PASS requires:
//     D1  events arriving during forceReindex are deferred, not lost
//     D2  deferred events are replayed idempotently after reindex ends
//     D3  a modify event for a file that reindex already processed is a
//         no-op if the final bytes are unchanged
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

class SlowSource implements FileSource {
    files = new Map<string, FileEntry>();
    delayMs = 50;
    async listFiles(): Promise<string[]> {
        return [...this.files.keys()].sort();
    }
    async readFile(path: string): Promise<FileEntry | null> {
        await new Promise((r) => setTimeout(r, this.delayMs));
        return this.files.get(path) ?? null;
    }
    put(path: string, text: string, mtime: number): void {
        this.files.set(path, { path, bytes: new TextEncoder().encode(text), mtime });
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
    console.log('[F10] deferred events during reindex');

    const store: Store = await openStore(':memory:');
    const source = new SlowSource();
    source.put('notes/a.md', '# A\n\nalpha content\n', 1);

    const lane = new IntakeLane({
        store,
        source,
        embedClient: new FakeEmbedder(),
        modelTag: MODEL_TAG,
        epoch: 1,
        chunkerCp: 2,
    });

    // D1 / D2 — inject a modify while reindex is sleeping on readFile.
    const reindexPromise = lane.forceReindex();
    source.put('notes/a.md', '# A\n\nalpha content modified\n', 2);
    lane.onModify('notes/a.md');
    const r = await reindexPromise;
    check('D1 reindex completed', r.files === 1, JSON.stringify(r));

    // Give the microtask drain a moment.
    await new Promise((r2) => setTimeout(r2, 10));

    check('D2 deferred modify applied',
        store.searchText('modified').length > 0,
        JSON.stringify(store.searchText('modified')));
    check('D2 watermark updated to later mtime',
        store.getFile('notes/a.md')?.mtime === 2,
        JSON.stringify(store.getFile('notes/a.md')));

    // D3 — idempotent replay: a no-op modify should not corrupt state.
    const chunksBefore = store.countChunks();
    lane.onModify('notes/a.md');
    await new Promise((r2) => setTimeout(r2, 10));
    check('D3 no-op modify keeps chunk count stable',
        store.countChunks() === chunksBefore,
        `${store.countChunks()} vs ${chunksBefore}`);

    console.log(failures === 0
        ? '[F10] VERDICT: GREEN'
        : `[F10] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
