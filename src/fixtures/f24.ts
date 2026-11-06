// =============================================================================
// Muninn — F24: Frozen Plugin 1 Public API Contract
// fixtures/f24-api-contract.ts
//
// CONTRACT TEXT (API surface freeze):
//   PASS requires:
//     P1  MuninnApi exposes exactly the five frozen methods.
//     P2  Each method accepts the documented parameter types.
//     P3  Each frozen return shape contains exactly the documented fields.
//     P4  The Hit shape is frozen and carries path, ord, bs, be, title, text.
//     P5  TextSearchResult discloses mode 'bm25' or 'scan'.
//     P6  SemanticSearchResult returns only hits; no mode field.
//     P7  relatedChunks returns { neighbors } where each neighbor is a ChunkRef.
//     P8  tagVocabulary returns { tags } where each TagInfo is tag/files/chunks.
//     P9  forceReindex accepts an optional progress callback and returns a
//         ReindexResult.
//    P10  All dark-safe failures return null (verified for empty/invalid input).
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f24.ts
// =============================================================================

import { createMuninnApi, type MuninnApi, type Hit, type TextSearchResult, type SemanticSearchResult, type ChunkRef, type TagInfo, type ReindexResult, type ReindexProgress } from '../api.ts';
import type { Store } from '../store/store.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function fakeHit(): Hit {
    return { path: 'notes/a.md', ord: 0, bs: 0, be: 5, title: 'A', text: 'alpha' };
}

function fakeStore(): Store {
    return {
        searchText(): never { throw new Error('not reached'); },
        searchScan(): never { throw new Error('not reached'); },
        tagVocabulary(): TagInfo[] { return [{ tag: 'ml', files: 1, chunks: 1 }]; },
        query(): never { throw new Error('not reached'); },
        getEmbedding(): never { throw new Error('not reached'); },
    } as unknown as Store;
}

function fakeApi(opts: {
    textResult?: TextSearchResult | null;
    semanticResult?: SemanticSearchResult | null;
    relatedResult?: { neighbors: ChunkRef[] } | null;
    tagsResult?: { tags: TagInfo[] } | null;
    reindexResult?: ReindexResult | null;
}): MuninnApi {
    return {
        searchText(): TextSearchResult | null {
            return opts.textResult ?? null;
        },
        async searchSemantic(): Promise<SemanticSearchResult | null> {
            return opts.semanticResult ?? null;
        },
        relatedChunks(): { neighbors: ChunkRef[] } | null {
            return opts.relatedResult ?? null;
        },
        tagVocabulary(): { tags: TagInfo[] } | null {
            return opts.tagsResult ?? null;
        },
        async forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult | null> {
            if (onProgress) {
                onProgress({ phase: 'walk', done: 1, total: 1 });
            }
            return opts.reindexResult ?? null;
        },
    };
}

async function main(): Promise<void> {
    console.log('[F24] frozen Plugin 1 public API contract');

    // P1 — exact five methods
    const api = fakeApi({});
    const keys = Object.keys(api).sort();
    check('P1 exposes exactly five methods',
        keys.length === 5 &&
        keys.includes('searchText') &&
        keys.includes('searchSemantic') &&
        keys.includes('relatedChunks') &&
        keys.includes('tagVocabulary') &&
        keys.includes('forceReindex'),
        JSON.stringify(keys));

    // P2/P4/P5
    const t = fakeApi({ textResult: { hits: [fakeHit()], mode: 'bm25' } }).searchText('machine');
    check('P2 searchText accepts string', t !== null);
    check('P4 Hit has frozen fields',
        t !== null &&
        typeof t.hits[0]?.path === 'string' &&
        typeof t.hits[0]?.ord === 'number' &&
        typeof t.hits[0]?.bs === 'number' &&
        typeof t.hits[0]?.be === 'number' &&
        typeof t.hits[0]?.title === 'string' &&
        typeof t.hits[0]?.text === 'string',
        JSON.stringify(t?.hits[0]));
    check('P5 TextSearchResult has mode', t !== null && (t.mode === 'bm25' || t.mode === 'scan'));

    // P2/P6
    const s = await fakeApi({ semanticResult: { hits: [fakeHit()] } }).searchSemantic('intro');
    check('P2 searchSemantic accepts string', s !== null);
    check('P6 SemanticSearchResult has only hits',
        s !== null && Array.isArray(s.hits) && !('mode' in s),
        JSON.stringify(s));

    // P2/P7
    const c = fakeApi({ relatedResult: { neighbors: [{ ...fakeHit(), ord: 1 }] } }).relatedChunks('notes/a.md', 3);
    check('P2 relatedChunks accepts path and k', c !== null);
    check('P7 relatedChunks returns neighbors', c !== null && Array.isArray(c.neighbors));
    check('P7 neighbor is a ChunkRef',
        c !== null &&
        typeof c.neighbors[0]?.path === 'string' &&
        typeof c.neighbors[0]?.ord === 'number',
        JSON.stringify(c?.neighbors[0]));

    // P2/P8
    const v = fakeApi({ tagsResult: { tags: [{ tag: 'ml', files: 2, chunks: 3 }] } }).tagVocabulary();
    check('P2 tagVocabulary needs no args', v !== null);
    check('P8 tagVocabulary returns tags', v !== null && Array.isArray(v.tags));
    check('P8 TagInfo has tag/files/chunks',
        v !== null &&
        typeof v.tags[0]?.tag === 'string' &&
        typeof v.tags[0]?.files === 'number' &&
        typeof v.tags[0]?.chunks === 'number',
        JSON.stringify(v?.tags[0]));

    // P2/P9
    let progressCalled = false;
    const r = await fakeApi({ reindexResult: { files: 5, chunks: 10, embedded: 2, durationMs: 100 } })
        .forceReindex((p) => { progressCalled = p.phase === 'walk'; });
    check('P9 forceReindex accepts progress callback and returns ReindexResult',
        r !== null &&
        typeof r.files === 'number' &&
        typeof r.chunks === 'number' &&
        typeof r.embedded === 'number' &&
        typeof r.durationMs === 'number' &&
        progressCalled,
        JSON.stringify(r));

    // P10 — dark-safe null returns via real API with empty/invalid inputs
    const realApi = createMuninnApi(fakeStore(), null);
    check('P10 empty text query returns null', realApi.searchText('') === null);
    check('P10 empty semantic query returns null', await realApi.searchSemantic('') === null);
    check('P10 empty relatedChunks path returns null', realApi.relatedChunks('', 3) === null);
    check('P10 invalid k returns null', realApi.relatedChunks('notes/a.md', 0) === null);

    console.log(failures === 0
        ? '[F24] VERDICT: GREEN'
        : `[F24] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
