# ADR-40: Working documents live in the repo; nothing is kept twice for provenance

**Status:** Accepted — Dan's ruling 2026-11-17. Recorded 2026-11-17.
**Ruled:** Dan, 2026-11-17, verbatim: **"The place to store project files that are going to persist is the
repo, and your plan for Tracked Issues.md in Muninn sounded good. As far as the rest of the documents, the
point of rationalising the project documents was to reduce duplication and confusion. To keep things solely
for provenance when they are explicitly stated elsewhere creates duplication, doesn't it? Having something
stated gives clarity. Having something stated twice is an opportunity for drift."**
**Related:** ruling 2 / ADR-6 (records are immutable, so drift is controlled by keeping facts single-sited),
ADR-17 (docs conform to code), ruling 3 (handovers are archive material, the single home of dated narrative).

## Context

Working documents created during the rationalisation lived in `/tmp/opencode/rationalisation/`, which does
not survive a restart, and several of them restated facts already committed in the repos: the Phase 3 triage
dispositions are in the Design Report registries and the tombstones, the commit/push records are in the
Design Reports and `CHANGELOG.md`, the rulings are in the ADR set. Keeping a `/tmp` copy "for provenance"
means the same fact is stated twice, and the two statements drift apart — which is exactly the failure the
rationalisation was built to prevent. The measured inventory of `/tmp` was presented to Dan with this
question; the ruling settles it.

## Decision

- **A document that outlives one task lives in the repo.** `/tmp` is for the length of a single task and
  exists only until the next restart.
- **No provenance-only copies are preserved.** If a fact is stated in a committed doc, the working copy of
  that fact is not kept. Working files whose facts are committed are retired: the triage tables, the Phase 2
  ADR and Design Report drafts, the ruling notes, the receipt logs, and the commit-message files are not
  moved into the repos.
- **The tracked-issues docket is a persisting document, so it lives in the repo**:
  `Muninn/docs/Tracked Issues.md` is **canonical for both projects**, with a pointer stub at
  `Huginn/docs/Tracked Issues -- Pointer.md`. Issues are not duplicated across the repos.
- **The docket itself obeys the rule:** it does not copy the execution record, the approvals, or the
  dispositions. It points at the committed places that state them, and it carries only what is stated
  nowhere else — measured findings, Dan's rulings verbatim, and open questions.
- Receipts stay receipts: pasted terminal output is evidence quoted in the commit messages, the Design
  Reports, and the docket, not a stored artifact.
