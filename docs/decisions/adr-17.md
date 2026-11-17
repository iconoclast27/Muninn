# ADR-17: Private by default — BRAT distribution, community release is a non-goal, issues disabled, MIT with no warranty

**Status:** Accepted (retrospective; recorded 2026-11-16).
**Ruled:** 2026-11-01 (the comparison's closure section).

## Context

The project is Dan's private tool built with models; the archive records the distribution stance and
the licensing wording as decisions of record, including the deliberate non-goals.

## Decision

- Distribution is **private by default**, via BRAT; **community release is a non-goal**;
  **issues are disabled**.
- **MIT** plus the stated status: "Personal/experimental use. No warranty; use at your own risk."
- The repo flipped public for convenience (2026-10-24, `iconoclast27/vault-overseer-index`), which is
  transport, not a release posture.
- **Plugin 1 must remain useful with Ollama down**: the lexical lane never touches the network, on
  any device. Plugin load must never block on `localhost:11434` being absent.
- **Plugin 2 (Huginn) is a consumer of Plugin 1's frozen API; Plugin 1 does not depend on Plugin 2**
  (ADR-34).

## Consequences

`SECURITY.md` in both projects (Dan, 2026-11-16) states this posture: private/experimental plugin, no
warranty, no issue channel, release assets are not a support commitment. The non-goal list keeps
infrastructure work (publishing, issue triage, packaging for others) out of scope, in the same family
as "Infrastructure is seductive procrastination".

## Sources

`docs/archive/project-definition-file.md` (distribution, licensing, Ollama-absent rule);
`docs/archive/comparison.md` (issues disabled, non-goal list);
`docs/archive/Session Handover Note 2026-10-24.md` (repo flipped public).
