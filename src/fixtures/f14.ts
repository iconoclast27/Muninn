// =============================================================================
// Muninn — F14: Folder rename moves all descendant paths
// fixtures/f14-folder-rename.ts
//
// CONTRACT TEXT (independent review M2, store-spec.md §5.3):
//   PASS requires:
//     F1  A folder rename re-addresses every child markdown path in one go.
//     F2  Search still finds the moved content under the new folder prefix.
//     F3  The old folder prefix returns no hits.
//     F4  Nested subfolder paths are re-addressed correctly.
//     F5  Watermarks move with their chunks.
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

function chunkRecord(path: string, ord: number, vh: string, text: string): ChunkRecord {
    return { path, ord, bs: 0, be: text.length, vh, text, title: 'T' };
}

async function main(): Promise<void> {
    console.log('[F14] folder rename moves descendant paths');

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

    // Seed rows directly; we are testing the store/lane rename contract, not
    // the chunker.
    store.insertChunks([
        chunkRecord('folder/old/alpha.md', 0, '1111111111111111', 'folder alpha content'),
        chunkRecord('folder/old/beta.md', 0, '2222222222222222', 'folder beta content'),
        chunkRecord('folder/old/nested/gamma.md', 0, '3333333333333333', 'nested gamma content'),
    ]);
    store.recordFile('folder/old/alpha.md', 1, 1, 'aaaaaaaaaaaaaaaa');
    store.recordFile('folder/old/beta.md', 1, 1, 'bbbbbbbbbbbbbbbb');
    store.recordFile('folder/old/nested/gamma.md', 1, 1, 'cccccccccccccccc');

    lane.onRenamePrefix('folder/old', 'folder/new');
    await lane.drain();

    const allPaths = store.query<[string]>('SELECT DISTINCT path FROM chunks ORDER BY path')
        .map((r) => r[0]);
    check('F1 all child paths moved',
        JSON.stringify(allPaths) === JSON.stringify([
            'folder/new/alpha.md',
            'folder/new/beta.md',
            'folder/new/nested/gamma.md',
        ]),
        JSON.stringify(allPaths));

    check('F2 search finds moved content',
        store.searchText('folder').length === 2,
        `${store.searchText('folder').length}`);
    check('F2 search finds nested moved content',
        store.searchText('nested').length === 1,
        `${store.searchText('nested').length}`);

    check('F3 old prefix has no chunks',
        store.query<[string]>("SELECT path FROM chunks WHERE path LIKE 'folder/old/%'").length === 0);
    check('F3 old prefix has no watermark',
        store.getFile('folder/old/alpha.md') === undefined);

    check('F4 nested path re-addressed',
        allPaths.includes('folder/new/nested/gamma.md'),
        JSON.stringify(allPaths));

    check('F5 watermarks moved',
        store.getFile('folder/new/alpha.md')?.content_hash === 'aaaaaaaaaaaaaaaa' &&
        store.getFile('folder/new/beta.md')?.content_hash === 'bbbbbbbbbbbbbbbb' &&
        store.getFile('folder/new/nested/gamma.md')?.content_hash === 'cccccccccccccccc');

    store.close();

    console.log(failures === 0
        ? '[F14] VERDICT: GREEN'
        : `[F14] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
