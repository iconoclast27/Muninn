# ADR-24: Governance residency — law lives in the vault under `Agents/`, never in `_vault-index/`

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built.
**Ruled:** 2026-11-03 (one of the ten spec rulings), restated as Zone 1.

## Decision

**Governance lives in the vault under `Agents/` (`SKILLS/`, `Notebook/`, `Memories/`) — never
`_vault-index/`.** Zone 1 is authored law, synced, editable; Zone 2 (plugin folder) is derived
machine state and is never the home of law.

As-built (Huginn, measured): recipes in `Agents/Huginn/SKILLS/`, memory in
`Agents/Huginn/MEMORY/` (corrections, user memory, chat summaries); corrections are written on
validation/apply/user-rejection failure and fed back into dispatcher and recipe prompts.
Muninn's `docs/AGENTS/SKILLS/` is an empty untracked directory [R] — a repo copy of the vault
namespace, a boundary-confusion artifact, deleted by ruling (Dan, 2026-11-16).

Recipe residency ruling (Muninn's design, as-built in Huginn): **plugin defaults + vault overrides
by same-name precedence — "code delivers, vault remembers; survives reinstall."** The proposal-era
`_vault-index/skills/` residency was never ruled and does not count.

## Consequences

Human law is readable and editable outside the plugin, survives reinstall, and syncs. Derived state
never becomes law. Huginn owns the as-built residency facts; Muninn owns the ruling, cross-referenced.

## Sources

`docs/Session Handover 2026-11-03 Evening.md` (the ruling, zone restatement);
`docs/archive/architecture-map.md` (recipe residency); `docs/archive/Session Note -- 2026-11-03
Morning.md` L21/L39 (`_vault-index/skills/` residency flagged unconfirmed, never ruled); as-built
`Huginn/README.md`, `Huginn/docs/TESTING1.md`, `Huginn/src/recipes/bundled.ts` [R].
