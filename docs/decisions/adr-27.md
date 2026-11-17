# ADR-27: Epochs — `chunker_epoch` in meta is the sole authority; a behavioural change bumps the epoch as a rule, not a mechanism

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-11-03 (per-row `cp` dropped); epoch rule restated 2026-11-03 Evening.

## Decision

- **Per-row `cp` (chunker partition marker) is dropped. `chunker_epoch` in meta is the sole
  authority.**
- **Epoch bump on any behavioural change — a rule, not a mechanism.** The epoch is the honest label
  for "these bytes were produced by that rule".
- **Foreign epochs are loudly skipped with disclosure, never verified, never fabricated as
  violations.**
- Schema-version stamping lives **inside the DB, never in the filename**; migration path is wipe and
  rebuild (ADR-23).

## Consequences

Chunker behaviour changes are auditable as epoch transitions. Determinism is the paired rule: **pure
functions — no clock, no locale, no random, no iteration-order luck**, so ordering is always
explicit. "A slow staleness check is a broken staleness check": probe baselines are recorded **after**
the disclosure line, which closed the infinite-rebuild loop (Design Report gotcha).

## Sources

`docs/Session Handover 2026-11-03 Evening.md` (the ruling, the epoch rule, determinism);
`docs/archive/chunker-spec.md` (foreign `cp` handling, P-suite determinism);
`docs/archive/architecture-map.md` (staleness-probe gotcha, schema stamping inside the DB);
`docs/archive/Session Note -- 2026-11-03 Morning.md` L38 (chunker determinism under watermarks —
superseded with the watermark spine).
