# ADR-37: `listNotes` — the sixth door (Accepted 2026-11-18; implementation owed)

**Status:** **Accepted — Dan's ruling, 2026-11-18.** Drafted **Proposed** 2026-11-16; the contract text
below is the acceptance-time text, written on the ruling. **Nothing is implemented**: no `api.ts` member,
no fixture, no mirror. Implementation is gated separately, in ADR-10's order.
**Prepared under:** ADR-33 (API for code ergonomics), ADR-34 (Plugin 2 never touches the vault
directly), ADR-36 (deviation requires a ruling), ADR-43 (the declared compute limitation).

## Dan's rulings, verbatim (2026-11-18)

The ruling points were presented as six numbered questions; Dan ruled **1, 2, 3, 4 agreed**,
**5. recommendation accepted** (semantic enumeration enters the door now, ranked-only), **6. that waits
on that proposed addons list** (structural predicates, Dataview, deferred to a much-later add-ons list —
the docket row **T37**). Two further rulings from the same exchange: **`title` splits into two fields,
`filename` and `header`** — "title has to be filename, since null information has null value", then
"One would require the path and filename, the other requires the semantic header. So we need to have
filename AND header"; and **`mtime` stays** — "mtime should stay in determining hot/cold notes later. It
hasn't been used because the eventlog drifted away from doing anything useful before it was removed."
Dan also set the guard: **"a hard limit is a sign that the model's query was not specific enough"** and
**"the phrasing of the prompt is the quick guard."**

## Context

Huginn's serial contextual operations include a `list` op (metadata: which notes exist, where, tagged
how). Dan's ruling (2026-11-15): **`list` in Huginn must go through Muninn; vault enumeration in Huginn
(`app.vault.getMarkdownFiles()`) is forbidden** — a second source of truth. The frozen surface (ADR-36)
has no enumeration door, so the op cannot exist until Muninn grants the door. `tagVocabulary()` returns
**counts, not paths**, so a tag→path filter is inexpressible through the frozen surface today [R].

Dan named the two kinds of query the door must serve: the path-defined kind — "Add tags to all notes in
Resource/Guitar folder" — and the semantic kind, "all notes like X". They are not the same kind of
**answer**: the path kind is a **set** (a definite, countable, completable collection), the semantic kind
is a **ranking** (the top-k closest chunks, with no similarity floor, so no natural stopping point). The
contract below states that difference, because the disclosure rule forbids a ranking from being served
as a set.

## The ruled contract

```ts
listNotes(filter: {
    folder?: string;    // vault-relative path prefix
    filename?: string;  // basename substring
    tag?: string;       // exact vocabulary tag, no prefix match
    lexical?: string;   // body words → FTS5 MATCH, mode 'bm25'
    scan?: string;      // body substring → LIKE, mode 'scan'
    like?: string;      // semantic → embedded query + capped brute-force kNN, mode 'semantic'
    limit?: number;     // transport cap: rows handed back, optional, per recipe
    offset?: number;    // paging cursor over the same ORDER BY
}): {
    notes: Array<{ path: string; filename: string; header: string; mtime: number; tags: string[] }>;
    total: number;   // set size counted before limit/offset — absent for the semantic lane
    mode: 'path' | 'tag' | 'bm25' | 'scan' | 'semantic';
} | null;
```

### What the fields mean

- **`path`** is the vault path: the folder identity the model acts on, and the only field a rename
  touches. **`filename`** is the basename, derived from `path`; it is never empty, and it is the handle
  the model cites when it writes. **`header`** is the semantic header: the heading chain of the chunk
  that made the row match — chunk `ord = 0` for a folder/filename/tag-only query, the matching chunk's
  chain for `lexical` and `like`. A heading-less note gives `header: ''`; `filename` still gives
  identity. **`mtime`** is the hot/cold field, held for the later hotness rule. **`tags`** is the
  vocabulary set for the note, through the `chunks.vh` → `tags.vh` join.
- **`mode`** names the lane that ran. It is in the answer, not in the request: the caller's intent is
  already stated by which field it filled in, so a knob that can lie is not needed.
- **`total`** is the size of the matching **set**, counted over the whole set before any cap. It is the
  truth. **`limit`** is how many rows are handed back — transport. **`offset`** makes an unbounded set
  completable across turns, so a 214-note folder is enumerated 40 at a time with no note skipped or
  doubled, under one stable `ORDER BY path ASC`.
- **The boundary sits on transport and on cost, never on truth.** A capped answer self-discloses:
  `notes.length` against `total` says it is partial, and the plan's turn receipt carries that
  comparison. When an internal work cap bites (the scan lane's 100-row `LIMIT`, the semantic lane's
  10 000-chunk scan), the answer must say so; a capped scan is never served as complete.
- **Cost is chosen by the field filled in.** A folder-only `list` reads `files` and embeds nothing.
  `lexical` runs the FTS lane (unbounded rows today). `scan` is the 2-character lane, capped at 100
  chunk rows. `like` costs one embedder `await` plus the capped brute-force scan — the declared
  limitation of ADR-43, accepted by Dan, with disclosure mandatory. A single `query` string with the
  door guessing the lane was **rejected**: it hides an embedding call inside a cheap-looking `list`.
