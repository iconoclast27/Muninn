# ADR-10: Sequencing ruling — contract first, then rulings, then implementation, then the fixture authored from the contract

**Status:** Accepted (retrospective; recorded 2026-11-16); live method doctrine for both projects.
**Ruled:** 2026-10-28, precedent registered under F08 (no-op modification dedup, commit `ec42c33`).

## Context

Fixture-first worked for regressions and failed for virgin territory: a fixture written against
unwritten code encodes the author's guesses, and green-on-first-contact proves nothing. The F08 case
is the named precedent where contract-first ordering produced a meaningful suite (25 checks / 11
scenarios green).

## Decision

- **"Fixture-first is for regressions, not virgin territory."**
- For new territory: **design contract text first → rulings → implementation → fixture authored from
  the contract text, not from observed behavior.**
- **"Contract text before implementation. Fixtures are authored from the contract, not from the
  code."**
- Rulings required before coding are listed before coding ("Before coding, rulings needed on:").
- A fixture that is green before the wiring exists is a hard stop for the phase, not a completion.

## Consequences

The op-loop plan follows this shape: `listNotes` contract (agreed shape) → ruling →
implementation → fixture amended/authored from the contract. The `ApprovalRequest`/envelope red plan
is regression-shaped, so fixture-first is correct there. This ADR is the written basis for
"diagnose before you build".

## Sources

`docs/archive/Session Handover — 2026-10-28.md` (the named ruling, F08 precedent);
`docs/archive/project-definition-file.md` ("contract text → rulings → implementation → fixture");
`docs/archive/Session Note -- 2026-11-01 Morning.md` L143, L254 (fixture-green before wiring = hard
stop); `docs/Session Handover 2026-11-03 Evening.md` ("Contract text before implementation").
