// =============================================================================
// Muninn — F32 (M-f32): the epoch event's two legs — RED fixture
// src/fixtures/f32.ts
//
// Authored from the contract text in docs/T58 Implementation Design (draft -
// not canon).md (B1 and B3 and its fixture plan), NOT from observed behavior
// (ADR-10). The draft is the contract of record for this act, NOT canon: no
// ADR, the docket's T58 row stays OPEN, closure is Dan's.
//
// Rulings of record (2026-11-26): B1 double-fence consumption rides CHUNKER_CP
// 2 → 3 (the one epoch event); B3 degenerate decline at the lane with floor
// DAN'S RULING 4 (non-whitespace UTF-8 bytes, declined at <= 4; the 32-byte
// draft proposal was NOT chosen). Authorized as ruling item 6, numbered M-f32
// (next free, chain extended with no gaps).
//
// Contract clauses asserted:
//   B1a chunker side, direct (chunkNote on double-fence bytes): a closed
//       frontmatter block followed by a further bare '---' line is DECLINED —
//       the second fence never becomes the body's first paragraph. The carve
//       of the double-fence note EQUALS the carve of the same note without
//       the extra fence — RED at HEAD (cp 2 carves '---' absorbed into the
//       body's first chunk). The no-bare-fence-trim leg is a GREEN-ON-BOTH
//       guard (justified: at cp 2 the fence was absorbed, not bare; this leg
//       pins the decline shape against a special-casing fix).
//   B1b lane side: seeded through the lane, notes/template.md carries EXACTLY
//       ONE chunk row whose text is the body paragraph alone — the fence
//       pollution (absorbed or bare alike) is what the bump exists to heal.
//       RED at HEAD (the row text opens with the fence line).
//   B3a degenerate decline (lane-side): a note whose single paragraph is 2
//       nonws bytes keeps its chunk ROW but gets NO embeddings row. RED at
//       HEAD: the floor does not exist, the chunk embeds.
//   B3b floor boundary honesty: a 5-byte-nonws standalone paragraph IS
//       embedded — the floor is 4 (Dan's ruling: measured junk class ≤ 3
//       plus one byte of margin), not 5+. Guard, justified (R14): pins the
//       ruled NUMBER — mislanding the constant breaks it while B3a stays
//       green.
//   B3c rows stay (guard, written justification — the claim protected is that
//       the decline is LANE-side, not chunker-side): both standalone
//       degenerate/boundary paragraphs' chunk rows are present, so a wrong
//       fix that dropped rows at the chunker is caught even though the
//       embeddings leg alone would pass.
//
// NOT asserted here (deliberate, and why): the epoch STAMP legs (chunker_epoch
// / embedder_model_tag consumption and re-stamp) ride the same lane but are
// not in the draft's M-f32 clause list — they land with the schedule/door
// audit, owed their own authorization. The embed batch width 8 → 32 stays a
// RECEIPT (draft item 5: one measured 32-text call against the real model
// before the number ships) — not fixture-policied with a fake client.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f32.ts
// =============================================================================

import { openStore } from '../store/store.ts';
import { IntakeLane } from '../intake/lane.ts';
import { chunkNote, CHUNKER_CP } from '../chunker/chunker.ts';
import { type EmbedClient } from '../api.ts';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');

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

