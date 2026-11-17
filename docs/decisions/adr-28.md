# ADR-28: All SQL behind store doors; `query()` is read-only with a first-keyword allowlist

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built, stricter than spec.
**Ruled:** 2026-11-03 (the allowlist ruling, one of the ten), earned by the 2026-10-31 SQL routing
red, verified by the 2026-11-04 review (the read-only guard is "stricter than spec").

## Context

The first SQL routing red: a `folder.renamed` handler routed its `UPDATE` through `store.query()`,
whose `.all()` on a row-less statement threw better-sqlite3's "This statement does not return data.
Use run() instead." The fix added named doors (`pathsInRange()`, `updateChunkPath()`). The doctrine
line: "all SQL lives behind store doors, the lane composes calls only, `query()` stays read-only."

## Decision

- **Every SQL statement lives behind a named store door.** The lane composes calls; it never writes
  SQL.
- **`query()` is read-only, guarded by an allowlist on the first SQL keyword** — not a convention, a
  guard. The as-built guard is stricter than the spec required.
- Mutations go through named methods (ADR-16), and the frozen door surface (ADR-37) is the only
  public path.
- **Declared-but-unenforced furniture is a defect**: a decorative foreign key with `PRAGMA foreign_keys`
  never ON, WAL on `:memory:` (inert) — "declared limitations over hidden ones means: drop the FK or
  enable the pragma."

## Consequences

The store's surface is enumerable and frozen. Adding a door (e.g. `listNotes`) is a ruling, not an
implementation decision, and grows the full-shape fakes (ADR-11). The `ts` column is never trusted for
ordering (ADR-22), so every door that returns an ordered set states its ordering.

## Sources

`docs/archive/Session Note -- 2026-11-01 Morning.md` L45 (the SQL routing red, the doors added);
`docs/archive/event-log-fixture-corpus.md` (the doctrine line); `docs/Session Handover 2026-11-03
Evening.md` (allowlist ruling); `docs/Independent Review 2026-11-04.md` (guard stricter than spec,
unenforced furniture, dead code paths named, aspirational comments named); as-built `src/store/store.ts`
doors + allowlisted `query()` [R].
