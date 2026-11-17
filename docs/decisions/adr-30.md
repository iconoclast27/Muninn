# ADR-30: The semantic lane — FTS5 + brute-force kNN in JavaScript, capped at 10k chunks; vectors never synced; a model change forces a re-embed, loudly

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-11-03 (semantic lane on the store), embedding facts locked 2026-10-18/11-01 (R3/R4);
model-bound fact receipted live 2026-11-06.

## Context

Embeddings were deferred behind FTS wiring ("Layer 2, FTS must be wired first"). The ruling shipped
them: Ollama on the host, `nomic-embed-text`, 768 dims, the R3 prefixes, and a search shape chosen
for a small-vault reality: no vector index, no sync of vectors, no model abstraction.

## Decision

- **Semantic search = FTS5 for lexical + brute-force kNN over all embeddings in JavaScript, capped
  at 10k chunks.** Deferred debt named: brute-force scan may freeze large vaults.
- **Vectors are never synced** (Zone 2, disposable); **model mismatch → rebuild, disclosed loudly**
  (R4, the model fingerprint).
- **`/api/embed` with `input: texts[]` is the batched endpoint** (R7); `/api/embeddings` is
  deprecated. Incumbent batch sizes recorded for comparison: S2B 2, Vault Curate 8, vector-search none.
- **Dimension is a setting, not a probe**: as-built sets it in the settings tab; the warmup `"_"`
  discovery trick is superseded (it was a response to Ollama exposing no model metadata).
- **Ollama is a host-side dependency**: plugin load must never block on `localhost:11434`; the lexical
  lane never touches the network (ADR-17).

**Live receipts (2026-11-06, raw record):** Scenario K passes, the interface works, **semantic search
fails when the Ollama port changes and works when the correct port is restored**, and **a major change
in model results in re-embed.**

## Consequences

The semantic lane is model-bound and port-bound: an Ollama endpoint change is a user-facing event, not
a silent degradation, and a model change costs a re-embed. The 10k cap is a declared limitation, not a
silent truncation. `related-notes` ranking in Huginn consumes this lane through the frozen door.

## Sources

`docs/archive/project-definition-file.md` (nomic-embed-text:v1.5, 768 dims, brute-force kNN at 5,527
files, vectors never synced, model mismatch rebuild); `docs/archive/comparison.md` (R4, R7, batch
sizes, warmup probe, Ollama exposes no model metadata); `docs/archive/testresults-2026-11-06.md`
(the live facts, consolidated into `TESTING1.md` 11-06 [R]);
`docs/archive/Session Note -- 2026-11-01 Morning.md` L136/L279–280 (embeddings deferred — superseded);
`docs/archive/HANDOVER - 2026-11-05.md` (brute-force freeze debt); as-built `docs/TESTING1.md`
(brute-force over all embeddings, capped at 10k chunks, large vaults may freeze) [R].
