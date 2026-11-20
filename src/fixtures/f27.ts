// =============================================================================
// Muninn — F27: listNotes, the sixth door — RED fixture authored from contract
// src/fixtures/f27.ts
//
// Authored from docs/decisions/adr-37.md (Accepted) — the contract of record —
// not from observed behavior (ADR-10). Exercises the public API only (ADR-7):
// notes are ingested through the lane, every assertion enters through the API.
//
// END STATE IS THE RED: the committed API has five doors (api.ts:65-71), so
// the sixth door's legs fail at committed code. Duck-typed accessors are used
// instead of a typed listNotes reference, so the red is a real interface
// behaving wrongly, not a type error (ADR-37 item 4).
//
// Contract clauses asserted:
//   D1  The public API exposes six doors (P1 enumeration pattern, f24.ts:82-92).
//   D2  listNotes exists as a callable door (duck-typed accessor).
//   D3  Set lanes return rows with exactly path/filename/header/mtime/tags —
//       the filename/header split, no 'title' field; filename never empty.
//   D4  ORDER BY path ASC is the single stable order, not mtime-derived.
//   D5  A capped answer self-discloses: notes.length against total says partial.
//   D6  Absent the transport cap means no cap: notes.length === total.
//   D7  offset pages an unbounded set with no note skipped or doubled, under
//       one stable ORDER BY path ASC; total is counted before limit/offset.
//   D8  A heading-less note gives header '' — filename still gives identity.
//   D9  Zero-chunk notes appear (watermark records every walked file,
//       intake/lane.ts:431-435); tags ride the chunks.vh join, so none.
//   D10 A folder filter is a path prefix: descendants included, siblings of a
//       shared prefix excluded; a folder matching nothing is an empty set.
//   D11 filename is a basename substring, lane 'path'.
//   D12 tag is exact vocabulary, no prefix match; lane 'tag'.
//   D13 lexical runs the FTS lane, lane 'bm25', header is the matched chunk's
//       heading chain (chunker chain join, lane.ts:423).
//   D14 folder prefix combined with lexical restricts the bm25 lane to the
//       folder — the combination ADR-37 names as f27's to prove.
//   D15 scan is the substring lane, lane 'scan'.
//   D16 like returns a RANKING: mode 'semantic', no total, limit is k —
//       top-k can never be read as "all notes like X".
//   D17 Every failure path returns null with a console reason via fail()
//       (api.ts:77-83).
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f27.ts
// =============================================================================

import { openStore } from '../store/store.ts';
import { IntakeLane } from '../intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient } from '../api.ts';
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

// Duck-typed door access — never a typed MuninnApi.listNotes reference.
type NotesRow = { path?: unknown; filename?: unknown; header?: unknown; mtime?: unknown; tags?: unknown };
type ListNotesResult = { notes?: NotesRow[]; total?: unknown; mode?: unknown };
type ListNotesDoor = (filter: Record<string, unknown>) => ListNotesResult | null | Promise<ListNotesResult | null>;

type ListOutcome = ListNotesResult | null | { sentinel: string };

async function callListNotes(api: MuninnApi, filter: Record<string, unknown>): Promise<ListOutcome> {
    const door = (api as unknown as { listNotes?: ListNotesDoor }).listNotes;
    if (typeof door !== 'function') return { sentinel: 'missing — typeof listNotes is not function' };
    try {
        return await door(filter);
    } catch (e) {
        return { sentinel: `threw: ${String(e)}` };
    }
}

function ok(r: ListOutcome): boolean {
    return typeof r === 'object' && r !== null && !('sentinel' in r);
}

function rowsOf(r: ListOutcome): NotesRow[] {
    if (typeof r !== 'object' || r === null || 'sentinel' in r) return [];
    return Array.isArray(r.notes) ? r.notes : [];
}

function pathsOf(r: ListOutcome): string[] {
    return rowsOf(r).map((row) => String(row.path));
}

function totalOf(r: ListOutcome): unknown {
    return typeof r === 'object' && r !== null && !('sentinel' in r) ? r.total : undefined;
}

function modeOf(r: ListOutcome): unknown {
    return typeof r === 'object' && r !== null && !('sentinel' in r) ? r.mode : undefined;
}

function detailOf(r: ListOutcome): string {
    return JSON.stringify(r);
}

// Captures fail()'s console.warn reasons while a call runs (api.ts:77-83).
async function withWarnCapture<T>(fn: () => Promise<T>): Promise<{ result: T; reasons: string[] }> {
    const reasons: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]): void => { reasons.push(args.map(String).join(' ')); };
    try {
        return { result: await fn(), reasons };
    } finally {
        console.warn = original;
    }
}

