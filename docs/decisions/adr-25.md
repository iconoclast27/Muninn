# ADR-25: The trigram floor — 2-character queries fall back to `LIKE` with disclosed scan mode, 1-character queries return empty with a reason

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-11-03 (one of the ten spec rulings), after the 2026-11-02 live fact.
**As-built seam:** `src/store/store.ts:633-638` (floor logic) and `src/api.ts:116-128` (mode
disclosure). **There is no `src/search/` directory in Muninn** [R] — the FTS doors live in the store.

## Context

The live fact: trigram requires ≥3 characters. `MATCH 'bl'` returned **0 rows with no error** — "a
silent miss, not a throw". CJK two-character words would silently fail. The floor was a ruling owed.

## Decision

- **2-character query → `LIKE` fallback, with `mode: 'scan'` disclosed** in the result.
- **1-character query → empty with a reason** (never a silent zero).
- **Declared limitations over hidden ones**: the disclosure names the mode so a reader can tell a
  scan from an index hit.

## Consequences

Search results carry a mode field; consumers must surface it. The as-built semantic lane
(embeddings + brute-force kNN) does not depend on trigram tokenization, so CJK short-word queries are
served by the semantic lane, not by the trigram index. The archived "needs a ruling" text is superseded.

## Sources

`docs/archive/Session Handover Note 2026-11-02.md` L125 (the live fact, "silent miss, not a throw",
CJK); `docs/Session Handover 2026-11-03 Evening.md` (the ruling among the ten); as-built `src/search`
[verified during mining].
