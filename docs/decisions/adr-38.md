# ADR-38: The Plugin 2 corpus in Muninn is retained as a **named oracle**

**Status:** Accepted — Dan's ruling 2026-11-17. Recorded 2026-11-17.
**Ruled:** Dan, 2026-11-17: **"T1, keep as a named oracle. It's likely it was used to test the API before
freezing. It may even be useful to test your additive method, I don't know."** and **"Let's go with A."**
**Extends:** ADR-34 (the plugin boundary — Plugin 1 owns the index, Plugin 2 owns the assistant), ADR-7
(fixture hostility — a corpus that passes on first contact has not been hostile enough; the oracle must keep
being exercised). Closes docket **T1**.

## Context

Plugin 2's harness was ported to Huginn on 2026-11-07 (Design Report §14), and commit `084a076` removed
every Plugin 2 import from Muninn's `main.ts` and `settings.ts`. The corpus is still in the repo:
`git ls-files src/harness src/llm src/recipes` = **15 tracked files** (harness 5, llm 1, recipes 7,
including `tag-assignment.md`) [R]. `git grep -l "recipes/" HEAD -- src` returns **only the 7 recipe files'
own self-imports** [R] — no Muninn production path reaches the corpus, and Design Report §14 line 150
already records the truth: "**Plugin 2 harness is dormant** — `harness.ts`/`recipe-registry.ts` exist,
nothing calls them; Plugin 2 owns that code, see ADR-7."

Its only consumers are fixtures: **f25** (protocol conformance — registry, prompt safety, approval, dwell,
`maxTurns`) and **f26** (dwell + harness reference counting, 13 assertions). Both are GREEN on every run of
Muninn's fixture loop, so the corpus is exercised, not dead. ADR-27, ADR-28, and ADR-7 record the design
decisions that produced it.

## Options measured

**(A)** Keep as-is and name the role. **(B)** Retire corpus + f25/f26: loses the referees, leaves a gap in
the gapless `f01..f26` chain (Muninn's rule), and forces dated addenda on ADR-7/27/28. **(C)** Retire the
corpus and move the oracle to Huginn: same gap, and Muninn loses the referee for its own API seam.

## Decision

**(A) Keep the corpus as a named oracle.** The 15 files stay tracked, green, and exercised by f25/f26; the
fixture chain stays gapless; no deletions. The corpus's role is stated explicitly: it is **Muninn's live
referee for the interface that `listNotes` (ADR-37) must not disturb** — reference counting and the dwell
rules are guarded by f26, and the approval/registry/prompt-safety contract by f25.

Consequences:
- The corpus is **not** product code, and no Muninn product path may be wired to it without a new ruling.
  Design Report §14's dormancy statement is the standing record of that.
- The duplication with Huginn's ported harness is accepted as the price of keeping the oracle.
- `isDesktopOnly: false` in both `manifest.json:10` is unaffected; the "flip owed" doctrine was already
  retired (ruling 11, 2026-11-15).
- Any future change to the corpus is ruled against f25/f26, never against a passing product path, because
  no product path exists.
