# ADR-4: The chunker contract — killer invariant, no normalization, `[bs, be)`, one render function

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** v0.1 2026-10-20; revs 2026-10-24, 2026-10-27.

## Context

Chunks feed embeddings and citations. If recorded byte offsets cannot reproduce the text that
produced an embedding, citation jumps are fiction and dedupe is fraud. Byte-level behavior is also
where CRLF vaults, BOMs, and UTF-8 vs JS string indices bite.

## Decision

- **The killer invariant:** byte offsets recorded must always reproduce the chunk text from the file
  (`file.slice(bs, be) === served text`, offsets verify).
- **Range is inclusive-exclusive `[bs, be)`**, stated once because "it's the kind of unstated
  assumption that kills off-by-one for a decade".
- **The chunker normalizes nothing.** `bs`/`be` are offsets into the file *as stored*; a CRLF vault
  yields CRLF-straddling offsets; CRLF vs LF yields different `vh`s, correctly. A line-ending flip by
  an editor is a real content change and gets re-embedded — "honest, not wasteful".
- `vh = sha256(prefix || chain || fm_context || chunk_text)`. Chunker and embed path share **one**
  `renderEmbedInput()` — "two implementations would be two drift opportunities".
- `fm_context` keys: `type`, `tags`, `aliases`, `description`; canonical serialization = compact JSON,
  keys alphabetical, strings/array elements trimmed, no coercion. Parsing degrades to "no fm_context",
  **never throws** (five ratified degeneracy variants, pinned by fixture C05).
- Property suite P1–P6 (offsets reproduce text; partition; determinism; atomicity; chain correctness;
  idempotent `vh`) plus hostile fixtures C01–C06.
- **JS string indices ≠ UTF-8 byte offsets**; BOM occupies bytes 0–2 and is accounted.

## Consequences

Every consumer of chunk data (search, citation jump, semantic lane, `listNotes`'s title field, which
is the heading chain) must treat `chunks.title` as the heading chain — a heading-less note yields
`title: ''`. Offsets are the contract, not a convenience. Any chunker behaviour change bumps
`chunker_epoch` (ADR-27).

## Sources

`docs/archive/chunker-spec.md` (v0.1, 2026-10-20; revs 2026-10-24, 2026-10-27);
`docs/Session Handover 2026-11-03 Evening.md` (the killer invariant restated as a zone rule);
as-built `src/chunker/render.ts` (prefixes measured at `render.ts:53`).
