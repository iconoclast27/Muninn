// =============================================================================
// Muninn — F29: the scan lane's truthful `total` (store count door) — RED fixture
// src/fixtures/f29.ts
//
// Authored from docs/decisions/adr-45.md (Accepted, Dan 2026-11-22: "(a) Truthful
// total via a store count door) — the contract of record for this act — not from
// observed behavior (ADR-10). Exercises the public API only (ADR-7): notes are
// ingested through the lane, every assertion enters through `listNotes`; the
// count door itself is observed only through what the door answers, never called
// directly. (The store is opened here solely to drive the lane, as f27/f28 do.)
//
// adr-37.md already says `total` is the set size counted over the whole set
// before any cap and that "a capped scan is never served as complete"; the
// shipped door derives `total` from the capped 100-row `searchScan` fetch
// (src/store/store.ts:671-699, src/api.ts:284-292, `total = rows.length` at
// :314 [R @ Muninn f151846]), so a partial answer arrives labelled complete —
// docket T43, closed by adr-45. ADR-45 rules the mechanism: the truth count is a
// store door (`COUNT(DISTINCT path)`, the `tagVocabulary()` precedent), the row
// fetch stays capped at 100 chunk rows, and `notes.length` against `total`
// self-discloses partialness. No field is added to the ruled return object.
//
// RED legs, earned at Muninn HEAD f151846 against the committed door:
//   S1  A scan over a set larger than the lane's 100-row cap answers the truth
//       `total` (126 distinct matching paths), with rows capped at 100. Measured
//       failing: `total: 100` — the capped fetch reported as the set size.
//   S2  Partialness self-discloses: `notes.length < total` is exactly the
//       disclosure adr-37 names; the answer stays complete-shaped otherwise.
//       Measured failing at the same seam as S1 (`notes.length == total`).
//   S3  A folder-restricted scan counts truth within the restriction: the truth
//       over `Project/HomeLabOps/` is 106 (105 notes plus twice.md), rows still
//       capped at 100. Measured failing: `total: 100` (the restricted set looks
//       exactly like the cap).
//   S4  The 2-character lexical delegation rides the same disclosure (adr-45):
//       `lexical: 'op'` delegates to `searchScan` (store.ts:632-638), so its set
//       is capped too; the truth is 126, rows at 100. Measured failing: 100/100.
//   S5  Paging over the capped fetch stays honest under a truthful `total`:
//       pages of 40 cover exactly the delivered rows, no path skipped or
//       doubled, and an offset past the delivered window is an empty page whose
//       `total` is still the truth (126), not the window (100). Measured
//       failing: `total: 100` at the past-the-window leg.
//   S6  The filename restriction composes before the count: `scan: 'ops'` with
//       `filename: 'note-0'` narrows the counted set by basename — note-000..
//       note-099 (100) plus note-00..note-09 (10) — truth 110, rows capped.
//       Measured failing: `total: 100` (the count ignored the narrowing).
//
// FIRST-GREEN guards, justified here (R14 — a first-green guard needs written
// justification) because they pin behavior the ruling keeps unchanged:
//   G1  Under the cap the truth count equals the delivered rows (a scan of one
//       matching note answers `total: 1`, rows 1) — the fix must not fabricate a
//       larger number, and the FTS lane stays unbounded as ruled (adr-37,
//       "unbounded rows today"): `lexical: 'dashboard'` (3+ chars) answers
//       truth = rows = 105.
//   G2  The cap is unchanged: a matching set of 126 never delivers more than
//       100 rows (ADR-43's declared limitation; adr-45 kept the row fetch
//       capped — option (c), serving the whole set, was not ruled).
//   G3  A scan matching nothing answers the empty set with truth 0 — the count
//       door must not report phantom matches.
//   G5  The frozen surface stays: six doors, the ruled return shape unchanged —
//       no disclosure field added (adr-45 ruled option (a), not option (b)).
//       FIRST-GREEN guard; M-f24 polices the surface, this pins the shape.
//
// The semantic lane's 10 000-chunk cap is out of scope: it stays with docket T8,
// open and unbundled. M-f27's D15 stays green: its scan corpus is far below the
// cap, so truth == rows there (re-measured in the green pass, not assumed).
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f29.ts
// =============================================================================

import { openStore, type Store } from '../store/store.ts';
import { IntakeLane } from '../intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient, type ListNotesResult } from '../api.ts';
import { CHUNKER_CP } from '../chunker/chunker.ts';

const enc = new TextEncoder();

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function paths(r: ListNotesResult | null): string[] {
    return r === null ? [] : r.notes.map((n) => n.path);
}

function sameStrings(a: unknown[], b: unknown[]): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function noteBytes(body: string): Uint8Array {
    return enc.encode(`---\n---\n${body}\n`);
}

class FakeEmbedClient implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<{ vh: string; vector: Uint8Array; dim: number; model_tag: string; epoch: number }[] | null> {
        return inputs.map((i) => {
            const dim = 768;
            const floats = new Float32Array(dim);
            floats[0] = i.text.length / 1000;
            return { vh: i.vh, vector: new Uint8Array(floats.buffer), dim, model_tag: 'fake/model', epoch: 1 };
        });
    }
}

