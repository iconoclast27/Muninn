# ADR-43: Compute threading — the declared limitation is taken; no worker is built, disclosure is mandatory, the reopening trigger is named

**Status:** Accepted — Dan's ruling 2026-11-18. Recorded 2026-11-18.
**Ruled:** Dan, 2026-11-18, verbatim: **"Declared limitation, we can revisit if the problem bites."**
**Closes:** docket **T4** — the ruling ADR-35 §Consequences named as owed.
**Extends:** ADR-35 (the invariant stands; the as-built deviation becomes a **ruled disposition**, not an
open question), ADR-30 (the named brute-force debt), ADR-36 (the freeze), ADR-37's growth obligation at
`:46-49` [R].

## Context

ADR-35 declared **"long compute must not sit on the main thread of a plugin that a model depends on"** as
v1 law, observed empirically, and named the deviation: no workers exist. Measured 2026-11-18:
`git grep -il worker HEAD -- src` = **0 hits in Muninn**, **0 hits in Huginn** [R]. The semantic lane runs
brute-force over `chunks ⋈ embeddings` capped at `SEMANTIC_SEARCH_HARD_CAP = 10000` (`api.ts:228`, used at
`:250` [R]), and the scan's own comment names the trade: *"A hard cap limits the worst-case CPU/RAM cost in
the main thread; larger vaults need an ANN extension"* (`api.ts:234-235` [R]).

The doors a model calls are largely synchronous: `searchText`, `relatedChunks`, `tagVocabulary` return
values, not Promises (`api.ts:65-71` [R]). `searchSemantic` is `async` (`api.ts:133-155` [R]) but contains
exactly one `await` — the embedder call at `:144` — and the scan at `:153` runs synchronously, so the
async shape does not move the scan off the thread. Measured: `git grep -n "await" HEAD -- src/api.ts`
returns **two hits**, `:144` and `:200` [R].

Declaring the limitation is already doctrine, not a new invention: `docs/Initial Design Report.md` §7
records **"The 10k cap is a declared limitation, not silent truncation"** and names **"brute-force scan may
freeze large vaults"** as debt (ADR-30, `adr-30.md:16` [R]). The lexical lane is the disclosure precedent:
`mode` rides the frozen shape (`TextSearchResult.mode`, `api.ts:28-31` [R], guarded at `f24.ts:106` [R]),
with the ruled floor "declared limitations over hidden ones" and "partial indexes never served as complete".

What made the ruling urgent is Huginn's op loop. A turn at bound 12 costs ~2N+2 ops and ~3N+2 LLM calls
for N notes, and **"a 12-op turn may run minutes on local Ollama"** (Huginn
`docs/Serial Contextual Operations Design (Ruled).md:132` [R]). Every `list` is a door call, every `read` a
vault read, every `write` a harness sub-run — all on the thread that must render the approval gate, honour
Stop, and keep the stream alive. ADR-37's contract text already demands the cap not sit in the main thread
(`adr-37.md:46-49` [R]).

## Decision

Three parts, exactly as ruled.

1. **Declared limitation, taken.** No worker is built for the store/embedding path, and no scan
   restructuring is authorized by this ruling. Long compute stays on the main thread, bounded by stated
   caps, and the limitation is declared in the docs of record: Muninn `docs/Initial Design Report.md` §7,
   this ADR, `README.md`'s user-facing line, and the Huginn plan. **ADR-35's invariant is not repealed** —
   it remains binding law for any **new** long-compute path in either plugin; what changes is that the
   as-built state now has a ruling attached, so T4 is discharged and the loop's gates shrink to T15 and T13.
2. **With disclosure.** A capped result must say it is capped. ADR-37's `listNotes` carries this by
   construction: `total` counted **before** `limit`, `limit` as a parameter and not a default, `mode`
   disclosing scan semantics. **This ruling does not grant a disclosure field inside a frozen door**:
   `f24.ts:111` pins `SemanticSearchResult` to `{ hits }` with `!('mode' in s)` [R], so adding a disclosure
   field to `searchSemantic` is an ADR-36 surface change requiring its own ruling. `searchSemantic`'s cap
   remaining invisible to the caller is part of what is declared.
3. **The reopening trigger is named.** "If the problem bites" is a measured live receipt, not a judgement
   call: a real vault, in Obsidian, where a door call blocks the main thread long enough to stall the UI,
   the approval gate, or the model stream — raised as a live-receipt row on the docket, in Dan's act.
   Reopening means the middle option (chunked scan with aborts that yield to the event loop) or the
   expensive one (a worker), each as **a new ruling**, per ADR-36's discipline. The loop plan's abort
   threading (`Huginn/docs/Op Loop Red Plan.md` §3, Stage 11 [R]) is loop machinery, not scan work; this
   ruling neither adds nor removes it.

## Consequences

- **The loop's `list` inherits the limitation directly.** ADR-37 states absent `limit` means no cap, so an
  unbounded enumeration walk is a main-thread walk, and the loop calls `list` repeatedly inside one turn.
  The consequence is accepted as declared: the loop's turn receipt must surface a partial `list` (the
  `total` against the returned count) alongside the bound notice.
- **Disclosure is not negotiable.** A declared limitation is only legitimate when the result says so. If a
  future ruling strips `total`-before-`limit` from `listNotes`, this ruling does not survive it: silent
  truncation under a declared limitation is the exact hidden limitation the lexical lane's ruling exists to
  prevent (`docs/Initial Design Report.md` §7 [R]).
- **T8 (ANN for >10k chunks) stays open** as named debt behind an epoch bump. This ruling does not build
  it, and it is the vector by which the problem bites first on a large vault.
- **No fixture is owed for thread behaviour by this ruling.** No code path is introduced, so there is no
  seam to make red (ADR-7: red is earned at committed code). ADR-35's fixture-side obligation — the
  mobile/import-graph cleanliness proof, ADR-14 / M1 — is untouched.
- **Muninn's release act is undisturbed.** The ruling adds no code, so the sixth door (`f27`'s red, ADR-37)
  rides Plugin 1's release exactly as planned, and the run-all range moves to `seq -w 1 27` when f27 lands.
- `docs/Op Loop Red Plan.md` §3 Stage 0 loses T4 from its gate list; **T15** then **T13** are the gates.
- No version, tag, release, or code change is authorized by this ruling.

## Sources

Measured [R]: Muninn `src/api.ts:28-31, 65-71, 133-155, 228, 234-235, 244-268`; `src/fixtures/f24.ts:106,
111`; `git grep -n "await" HEAD -- src/api.ts` = 2 hits; `git grep -il worker HEAD -- src` = 0 hits in
Muninn and 0 in Huginn; Muninn `docs/Initial Design Report.md` §7, §13; `docs/decisions/adr-30.md`,
`adr-35.md`, `adr-36.md`, `adr-37.md`; Huginn `docs/Serial Contextual Operations Design (Ruled).md:132`,
`docs/Op Loop Red Plan.md` §2 (row 67), §3 (Stage 0, Stage 11), §6; `docs/Tracked Issues.md` row T4. Dan's
ruling verbatim, 2026-11-18.
