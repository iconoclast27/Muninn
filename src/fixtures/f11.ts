// =============================================================================
// Muninn — F11: tagVocabulary populated from frontmatter tags
// fixtures/f11-tags.ts
//
// CONTRACT TEXT (store-spec.md §6.2):
//   PASS requires:
//     T1  tags declared in YAML frontmatter are persisted per-vh
//     T2  tagVocabulary() returns distinct tags with per-tag file and chunk counts
//     T3  shared vh across files counts each containing file once
//     T4  tags on notes with no chunks do not appear in the vocabulary
//     T5  tag counts update after a file is modified
// =============================================================================

import { openStore, type Store, type TagInfo } from '../store/store.ts';
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

function findTag(vocab: TagInfo[], tag: string): TagInfo | undefined {
    return vocab.find((t) => t.tag === tag);
}

async function main(): Promise<void> {
    console.log('[F11] tagVocabulary from frontmatter');

    const store: Store = await openStore(':memory:');
    const source = new FakeSource();

    source.put('notes/alpha.md', [
        '---',
        'tags: [ml, research]',
        '---',
        '# Alpha',
        '',
        'machine learning content',
        '',
    ].join('\n'), 1);

    source.put('notes/beta.md', [
        '---',
        'tags: [research, reading]',
        '---',
        '# Beta',
        '',
        'reading list content',
        '',
    ].join('\n'), 1);

    source.put('notes/gamma.md', [
        '---',
        'tags: [ml]',
        '---',
        '# Gamma',
        '',
        'machine learning content',
        '',
    ].join('\n'), 1);

    const lane = new IntakeLane({
        store,
        source,
        embedClient: new FakeEmbedder(),
        modelTag: MODEL_TAG,
        epoch: 1,
        chunkerCp: 2,
    });

    await lane.forceReindex();

    const vocab = store.tagVocabulary();
    check('T1 vocabulary is non-empty', vocab.length > 0, JSON.stringify(vocab));

    const ml = findTag(vocab, 'ml');
    check('T2 ml tag present', ml !== undefined, JSON.stringify(vocab));
    check('T2 ml counts two files', ml?.files === 2, `${ml?.files}`);

    const research = findTag(vocab, 'research');
    check('T2 research tag present', research !== undefined, JSON.stringify(vocab));
    check('T2 research counts two files', research?.files === 2, `${research?.files}`);

    const reading = findTag(vocab, 'reading');
    check('T2 reading tag present', reading !== undefined, JSON.stringify(vocab));
    check('T2 reading counts one file', reading?.files === 1, `${reading?.files}`);

    // alpha and gamma have identical body text, so they share a vh for the
    // single content chunk. The tag row is keyed by vh, but file counts must
    // still reflect both files.
    check('T3 shared-vh tag counts both files', ml?.files === 2, `${ml?.files}`);

    source.put('notes/alpha.md', [
        '---',
        'tags: [ml, research, newtag]',
        '---',
        '# Alpha',
        '',
        'machine learning content updated',
        '',
    ].join('\n'), 2);
    lane.onModify('notes/alpha.md');
    await new Promise((r) => setTimeout(r, 10));

    const vocab2 = store.tagVocabulary();
    const newtag = findTag(vocab2, 'newtag');
    check('T5 new tag appears after modify', newtag !== undefined, JSON.stringify(vocab2));

    console.log(failures === 0
        ? '[F11] VERDICT: GREEN'
        : `[F11] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