type VaultFile = { bytes: Uint8Array; mtime: number };

class FakeFileSource {
    constructor(private files: Map<string, VaultFile>) {}

    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }

    async readFile(path: string): Promise<{ path: string; bytes: Uint8Array; mtime: number } | null> {
        const f = this.files.get(path);
        if (!f) return null;
        return { path, bytes: f.bytes, mtime: f.mtime };
    }
}

async function main(): Promise<void> {
    console.log('[F29] the scan lane\'s truthful total (contract: adr-45.md)');

    // 126 notes whose chunk text contains 'ops': 105 under Project/HomeLabOps/,
    // 20 under Project/FieldOps/, plus twice.md (three 'ops' mentions in one
    // chunk — COUNT(DISTINCT path) collapses it to one member). Two notes do
    // not match at all. Measured at HEAD f151846 with the green door: 126
    // distinct matching paths, 126 chunk rows — truth above the lane's 100-row
    // cap deliberately.
    const files = new Map<string, VaultFile>();
    for (let i = 0; i < 105; i++) {
        files.set(`Project/HomeLabOps/note-${String(i).padStart(3, '0')}.md`, { bytes: noteBytes(`Operations dashboard ${i} for the ops registry.`), mtime: 1000 + i });
    }
    for (let i = 0; i < 20; i++) {
        files.set(`Project/FieldOps/note-${String(i).padStart(2, '0')}.md`, { bytes: noteBytes(`Field ops log ${i}.`), mtime: 500 + i });
    }
    files.set('Project/HomeLabOps/quiet.md', { bytes: noteBytes('A note about tuning guitars, no match here.'), mtime: 7 });
    files.set('Project/FieldOps/quiet.md', { bytes: noteBytes('Another non-matching note.'), mtime: 9 });
    files.set('Project/HomeLabOps/twice.md', { bytes: noteBytes('ops first mention\nops second mention\nops third mention\n'), mtime: 11 });

    const store: Store = await openStore(':memory:');
    const lane = new IntakeLane({
        store,
        source: new FakeFileSource(files) as never,
        embedClient: new FakeEmbedClient(),
        modelTag: 'fake/model',
        epoch: 1,
        chunkerCp: CHUNKER_CP,
    });
    const reindex = await lane.forceReindex();
    // Every file has at least one chunk; the matched set is 126 distinct paths
    // (twice.md contributes several mentions but one path). FIRST-GREEN guard,
    // justified (R14): the corpus must be larger than the lane's cap for S1-S5
    // to bite, so the walk is pinned; measured at HEAD f151846 as 128 files.
    check('S0 lane reindex: 128 files walked, chunks above the 100-row cap', reindex !== null && reindex.files === 128 && reindex.chunks > 100, JSON.stringify(reindex));

    const api: MuninnApi = createMuninnApi(store, null, laneReindexer(lane));

    // Truth measured through the public door at this HEAD would be the capped
    // fetch, so the expectations below are from adr-45's ruling text, not from
    // observed behavior (ADR-10).
    const SCAN_TRUTH = 126;
    const HOME_TRUTH = 106;
    const ROW_CAP = 100;

    // S1 — a scan over a set larger than the lane's cap answers the truth.
    const scan = await api.listNotes({ scan: 'ops' });
    check('S1 scan total is the truth over the whole set (126), not the cap',
        scan !== null && scan.total === SCAN_TRUTH && scan.mode === 'scan',
        JSON.stringify({ total: scan?.total, mode: scan?.mode, rows: scan?.notes.length }));

    // S2 — partialness self-discloses as notes.length against total.
    check('S2 capped answer self-discloses: notes.length below total',
        scan !== null && scan.notes.length === ROW_CAP && scan.total === SCAN_TRUTH && scan.notes.length < scan.total,
        JSON.stringify({ rows: scan?.notes.length, total: scan?.total }));

    // G2 — the row fetch stays capped: the whole set is never served.
    check('G2 the cap stands: 126-note matching set delivers at most 100 rows',
        scan !== null && scan.notes.length <= ROW_CAP,
        JSON.stringify({ rows: scan?.notes.length }));
    check('G2 delivered rows are distinct paths in path ASC',
        scan !== null && sameStrings(scan.notes.map((n) => n.path), [...new Set(scan.notes.map((n) => n.path))]) &&
        scan.notes.map((n) => n.path).every((p, i, arr) => i === 0 || arr[i - 1] < p),
        JSON.stringify(scan?.notes.slice(0, 3).map((n) => n.path)));

    // S3 — a folder-restricted scan counts truth inside the restriction.
    const folderScan = await api.listNotes({ folder: 'Project/HomeLabOps', scan: 'ops' });
    check('S3 folder-restricted scan: truth 106 within the folder, rows capped',
        folderScan !== null && folderScan.total === HOME_TRUTH && folderScan.mode === 'scan' &&
        folderScan.notes.length <= ROW_CAP && folderScan.notes.length < folderScan.total &&
        folderScan.notes.every((n) => n.path.startsWith('Project/HomeLabOps/')),
        JSON.stringify({ total: folderScan?.total, mode: folderScan?.mode, rows: folderScan?.notes.length }));

    // S4 — the 2-character lexical delegation rides the same disclosure.
    const lexicalTwo = await api.listNotes({ lexical: 'op' });
    check('S4 two-character lexical delegates to the scan lane and counts truth',
        lexicalTwo !== null && lexicalTwo.total === SCAN_TRUTH && lexicalTwo.notes.length === ROW_CAP &&
        // adr-50.md (amended in place 2026-11-23 under Dan's implementation authorization; pre-amendment
        // pin covered truth+cap only): mode names the MECHANISM that answered, not the selector asked —
        lexicalTwo.mode === 'scan',
        JSON.stringify({ total: lexicalTwo?.total, mode: lexicalTwo?.mode, rows: lexicalTwo?.notes.length }));

    // S7 — the 1-character lexical selector refuses dark-safe: adr-49.md law, extended to this door by
    //       Dan's 2026-11-23 ruling ("I rule it as already shaped", docket addendum 24) — one floor rule
    //       settles both doors; the payload stops pretending a scan happened. Red earned for this leg
    //       against the committed door (which answered the confident empty set), green at the seam.
    const lexicalOne = await api.listNotes({ lexical: 'a' });
    check('S7 one-character lexical refuses dark-safe — null, not a confident empty set',
        lexicalOne === null, JSON.stringify(lexicalOne));

    // G1 — under the cap, truth == delivered rows; the FTS lane stays unbounded.
    const small = await api.listNotes({ scan: 'guitars' });
    check('G1 under the cap truth equals rows (a small set is not inflated)',
        small !== null && small.total === 1 && small.notes.length === 1 && paths(small).includes('Project/HomeLabOps/quiet.md'),
        JSON.stringify(small));
    const fts = await api.listNotes({ lexical: 'dashboard' });
    check('G1 three-character lexical stays unbounded: truth == rows == 105',
        fts !== null && fts.total === 105 && fts.notes.length === 105 && fts.mode === 'bm25',
        JSON.stringify({ total: fts?.total, mode: fts?.mode, rows: fts?.notes.length }));

    // G3 — a scan matching nothing answers the empty set with truth 0.
    const none = await api.listNotes({ scan: 'zz-no-such-substring' });
    check('G3 scan matching nothing is the empty set with truth 0',
        none !== null && none.total === 0 && none.notes.length === 0 && none.mode === 'scan',
        JSON.stringify(none));

    // S5 — paging over the capped fetch, with the truth as total.
    const delivered: string[] = [];
    for (let offset = 0; offset < ROW_CAP; offset += 40) {
        const page = await api.listNotes({ scan: 'ops', limit: 40, offset });
        delivered.push(...paths(page));
    }
    check('S5 pages cover the delivered window with no path skipped or doubled',
        delivered.length === ROW_CAP && sameStrings(delivered, scan === null ? [] : paths(scan)),
        JSON.stringify({ delivered: delivered.length, first: delivered.slice(0, 2) }));
    const pastWindow = await api.listNotes({ scan: 'ops', limit: 40, offset: ROW_CAP });
    check('S5 offset past the delivered window is an empty page whose total is the truth',
        pastWindow !== null && paths(pastWindow).length === 0 && pastWindow.total === SCAN_TRUTH,
        JSON.stringify(pastWindow));

    // S6 — the filename restriction composes before the count: basename rule
    // matches note-000..note-099 (100) and note-00..note-09 (10) — truth 110,
    // rows still capped. Red at f151846 (the door answered total 100).
    const narrowed = await api.listNotes({ scan: 'ops', filename: 'note-0' });
    check('S6 filename restriction narrows the counted set by basename (110)',
        narrowed !== null && narrowed.total === 110 && narrowed.notes.length <= ROW_CAP &&
        narrowed.notes.length < narrowed.total &&
        narrowed.notes.every((n) => n.filename.includes('note-0')),
        JSON.stringify({ total: narrowed?.total, rows: narrowed?.notes.length }));

    // G5 — the ruled return shape unchanged: no disclosure field added (option (b) was not ruled).
    check('G5 scan answer keeps the ruled shape: notes, total, mode — no extra field',
        scan !== null && Object.keys(scan).length === 3 && sameStrings(Object.keys(scan).sort(), ['mode', 'notes', 'total']),
        JSON.stringify(scan === null ? null : Object.keys(scan)));
    const doorKeys = Object.keys(api);
    check('G5 the frozen surface stays six doors',
        doorKeys.length === 6 && doorKeys.includes('listNotes'),
        JSON.stringify(doorKeys));

    console.log(failures === 0
        ? '[F29] VERDICT: GREEN'
        : `[F29] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
