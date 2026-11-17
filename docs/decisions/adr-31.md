# ADR-31: One gate, no write-class in v1 — auto-apply deferred, no plugin-owned write-audit log

**Status:** Accepted (retrospective; recorded 2026-11-16). Partly superseded by Huginn's gated
`write` op ruling of 2026-11-15 (recorded in Huginn's ADR set); the ban's basis stands.
**Ruled:** Dan, 2026-11-03.

## Context

The archived architecture map carried an **auto-apply write carve-out as a ✅ row (2026-10-20)**. The
2026-11-03 ruling killed it: auto-apply was "a future design idea" with no real example, and the only
candidate (frontmatter-fill for template-less notes) was uncommon.

## Decision

- **One gate, no write-class in v1. Auto-apply deferred.**
- The sole candidate — frontmatter-fill for template-less notes — **becomes a suggest-class detection
  skill through the diff gate** (R10), not an automatic apply.
- **Revertibility is rented from Obsidian's version history and trash.** **No plugin-owned write-audit
  log in the schema** — the plugin does not build a write journal it does not need.
- Basis, verbatim: auto-apply is "a future design idea" with no real example (Dan, 2026-11-03). **No
  write-class operation gets shipped without a real, named example.**

## Consequences

The 2026-10-20 auto-apply carve-out is superseded; the 2026-11-03 ban is the record. **The 2026-11-15
rulings in Huginn re-admit a `write` op — one note, always gated, names a recipe, with disclosure at
the gate.** That is a gated re-admission, not a revival of auto-apply: `batch-suggest`/`auto-apply` are
superseded by name. Muninn acknowledges the change (Plugin 1 has no write surface [R]); Huginn owns the
ruling. The write-audit log stays unbuilt.

## Sources

`docs/archive/Session Note -- 2026-11-03 Morning.md` L15 (the ruling, basis, rental of revertibility);
`docs/archive/architecture-map.md` (the superseded auto-apply ✅ row, 2026-10-20);
`Huginn/docs/Serial Contextual Operations Design (Ruled).md` (the gated `write`, R13 superseding
`batch-suggest`/`auto-apply`) [R].
