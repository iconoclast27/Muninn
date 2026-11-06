// =============================================================================
// Muninn — F23: Sidebar Search State Serialization
// fixtures/f23-search-state.ts
//
// CONTRACT TEXT (sidebar view state restore):
//   PASS requires:
//     V1  emptySearchState returns empty query, text mode, and no hits.
//     V2  sanitizeSearchState rejects null, undefined, and primitive input.
//     V3  sanitizeSearchState preserves a valid query and mode.
//     V4  sanitizeSearchState drops malformed hits and keeps valid ones.
//     V5  sanitizeSearchState accepts a frozen Hit shape.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f23.ts
// =============================================================================

import { emptySearchState, sanitizeSearchState } from '../ui/search-state.ts';
import type { Hit } from '../api.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function fakeHit(path: string, ord: number): Hit {
    return { path, ord, bs: 0, be: 1, title: 'T', text: 'text' };
}

function main(): void {
    console.log('[F23] sidebar search state serialization');

    const empty = emptySearchState();
    check('V1 empty query', empty.query === '');
    check('V1 text mode', empty.mode === 'text');
    check('V1 no hits', empty.hits.length === 0);

    check('V2 rejects null', sanitizeSearchState(null) === null);
    check('V2 rejects undefined', sanitizeSearchState(undefined) === null);
    check('V2 rejects string', sanitizeSearchState('state') === null);
    check('V2 rejects number', sanitizeSearchState(42) === null);

    const s3 = sanitizeSearchState({ query: 'guitar', mode: 'semantic' });
    check('V3 preserves query', s3?.query === 'guitar');
    check('V3 preserves semantic mode', s3?.mode === 'semantic');
    const s3t = sanitizeSearchState({ query: 'machine', mode: 'text' });
    check('V3 preserves text mode', s3t?.mode === 'text');

    const s4 = sanitizeSearchState({
        query: 'test',
        mode: 'text',
        hits: [
            fakeHit('notes/good.md', 0),
            { path: 'notes/bad.md' } as unknown as Hit, // missing ord
            null,
            'not-a-hit',
        ],
    });
    check('V4 keeps valid hit', s4?.hits.length === 1 && s4?.hits[0]?.path === 'notes/good.md', JSON.stringify(s4?.hits));

    const s5 = sanitizeSearchState({
        query: 'introduction',
        mode: 'semantic',
        hits: [fakeHit('notes/intro.md', 2)],
    });
    check('V5 restores query', s5?.query === 'introduction');
    check('V5 restores mode', s5?.mode === 'semantic');
    check('V5 restores hit path', s5?.hits[0]?.path === 'notes/intro.md');
    check('V5 restores hit ord', s5?.hits[0]?.ord === 2);

    console.log(failures === 0
        ? '[F23] VERDICT: GREEN'
        : `[F23] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
