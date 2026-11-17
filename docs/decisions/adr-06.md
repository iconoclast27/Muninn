# ADR-6: Sealed records are immune — corrections are ledgered, addenda govern, ADRs are never edited

**Status:** Accepted (retrospective; recorded 2026-11-16); this rationalization runs on it.
**Ruled:** 2026-10-24 (the comparison's closure doctrine), restated 2026-11-01.

## Context

The project's evidence discipline grew inside documents that kept growing: the comparison doc was
being edited after closure, and the archive is full of docs whose bodies contradict their own later
addenda. The rule is Muninn's own words, mined from the sealed comparison.

## Decision

- **"An autopsy record that keeps growing is a corruption of its own evidence discipline."** A
  sealed record stops growing.
- Corrections to a sealed record are **ledgered, not edited** — recorded as addenda/ledger entries,
  never woven into the body.
- **Where body and addendum disagree, the addendum governs** (it post-dates the body).
- An **ADR is never edited after acceptance.** A changed decision is a new ADR that marks the old one
  Superseded. The superseded ADR keeps its text (with the status line changed), so the decision
  trail stays auditable.
- **Evidence tags carry their generation date:** "an evidence tag must include its generation date";
  source-linked diagrams go stale with the codebase. Docs outside the vault need manual body
  revision dates; frontmatter `modified:` is not evidence.

## Consequences

Phase 4 can seal, archive and tombstone without rewriting history. The Design Report's dated revision
line and its provenance labels are governed by this ADR, and the ADR set itself is append-only.

## Sources

`docs/archive/comparison.md` (closure doctrine, corrections ledgered, addendum governs, evidence-tag
date rule); `docs/archive/project-definition-file.md` (timestamp doctrine);
`docs/archive/Session Note -- 2026-11-01 Morning.md` L144 (rev dates in body, `modified:` never
auto-updates outside the vault); `docs/archive/Session Gitingest Paste Playbook.md` (frontmatter
timestamps are not evidence).
