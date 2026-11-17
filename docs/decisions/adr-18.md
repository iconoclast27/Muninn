# ADR-18: Aggregated disclosure — fold per-path, emit one line total, no per-file chatter

**Status:** Accepted (retrospective, ruling offered and accepted 2026-11-01; recorded 2026-11-16);
live as reporting discipline.
**Ruled:** 2026-11-01 (registered aggregation ruling), reporting shape ruled 2026-11-02.

## Context

The 508-buffer-window incident showed that disclosure volume is a capacity problem: 508 live paths ×
one disclosure per path = the disclosures were lost. Chatter also destroys the signal in the console,
which "is not an observability channel".

## Decision

- **Fold per-path aggregation, emit one line total.** "Novelty emission, not capacity overflow."
- Integrity reporting routes to the store's disclosure door as **one aggregated line per call (reasons
  tallied), never a toast, never per-hit chatter** (the `staleSkips` ruling).
- **First-build spike: one aggregated disclosure line, no per-file chatter.**
- **Reporting is the adapter's decision, not this module's** — the module returns structured counts
  (`{ hits, staleSkips }`); the sink decides what to say. The door surface is frozen by the Store
  Rewrite Specification §4/§6.2; the spine sink is dead (ADR-22).
- **Silence is disqualifying** (R5): every integrity action is logged, loud and named. **Declared
  limitations over hidden ones. Loud over silent.**
- The known-no-op event map moves from "unknown type" warn to **explicit no-ops with rationale**.
- Two-level logging: terse info + reconstructive trace. Add logging at each seam to pinpoint a drop
  (the Scenario H method).

## Consequences

The disclosure rule governs Muninn's rebuild/force-reindex lines, Huginn's drop notices (which must
display unconditionally), and the op-loop's turn disclosure. Aggregation never means suppression: the
tally must be complete.

## Sources

`docs/archive/Session Note -- 2026-11-01 Morning.md` L76 (aggregation ruling), L35 (first-build
spike), L83 (adapter decides reporting); `docs/archive/Session Handover Note 2026-11-02.md` L20
(`staleSkips` → one aggregated line, never toast), L43 (silence map), L207 (loud over silent);
`docs/archive/event-log-schema.md` (R5, silence is disqualifying); as-built Store Spec §4 door
surface [R].
