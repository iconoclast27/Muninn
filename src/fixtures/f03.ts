// =============================================================================
// Muninn — F03: Prefix Rename Boundary Matching
// fixtures/f03-prefix-rename.ts
//
// CONTRACT TEXT (store-spec.md §5.3):
//   PASS requires:
//     P1  renamePrefix('Area', 'Zone') moves every path under 'Area/'
//     P2  renamePrefix('Area', 'Zone') does NOT touch paths starting with
//         'Area 2/' or 'Areafield/' (boundary match: prefix + '/')
//     P3  renamePrefix is idempotent-ish: the second call with the same
//         folders is a no-op (no rows under the old prefix remain)
//     P4  vh set is unchanged; search still finds content under new prefix
// =============================================================================

import { openStore, type Store } from '../store/store.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function pathsUnder(store: Store, folder: string): string[] {
    const prefix = folder.endsWith('/') ? folder : `${folder}/`;
    const pattern = `${prefix}%`;
    return store.query<[string]>(
        'SELECT DISTINCT path FROM chunks WHERE path LIKE ?',
        pattern,
    ).map((r) => r[0]).sort();
}

async function main(): Promise<void> {
    console.log('[F03] prefix rename boundary matching');

    const store: Store = await openStore(':memory:');

    const docs = [
        { path: 'Area/note-a.md', vh: 'aaaaaaaaaaaaaaaa', text: 'alpha content' },
        { path: 'Area/sub/note-b.md', vh: 'bbbbbbbbbbbbbbbb', text: 'beta content' },
        { path: 'Area 2/note-c.md', vh: 'cccccccccccccccc', text: 'gamma content' },
        { path: 'Areafield/note-d.md', vh: 'dddddddddddddddd', text: 'delta content' },
    ];

    for (const d of docs) {
        store.replaceChunksForPath(d.path, [
            { path: d.path, ord: 0, bs: 0, be: d.text.length, vh: d.vh, text: d.text, title: 'T' },
        ]);
        store.recordFile(d.path, d.text.length, 1, d.vh);
    }

    const vhBefore = new Set(docs.map((d) => d.vh));

    // P1 / P2
    const moved = store.renamePrefix('Area', 'Zone');
    const zonePaths = pathsUnder(store, 'Zone');
    const areaPaths = pathsUnder(store, 'Area');
    const area2Paths = pathsUnder(store, 'Area 2');
    const areafieldPaths = pathsUnder(store, 'Areafield');

    check('P1 Area rows moved to Zone',
        zonePaths.length === 2 &&
        zonePaths.includes('Zone/note-a.md') &&
        zonePaths.includes('Zone/sub/note-b.md'),
        JSON.stringify(zonePaths));
    check('P2 Area 2 untouched',
        area2Paths.length === 1 && area2Paths[0] === 'Area 2/note-c.md',
        JSON.stringify(area2Paths));
    check('P2 Areafield untouched',
        areafieldPaths.length === 1 && areafieldPaths[0] === 'Areafield/note-d.md',
        JSON.stringify(areafieldPaths));
    check('P1 old Area prefix empty', areaPaths.length === 0, JSON.stringify(areaPaths));

    // P3 — second rename is a no-op
    const moved2 = store.renamePrefix('Area', 'Zone');
    check('P3 second rename affects no rows', moved2 === 0, `${moved2}`);

    // P4 — vh set and search
    const afterVhs = new Set(
        store.query<[string]>('SELECT vh FROM chunks').map((r) => r[0]),
    );
    check('P4 vh set unchanged',
        afterVhs.size === vhBefore.size && [...afterVhs].every((v) => vhBefore.has(v)));
    check('P4 search finds moved content',
        store.searchText('alpha').some((h) => h.path === 'Zone/note-a.md'));

    console.log(failures === 0
        ? '[F03] VERDICT: GREEN'
        : `[F03] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