- **The semantic lane returns a ranking and has no `total`.** Its `limit` **is** k. A recipe that needs
  a set builds it from the set-lanes. The contract text itself says this, so top-20 can never be read as
  "all notes like X".

### Expressibility, measured

Five of the six lanes need **no schema change**: `files(path, size, mtime, content_hash)`
(`store.ts:138-143` [R]) supplies path/mtime for **every walked file**, including notes with zero chunks
(the watermark is recorded inside `replaceChunksForPath` even when `records.length === 0`,
`intake/lane.ts:431-435` [R]); `chunks.title` is the heading chain, `c.chain.join(' > ')`
(`intake/lane.ts:423` [R]); `tags` is reachable only through `chunks.vh` → `tags.vh` (`store.ts:171-175`
[R]); `lexical` reuses `chunk_fts` MATCH and `scan` reuses `searchScan` (`store.ts:632-655`,
`store.ts:670-687` [R]); `like` reuses `findSemanticNeighborsByVector` with the hard cap
(`api.ts:228`, used `:249-250`, `k = 20` hardcoded at `api.ts:149` [R]). `path` is **UNINDEXED** in
`chunk_fts` (`store.ts:180` [R]), so it cannot be MATCHed; combining a folder prefix with lexical search
is expressible as a column filter alongside MATCH, and **that combination is f27's to prove, not this
ADR's to assert.** `COUNT(DISTINCT path)` for `total` has precedent in `tagVocabulary()`
(`store.ts:604` [R]).

**Structural predicates are not expressible today.** Dan's use case — "How many notes in the
Project/HomeLabOps folder do not have frontmatter?" — cannot be answered: frontmatter is parsed at chunk
time and used to render the embedding input, and **presence is never recorded**: `frontmatter` appears
nowhere in the store's schema (measured `git grep -n "frontmatter\|fm\b" HEAD -- src/store/store.ts` =
**0 hits** [R]); the partition lives in the chunker, where a first line of `---` opens frontmatter only
if a later line is exactly `---` (`chunker/chunker.ts:152`, `:167` [R]). Answering it needs a column on
`files`, a schema ruling and an epoch bump. **Point 6, ruled:** it "waits on that proposed addons list" —
docket row **T37** (Dataview integration, structural predicates), to be looked at much, much later.

## Growth obligations when implementation is authorized

1. `src/api.ts`: interface member at `:65-71` + dark-safe implementation, composed from store doors,
   **no SQL in the door** (ADR-28); `fail()` reused (`api.ts:77-83` [R]).
2. `src/fixtures/f24.ts` P1: `keys.length === 5` → `=== 6` with `listNotes` in the enumeration
   (`f24.ts:84-92` [R]); plus shape checks (P3/P4) for the new return object, including `mode`, the
   absence of `total` on the semantic lane, and the `filename`/`header` split.
3. Full-shape fakes grow: `f22.ts:41` and `f24.ts:56` [R] — `npm run typecheck` fails at both until both
   grow (ADR-11).
4. New Muninn fixture **f27** (next number; Muninn has `f01.ts`–`f26.ts` [R]), authored from this
   contract text, not from observed behavior (ADR-10), exercising the public API only (ADR-7), with
   **earned red**: f27 is written against the frozen five first, so P1's `=== 6` is a real interface
   behaving wrongly, not a type error. `package.json`'s `fixtures` chain grows by appending f27, **no
   gaps** (the chain is the canonical fixture list; a missing fixture is visible in the line).
5. Huginn mirrors the door in `src/muninn-api.ts:57-63`; Huginn's `list` op is then wired through the
   mirror. Muninn leads, Huginn follows (binding sequencing, Dan 2026-11-15).

## Consequences

The enumeration door becomes part of the frozen surface forever, and the sixth door is the first
expansion of the frozen set — the precedent for every future door is: contract text, ruling,
implementation, fixture from the contract, fakes grown, one release. The **set/ranking split is now
doctrine**: every future door that answers a question must say which kind of answer it gives, and a
ranking must disclose that it is a ranking. If Dan had declined the door, the `list` op would die with it
and Huginn could not substitute a vault read.

## Sources

`Huginn/docs/Serial Contextual Operations Design (Ruled).md` (the shape, `list` through Muninn,
enumeration forbidden) [R]; as-built `src/api.ts`, `src/store/store.ts`, `src/chunker/chunker.ts`,
`src/intake/lane.ts`, `src/fixtures/f24.ts`, `src/fixtures/f22.ts`, `package.json` [R]; ADR-7, ADR-10,
ADR-22, ADR-27, ADR-28, ADR-33, ADR-34, ADR-35, ADR-36, ADR-43; Dan's rulings of 2026-11-18, quoted
above. **No new ADR is created by this ruling**: the ruling accepts the proposed contract, so ADR-37's
status moves to Accepted and its body is the acceptance-time text.
