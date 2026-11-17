# ADR-42: Root placement for the four root documents; living references in `docs/`

**Status:** Accepted — Dan's ruling 2026-11-17. Recorded 2026-11-17.
**Ruled:** Dan, 2026-11-17, verbatim: **"T17/18 -- agreed, root."**
**Closes:** docket **T17** (`CHANGELOG.md` owed), **T18** (`SECURITY.md` owed).
**Extends:** rulings 5 and 6 of 2026-11-16 (`CHANGELOG.md` and `SECURITY.md` owed in both projects), ruling 1
(`docs/archive/` as the archive layout), ruling 4 (shared documents owned by Muninn, Huginn keeps pointer
stubs).

## Context

Rulings 5 and 6 required a `CHANGELOG.md` and a `SECURITY.md` in both projects. The Huginn Phase 3 triage
table named `docs/` as their destination; Phase 4 execution wrote them at the **repo root** in both projects,
and the deviation was reported at the time (it was mine, recorded in the Phase 4 record). The placement
question stayed open as T17/T18.

Two facts decide it. GitHub discovers `SECURITY.md` and `CHANGELOG.md` at the repo root without a click —
the release page links them, and a security report reaches a maintainer through the file's own text. And
`README.md` already lives at the root, so the four root documents sit together in the place a reader
arrives at first. The ADR set, the Design Report, the testing contract, and the protocol documents are
project-internal references, and `docs/` is their home (rulings 1 and 3, and Phase 4 execution: Muninn
`docs/decisions/` = **41 tracked files** measured, Huginn = **37 tracked files** [R]).

## Decision

The four root documents are at the **repo root** in both projects: `README.md`, `CHANGELOG.md`,
`SECURITY.md`, `CONTRIBUTING.md`. Living references (Design Report, ADR set, `TESTING1.md`, the release
ritual, protocol documents, pointer stubs, `docs/Tracked Issues -- Pointer.md`) live under `docs/`. The
canonical docket is `Muninn/docs/Tracked Issues.md` (ADR-40), with Huginn's pointer stub.

Consequences:
- No file moves are needed: Phase 4's execution already matches the ruling, in both repos, measured as
  **51** tracked doc files in each.
- A triage table naming `docs/` for a root document is read against this ruling.
- Placement is not re-opened by a future migration; moving a root document is a ruling, not an
  implementation decision (ADR-36's discipline, generalized to documents).
