# ADR 01 — The narrowed door contract (Muninn)

Status: **Accepted — Dan's ruling act 2026-11-27 (verbatim: "ratified.").** Ratified as
proposed: the contract text below is canon, and the field ceremony (`tie`, `band`, and
the score carriers) landed AS PROPOSED (the R-2 "ratified as proposed" convention).
This file is never edited after acceptance; changed decisions are new ADRs + dated
addenda. Implementation remains gated on the per-leg acts, in T15 order: door
(`api.ts` narrow) → Huginn mirror (`muninn-api.ts`) → the op in the loop.

## Authority chain

- D-2 (boundary law — semantics = Muninn, structure = Obsidian) + D-16 (authored design
  green light): the narrowed door is Dan's authored artifact; the Coder-presumption guard
  is satisfied by the design act, not by Coder's judgment.
- R-2 (ratified 2026-11-26, Restart Ledger §11): all §7 Muninn rows ratified as proposed
  except the `api.ts` **path-answer leg DEMOLISH**. Measured scope of that leg: the
  `listNotes` browse fixtures `M-f27/M-f28` retired with it (Ledger §323), while `M-f29`
  (scan lane) and `M-f30` (lane selectors) stay on the chain — so the leg is the **path
  lane inside the `listNotes` frame**, not the whole frame.
- T15 precedent: the narrowed-contract act leads implementation of `api.ts`; the Huginn
  mirror (`src/muninn-api.ts`) and the M-f04/f24/f31 SALVAGE rows re-earn there,
  sequentially, after it.
- Measured blast radius (the reason the TS surface cannot narrow to one verb): chain
  fixtures consuming `searchText` — f01 f03 f05 f07 f09 f10 f12 f14 f15 f17 f19 f20 f22;
  `tagVocabulary` — f11 f22; `forceReindex` — f05 f06 f08 f10 f16 f22 (measured
  `grep -ln` at HEAD, 2026-11-27). None of these has an adjudicating row against
  demolition; R-2's KEEP ratifications require the frozen TS surface to stay whole apart
  from the ratified leg.

## Contract text (accepted 2026-11-27, as proposed — "ratified.")

The door narrows on **two named surfaces**; the contract is meaningless unless each is
stated separately.

### Surface M — model-facing (what the chat manifest reaches)

