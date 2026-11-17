# ADR-36: The API freeze — five doors, dark-safe, fixture-guarded; deviation requires a ruling, not an implementation decision

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built, in force.
**Ruled:** 2026-11-06, commit `be3a1b3` ("docs(api): freeze Plugin 1 public API surface for Plugin 2").

## Context

Plugin 2 (Huginn) builds on Plugin 1's API. If the surface moves while Plugin 2 is building, Plugin 2
is built on sand. The freeze was declared when the store rewrite shipped, and it was made real with a
fixture, not with prose: **F24 polices the frozen shapes and the dark-safe behavior.** The Store
Rewrite Specification was promoted to **Final v3** at the same moment.

## Decision

The frozen public surface is exactly five methods, `src/api.ts:65-71` [R]:

```
searchText(query)              → TextSearchResult | null   // mode: 'bm25' | 'scan'
searchSemantic(text)           → Promise<SemanticSearchResult | null>
relatedChunks(path, k)         → { neighbors: ChunkRef[] } | null
tagVocabulary()                → { tags: TagInfo[] } | null
forceReindex(onProgress?)      → Promise<ReindexResult | null>
```

- **Dark-safe by construction:** `fail()` at `api.ts:77-83` logs the reason to console and returns
  `null`; no method throws. "Every method returns `null + reason` on failure rather than throwing."
- **Breaking a shape is a version event.** The header states it: "The shapes here are frozen forever
  for v0.2; breaking one is a version event."
- **The freeze is fixture-guarded**, not convention-guarded: F24 P1 asserts
  `keys.length === 5` with the five names enumerated (`f24.ts:84-90` [R]); P3/P4 pin the exact
  fields of every return shape; P10 verifies dark-safe `null` returns against the real API for
  empty/invalid inputs (`f24.ts:149-154` [R]).
- **Deviation path, verbatim from the spec footer:** "Any deviation requires a ruling, not an
  implementation decision." Growing the surface is a ruling (ADR-37), and it grows the full-shape
  fakes: `f22.ts:41` and `f24.ts:56` both build complete `MuninnApi` literals, so a new door breaks
  `npm run typecheck` at both until both fakes grow (ADR-11).
- **The harness is not part of the frozen API** — it is a private property on the plugin instance,
  never a door (ADR-34).

## Consequences

Plugin 2 may build only against these five. Every Plugin 2 need that the five cannot serve becomes a
Muninn ruling before it becomes code. The first such ruling is `listNotes` (ADR-37): vault
enumeration is not in the frozen surface, and Huginn is forbidden from taking it into its own hands.

## Sources

`src/api.ts` header + `api.ts:65-71` + `api.ts:77-83` [R]; `src/fixtures/f24.ts` P1/P3/P4/P10 [R];
`docs/Muninn Store Rewrite Specification.md` (Final v3, §4 doors, §6.2 frozen surface, footer);
`docs/archive/HANDOVER - 2026-11-06.md` ("Plugin 1 public API frozen", `be3a1b3`, F24 created);
commit `be3a1b3` [R].
