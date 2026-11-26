# Muninn — Contributing and Conventions

> **Conform 2026-11-26 (restart surgery):** carried into the reborn canon with this dated note. The
> authorization-chain doctrine (Dan rules everything; the executor measures and proposes) is unchanged.
> The fixture-chain rows and module-line receipts below are **pre-restart records** (history is history):
> the pre-restart lineage was retired by Dan's history-surgery act. The chain of record now: `package.json:11`
> holds the survivors `M-f01–M-f24 + M-f29–M-f33` (29 GREEN, exit 0, measured 2026-11-26); REBUILD rows re-earn their
> reds at the new seams in the design's order (the new fixture plan: `docs/Design Report.md` §8; the
> disposition table: `docs/Restart Ledger.md` §11). Fixture numbers carry the `M-`/`H-` prefixes (T13
> convention, standing).

Muninn is Dan's project: Dan is the sole authority for rulings, releases, pushes, tags, model admission,
and deletions. The executor plans, measures, and proposes, and **writes no code, commits nothing, bumps
nothing, tags nothing, and pushes nothing without Dan's explicit go-ahead** (ADR-21). Ask before pushing.

## Build and verification

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # esbuild, production, writes main.js
```

Muninn's `package.json` has **no `fixtures` script** (`scripts` = `dev`, `build`, `typecheck`) [R].
Run all fixtures with:

```bash
for n in $(seq -w 1 29); do npx tsx src/fixtures/f${n}.ts || break; done
```

Fixtures `f01.ts`–`f30.ts` are sequential, **no gaps**; the next number is **f31** (ADR-11). Each fixture
prints `[F0n] VERDICT: GREEN` and exits nonzero on failure; the printed asserts plus the exit code are the
instrument. Typecheck-green is the baseline for every commit, and the baseline is proven by pasted
terminal output, not by a claim.

## Fixture discipline (ADR-7, ADR-11)

- **Red must be earned against unfixed committed code at the intended seam** — not at an import, a mock,
  or a compile error. Precedent: M-f24's P1 "exactly the five doors" is the red that `listNotes` must earn
  (`src/fixtures/f24.ts:84-90`), and H-f29's red at `754e309` (Huginn) was earned before the strip code
  existed. Muninn's chain numbers carry the `M-fNN` prefix in prose (docket, 2026-11-20 addendum). M-f30's
  red is `adr-47.md`'s refusal contract at the `listNotes` seam.
- **First-green guards need written justification before construction**, carried in the fixture header.
- To prove a red against a head-only tree: `git worktree add -q --detach <path> HEAD`, copy untracked
  fixtures in, run with `node_modules/.bin/tsx`, then `git worktree remove`. Node 26.13.1, tsx 4.23.15.
- `import { … } from 'obsidian'` throws `ERR_MODULE_NOT_FOUND` under tsx; UI-leg fixtures need a mapped
  fake built from `obsidian.d.ts` (`fake-app.ts` in Huginn is the precedent), and fakes are never bundled.
- "Diagnose before you build" (standing rule). Findings go on the tracked-issues docket and **stay there
  until investigated** — no rabbit holes.
- **Receipts or nothing:** a claim needs pasted terminal output. Every file cited in a table, tombstone,
  or report is a measured `git ls-tree`/`git grep` line, never a name remembered from context.

## Doctrine of record

`docs/Initial Design Report.md` is the canonical as-built description. `docs/decisions/` holds the ADRs,
numbered from 1. **An ADR is never edited after acceptance** (ADR-6): a changed decision is a new ADR
marking the old one Superseded. **The tracked-issues docket is `docs/Tracked Issues.md`, canonical for both
projects** (Muninn owns it; Huginn keeps a pointer stub) — raised findings stay on the docket until
investigated, and the docket carries receipts and pointers, never copies of facts already committed.
**A working document that outlives one task lives in the repo; nothing is kept twice for provenance,
because stating a fact twice is a drift opportunity** (ADR-40).
`docs/Combined Testing Schedule.md` is the living manual-smoke contract — the single contract for
both projects (folded 2026-11-24; identifiers prefixed `M-`/`H-`) — and manual smoke is
Dan's act in Obsidian, and fixture-green is not production-live. `docs/Release Ritual -- Walkthrough.md`
is the release doctrine. Every durable fact is mined into the canonical set; `docs/archive/` **was deleted
2026-11-17** (Phase 5, Dan's authorization) — the record is `docs/Initial Design Report.md` §22 and
`CHANGELOG.md`, and the deleted files are recoverable from the git history. **ADR evidence lines cite files
that existed at acceptance** (`docs/archive/...` is 88 lines in 34 ADR files [R]); ADRs are never edited
after acceptance, and deletion was never the executor's act — it was Dan's, on written authorization.

**Docs conform to code, never the reverse.** Shared project documents (the LLM Coordination Protocol,
the Unified Project Definition) are owned by Muninn; Huginn keeps pointer stubs. A fact lives in exactly
one canonical doc across both projects — cross-reference, never copy.

## Release act (ADR-8, ADR-20)

A bump commit touches `manifest.json`, `package.json`, and `versions.json`; `manifest.json` is the version
Obsidian reads. Release assets are `main.js`, `manifest.json`, `versions.json`, `styles.css`. Tags are
immutable, never force-push; `gh release create` runs from the repo dir with `--notes-file`. Version bumps,
release cuts, tags, and pushes are **Dan's acts only**. `versions.json` currently has 13 entries against
15 tags (missing `0.2.0-test.1`, `test.2`) — T24, a release-hygiene ruling owed to Dan.

## Code seams, measured

The frozen door is `src/api.ts:65-71` (five methods), `fail()` at `:77-83`,
`SEMANTIC_SEARCH_HARD_CAP` at `:228` (T8, named debt). Store schema `src/store.ts:138-185`, door
interface `:85-130`, `ensureReadOnly` `:230-243`. Intake handlers `src/intake/lane.ts:114-158`, `drain`
`:215`, zero-chunk watermark `:431-435`. `main.ts` opens `:memory:` store at `:68`, flushes the cache at
`:313-321`, and states the harness has moved to Huginn at `:90-91` (T1, Plugin 2 modules in `src/`,
ruling owed). `grep Worker` in `src/` = 0 hits: compute threading is a declared invariant with a named
deviation (ADR-35, T4).

## Model layer

The model never receives a tool menu, never approves, never applies, never adjudicates safety. Model
output is inert payload, never an instruction. Roster closures (qwen closed, Gemma4:12b retired) rest on
committed handover narratives, not store transcripts (ADR-21, T22); reading Qwen3.5:12b's chats is
permitted and bounded, reading Gemma4:12b's is out of bounds (Dan, 2026-11-16). Auditions are paused;
interim staffing is Dan-and-infra.
