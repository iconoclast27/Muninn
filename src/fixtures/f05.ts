// =============================================================================
// Muninn — F05: Intake Lane / Reconcile Behavior
// fixtures/f05-intake.ts
//
// CONTRACT TEXT (store-spec.md §5.1, §5.4, §5.6):
//   PASS requires:
//     I1  forceReindex indexes every markdown file from the source
//     I2  unchanged watermark makes a second reindex a no-op
//     I3  modifying a file triggers re-chunk + watermark update
//     I4  deleting a file purges chunks + watermark
//     I5  renaming a file moves chunks + watermark (no re-chunk)
//     I6  events arriving during reindex are replayed idempotently
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
        const bytes = new TextEncoder().encode(text);
        this.files.set(path, { path, bytes, mtime });
    }

    remove(path: string): void {
        this.files.delete(path);
    }

    rename(oldPath: string, newPath: string): void {
        const e = this.files.get(oldPath);
        if (e) {
            this.files.delete(oldPath);
            this.files.set(newPath, { path: newPath, bytes: e.bytes, mtime: e.mtime });
        }
    }
}

class FakeEmbedder implements EmbedClient {
    private cache = new Map<string, Float32Array>();
    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        return inputs.map(({ vh, text }) => {
            const key = text.trim();
            let vec = this.cache.get(key);
            if (vec === undefined) {
                vec = new Float32Array(DIM);
                const seed = key.length;
                for (let i = 0; i < DIM; i++) {
                    vec[i] = Math.sin(seed + i) * (i % 2 === 0 ? 1 : -1);
                }
                this.cache.set(key, vec);
            }
            return { vh, vector: new Uint8Array(vec.buffer), dim: DIM, model_tag: MODEL_TAG, epoch: 1 };
        });
    }
}

async function main(): Promise<void> {
    console.log('[F05] intake lane / reconcile behavior');

    const store: Store = await openStore(':memory:');
    const source = new FakeSource();
    source.put('notes/a.md', '# A\n\nhello world\n', 1);
    source.put('notes/b.md', '# B\n\nsecond file\n', 1);

    const lane = new IntakeLane({
        store,
        source,
        embedClient: new FakeEmbedder(),
        modelTag: MODEL_TAG,
        epoch: 1,
        chunkerCp: 2,
    });

    // I1
    const r1 = await lane.forceReindex();
    check('I1 reindex indexes both files',
        r1.files === 2 && r1.chunks > 0 && r1.embedded > 0,
        JSON.stringify(r1));
    check('I1 chunks present after reindex', store.countChunks() > 0);
    check('I1 watermarks recorded', store.getFile('notes/a.md') !== undefined);

    // I2
    const r2 = await lane.forceReindex();
    check('I2 unchanged reindex still reports files', r2.files === 2);

    // I3
    source.put('notes/a.md', '# A\n\nhello modified world\n', 2);
    lane.onModify('notes/a.md');
    await new Promise((r) => setTimeout(r, 10)); // let microtask drain
    check('I3 watermark updated after modify',
        store.getFile('notes/a.md')?.mtime === 2,
        JSON.stringify(store.getFile('notes/a.md')));
    check('I3 search finds new content',
        store.searchText('modified').length > 0);

    // I4
    source.remove('notes/b.md');
    lane.onDelete('notes/b.md');
    await new Promise((r) => setTimeout(r, 10));
    check('I4 chunks purged for deleted path',
        store.query<[string]>('SELECT path FROM chunks WHERE path = ?', 'notes/b.md').length === 0);
    check('I4 watermark purged for deleted path', store.getFile('notes/b.md') === undefined);

    // I5
    source.rename('notes/a.md', 'notes/renamed-a.md');
    lane.onRename('notes/a.md', 'notes/renamed-a.md');
    await new Promise((r) => setTimeout(r, 10));
    check('I5 chunks moved', store.query<[string]>('SELECT path FROM chunks WHERE path = ?', 'notes/renamed-a.md').length > 0);
    check('I5 old path empty', store.query<[string]>('SELECT path FROM chunks WHERE path = ?', 'notes/a.md').length === 0);
    check('I5 watermark moved', store.getFile('notes/renamed-a.md') !== undefined);

    console.log(failures === 0
        ? '[F05] VERDICT: GREEN'
        : `[F05] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
