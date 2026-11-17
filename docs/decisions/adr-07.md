# ADR-7: Fixture hostility and earned red — "a corpus that passes on first contact hasn't been hostile enough"

**Status:** Accepted (retrospective; recorded 2026-11-16); live in as-built discipline.
**Ruled:** 2026-10-24 (fixture corpus v0.1), strengthened 2026-10-26, 2026-10-31, 2026-11-01.

## Context

Fixtures referee the work. The archive records exactly which fixture practices burned the project:
greens that proved nothing, reds that convicted the fixture, wiring declared by fixture-green,
house-order inversions.

## Decision

- **Definition of done includes at least one initially-red fixture**: "a corpus that passes on first
  contact hasn't been hostile enough."
- **Red must be earned. A red against a nonexistent module is a type error, not a test failure. The
  meaningful red is a real interface behaving wrongly.** Red taxonomy: **earned / contrived / vacuous**;
  "contrived red is not earned red"; mutation red is a wiring check, labelled, never counted.
- **House-order inversion (implementation before fixture) is a named debt**, not a sin to hide; the
  exception ledger is the ancestor of first-green-with-written-justification (R14 in Huginn).
- **Wiring debt named, not hidden: "fixture-green is not production-live."** (Exactly the Scenario F
  situation in Huginn: `f27` guards it, never smoked.)
- **Hostility ledger**: per-fixture record of which reds were earned, in which fault classes, counting
  both directions — "the fixture wrong, the code right" convicts the fixture, not the code — with
  "neither inflated".
- **"Every vault bug becomes a fixture before it's fixed."**
- Corpus design rules: fixtures exercise the **public API only** ("if a test needs an internal, the
  internal is really a public"); **corruption injected at the file level**, never by mocking
  internals; **no mocks of the subject's own code, ever**; every fixture asserts the integrity
  contract where applicable (loud, named — silence is disqualifying); **deterministic seeds** ("a
  fixture that fails intermittently is a fixture that hasn't diagnosed itself"); **fast/slow split**,
  "keeping the tight loop tight matters more than total coverage numbers"; salt fixture worlds —
  homogeneous filler is a lying witness; each fixture names its **fail smells**; a fixture may keep
  dead code alive as a named oracle.
- **Parked boundary variants are registered, not scheduled** — "not a red against current behavior,
  an untested path." Paid entries are paid; the parked remainder is next sprint's, not smuggled.
- `untested path` ≠ red. Casts are confessions.

## Consequences

Every new behavior needs a failing fixture first ("any bug fix or new behavior needs a failing
fixture before the code change"). Guards that start green carry a written justification. The ledger
counts both directions, so fixture fixes are recorded as wins. Muninn's fleet and Huginn's
f01–f30 chain run this doctrine; the f31–f36 red plan is the current application.

## Sources

`docs/archive/event-log-fixture-corpus.md` (v0.1, rev. 2026-11-01, corpus design rules, hostility
ledger, parked variants, house rules); `docs/archive/architecture-map.md` (definition of done,
house-order inversion, "fixture-green is not production-live");
`docs/archive/Session Handover, 2026-10-26.md` (the four ground rules + exception ledger);
`docs/Independent Review 2026-11-04.md` (earned-red shape);
`docs/Session Handover 2026-11-03 Evening.md` ("Red must be earned…");
`docs/archive/HANDOVER - 2026-11-05.md` (fixture-first convention).
