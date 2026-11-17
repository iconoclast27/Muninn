# ADR-32: The model judges, the harness acts — no tool menus, contracts not menus, the diff gate as the differentiator

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built (cross-project).
**Ruled:** 2026-10-19/10-20 (R9, R10), restated 2026-11-03.

## Decision

- **The model judges; the harness acts.** The model never receives a tool menu, never composes, never
  executes.
- **Recipes are declarative Markdown forms with strict JSON output contracts** (R9). The harness
  validates the model's output against schema and vault truth before any apply routine runs.
- **The diff gate is the differentiator** (R10): schema-valid ≠ correct; every LLM edit gets human
  review in native Obsidian diff.
- This kills the observed S2B failure mode: models inventing tools like `execute_javascript`.
- **The index is blank-filling machinery for harness code, never model-facing** (ADR-33) — the index
  is not in the model's tool surface, and "the LLM never touches the index" (ADR-1).

As-built in Huginn: `src/harness/` (loader, renderer, JSON-schema validator, diff gate, apply
registry, LLM client, orchestrator), `src/chat/dispatch.ts` refuses non-envelope JSON → plain-chat
fallback [R], the approval gate + modal [R], six bundled recipes [R].

## Consequences

Verbosity is model-facing, never a display filter (Huginn R4). Payloads are authored by the recipe
sub-run, never by the model (Huginn R8). Any design that hands the model a menu of vault operations
contradicts this ADR, and the command palette stays single-shot.

## Sources

`docs/tool-skill-strategy.md` (R9, R10, 2026-10-19/10-20); `docs/archive/Session Note -- 2026-11-03
Morning.md` L21 ("the model judges; the harness acts", S2B failure mode, recipes as declarative
Markdown); `docs/archive/comparison.md` (R10 as headline differentiator); as-built
`Huginn/src/harness/*`, `src/chat/dispatch.ts` [R].
