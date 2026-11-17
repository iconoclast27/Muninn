# ADR-33: API design targets code ergonomics, not LLM friendliness

**Status:** Accepted (retrospective; recorded 2026-11-16); live, and it is the shape rationale for
`listNotes` (ADR-37).
**Ruled:** 2026-11-03.

## Context

Plugin 1's API is consumed by harness code, not by the model (ADR-32). Designing an API "for the LLM"
would produce stringly-typed, prose-shaped calls — and the project has already measured what prose
does to a contract.

## Decision

**The index is blank-filling machinery for harness code, never model-facing — which means API design
targets code ergonomics, not LLM friendliness.** API shapes are frozen **before** Plugin 2 builds
(ADR-36); every door is dark-safe (`null` + reason, never throws); results are arrays/objects with
explicit fields, not prose; ordering is stated (ADR-22); limits are parameters, not defaults
(`limit`, not "all").

## Consequences

The agreed `listNotes` shape is this ruling's product: a filter object with explicit fields, a
deterministic result shape (`{ notes: Array<{ path, title, mtime, tags }>, total }`), `null` in the
dark, no schema change, no version event. `criteria.tag` is inexpressible today (ADR-23), so the
filter's tag field must be expressible through the join that exists, not invented.

## Sources

`docs/archive/Session Note -- 2026-11-03 Morning.md` L23 (the ruling, dark-safe, shapes frozen before
Plugin 2 builds); as-built `src/api.ts` (five doors, dark-safe `fail()`) [R];
`Huginn/docs/Serial Contextual Operations Design (Ruled).md` (the agreed `listNotes` shape) [R].
