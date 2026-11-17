# ADR-11: The typecheck baseline ritual — establish the baseline, keep new code at zero

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built (`npm run typecheck`, `EXIT:0`).
**Ruled:** 2026-10-28, first typecheck in the repo's life.

## Context

The first typecheck in the project's life reported 175 errors. All were pre-existing; zero were in
new code. The lesson is procedural: a tool must be baselined before it can convict anything, and the
baseline is a discovery ritual, not a bug hunt.

## Decision

- Establish the typecheck baseline at the start of a phase; count pre-existing errors; require zero
  new ones.
- Typecheck is a session-close gate (it is item 1 of the session-close ritual, ADR-34 lineage).
- Baseline discovery → toolchain fixes is a named session ritual, not an ad-hoc repair.
- Adding a door breaks full-shape fakes: adding `listNotes` breaks `f22.ts:41` and `f24.ts:56`
  (both build complete `MuninnApi` literals) until both fakes grow. Growth of the frozen surface is
  a ruling, not an implementation decision (ADR-37).

## Consequences

The gate is cheap, deterministic, and runs on Node, not in Obsidian — it cannot be skipped by a
fixture-only claim. "Typechecked but never executed" is a known failure class (ADR-15): typecheck
green is not runtime green.

## Sources

`docs/archive/Session Handover — 2026-10-28.md` (175 → 44, all pre-existing);
`docs/archive/Session Note — 2026-10-29.md` (the witness rule: "when numbers conflict, ask the
witness immediately, don't re-derive"); as-built `npm run typecheck` `EXIT:0` [R].