async function main(): Promise<void> {
    console.log(`[F32] epoch-event legs (CHUNKER_CP=${CHUNKER_CP} in this tree) — contract: T58 draft B1/B3`);

    // ---------------------------------------------------------------------
    // B1a — chunker side, direct: the double-fence rule.
    // ---------------------------------------------------------------------
    const doubleFence = enc.encode(
        '---\ntags: [tpl]\n---\n---\n\nReal body paragraph here.\n',
    );
    const singleFence = enc.encode(
        '---\ntags: [tpl]\n---\n\nReal body paragraph here.\n',
    );

    const carveDouble = chunkNote(doubleFence);
    const carveSingle = chunkNote(singleFence);
    const textsDouble = carveDouble.chunks.map((c) => dec.decode(doubleFence.subarray(c.bs, c.be)).trim());
    const textsSingle = carveSingle.chunks.map((c) => dec.decode(singleFence.subarray(c.bs, c.be)).trim());

    check('B1a no chunk of the double-fence note trims to the bare fence (cp: 3 decline)',
        textsDouble.every((t) => t !== '---'),
        JSON.stringify(textsDouble));
    check('B1a the double-fence carve equals the single-fence carve — consumption, not special casing',
        JSON.stringify(textsDouble) === JSON.stringify(textsSingle),
        `${JSON.stringify(textsDouble)} vs ${JSON.stringify(textsSingle)}`);

    // ---------------------------------------------------------------------
    // B1b / B3x — lane side: seed template notes and degenerate paragraphs.
    // ---------------------------------------------------------------------
    const files = new Map<string, VaultFile>([
        // the smoke vault's template shape: closed block, extra fence, body.
        ['notes/template.md', { bytes: doubleFence, mtime: 9 }],
        // B3 seeds: degenerate paragraph (2 nonws bytes) and the floor boundary
        // (5 nonws bytes: 'abcde') — each note's SOLE paragraph, so the carve
        // is standalone (chunker.ts:434 merges adjacent paragraphs under
        // TARGET_BYTES, so beside-text seeds would not carve a degenerate
        // chunk at all — measured).
        ['notes/degen.md', { bytes: enc.encode('ab\n'), mtime: 5 }],
        ['notes/boundary.md', { bytes: enc.encode('abcde\n'), mtime: 7 }],
        // normal signal notes (the decline must not eat the lane).
        ['notes/alpha.md', { bytes: enc.encode('# Alpha\n\nA normal paragraph with plenty of content here for the join.\n'), mtime: 3 }],
        ['notes/beta.md', { bytes: enc.encode('# Beta\n\nAnother normal paragraph with plenty of content too.\n'), mtime: 4 }],
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
    check('F0 lane reindex completes (5 files walked)', reindex !== null && reindex.files === 5, JSON.stringify(reindex));

    const chunkRows = store.query<[string, string, string]>('SELECT path, vh, text FROM chunk_fts')
        .map((r) => ({ path: r[0], vh: r[1], text: r[2] }));
    const embedded = new Set(store.query<[string]>('SELECT vh FROM embeddings').map((r) => r[0]));

    // B1b — the store carries EXACTLY ONE chunk row for the template note,
    // its text the body paragraph alone: the fence pollution — absorbed into
    // the body's first chunk at cp 2 (measured), bare at some hypothetical
    // carve alike — is what the bump exists to heal.
    const tplRows = chunkRows.filter((r) => r.path === 'notes/template.md');
    check('B1b template note: one chunk row, text is the body paragraph alone (RED at cp 2: fence absorbed into the row text)',
        tplRows.length === 1 && tplRows[0].text.trim() === 'Real body paragraph here.',
        JSON.stringify(tplRows.map((r) => r.text)));

    const rowsOf = (p: string) => chunkRows.filter((r) => r.path === p);
    const degenRow = rowsOf('notes/degen.md').find((r) => r.text.trim() === 'ab');
    const boundRow = rowsOf('notes/boundary.md').find((r) => r.text.trim() === 'abcde');

    check('B3c chunk rows STAY for declined chunks (the decline is lane-side, not chunker-side) — guard',
        degenRow !== undefined && boundRow !== undefined,
        `rows=${rowsOf('notes/degen.md').length}/${rowsOf('notes/boundary.md').length}`);

    check('B3a the 2-byte degenerate chunk is NOT embedded (floor decline)',
        degenRow !== undefined && !embedded.has(degenRow.vh),
        degenRow === undefined ? 'no such row' : `${degenRow.vh} embedded? ${embedded.has(degenRow.vh)}`);

    check('B3b the 5-byte boundary chunk IS embedded — floor is 4, not 5+ (number of ruling)',
        boundRow !== undefined && embedded.has(boundRow.vh),
        boundRow === undefined ? 'no such row' : `${boundRow.vh} embedded? ${embedded.has(boundRow.vh)}`);

    // The normal notes must all still embed (the decline must not eat the
    // lane).
    const normalRows = chunkRows.filter((r) => r.path !== 'notes/degen.md' && r.path !== 'notes/boundary.md');
    check('B3d normal paragraphs all embed (decline is scoped to the floor)',
        normalRows.length >= 3 && normalRows.every((r) => embedded.has(r.vh)),
        `${normalRows.length} normal rows, ${normalRows.filter((r) => !embedded.has(r.vh)).map((r) => r.vh).join(',')}`);

    console.log(`[F32] VERDICT: ${failures === 0 ? 'GREEN' : 'RED — ' + failures + ' failing'}`);
    if (failures !== 0) process.exit(1);
}

void main();
