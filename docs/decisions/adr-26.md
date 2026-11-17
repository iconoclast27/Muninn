# ADR-26: Clean start — a new repo for the rebuilt plugin, not a legacy branch; ngram tokenizer exploration dropped

**Status:** Accepted (retrospective; recorded 2026-11-16).
**Ruled:** 2026-11-03 (two of the ten spec rulings).

## Decision

- **Clean-start a new repo** (`/home/danf/Projects/Muninn`) for the rebuilt plugin; **not** a legacy
  branch of `vault-overseer-index`. The legacy remote was removed; a disk copy remains, named.
- **Ngram tokenizer exploration is unnecessary** — no custom tokenizer work; FTS5 + trigram + `LIKE`
  fallback + embeddings carry the search surface.

## Consequences

Muninn's git history begins at the rebuild; spine-era history lives in the legacy repo and in the
archive. Naming: **product renamed Vault Overseer (FOVEYE) / repo `vault-overseer-index` → Muninn**;
the rename is recorded here so archive filenames do not read as product claims. "Start as we mean to
finish" (UI ruling 2026-10-31) is the same family.

## Sources

`docs/Session Handover 2026-11-03 Evening.md` (both rulings, legacy remote removed, BRAT re-pointed at
Muninn, test-vault spike-plugin noise); `docs/archive/Session Handover Note 2026-10-24.md` (repo
public, pre-Muninn naming); `docs/archive/Session Handover Note 2026-11-02.md` L3 (project identity at
the time); `docs/archive/architecture-map.md` (UI ruling 2026-10-31).
