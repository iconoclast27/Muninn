// =============================================================================
// Muninn — F13: Intake lane crash/resurrection isolation
// fixtures/f13-lane-isolation.ts
//
// CONTRACT TEXT (independent review H1/H2/H3, store-spec.md §5.6):
//   PASS requires:
//     I1  A single bad op does not drop remaining buffered ops: per-op
//         isolation in drain() lets later paths commit.
//     I2  A rename whose destination already holds rows is caught and does
//         not wedge the lane; the source rows are removed as a fallback.
//     I3  A delete scheduled while a touch is in-flight is awaited: the
//         touch completes, then the delete runs, so the file's rows are
//         actually removed (no resurrection race).
// =============================================================================

import { openStore, type Store, type ChunkRecord } from '../store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from '../intake/lane.ts';
import type { EmbedClient } from '../api.ts';
import type { EmbeddingRecord } from '../store/store.ts';

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
}

class FakeEmbedder implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        return inputs.map(({ vh }) => ({
            vh,
            vector: new Uint8Array(768 * 4),
            dim: 768,
            model_tag: 'ollama/nomic-embed-text:v1.5',
            epoch: 1,
        }));
    }
}

async function main(): Promise<void> {
    console.log('[F13] intake lane crash/resurrection isolation');

    const store: Store = await openStore(':memory:');
    const source = new FakeSource();
    const lane = new IntakeLane({
        store,
        source,
        embedClient: new FakeEmbedder(),
        modelTag: 'ollama/nomic-embed-text:v1.5',
        epoch: 1,
        chunkerCp: 2,
        debounceMs: 0,
    });

    // I1 — bad op does not drop later ops.
    source.put('notes/good.md', '# Good\n\nGood content.\n', 1);
    source.put('notes/bad.md', '# Bad\n\nBad content.\n', 1);

    // Seed destination for bad rename so renamePath throws.
    store.replaceChunksForPath('notes/bad.md', [
        {
            path: 'notes/bad.md',
            ord: 0,
            bs: 0,
            be: 1,
            vh: 'bad0000000000000',
            text: 'x',
            title: 'Bad',
        },
    ]);
    store.replaceChunksForPath('notes/good.md', [
        {
            path: 'notes/good.md',
            ord: 0,
            bs: 0,
            be: 1,
            vh: 'good000000000000',
            text: 'x',
            title: 'Good',
        },
    ]);
    // Now rename notes/bad.md -> notes/good.md will hit a constraint violation
    // because notes/good.md already has a chunk row. The lane must catch this
    // and continue; the later touch on notes/good.md must still apply.
    lane.onRename('notes/bad.md', 'notes/good.md');
    // Also queue a real touch after the bad rename to prove drain continues.
    source.put('notes/good.md', '# Good\n\nGood content updated.\n', 2);
    lane.onModify('notes/good.md');
    await lane.drain();

    const goodWm = store.getFile('notes/good.md');
    check('I1 later op still processed after bad rename',
        goodWm !== undefined && goodWm.mtime === 2,
        JSON.stringify(goodWm));
    check('I1 bad source rows removed after rename fallback',
        store.countChunks() === 1, `${store.countChunks()}`);

    // I3 — delete waits for in-flight touch.
    source.put('notes/race.md', '# Race\n\nRace content.\n', 1);
    lane.onModify('notes/race.md');
    // Queue delete immediately, before the touch's async read/embed/write finishes.
    lane.onDelete('notes/race.md');
    await lane.drain();

    check('I3 delete serialized after touch: no rows remain',
        store.countChunks() === 1, `${store.countChunks()}`); // only good.md remains
    check('I3 delete serialized after touch: watermark gone',
        store.getFile('notes/race.md') === undefined);

    store.close();

    console.log(failures === 0
        ? '[F13] VERDICT: GREEN'
        : `[F13] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
