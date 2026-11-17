# ADR-15: No erasable-TS syntax in Node-executed files

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built conventions.
**Ruled:** 2026-10-31, first-contact red (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`).

## Context

Modules that typechecked cleanly and then crashed under Node's type-stripping: parameter properties,
enums, namespaces, decorators do not survive erasure. Two files were fixed, `f15.ts` (SpyByteSource)
and `store.ts`.

## Decision

For any `.ts` executed directly by Node (fixtures, spikes, the fixture runner): **no parameter
properties, no enums, no namespaces, no decorators** — field declarations only. The pre-emission
checklist includes "is it erasure-safe?" and "does it parse end-to-end?".

Related rulings in the same family: **"Reasoned ≠ receipted"** — never claim empirical validation
without running the test, never describe buggy code as working; and the fix class "fix the world, not
the code" (a fixture world must obey the contract it polices — `folder.renamed` implies the disk
already moved).

## Consequences

Typecheck green is not runtime green: the fleet must execute, not typecheck. The rule is checked by
the checklist, not by tooling, so it is a convention the executor contract enforces.

## Sources

`docs/archive/Session Note — 2026-10-31.md` (the erasable-TS checklist, the crash, "reasoned ≠
receipted", pre-emission checklist, header truth rule);
`docs/archive/Session Note -- 2026-11-01 Morning.md` L44 (parameter properties crashed Node's
type-stripping); `docs/archive/event-log-fixture-corpus.md` (F15 doctrine earned: "the modules had
typechecked but never executed").
