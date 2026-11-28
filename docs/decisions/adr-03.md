# ADR 03 — Freshness determination on door results (report over the watermark)

**Status: Accepted 2026-11-28.** Ruling acts (Dan, verbatim, over the priced option set
{A answer-time compare, B edit-time marks, C status quo, D scan-timestamp claim}):
"So freshness is approved." and "So we can indeed go with A." The design conformations below
are the executor's choices, disclosed at acceptance; a conforming revision is a new ADR or a
dated addendum here, never an edit.

## 1. Law

1. **The door reports staleness; the lane repairs it.** The committed lane compare
   (`src/intake/lane.ts:481-483`, watermark size+mtime+content_hash at scan time) stays the
   repair authority, untouched by this act. Report and repair ride ONE watermark at two clocks:
   the flag's whole meaning is the window the repair has not yet closed.
2. **Determination at answer time (the ruled site, A):** for each door result, compare the store
   watermark (`Store.getFile`, `src/store/store.ts:94`/`:351`) against live file facts supplied
   through a NEW factory option `fileMeta` (the Obsidian half is wired at `src/main.ts` from
   `vault.getAbstractFileByPath` → `stat.mtime`/`stat.size`, `FileStats` in the root's
   `docs/research/raw/obsidian.d.ts` — measured). No listener, no mark map, no new lifecycle state.
3. **Honest states.** `Hit.stale: boolean | null` — `true` = drift (live mtime/size ≠ watermark)
   or the file is gone; `false` = verified equal now; `null` = not determined (no `fileMeta`
   wiring, or the path was never ingested). The comparison at answer time cannot carry
   `content_hash` (re-reading bytes is not worth paying); it can only OVER-flag (touch-without-edit),
   never under-flag — the conservative direction required beside the honest-label law.
4. **Rides `Hit`** (searchText scan/bm25 and searchSemantic lanes). The `listNotes` lanes'
   `NotesRow` are NOT flagged by this act — that face stays OPEN.
5. **Model-facing face (conformation, disclosed):** a `[STALE]` per-result marker at the consumer
   render and a shift in the "not freshness" label clause (manifest description and result line) —
   the clause stops being an unqualified denial once a flag rides. Law-bearing description text
   moves only under this act's authority.
6. **Not decided here:** M-f32/M-f33 epoch-leg disposition (re-anchor/retire) — still open,
   its own word owed; the freshness doctrine REPLACES the epoch-stamp mechanics as candidate
   only when that disposition lands.

## 2. Machine halves

M-f30 F rows (authored at the packet leg): live-side drift over the walk's watermarks ⇒
every semantic hit answers `stale: true` (RED-first at the committed door — the field is absent
there); no-`fileMeta` door ⇒ `stale: null`. Huginn side: the mirror `Hit` conforms
(`src/muninn-api.ts`), the consumer render carries the marker — pointer to this file, no restatement.
Smoke halves ride schedule blocks (H6 amended with a dated conform row, H8 web, when authored).
