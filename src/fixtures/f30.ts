// =============================================================================
// Muninn — F30: co-occurring lane selectors are refused (ADR-47) — RED fixture
// src/fixtures/f30.ts
//
// Authored from docs/decisions/adr-47.md (Accepted, Dan 2026-11-22: "Refuse all
// multi-lane combos, but note that desired functionality may revisit this
// question later.") — the contract of record for this act, not from observed
// behavior (ADR-10). Exercises the public API only (ADR-7): every assertion
// enters through `listNotes`. Two APIs as in f27: the plain door refuses
// `like` dark-safe without an embedder, so the `like`-combination legs must
// ride the embedder-bearing door for the refusal to mean "refused", not
// "infra-failed" — otherwise the red would pass for the wrong reason.
//
// The finding (docket T45, closed by adr-47): the shipped door at Muninn
// `8bb4f04` answers co-occurring selectors by precedence — `like` enters the
// ranking branch and the set selectors are never consulted again
// (`src/api.ts:302`, `:312`, `:373`); `lexical` beats `scan` beats `tag`. No
// combination is refused, no combination is composed, and the ranking lane has
// no `total` to disclose the narrowing.
//
// RED legs, to be earned at Muninn HEAD `8bb4f04` against the committed door:
//   R1  {like, tag}      → must be refused (null). Today: a ranking answers.
//   R2  {like, lexical}  → must be refused. Today: a ranking answers.
//   R3  {like, scan}     → must be refused. Today: a ranking answers.
//   R4  {lexical, scan}  → must be refused. Today: the bm25 set answers.
//   R5  {lexical, tag}   → must be refused. Today: the bm25 set answers.
//   R6  {scan, tag}      → must be refused. Today: the scan set answers.
//
// FIRST-GREEN guards, justified here (R14 — a first-green guard needs written
// justification) because they pin behavior ADR-47 keeps unchanged:
//   G1  Single selectors still answer: `scan` alone (mode 'scan', truth under
//       the cap so rows == total) and `lexical` alone (mode 'bm25') — the
//       refusal must not eat the surviving lane.
//   G2  `like` alone still ranks, and the ranking keeps its ruled shape
//       (adr-37): mode 'semantic', NO `total` field, rows within the k limit.
//   G3  `folder` composes with the surviving lane selector (the f27-ruled
//       `folder`+`lexical` combination, and `folder`+`scan`): ADR-47 refuses
//       lane+lane only; folder/filename narrowing is untouched.
//   G4  The frozen surface stays six doors (M-f24 polices the surface; this
//       pins that this act adds none).
//
// Corpus (7 files): three tagged ops notes under Project/Alpha (FTS, scan and
// tag lanes all bite), an ops-flavored dashboard note under Project/Beta (the
// folder-narrowing bite: lexical 'dashboard' matches 4, folder Alpha narrows
// to 3), two tuning notes under Project/Beta, one quiet note.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f30.ts
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

function noteBytes(body: string, tags?: string[]): Uint8Array {
    const fm = tags === undefined ? '---\n---\n' : `---\ntags: [${tags.map((t) => `'${t}'`).join(', ')}]\n---\n`;
    return enc.encode(`${fm}${body}\n`);
}

