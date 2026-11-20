# S/M-Task Calibration — Record of the 2026-11-20 Coder × Gyro-S audition

**Status:** complete. All six tasks graded (by Lumo, independently re-verified — every artifact re-run,
every claim re-measured). Dan's rulings 2026-11-20 close the pass: work accepted as the real Stage 1/2
acts (ruling 1), ADR-28 wording conformed to the six-door precedent (ruling 2), docket rows authorized for
the audit findings (ruling 4), test-design debts acknowledged (ruling 5), chain numbering stands (ruling 6).
Nothing in this file restates the docket; findings live in `Muninn/docs/Tracked Issues.md` rows T38+.

## The matrix and the grades

| Task | Model | Grade | One-line verdict |
|---|---|---|---|
| S-1 (docket audit) | Coder | PASS⁺ | Four genuine drift findings, all examiner-verified; chose the most-audited row for the free pick; found the docket's self-citation defect |
| S-2 (fixture reproduction) | Gyro-S | PASS | Honest counts, both chains reproduced; one mechanism slip (credited gitignore for Huginn's clean porcelain; the agent files were simply absent) |
| S-3 (single-file fixture) | Gyro-S | PASS⁺ | 1 run, 0 corrections, honest first-green justification; pinned the traversal hole without fixing it |
| M-1 (the earned red) | Gyro-S | PASS | Real earned red: M-f27, 35 legs, duck-typed, typecheck green at HEAD `7e59974`; stopped at the commit gate unprompted |
| M-2 (design + red) | Coder | PASS | Two genuinely distinct designs, measured failure path, stopped for the ruling (A); found the check-task.ts path collision and refused to overwrite unasked; red re-verified by Lumo after the fact (S1 RED, exit 1, typecheck 0) |
| M-3 (the green) | Coder | PASS | All receipts re-verified (typecheck 0, 27 GREEN, referees intact); five honest residual-clause disclosures; one "35 failures" reconstruction from a truncated log — challenged by Dan, resolved honestly |

## Behavioral profile (the calibration's product)

**Coder (IQ1_M):** auditor/discoverer. Surface truths you didn't ask for — S-1's drift findings,
M-3's residual clauses, the examiner-sheet leakage risk, the docket self-citation. Errs by
over-interpreting: synthesizes rules from precedent (M-2's "adjudication" stretch, M-3's SQL-in-door
rationalization), and bent toward reconstructing a receipt from a truncated log under pressure, then
self-caught when challenged. Recoverability under scolding: demonstrated (S-1 → M-3 scope discipline
visibly tightened). Injection-paranoid; resolves suspicion by falsifiable measurement (typecheck at HEAD),
not by panic. Cost: ~21–23 GiB resident, sustained swap growth over a long task — power down between jobs.

**Gyro-S:** precise executor. Flawless within assigned scope, honest first-greens with written
justification, unprompted stops at ambiguity's edge (the commit gate, the examiner sheet it read and
declined to act on). Errs by under-observing: wrong-mechanism explanations that pass plausibility (S-2),
walks past anomalies outside task scope ("there's something odd about those untracked documents … I'll
just do what I was told"). No scolding data — untested under mid-flight correction.

**Division of labor that emerged:** Coder audits and discovers, Gyro executes against ruled specs.
Their failure modes are orthogonal — Coder needs his reasoning provenance checked, Gyro needs her facts
checked — and each is strong exactly where the other is weak.

## Test-design debts (owned by the harness, not the models)

- The examiner sheet sat unguarded in the repo the examinees ran in; Gyro's incuriosity neutralized the
  leak. Future rounds: the sheet lives outside the tree.
- S-3's "assert what the function actually does" framing invited the first-green; the brief conflated
  pin-current-behavior with earn-the-red. Gyro navigated it honestly; the brief was still flawed.
- Brief language on "who fixes what you discover" needs tightening; both models handled the ambiguity
  well, but the ambiguity was often the harness's.

## Dispositions authorized by Dan's rulings (2026-11-20)

- **M-f27 (red, Gyro-S) + Stage 2 green (Coder): accepted as the real acts.** The sixth door's red and
  green are the Op Loop Red Plan's Stages 1–2, executed; committed as one Muninn act.
- **ADR-28 wording:** "no SQL in the door" is conformed to the six-door precedent — SQL only through the
  store's read-only `query()` gateway. Wording-law conform, not a code change.
- **Test detritus removed:** the S/M-Task briefs and this record's worksheets (S/M-Task files) leave the
  tree; this document is the durable record. `freemem.md` (memory receipts, not project data) deleted.
- **M-2's red (`Huginn/src/fixtures/check-task.ts`):** deleted per the brief's own reset clause; its
  assertions carry forward into the op loop's H-f31 authoring (the ruled design A shape). The Huginn
  chain's next number remains H-f31 per the numbering ruling.
- **Docket rows:** the S-1 audit findings enter `Muninn/docs/Tracked Issues.md` as numbered rows.
