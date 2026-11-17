# ADR-35: Compute threading — "a blocked main thread kneecaps model tool calls" is a declared v1 invariant, unmet as-built

**Status:** Accepted (retrospective; recorded 2026-11-16), **with a named as-built deviation.** The
invariant stands; the implementation is owed.
**Ruled:** 2026-10-24/11-01 (declared v1, observed empirically).

## Context

The architecture map declares it as an invariant, observed, not theoretical: model tool calls fail when
the main thread is blocked. As-built Muninn runs the WASM store and the embedding calls on the main
thread, **with no worker** [R], and the semantic lane is a brute-force scan whose cost is declared
debt ("brute-force semantic scan may freeze large vaults").

## Decision

The invariant is recorded as binding design law: **long compute must not sit on the main thread of a
plugin that a model depends on.** The v1 promise ("start as we mean to finish") named it. The as-built
state contradicts it, so the deviation is named, not hidden: **no workers exist in Muninn today.**

## Consequences

This ADR is the authority for the next ruling on the subject: a worker for the store/embedding path,
or a chunked/aborted scan, or a declared limitation with disclosure. Any new long-compute path in
either plugin inherits the obligation. The Design Report records it as drift; the fixture side of it
is the mobile/import-graph cleanliness proof (M1).

## Sources

`docs/archive/architecture-map.md` (the invariant, declared v1, observed);
`docs/archive/HANDOVER - 2026-11-05.md` (brute-force freeze debt); as-built absence of workers in Muninn
`src/` [R]; `docs/archive/project-definition-file.md` ("start as we mean to finish").
