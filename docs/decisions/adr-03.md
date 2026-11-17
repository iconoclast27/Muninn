# ADR-3: The requirement table R1–R12 — requirements of record, with live/dead status

**Status:** Accepted (retrospective; recorded 2026-11-16). Requirement status is per-requirement:
eight live, three dead by architecture, one superseded in mechanism.
**Ruled:** finalized 2026-10-19, CLOSED 2026-10-24.

## Context

The project began by comparing incumbents (S2B, Vault Curate, vector-search) to separate the product
from inherited architecture justification. The comparison closed with a numbered requirement table
declared "live as citations, load-bearing forever". The comparison itself is a sealed autopsy record
(ADR-6), so the table needs a canonical home.

## Decision

The requirement table is the requirements of record. **Live in as-built:**

- **R3** embedding prefixes `search_document:` / `search_query:` (required by the nomic model card;
  raw Ollama adds no prefixes) — present in code (`render.ts:53`), absent from canonical docs until now.
- **R4** embedding model fingerprint (model identity bound to vectors; a model change forces a
  re-embed, disclosed).
- **R6** rename never re-embeds (path change is metadata).
- **R7** `/api/embed` with `input: texts[]` as the batched endpoint (`/api/embeddings` deprecated).
- **R8** no volatile runtime state in `data.json` (Zone 3).
- **R9** recipe contracts, not tool menus (see ADR-32).
- **R10** the diff gate as the headline differentiator: schema-valid ≠ correct; every LLM edit gets
  human review in native Obsidian diff.
- **R11** paragraph/heading-chained chunker.
- **R12** paste regions, not bundles.

**Dead (spine-era):** R1, R2, R5 (with the spine, ADR-22).

**Mechanism superseded, requirement live:** dimension discovery by embedding `"_"` at warmup is dead —
as-built sets the dimension in the settings tab. The requirement it served (know the vector width) stands.

## Consequences

The table becomes the acceptance authority for the store: a new subsystem must map to a numbered
requirement, and a subsystem that maps to none and has no consumer dies (the spine's death, ADR-22,
is the precedent). The live/dead column is part of the record: dead requirements are recorded, not deleted.

## Sources

`docs/archive/comparison.md` (Comparison Doc v2, finalized 2026-10-19, CLOSED 2026-10-24);
`docs/archive/project-definition-file.md` (prefixes, nomic-embed-text:v1.5, 768 dims, brute-force
kNN at 5,527 files, vectors never synced).
