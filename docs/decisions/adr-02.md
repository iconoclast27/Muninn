# ADR-2: Obsidian Sync ferries the canonical quartet only — the Zone 2 exclusion mechanism

**Status:** Accepted (retrospective; recorded 2026-11-16)
**Ruled:** 2026-10-18 (structural fact adopted as design constraint), restated 2026-11-02.

## Context

The zone model (ADR-1) needs a *mechanism* that makes Zone 2's exclusion real, not a convention.
The archive records the vendor behavior twice, from independent readings.

## Decision

Obsidian Sync structurally excludes everything in a plugin folder except the canonical quartet
(`manifest.json`, `main.js`, `styles.css`, `data.json`), **silently, with no error, no log entry, no
retry**. The design treats this as load-bearing:

- Zone 2 caches (`cache/index.db`) are excluded by construction, so per-device rebuild is the
  expected path, not a failure mode.
- Zone 3 is the syncable surface, and `data.json` carries settings only.
- Consequence for packaging (see ADR-20): you cannot distribute a `.wasm` sidecar — the plugin
  folder's non-quartet files are not ferried, so the engine must be embedded in `main.js`.

## Consequences

Any file outside the quartet must be treated as per-device. Nothing in the design may rely on
plugin-folder state surviving a sync. The silent exclusion means an accidental non-quartet file in
the plugin folder fails quietly — so declared limitations and the doc's own inventory matter.

## Sources

`docs/archive/project-definition-file.md` (quartet-only sync, the exclusion mechanism);
`docs/archive/comparison.md` (finalized 2026-10-19 — "issues disabled… Sync ferries the quartet
only… excluded silently, with no error, no log entry, no retry");
`docs/archive/Session Handover Note 2026-11-02.md` L164.
