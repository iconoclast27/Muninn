# ADR-16: The FTS5 serving row is self-contained, not external-content — a deviation from the decision of record, ledgered

**Status:** Accepted (retrospective; recorded 2026-11-16). As-built is self-contained.
**Ruled:** Dan, 2026-11-01 (the row as decision of record); deviation ledgered 2026-11-01.

## Context

The archived project definition recorded an FTS5 **external-content** table as the decision of
record. As-built ships a self-contained table. The rationalization's own model case: the decision,
its deviation, and its unburying procedure all live in one place — the archive.

## Decision

- **Self-contained serving row (ruled 2026-11-01):** content lives in the serving row. Rationale:
  "companion content table buys nothing for disposable Zone 2 cache rebuilt by full replacement;
  self-contained keeps served text and citation offsets in one row."
- The earlier external-content decision is **not deleted**; the deviation is **ledgered**, with a
  named unburying procedure: "paste the database-tour notes and reconcile."
- **The corpse-marker rationale** (deleted notes must not be served; the live-set-only rule) is the
  consumer of this row shape: tombstones, renamed-away, absent files never served.
- **`store.query()` is read-only by convention; mutations go through named doors** (ADR-28).
- **SQLite WASM returns positional arrays, not row objects** — every wrapper maps columns
  explicitly, "or fixtures will pass for the wrong reason". Array-shaped mapping is explicit
  everywhere.

## Consequences

The row shape is the store's answer to "what is the minimum that satisfies the citation invariant
(ADR-4) and the live-set rule". The ledger entry keeps the deviation auditable; the unburying path
stays a named procedure, not an archaeology project.

## Sources

`docs/archive/project-definition-file.md` (Dan's ruling 2026-11-01, deviation, unburying procedure);
`docs/archive/Session Note -- 2026-11-01 Morning.md` L50 (external content → self-contained);
`docs/archive/Session Handover Note 2026-11-02.md` L21, L220 (decided-vs-as-built annotation,
fabrication correction, corpse-marker rationale); `docs/archive/REPORT.md` (positional arrays;
pragmas `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout 5000`).