- **One family: `notesLike`** (semantic, door, ranked) is the ONLY family the door answers
  to the model. Structure, lexical (`searchVault`-class), tags/metadata, palette commands
  answer directly from Obsidian (Design Report §5 verb-surface table — the second-source
  criterion's one survivor). No `listNotes`/set-lane/path-answer family reaches the model
  through the door.
- **Ranking honesty**: results are ranked, scored, and honest-labeled — the label ("semantic
  match, not lexical, not freshness") rides two channels (Design §1:14 + D-10 channel 1):
  the tool description and the per-result self-description (D-5's per-result disclosure,
  "approved, but we'll see if it works": the efficacy test is a smoke-task leg, not yet run).
  Ranking is decided at the door — never negotiated downstream (ADR-37's surviving boundary).
- **Tie disclosure**: the honest tail of the cut when it sits inside a tie block — counts
  exact, not estimated (the door scores the full chunks⋈embeddings join). Proposed carrier
  `{ score, atScore, returnedAtScore } | null` (T58 A2; the proposal survives at HEAD as a
  code comment, `src/api.ts:633` — the T58 dossiers themselves are retired, their record is
  the Ledger's §13 deletion entry).
- **Band**: when the top relatedness sits below the ruled margin, the door answers the null
  channel with reason (`below margin`, ADR-49 precedent; T58 A3 — proposal survives at HEAD,
  `src/api.ts:163`/`:223`; ruled default lives in `DEFAULT_SETTINGS`, Dan's act 2026-11-26:
  absolute floor, 0.5 between the measured classes). The band + tie disclosure are the door's
  honest-scoring doctrine at the narrowed verb.
- **Refusals, home corrected**: the ADR-25 sub-floor (2-char scan delegation, 1-char refuse)
  is a *lexical-scan* doctrine and survives only where its mechanism survives — at
  `searchText` (`api.ts:178–187`), on Surface T. At the semantic verb it claims no home;
  the semantic-side refusals are dark-safe `null + reason` (empty/whitespace query, embedder
  unavailable — ADR-49 precedent, `api.ts:122` `fail()`) plus the band's `below margin`
  null channel.
- **Row shape for `notesLike` (accepted as proposed)**:
  per-note rows under the whole-note anchor (seeds = every chunk of the note, max over seeds,
  self-exclusion note-wide — f33 header item 8, anchor shape (b), amended in place by Dan's
  rulings 2026-11-26); each row carries path, title/header, per-result score, and the per-result
  label half. No `total` field is proposed at this verb: tie disclosure carries the exact
  counts at the cut; the truthful-total law is a set-lane law and stays at the set lane.

### Surface T — the frozen TS `MuninnApi` (api.ts, frozen 2026-11-06)

- The only demolition R-2 ratifies: the **path lane of `listNotes`** — the path-answer
  selectors (`folder`/`filename` as path answers, `api.ts:81/83`; mode `'path'`,
  `api.ts:103/392`) dies; path questions answer natively from Obsidian.
- The rest of the frozen surface stays whole at this act: `searchText`, `searchSemantic`,
  `relatedChunks`, `tagVocabulary`, `forceReindex`, `listNotes` (its remaining lanes).
  Breaking a frozen shape is a version event — it rides the release act per the Release
  Ritual, not this contract act.
- `relatedChunks` survives as the door's whole-note anchor plumbing (internal, not model-facing;
  consumers measured at HEAD: f33/f04/f22/f31). `forceReindex` is a maintenance verb, not a
  question family — unchanged.

## Resolutions this act itemizes (accepted with the act; R8: "resolutions itemize there")

| Item | Resolution (accepted as proposed) |
|---|---|
| `api.ts` path-answer leg | DEMOLISH (ratified R-2): path lane of the `listNotes` frame only |
| `M-f27`, `M-f28` (listNotes browse) | DEMOLISH — already retired with the leg (Ledger §323) |
| `M-f04` (frozen surface, dark-safe wrappers) | SALVAGE — re-earn: dark-safe wrappers stay; the path-lane assertions flip to refusal of the excised selectors (null + reason) |
| `M-f24` (Plugin 1 public contract, P1 six methods) | SALVAGE — re-earn: method count stays six; P2/P3 re-earn against the narrowed filter vocabulary |
| `M-f29` (scan-lane truthful total, store-count door) | Re-earn unchanged at the surviving scan lane (adr-45 Accepted law); no `total` proposed at `notesLike` |
| `M-f30` (multi-lane refusal, ADR-47 Accepted) | Law re-earns on the surviving lane vocabulary (tag/lexical/scan/like combos still refused); path-lane combos die with the lane |
| `M-f31` (ranking honesty behind the door) | ADR-37's label law re-earns at `notesLike` — the boundary half, not the field ceremony |
| `M-f32`, `M-f33` (epoch legs / whole-note anchor) | Whole-note anchor survives (amended canon, f33 header); epoch-stamp legs and the freshness-flag doctrine (cache events) stay PENDING candidates — this contract does not decide freshness |
| `src/muninn-api.ts` (Huginn mirror) | Narrows on Surface M to the semantic family only (Ledger §160 row: REBUILD shrink); its TS conform lands only after this act is ratified (T15: contract → mirror → op in the loop) |
| `H-f07`, `H-f22` | REBUILD rows re-anchor red-first at their seams (Ledger §272: `notesLike` consumption shape replaces the gatherer; §287: rides the narrowed door) — post-act pass |

## What this contract does NOT decide

- Door expansion beyond `notesLike` (OQ-G) — deferred; separate contract acts (docket R4).
- ANN >10k cost finding (D-15) — open, measured later.
- Freshness flag and the epoch-stamp legs (M-f32/M-f33) — PENDING candidates, awaiting a ruling.
- Disclosure self-description efficacy — owed as the empirical smoke-task leg (docket R2,
  schedule block H1).
- Field ceremony — settled by the ratification itself, as proposed: the HEAD-cited proposal
  names (`tie`, `band`, score carriers — `src/api.ts:633` T58 A2, `:163`/`:223` T58 A3 comments)
  become the canon carriers at the narrowed verb.
- Tool-skip policy — open by ruling, unaddressed here.

## Conform (status lines and pointers — restatement is drift)

- `docs/Design Report.md` §5: status line + pointer to this draft.
- `docs/Tracked Issues.md` R8: dated conform, row stays GATED — closure is the ruling.
- `docs/Restart Ledger.md` §11: dated conform bullet below the R rows (deliberately not
  spliced into the ruling paragraphs — rulings stay verbatim and whole).
- Huginn `docs/decisions/index.md`: pointer stub (shared doctrine, Muninn owns).
- Recipes / H-f07 / H-f22: re-anchor at those seams post-act, red-first.