async function main(): Promise<void> {
    console.log('[F30] co-occurring lane selectors are refused (contract: adr-47.md)');

    const files = new Map<string, VaultFile>();
    for (let i = 0; i < 3; i++) {
        files.set(`Project/Alpha/op-note-${String(i).padStart(3, '0')}.md`, {
            bytes: noteBytes(`Operations dashboard ${i} for the ops registry.`, ['ops']),
            mtime: 1000 + i,
        });
    }
    files.set('Project/Beta/dash-note-002.md', { bytes: noteBytes('ops-flavored dashboard for guitarists.'), mtime: 9 });
    files.set('Project/Beta/tune-note-000.md', { bytes: noteBytes('Guitar tuning log.'), mtime: 8 });
    files.set('Project/Beta/tune-note-001.md', { bytes: noteBytes('Guitar tuning log, take two.'), mtime: 7 });
    files.set('Project/Alpha/quiet.md', { bytes: noteBytes('A quiet note about luthiers.'), mtime: 6 });

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
    // FIRST-GREEN guard, justified (R14): the corpus is pinned — 7 files, all
    // chunked — because the G1/G3 expectations (truth 4, folder-narrowed 3)
    // depend on the corpus shape, not on the act being tested.
    check('S0 lane reindex: 7 files walked, every file chunked', reindex !== null && reindex.files === 7 && reindex.chunks >= 7, JSON.stringify(reindex));

    const api: MuninnApi = createMuninnApi(store, null, laneReindexer(lane));
    const apiWithEmbedder: MuninnApi = createMuninnApi(store, new FakeEmbedClient(), laneReindexer(lane));

    // Expectations are from adr-47's ruling text, not from observed behavior
    // (ADR-10): a refused query answers null, dark-safe (src/api.ts:104-109).

    // R1-R3 — like with a set selector: the embedder-bearing door, so a
    // non-null answer proves the ranking branch served the unrefused query.
    const r1 = await apiWithEmbedder.listNotes({ like: 'operations registry', tag: 'ops' });
    check('R1 like with tag is refused (null), not a silently narrowed ranking', r1 === null, JSON.stringify(r1));
    const r2 = await apiWithEmbedder.listNotes({ like: 'operations registry', lexical: 'dashboard' });
    check('R2 like with lexical is refused (null)', r2 === null, JSON.stringify(r2));
    const r3 = await apiWithEmbedder.listNotes({ like: 'operations registry', scan: 'ops' });
    check('R3 like with scan is refused (null)', r3 === null, JSON.stringify(r3));

    // R4-R6 — two set selectors: the precedence chain answers the first and
    // evicts the rest today; the ruling refuses the combination.
    const r4 = await api.listNotes({ lexical: 'dashboard', scan: 'ops' });
    check('R4 lexical with scan is refused (null), not the FTS set with scan dropped', r4 === null, JSON.stringify(r4));
    const r5 = await api.listNotes({ lexical: 'dashboard', tag: 'ops' });
    check('R5 lexical with tag is refused (null)', r5 === null, JSON.stringify(r5));
    const r6 = await api.listNotes({ scan: 'ops', tag: 'ops' });
    check('R6 scan with tag is refused (null)', r6 === null, JSON.stringify(r6));

    // G1 — single selectors still answer: the refusal must not eat the
    // surviving lane. Truth under the cap, so rows == total.
    const g1a = await api.listNotes({ scan: 'ops' });
    check('G1a scan alone still answers: mode scan, truth 4, rows 4 (guard)',
        g1a !== null && g1a.mode === 'scan' && g1a.total === 4 && g1a.notes.length === 4,
        JSON.stringify({ mode: g1a?.mode, total: g1a?.total, rows: g1a?.notes.length }));
    const g1b = await api.listNotes({ lexical: 'dashboard' });
    check('G1b lexical alone still answers: mode bm25, truth 4, rows 4 (guard)',
        g1b !== null && g1b.mode === 'bm25' && g1b.total === 4 && g1b.notes.length === 4,
        JSON.stringify({ mode: g1b?.mode, total: g1b?.total, rows: g1b?.notes.length }));

    // G2 — like alone still ranks with the ruled shape: mode 'semantic', NO
    // total field (adr-37: the ranking lane has no total), rows within k.
    const g2 = await apiWithEmbedder.listNotes({ like: 'operations registry', limit: 3 });
    check('G2 like alone still ranks: mode semantic, no total field, rows within k (guard)',
        g2 !== null && g2.mode === 'semantic' && !Object.keys(g2).includes('total') && g2.notes.length <= 3,
        JSON.stringify({ mode: g2?.mode, keys: g2 === null ? null : Object.keys(g2), rows: g2?.notes.length }));

    // G3 — folder composes with the surviving lane selector (f27's ruled
    // combination stays legal; ADR-47 refuses lane+lane only).
    const g3a = await api.listNotes({ folder: 'Project/Alpha', lexical: 'dashboard' });
    check('G3a folder + lexical composes: truth 3, every path under the folder (guard)',
        g3a !== null && g3a.mode === 'bm25' && g3a.total === 3 &&
        g3a.notes.every((n: { path: string }) => n.path.startsWith('Project/Alpha/')),
        JSON.stringify({ total: g3a?.total, rows: g3a?.notes.map((n: { path: string }) => n.path) }));
    const g3b = await api.listNotes({ folder: 'Project/Alpha', scan: 'ops' });
    check('G3b folder + scan composes: truth 3, every path under the folder (guard)',
        g3b !== null && g3b.mode === 'scan' && g3b.total === 3 &&
        g3b.notes.every((n: { path: string }) => n.path.startsWith('Project/Alpha/')),
        JSON.stringify({ total: g3b?.total, rows: g3b?.notes.map((n: { path: string }) => n.path) }));

    // G4 — the frozen surface stays six doors.
    const doorKeys = Object.keys(api);
    check('G4 the frozen surface stays six doors (guard)',
        doorKeys.length === 6 && doorKeys.includes('listNotes'),
        JSON.stringify(doorKeys));

    console.log(failures === 0
        ? '[F30] VERDICT: GREEN'
        : `[F30] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
