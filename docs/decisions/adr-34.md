# ADR-34: The plugin boundary — Plugin 2 never touches the vault directly; Plugin 1 owns the index, Plugin 2 owns the assistant

**Status:** Accepted (retrospective; recorded 2026-11-16); live as-built boundary, binding on both
projects.
**Ruled:** 2026-11-03, with the unified Project Definition v0.2 (2026-11-03, one definition covering
both plugins).

## Decision

- **Plugin 2 never touches the vault directly — it consumes Plugin 1's frozen API** (`searchText`,
  `searchSemantic`, `relatedChunks`, `tagVocabulary`), all dark-safe, shapes frozen before Plugin 2
  builds.
- **One unified Project Definition covering both plugins** — "joined-up thinking, discourages
  checklist drift" — so the boundary is stated in one place, in Muninn (the owner, per Dan 2026-11-16;
  Huginn keeps a pointer stub).
- **Corollary binding today:** vault enumeration in Huginn (`app.vault.getMarkdownFiles()`) is
  **forbidden** — a second source of truth. `list` in Huginn must go through Muninn. This is the same
  ruling as "the LLM never touches the index" (ADR-1) applied to enumeration.
- **Dependency direction:** Plugin 1 does not depend on Plugin 2 (ADR-17); Muninn's Plugin-2 skeleton
  and its harness lived in Muninn as the initial design for Huginn, then the generic modules were
  ported to Huginn (2026-11-07) and the Muninn copy is archive material with a tombstone →
  Huginn's harness doc (Dan, 2026-11-16).
- **The harness is not part of the frozen `MuninnApi`** — it is a private property on the plugin
  instance, never a door.

## Consequences

Every Huginn feature that needs vault truth goes through a door; every Huginn write goes through the
gate. Any Muninn-side request to read Huginn's internals is out of scope. The boundary is why the
`listNotes` ruling is a Muninn ruling: the enumeration door must exist before the op can exist.

## Sources

`docs/archive/Session Note -- 2026-11-03 Morning.md` L23, L16; as-built `Huginn/src/muninn-api.ts`
(mirror), `Huginn/docs/Huginn Plugin 2 Harness.md` ("ported to Huginn 2026-11-07"), Muninn
`docs/Plugin 2 Harness.md` ("Port of generic modules to Huginn", fully ticked) [R]; Dan's rulings
(2026-11-15, `list` through Muninn; 2026-11-16, archive Muninn's Plugin 2 material → Huginn).
