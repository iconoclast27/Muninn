# ADR-23: Store schema — `chunks` keyed `(path, ord)`, `embeddings` keyed `vh`, lazy retention for orphaned vectors

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-11-03 (the ten spec rulings, folded into Store Rewrite Specification v3).

## Decision

- **Schema split:** `chunks` with PK `(path, ord)`, `embeddings` with PK `vh`; `tags` keyed by `vh`
  (added 2026-11-04 as finding 11, Option B; doors `insertTags`/`getTags`/`tagVocabulary`).
- **Lazy retention for orphaned vectors** as the embedding GC: "cache hits beat kilobytes."
- **Delete purges chunks + FTS + watermark atomically** — the pairing invariant, which closes the
  resurrection hole (see ADR-13).
- **`chunker_epoch` in meta is the sole authority** (per-row `cp` dropped, ADR-27).
- **Schema changes bump `schema_version` + epochs; the migration path is "wipe and rebuild."**
- `forceReindex` takes a progress callback (the settings-tab live progress status).
- `Store.countFiles()` door added for load diagnostics.

## Consequences

`tagVocabulary()` returns **counts, not paths**, so a tag→path filter is inexpressible through the
frozen door surface today — the planned `listNotes` filter must not assume a tag index. `chunks.title`
is the heading chain; a heading-less note yields `title: ''`. Every row of the schema is behind a
named door (ADR-28); the schema itself is not public surface.

## Sources

`docs/Session Handover 2026-11-03 Evening.md` (the ten rulings); `docs/Muninn Store Rewrite
Specification.md` (Final v3, §4 doors, §6.2 frozen surface, footer "Any deviation requires a ruling,
not an implementation decision"); `docs/HANDOVER - 2026-11-04.md` (tags table, doors,
`countFiles()`).
