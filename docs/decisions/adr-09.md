# ADR-9: Over-ceiling words and paragraphs are carved, never truncated, always disclosed

**Status:** Accepted (retrospective, ratified 2026-10-27; recorded 2026-11-16); live in as-built.
**Ruled:** parked decision #1, ratified 2026-10-27, 28 carves receipted.

## Context

A paragraph longer than the embedding ceiling, or a single word that exceeds it, has to reach the
embedder. Truncation makes the recorded bytes differ from the source bytes, which breaks the killer
invariant (ADR-4) and makes the citation jump lie.

## Decision

**Carve anyway, never truncate, always disclose.** Over-ceiling content is split into real pieces at
byte boundaries, each piece embedded, each piece counted, and the event is disclosed as
`reason=over-ceiling-byte-carved`. Silence is disqualifying.

Receipt: 28 carves, 2026-10-27.

## Consequences

Chunk counts can exceed paragraph counts; consumers must not assume one chunk per paragraph. The
disclosure line is aggregated (ADR-18), not per-file chatter. Any truncation path in the chunker is
a contract violation, not an optimization.

## Sources

`docs/archive/chunker-spec.md` (parked decision #1 ratified, 2026-10-27, carves counted, disclosure
reason string); `docs/archive/Session Note 2026-10-30.md` (the receipted carves).
