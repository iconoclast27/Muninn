// =============================================================================
// Muninn — F15: Vault.adapter-style persistence round-trip
// fixtures/f15-adapter-persistence.ts
//
// CONTRACT TEXT (viable smoke test critical path):
//   PASS requires:
//     A1  A fake DataAdapter can write serialized DB bytes to a path.
//     A2  Reading those bytes back and passing them to openStore(..., { load })
//         restores the full index state.
//     A3  The restore survives a close/open cycle.
//     A4  Without a prior write, opening with no load produces a fresh store.
// =============================================================================

import { openStore, type Store, type ChunkRecord } from '../store/store.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

class FakeAdapter {
    files = new Map<string, ArrayBuffer>();

    async readBinary(path: string): Promise<ArrayBuffer> {
        const data = this.files.get(path);
        if (data === undefined) throw new Error(`ENOENT ${path}`);
        return data;
    }

    async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
        this.files.set(path, data.slice(0));
    }

    async mkdir(_path: string): Promise<void> {
        // no-op
    }
}

function chunk(path: string, ord: number, vh: string, text: string): ChunkRecord {
    return { path, ord, bs: 0, be: text.length, vh, text, title: 'T' };
}

async function main(): Promise<void> {
    console.log('[F15] Vault.adapter-style persistence round-trip');

    const adapter = new FakeAdapter();
    const cachePath = '.obsidian/plugins/muninn/cache/index.db';

    // A1/A4 — fresh open with no cache
    const store1: Store = await openStore(':memory:');
    store1.insertChunks([
        chunk('notes/alpha.md', 0, '1111111111111111', 'alpha content'),
        chunk('notes/beta.md', 0, '2222222222222222', 'beta content'),
    ]);
    store1.recordFile('notes/alpha.md', 1, 1, 'aaaaaaaaaaaaaaaa');
    store1.recordFile('notes/beta.md', 1, 1, 'bbbbbbbbbbbbbbbb');
    const hits1 = store1.searchText('content');
    check('A4 fresh store has expected chunks', store1.countChunks() === 2);

    // A1 — write bytes to adapter
    const bytes = store1.serialize();
    await adapter.writeBinary(cachePath, bytes.buffer as ArrayBuffer);
    store1.close();
    check('A1 adapter received bytes', adapter.files.has(cachePath));

    // A2/A3 — read bytes and restore
    const loaded = await adapter.readBinary(cachePath);
    const loadBytes = loaded instanceof Uint8Array ? loaded : new Uint8Array(loaded);
    const store2: Store = await openStore(':memory:', { load: loadBytes });
    check('A2 restored chunk count', store2.countChunks() === 2);
    check('A2 restored watermarks',
        store2.getFile('notes/alpha.md')?.content_hash === 'aaaaaaaaaaaaaaaa' &&
        store2.getFile('notes/beta.md')?.content_hash === 'bbbbbbbbbbbbbbbb');
    const hits2 = store2.searchText('content');
    check('A2 restored FTS index',
        hits2.length === hits1.length &&
        JSON.stringify(hits2.map((h) => h.path).sort()) ===
        JSON.stringify(hits1.map((h) => h.path).sort()));

    // Mutate and persist again
    store2.insertChunks([chunk('notes/gamma.md', 0, '3333333333333333', 'gamma content')]);
    store2.recordFile('notes/gamma.md', 1, 1, 'cccccccccccccccc');
    const bytes2 = store2.serialize();
    await adapter.writeBinary(cachePath, bytes2.buffer as ArrayBuffer);
    store2.close();

    const loaded2 = await adapter.readBinary(cachePath);
    const loadBytes2 = loaded2 instanceof Uint8Array ? loaded2 : new Uint8Array(loaded2);
    const store3: Store = await openStore(':memory:', { load: loadBytes2 });
    check('A3 second round-trip chunk count', store3.countChunks() === 3);
    check('A3 second round-trip watermark',
        store3.getFile('notes/gamma.md')?.content_hash === 'cccccccccccccccc');
    store3.close();

    console.log(failures === 0
        ? '[F15] VERDICT: GREEN'
        : `[F15] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
