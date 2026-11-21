# ADR-44: T12 Design A — the bounded schema retry becomes ADR law; the docket-only ruling is superseded

**Status:** Accepted — Dan's ruling 2026-11-21 ("T41 C"). Recorded 2026-11-21.
**Ruled:** Dan, 2026-11-21, verbatim: **"T41 C"**, **"Yes, on T41, supersede the earlier ruling"**,
and the canon doctrine: **"canon information lives in the preserved design docs, the docket and ADRs.
The design docs are the historical source, and ADRs should track every design change"**,
**"The docket should track all open issues"**, and the attribution ruling: **"The previous agent
muddled up an audition document, which is not project-related but model-related"** — Dan ruled the
calibration record's *move to the vault*; Dan did not rule that design information lived in it,
because it wasn't there.
**Closes:** docket **T41** — Dan's ruling 2026-11-21 (option C: re-point accepted + Design A ruled an
ADR).
**Supersedes:** the executor-attributed docket-only statement in `docs/Tracked Issues.md` T41 row
("Design A appears legitimately only in the docket") — the executor attributed it to Dan; it was not
Dan's ruling. Superseded by this ADR.
**Origin:** the third addendum's ruling-3 clause in `docs/Tracked Issues.md` (Dan's dated act of
2026-11-20) — the historical source of the ruled shape, carried forward unedited.
**Extends:** ADR-34's staging amendment stands (Design A lands inside the merged release pair).

## Context

Design A's retry was ruled 2026-11-20 (docket T12 row, third addendum ruling 3), but its verbatim
design text proved **unrecoverable**: the docket's claim that the text "is recorded verbatim in the
vault record" was false when written (docket **T41**, measured: vault record 63 lines, 0 hits for
`Design A` and `-i retry`; `check-task.ts` — where the text lived — never tracked, 0 commits in both
repos; blame: the claim added by `9ab0c55`). The muddle, ruled by Dan 2026-11-21: an *audition*
document (the calibration record) is **model-related, not project-related**; the agent treated it as
the design text's home of record, which it never was.

Canon doctrine, ruled by Dan 2026-11-21: canon information lives in the **preserved design docs, the
docket, and ADRs**; the design docs are the **historical source**, ADRs **track every design change**,
and the docket **tracks all open issues**. Design A — a design change to the harness — therefore
belongs in an ADR, which is this one.

Until this ADR, the assertion source of record was the ruling-3 clause alone. Dan ruled 2026-11-21
(option C): accept the re-point **and** rule Design A an ADR, superseding the docket-only statement.
The committed implementation (Huginn `src/harness/harness.ts`, retry loop, run-local feedback) and
the earned red + green of **H-f31** already assert this shape; this ADR makes the decision law.

## Decision

**Design A is the ruled shape of T12** — bound in `harness.ts`; one retry; feedback run-local, never
corrections; infra nulls consume nothing; Stop parity inside the retry window; terminal shape
(`RecipeRunResult`) unchanged. The shape's historical origin is the third addendum's ruling-3 clause
(2026-11-20, Dan's dated act, carried forward verbatim in the docket); from this ADR, the law is
here, and ADRs track every future design change.

Three rulings of 2026-11-21 attach to the shape (each recorded verbatim in the docket's fourth
addendum, which stays the carrier of Dan's dated acts):

1. **Design A asserts inside H-f31** — no separate fixture.
2. **Option (b):** the final-failure schema-error correction on retry exhaustion stays; f13's
   correction-channel invariant is not disturbed.
3. **Mechanism where the ruled shape is silent is the executor's to propose** — the machine-readable
   code vocabulary, the constant's export visibility, the feedback's prompt-ride, the executor seam
   shape, the criteria-lane mapping, the correction-count refinement, the terminal-key pin. All
   enumerated in `Huginn/src/fixtures/f31.ts`'s header for reviewer review; a reviewer challenge
   re-points the fixture to this ruling, never to the code.

## Consequences

- Carriers, per Dan's doctrine: **design docs** = historical source; **ADRs** = law, tracking every
  design change; **the docket** = the tracker of all open issues plus Dan's dated acts. Design A's
  distinguishing vocabulary lives in this ADR and the docket's dated addenda (Dan's acts); the T12
  row prose re-points here and no longer restates the shape (grep test).
- The implementation stands as-committed: it matches the ruled shape; no code move follows this ADR.
- The executor choices above remain reviewable items, not defects of design fidelity.
- The false verbatim-copy claim stays corrected as applied (pointer to this ADR as the source of
  law); T41 closes with Dan's ruling; the audition record stays model-local agent memory in the
  vault, not project canon.
