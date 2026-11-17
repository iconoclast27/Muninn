# ADR-1: Zone model — three sync classes, Zone 2 disposable, derived-state failure must never damage durable state

**Status:** Accepted (retrospective; recorded 2026-11-16)
**Ruled:** 2026-10-18, revised 2026-11-01, restated 2026-11-03 (clean version), live in as-built.

## Context

The plugin owns two kinds of state: authored human law (notes, skills, governance) and derived
machine state (the index). Obsidian Sync ferries only what it can see, and a plugin folder's
contents are not all syncable. The design question: where does each kind of state live, and what
happens when the derived kind breaks.

## Decision

Three zones, named by **sync class**, not by folder:

- **Zone 1 — authored law:** the visible vault. Durable, fully synced, human- and agent-editable.
  Governance lives here under `Agents/`.
- **Zone 2 — derived machine state:** the plugin folder (`cache/index.db`). Disposable, never
  synced, never human-edited, rebuilt on demand by full replacement.
- **Zone 3 — the quartet:** `manifest.json`, `main.js`, `styles.css`, `data.json`. Settings only;
  **no volatile runtime state in `data.json`** (R8).

Load-bearing rules that came with the zones:

- **Derived-state failure must never damage durable state.** The map's rationale: Zone 2's
  disposability "contains the ABI failure mode: broken binary ⇒ search dark, durable state
  unaffected, rebuild on repair."
- **One writer, one reader door** over Zone 2 (the ancestor is the spine-era "sync conflicts
  eliminated by construction — one writer per shard", witnessed by S2B's `data.json` merged and
  re-uploaded twice in one minute).
- **The LLM never touches the index.**

## Consequences

The index can be deleted, corrupted, or rebuilt at any time at the cost of a reindex. Every
degraded mode is a disclosed, bounded mode ("Dark boot = no lane, no rebuild, nothing owed").
Huginn's cache and `data.json` discipline inherit this model; Huginn's ADR acknowledges it.

## Sources

`docs/archive/project-definition-file.md` (2026-10-18, rev. 2026-11-01);
`docs/archive/architecture-map.md` (Map v0.5, rev. 2026-11-01, zone table + sync-ferry rules);
`docs/archive/Session Handover Note 2026-11-02.md` L206, L64 (live containment receipt: "Zone 2
disposability, verified live"); `docs/Session Handover 2026-11-03 Evening.md` (zone restatement).
