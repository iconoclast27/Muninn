# ADR-20: Self-contained plugin package — a plugin may have external requirements but must not require extra installations

**Status:** Accepted (retrospective; recorded 2026-11-16); live packaging doctrine for both projects.
**Ruled:** 2026-11-02, Dan's framing adopted as doctrine.

## Context

The `better-sqlite3` path proposed staging `node_modules` into the plugin folder. That kills BRAT
compatibility (BRAT installs the asset set, not a dependency tree) and requires per-device manual
staging.

## Decision

**A plugin may have external requirements (e.g. Ollama) but must not require extra installations in
itself.** The shipped artifact set is `main.js`, `manifest.json`, `versions.json` (+ `styles.css`);
the engine is embedded (ADR-19); **you cannot distribute a `.wasm` sidecar** (ADR-2).

Corollaries in the same family:

- **Console output is not an observability channel.**
- **Deploy between releases is a manual copy; BRAT at release. The plugin triggers on vault reload,
  not on install; one reload after BRAT is the activation ritual** (ADR-8).
- Untracked spike artifacts at repo root are named, not deleted ("do not touch unless asked").
- Test-vault noise (spike plugins) is named as noise and recommended for deletion.

## Consequences

Huginn inherits the same asset set and the same rule: no sidecar, no extra installs, its cache is
Zone 2. `SECURITY.md` (ADR-17) states the external requirement (Ollama for semantic/embedding
features; Huginn needs a chat model endpoint).

## Sources

`docs/archive/Session Handover Note 2026-11-02.md` L66 ("must not require extra installations in
itself"), L78 ("cannot distribute a `.wasm` sidecar"), L96 (quartet-compatible);
`docs/archive/HANDOVER - 2026-11-05.md` (three release assets); as-built asset sets in both repos [R].
