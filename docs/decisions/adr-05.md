# ADR-5: The ontology ruling — folders are administrative, the link graph is organic, paths are addresses

**Status:** Accepted (retrospective; recorded 2026-11-16); shapes as-built.
**Ruled:** 2026-10-24.

## Context

The index stores notes by path, and the vault's own organization is folders plus links. The design
needed a stated position on what a folder *is*, because rename semantics, related-notes ranking, and
Huginn's target selection all inherit it.

## Decision

**Folders are administrative grouping. The link graph is the organic organization. Paths are storage
addresses, not relationships.**

Consequences, all as-built:

- Path changes are metadata operations, not content operations (R6, rename never re-embeds).
- **`renamePrefix` exists** (`store.ts:469`, `intake/lane.ts:163`) because stock Obsidian emits ONE
  rename event for a folder with **NO child events**; links are maintained, child paths are not. The
  prefix rewrite is the store's response to that vendor asymmetry.
- Related-notes ranking is graph-shaped, not folder-shaped. A folder rename rewrites addresses and
  must not be read as a semantic move.
- The `folder.renamed` rationale has no canonical home except this ADR (the durable form is in
  ADR-22's mining note and `docs/archive/event-log-schema.md`).

## Consequences

Any design that treats folder proximity as similarity, or that assumes child-path updates on folder
rename, contradicts this ruling. The production receipt for folder-rename child paths is still owed
(the Independent Review asked to "smoke-test a folder rename, watch child paths").

## Sources

`docs/archive/architecture-map.md` (Map v0.5, rev. 2026-11-01, ontology ruling 2026-10-24);
`docs/archive/event-log-schema.md` (v0.2, 2026-10-24, `folder.renamed` rationale);
as-built `store.ts:469`, `intake/lane.ts:163` [R].