function rowFieldsOk(row: NotesRow): boolean {
    return typeof row.path === 'string'
        && typeof row.filename === 'string' && (row.filename as string).length > 0
        && typeof row.header === 'string'
        && typeof row.mtime === 'number'
        && Array.isArray(row.tags) && (row.tags as unknown[]).every((t) => typeof t === 'string')
        && !('title' in row);
}

function basename(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

// Note bytes: frontmatter (optional tags), optional heading, body.
function noteBytes(title: string | null, body: string, tags?: string[]): Uint8Array {
    const fm = tags && tags.length > 0
        ? `---\ntags: [${tags.map((t) => `'${t}'`).join(', ')}]\n---\n`
        : '---\n---\n';
    const heading = title !== null ? `# ${title}\n\n` : '';
    return enc.encode(`${fm}${heading}${body}`);
}

class FakeEmbedClient implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<{ vh: string; vector: Uint8Array; dim: number; model_tag: string; epoch: number }[] | null> {
        return inputs.map((i) => {
            const dim = 768;
            const floats = new Float32Array(dim);
            // Deterministic but distinct vector per input text length so the
            // semantic lane has signal.
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
    console.log('[F27] listNotes — the sixth door (contract: adr-37.md)');

    // mtimes deliberately scrambled relative to path order: a stable
    // ORDER BY path ASC must not follow mtime.
    const files = new Map<string, VaultFile>([
        ['notes/alpha.md', { bytes: noteBytes('Alpha', 'Machine learning is fun.\n', ['ml']), mtime: 9 }],
        ['notes/beta.md', { bytes: noteBytes('Beta', 'Operations dashboards.\n', ['ops']), mtime: 5 }],
        ['notes/deep/nested.md', { bytes: noteBytes('Nested', 'A nested note deep in the folder.\n'), mtime: 7 }],
        ['notes/empty.md', { bytes: noteBytes(null, '', ['orphan']), mtime: 2 }],
        ['notes/gamma.md', { bytes: noteBytes('Gamma', 'A note about neural networks.\n'), mtime: 8 }],
        ['notes/headingless.md', { bytes: noteBytes(null, 'Plain text with no heading at all.\n'), mtime: 3 }],
        ['notesother/outside.md', { bytes: noteBytes('Outside', 'Operations dashboards too.\n'), mtime: 6 }],
        ['sub/zeta.md', { bytes: noteBytes('Zeta', 'A note in another folder entirely.\n'), mtime: 4 }],
    ]);

    const store = await openStore(':memory:');
    const lane = new IntakeLane({
        store,
        source: new FakeFileSource(files) as never,
        embedClient: new FakeEmbedClient(),
        modelTag: 'fake/model',
        epoch: 1,
        chunkerCp: CHUNKER_CP,
    });

    const reindex = await lane.forceReindex();
    // files=8 walked, chunks=7: notes/empty.md has no chunks yet is walked
    // (watermark recorded inside replaceChunksForPath, intake/lane.ts:431-435).
    check('D0 lane reindex: 8 files walked, 7 chunks', reindex !== null && reindex.files === 8 && reindex.chunks === 7, JSON.stringify(reindex));

    const api: MuninnApi = createMuninnApi(store, null, laneReindexer(lane));
    // Second API with an embedder — the like lane costs one embedder await
    // (ADR-37); the embedder-less api serves D17's embedder-unavailable leg.
    const apiWithEmbedder = createMuninnApi(store, new FakeEmbedClient(), laneReindexer(lane));

    const EXPECTED_NOTES = [
        'notes/alpha.md',
        'notes/beta.md',
        'notes/deep/nested.md',
        'notes/empty.md',
        'notes/gamma.md',
        'notes/headingless.md',
    ];

    // D1 — exact six doors (P1 enumeration pattern, f24.ts:82-92).
    const keys = Object.keys(api).sort();
    check('D1 exposes exactly six doors',
        keys.length === 6 &&
        keys.includes('searchText') &&
        keys.includes('searchSemantic') &&
        keys.includes('relatedChunks') &&
        keys.includes('tagVocabulary') &&
        keys.includes('forceReindex') &&
        keys.includes('listNotes'),
        JSON.stringify(keys));

    // D2 — the sixth door is a callable function (duck-typed).
    const doorType = typeof (api as unknown as { listNotes?: unknown }).listNotes;
    check('D2 listNotes is a callable door', doorType === 'function', `typeof listNotes = ${doorType}`);

    // D3 — set-lane row shape: filename/header split, no 'title' field.
    const folderOnly = await callListNotes(api, { folder: 'notes' });
    check('D3 folder-only returns rows with frozen shape',
        ok(folderOnly) && rowsOf(folderOnly).length > 0 && rowsOf(folderOnly).every(rowFieldsOk),
        detailOf(folderOnly));
    check('D3 filename is the basename, never empty',
        ok(folderOnly) && rowsOf(folderOnly).length > 0 &&
        rowsOf(folderOnly).every((row) => String(row.filename) === basename(String(row.path))),
        JSON.stringify(rowsOf(folderOnly).map((r) => r.filename)));

    // D4 — ORDER BY path ASC is the single stable order (mtimes scrambled).
    check('D4 stable order is path ASC, not mtime-derived',
        JSON.stringify(pathsOf(folderOnly)) === JSON.stringify(EXPECTED_NOTES),
        JSON.stringify(pathsOf(folderOnly)));

    // D5 — a capped answer self-discloses partialness against total.
    const capped = await callListNotes(api, { folder: 'notes', limit: 2 });
    const cappedTotal = totalOf(capped);
    check('D5 capped answer self-discloses partialness',
        ok(capped) && typeof cappedTotal === 'number' &&
        pathsOf(capped).length === 2 && cappedTotal === 6 && pathsOf(capped).length < cappedTotal,
        detailOf(capped));

    // D6 — absent the transport cap means no cap.
    const uncappedTotal = totalOf(folderOnly);
    check('D6 uncapped answer returns the whole set',
        ok(folderOnly) && typeof uncappedTotal === 'number' && pathsOf(folderOnly).length === uncappedTotal && uncappedTotal === 6,
        JSON.stringify({ notes: pathsOf(folderOnly).length, total: uncappedTotal }));

    // D7 — offset pages the set across turns: nothing skipped, nothing doubled.
    const p0 = await callListNotes(api, { folder: 'notes', limit: 2, offset: 0 });
    const p1 = await callListNotes(api, { folder: 'notes', limit: 2, offset: 2 });
    const p2 = await callListNotes(api, { folder: 'notes', limit: 2, offset: 4 });
    const paged = [...pathsOf(p0), ...pathsOf(p1), ...pathsOf(p2)];
    check('D7 pages cover the set with no note skipped or doubled',
        JSON.stringify(paged) === JSON.stringify(EXPECTED_NOTES),
        JSON.stringify(paged));
    const pastEnd = await callListNotes(api, { folder: 'notes', limit: 2, offset: 6 });
    check('D7 offset past the end is an empty page, total still the set size',
        ok(pastEnd) && pathsOf(pastEnd).length === 0 && totalOf(pastEnd) === 6,
        detailOf(pastEnd));

    // D8 — a heading-less note: header '' but filename gives identity.
    const headinglessRow = rowsOf(folderOnly).find((r) => String(r.path) === 'notes/headingless.md');
    check('D8 heading-less note: header is empty string, filename is identity',
        headinglessRow !== undefined && headinglessRow.header === '' && headinglessRow.filename === 'headingless.md',
        JSON.stringify(headinglessRow));

    // D9 — a zero-chunk note appears in the folder listing (files > chunks at D0).
    const emptyRow = rowsOf(folderOnly).find((r) => String(r.path) === 'notes/empty.md');
    check('D9 zero-chunk note appears with identity',
        emptyRow !== undefined && emptyRow.filename === 'empty.md' && emptyRow.header === '' && JSON.stringify(emptyRow.tags) === '[]',
        JSON.stringify(emptyRow));

    // D10 — folder filter is a path prefix: descendants in, prefix siblings out.
    const deep = await callListNotes(api, { folder: 'notes/deep' });
    check('D10 folder prefix includes descendants',
        ok(deep) && JSON.stringify(pathsOf(deep)) === JSON.stringify(['notes/deep/nested.md']),
        detailOf(deep));
    const otherFolder = await callListNotes(api, { folder: 'sub' });
    check('D10 folder filter excludes paths outside the folder (shared-prefix sibling notesother/ excluded)',
        ok(otherFolder) && JSON.stringify(pathsOf(otherFolder)) === JSON.stringify(['sub/zeta.md']),
        detailOf(otherFolder));
    const noMatch = await callListNotes(api, { folder: 'nomatch' });
    check('D10 folder matching nothing is an empty set with total 0',
        ok(noMatch) && pathsOf(noMatch).length === 0 && totalOf(noMatch) === 0,
        detailOf(noMatch));

    // D11 — filename substring, lane 'path'.
    const byFilename = await callListNotes(api, { filename: 'gam' });
    check('D11 filename substring finds the note, mode path',
        ok(byFilename) && JSON.stringify(pathsOf(byFilename)) === JSON.stringify(['notes/gamma.md']) && modeOf(byFilename) === 'path',
        detailOf(byFilename));

    // D12 — tag is exact vocabulary, no prefix match; lane 'tag'.
    const byTag = await callListNotes(api, { tag: 'ml' });
    check('D12 exact tag finds its note, mode tag, tags on the row',
        ok(byTag) && JSON.stringify(pathsOf(byTag)) === JSON.stringify(['notes/alpha.md']) && modeOf(byTag) === 'tag' &&
        JSON.stringify(rowsOf(byTag)[0]?.tags) === JSON.stringify(['ml']),
        detailOf(byTag));
    const byTagPrefix = await callListNotes(api, { tag: 'm' });
    check('D12 tag does not prefix-match (m finds nothing)',
        ok(byTagPrefix) && pathsOf(byTagPrefix).length === 0 && totalOf(byTagPrefix) === 0,
        detailOf(byTagPrefix));

    // D13 — lexical runs the FTS lane; header is the matched chunk's chain.
    const lexical = await callListNotes(api, { lexical: 'neural networks' });
    check('D13 lexical finds the body match, mode bm25',
        ok(lexical) && JSON.stringify(pathsOf(lexical)) === JSON.stringify(['notes/gamma.md']) && modeOf(lexical) === 'bm25',
        detailOf(lexical));
    check('D13 lexical header is the matched chunk heading chain',
        rowsOf(lexical)[0]?.header === 'Gamma',
        JSON.stringify(rowsOf(lexical)[0]));

    // D14 — folder prefix + lexical restricts the bm25 lane (ADR-37: f27's to prove).
    const lexUnrestricted = await callListNotes(api, { lexical: 'operations' });
    check('D14 lexical without folder spans both folders',
        ok(lexUnrestricted) &&
        JSON.stringify(pathsOf(lexUnrestricted)) === JSON.stringify(['notes/beta.md', 'notesother/outside.md']),
        detailOf(lexUnrestricted));
    const lexFolder = await callListNotes(api, { folder: 'notes', lexical: 'operations' });
    check('D14 folder prefix restricts the bm25 lane to the folder',
        ok(lexFolder) && JSON.stringify(pathsOf(lexFolder)) === JSON.stringify(['notes/beta.md']) && modeOf(lexFolder) === 'bm25',
        detailOf(lexFolder));

    // D15 — scan is the substring lane, mode 'scan'.
    const scan = await callListNotes(api, { scan: 'op' });
    check('D15 scan finds substring matches, mode scan',
        ok(scan) && pathsOf(scan).includes('notes/beta.md') && modeOf(scan) === 'scan',
        detailOf(scan));

    // D16 — the semantic lane returns a ranking: mode 'semantic', no total, limit is k.
    const ranking = await callListNotes(apiWithEmbedder, { like: 'neural networks', limit: 2 });
    check('D16 semantic answer is labelled a ranking (mode semantic, no total)',
        ok(ranking) && modeOf(ranking) === 'semantic' && !('total' in (ranking as ListNotesResult)),
        detailOf(ranking));
    check('D16 semantic limit is k: at most 2 rows',
        ok(ranking) && rowsOf(ranking).length <= 2,
        JSON.stringify(rowsOf(ranking).length));

    // D17 — every failure path returns null with a console reason via fail().
    const failureCases: [string, Record<string, unknown>][] = [
        ['empty folder', { folder: '' }],
        ['empty filename', { filename: '' }],
        ['empty tag', { tag: '' }],
        ['empty lexical', { lexical: '' }],
        ['empty scan', { scan: '' }],
        ['empty like', { like: '' }],
        ['limit 0', { folder: 'notes', limit: 0 }],
        ['limit negative', { folder: 'notes', limit: -1 }],
        ['limit NaN', { folder: 'notes', limit: NaN }],
        ['offset negative', { folder: 'notes', offset: -1 }],
        ['like with embedder unavailable', { like: 'neural networks' }],
    ];
    for (const [name, filter] of failureCases) {
        const { result, reasons } = await withWarnCapture(() => callListNotes(api, filter));
        const reasonLogged = reasons.some((r) => r.includes('[Muninn API] dark-safe failure'));
        check(`D17 ${name}: null + console reason`, result === null && reasonLogged, `result=${JSON.stringify(result)} reasons=${JSON.stringify(reasons)}`);
    }

    console.log(failures === 0
        ? '[F27] VERDICT: GREEN'
        : `[F27] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
