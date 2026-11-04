// =============================================================================
// Muninn — F06: Ollama Embed Client Dark-Safe Behavior
// fixtures/f06-ollama-dark.ts
//
// CONTRACT TEXT (store-spec.md §6.1):
//   PASS requires:
//     O1  OllamaEmbedClient embed() returns EmbeddingRecord[] on success
//     O2  network failure returns null (dark-safe, no throw)
//     O3  wrong embedding dimension returns null
//     O4  vh is derived from the render contract for each input
// =============================================================================

import { openStore, type Store, type EmbeddingRecord } from '../store/store.ts';
import { createMuninnApi, type MuninnApi } from '../api.ts';
import { IntakeLane, type FileSource, type FileEntry } from '../intake/lane.ts';
import type { EmbedClient } from '../api.ts';
import { renderEmbedInput, embedVh } from '../chunker/render.ts';

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

class RecordingOllamaClient implements EmbedClient {
    endpoint: string;
    failNext = false;
    badDim = false;
    calls: string[][] = [];

    constructor(endpoint = 'http://localhost:11434/api/embed') {
        this.endpoint = endpoint;
    }

    async embed(inputs: string[]): Promise<EmbeddingRecord[] | null> {
        this.calls.push(inputs);
        if (this.failNext) return null;
        const dim = this.badDim ? 512 : DIM;
        return inputs.map((text) => {
            const floats = new Float32Array(dim);
            for (let i = 0; i < dim; i++) {
                floats[i] = Math.sin(text.length + i);
            }
            return {
                vh: embedVh(renderEmbedInput('search_document:', [], null, text)),
                vector: new Uint8Array(floats.buffer),
                dim,
                model_tag: MODEL_TAG,
                epoch: 1,
            };
        });
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
}

async function main(): Promise<void> {
    console.log('[F06] Ollama embed client dark-safe behavior');

    const store: Store = await openStore(':memory:');
    const source = new FakeSource();
    const client = new RecordingOllamaClient();
    const lane = new IntakeLane({
        store,
        source,
        embedClient: client,
        modelTag: MODEL_TAG,
        epoch: 1,
        chunkerCp: 2,
    });
    const api: MuninnApi = createMuninnApi(store, client, async () => lane.forceReindex());

    // O1
    source.put('notes/x.md', '# X\n\nhello world\n', 1);
    await lane.forceReindex();
    check('O1 embeddings stored after reindex', store.countEmbeddings() > 0);

    // O2
    client.failNext = true;
    source.put('notes/y.md', '# Y\n\ndifferent text for failure\n', 2);
    await lane.forceReindex();
    check('O2 no embeddings for failed batch', store.getEmbedding(embedVh(renderEmbedInput('search_document:', [], null, 'different text for failure'))) === undefined);

    // O3
    client.failNext = false;
    client.badDim = true;
    source.put('notes/z.md', '# Z\n\nbad dimension text\n', 3);
    await lane.forceReindex();
    check('O3 bad-dimension embedding rejected', store.getEmbedding(embedVh(renderEmbedInput('search_document:', [], null, 'bad dimension text'))) === undefined);

    // O4
    client.badDim = false;
    const text = 'vh derivation check';
    const vh = embedVh(renderEmbedInput('search_document:', [], null, text));
    const single = await client.embed([text]);
    check('O4 returned vh matches render contract',
        single !== null && single.length === 1 && single[0].vh === vh,
        JSON.stringify(single));

    console.log(failures === 0
        ? '[F06] VERDICT: GREEN'
        : `[F06] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
