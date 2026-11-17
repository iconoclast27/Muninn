# ADR-13: Single-flight — one pump in flight, always

**Status:** Accepted (retrospective; recorded 2026-11-16); live as a rule.
**Ruled:** 2026-10-31; first-contact red 2026-11-01.

## Context

Two pumps ran in flight when a rename outpaced a create. The red named the exact defect: checking the
tail is not guarding the pump, and a promise is not a lock.

## Decision

**One pump, ever.** A `draining` flag gates pump creation; the pump drains serialized work lanes.
Per-op isolation inside a drain ("one bad path poisons the whole queue"). Fire-and-forget ingest
enables resurrection races: apply "one pump ever" literally.

Consequences in as-built: the intake lane is a serialized pump; the delete path purges chunks, FTS,
and watermark atomically (ADR-29), which is the pairing invariant that closes the resurrection hole.

## Consequences

Concurrency is not a feature; a second lane needs a ruling. "A promise is not a lock. Checking the
tail isn't guarding the pump" is the durable sentence to quote when a new lane is proposed.

## Sources

`docs/archive/Session Note -- 2026-11-01 Morning.md` L47 (two pumps red), L146 (draining flag);
`docs/archive/Session Note — 2026-10-31.md` ("One pump, ever…");
`docs/Independent Review 2026-11-04.md` (per-op isolation, fire-and-forget races);
`docs/Session Handover 2026-11-03 Evening.md` (delete atomicity).
