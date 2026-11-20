# Muninn ADR index (retrospective set, recorded 2026-11-16)

Muninn ADRs live in `docs/decisions/`, numbered from 1, one file per ADR. **An ADR is never edited
after acceptance** (ADR-6): a changed decision is a new ADR marking the old one Superseded. Status
values: **Accepted**, **Proposed** (ruling owed), **Superseded** (by a numbered ADR), **Accepted with
deviation** (invariant stands, as-built contradicts it), **Partly superseded**.

| # | Title | Status | Ruled | Decision, one line |
|---|---|---|---|---|
| 1 | Zone model — three sync classes, Zone 2 disposable | Accepted | 2026-10-18, rev 11-01, 11-03 | Authored law / derived machine state / quartet settings; derived-state failure never damages durable state |
| 2 | Obsidian Sync ferries the canonical quartet only | Accepted | 2026-10-18, restated 11-02 | Non-quartet plugin-folder files are excluded silently; Zone 2 is per-device by construction |
| 3 | The requirement table R1–R12 | Accepted | 2026-10-19, CLOSED 10-24 | Requirements of record: 8 live, 3 dead by architecture, 1 mechanism superseded |
| 4 | The chunker contract | Accepted | v0.1 10-20, rev 10-24, 10-27 | Byte offsets must reproduce the chunk text; `[bs, be)`; the chunker normalizes nothing |
| 5 | The ontology ruling | Accepted | 2026-10-24 | Folders administrative, link graph organic, paths addresses |
| 6 | Sealed records are immune; ADRs are never edited | Accepted | 2026-10-24, restated 11-01 | Corrections ledgered not edited; addendum governs; append-only ADRs |
| 7 | Fixture hostility and earned red | Accepted | 10-24, strengthened 10-26/10-31/11-01 | Definition of done includes an initially-red fixture; red is earned; hostility ledger both directions |
| 8 | Release doctrine | Accepted | 10-26, Rev 3/Rev 4, restraint 10-30, assets 11-05 | `manifest.json` is the version authority; never release from a dirty tree; the tag must resolve |
| 9 | Over-ceiling content is carved, never truncated, always disclosed | Accepted | ratified 10-27 | 28 carves receipted; `reason=over-ceiling-byte-carved` |
| 10 | Sequencing ruling — contract first, then rulings, then code, then fixture from the contract | Accepted | 2026-10-28, precedent F08 `ec42c33` | "Fixture-first is for regressions, not virgin territory" |
| 11 | The typecheck baseline ritual | Accepted | 2026-10-28 | Baseline first (175 errors, all pre-existing), zero new; surface growth breaks full-shape fakes |
| 12 | The subscriber-seam doctrine | Accepted | 10-29, generalized 11-01 | Tail not poll; notification latency == persistence latency; never amplify your own failure |
| 13 | Single-flight — one pump in flight, always | Accepted | 10-31, red 11-01 | "A promise is not a lock. Checking the tail isn't guarding the pump." |
| 14 | Mobile read lane, Option A, fixture-proven; `isDesktopOnly` superseded | Accepted, clause superseded | Option A 10-31; supersession Dan 11-16 | Zero native imports; parity not promised; the flag only blocks mobile activation — `false` is correct, no code change |
| 15 | No erasable-TS syntax in Node-executed files | Accepted | 10-31, first-contact red | No parameter properties, enums, namespaces, decorators; "reasoned ≠ receipted" |
| 16 | The FTS5 serving row is self-contained, not external-content | Accepted, deviation ledgered | Dan 2026-11-01 | Self-contained row keeps served text and citation offsets together; deviation ledgered with unburying procedure |
| 17 | Private by default — BRAT, issues disabled, MIT, no warranty | Accepted | 2026-11-01 | Community release is a non-goal; plugin stays useful with Ollama down |
| 18 | Aggregated disclosure — one line total, no per-file chatter | Accepted | 11-01, shape 11-02 | Fold per-path, emit one line; reporting is the adapter's decision; silence is disqualifying |
| 19 | Engine ruling — official SQLite WASM embedded as base64 in `main.js` | Accepted, strongest surviving | 2026-11-02, verified live same session | `@sqlite.org/sqlite-wasm`; CJS loader, `locateFile` mandatory, `'c'` not `'ct'`, positional arrays |
| 20 | Self-contained plugin package — no extra installations | Accepted | 2026-11-02, Dan's framing | External requirements allowed; no sidecar, no staged `node_modules` |
| 21 | Staffing — architect/mason split, executor contract, escalation ladder, adversarial specs | Accepted | 11-02, 11-03, contract undated | Implementer output is a draft, never a fact; provenance labels [R]/[U]/[H]/[GHOST] |
| 22 | The spine demolition — the event-log architecture dies entire | Accepted, supersedes spine architecture | Dan 2026-11-03 | No consumer = death; vendor- and assistant-proposed features with no Dan requirement die |
| 23 | Store schema — `chunks` PK `(path, ord)`, `embeddings` PK `vh`, lazy retention | Accepted | 2026-11-03 | Schema split, tags keyed by `vh`, delete purges chunks + FTS + watermark atomically |
| 24 | Governance residency — law lives in the vault under `Agents/` | Accepted | 2026-11-03 | `Agents/` (`SKILLS/`, `Notebook/`, `Memories/`), never `_vault-index/`; code delivers, vault remembers |
| 25 | The trigram floor — 2-char → `LIKE` with disclosed scan, 1-char → empty with reason | Accepted | 2026-11-03, after the 11-02 live fact | `store.ts:633-638`, `api.ts:116-128`; no `src/search/` directory exists |
| 26 | Clean start — a new repo, not a legacy branch; ngram exploration dropped | Accepted | 2026-11-03 | Muninn begins at the rebuild; product naming lineage recorded |
| 27 | Epochs — `chunker_epoch` in meta is the sole authority | Accepted | 2026-11-03 | Per-row `cp` dropped; epoch bump is a rule, not a mechanism |
| 28 | All SQL behind store doors; `query()` read-only with a first-keyword allowlist | Accepted, stricter than spec | 2026-11-03, earned 10-31 | `ensureReadOnly` at `store.ts:230-243`; declared-but-unenforced furniture is a defect |
| 29 | Persistence seam — import/export bytes via `Vault.adapter`; `:memory:` is a named workaround | Accepted, proven live 11-04 | 2026-11-04 | 510 files / 3779 chunks loaded on restart; the `Uint8Array` heap-view gotcha |
| 30 | The semantic lane — FTS5 + brute-force kNN, capped at 10k chunks | Accepted | 11-03, model-bound fact 11-06 | Vectors never synced; model change forces a re-embed, disclosed loudly; port-bound |
| 31 | One gate, no write-class in v1; no plugin-owned write-audit log | Partly superseded (by Huginn's gated `write`, 11-15) | Dan 2026-11-03 | No write-class ships without a real named example; revertibility rented from Obsidian |
| 32 | The model judges, the harness acts — contracts not tool menus, the diff gate as differentiator | Accepted, cross-project | 10-19/10-20, restated 11-03 | The model never receives a menu, never composes, never executes; the LLM never touches the index |
| 33 | API design targets code ergonomics, not LLM friendliness | Accepted | 2026-11-03 | The index is blank-filling machinery for harness code; dark-safe, explicit shapes, stated ordering |
| 34 | The plugin boundary — Plugin 2 consumes Plugin 1's frozen API, never the vault | Accepted, binding on both | 2026-11-03, unified definition 11-03 | Plugin 1 does not depend on Plugin 2; Huginn's vault enumeration is forbidden |
| 35 | Compute threading — a blocked main thread kneecaps model tool calls | Accepted **with named as-built deviation** | 10-24/11-01 | Declared v1 invariant; as-built has no workers, and the semantic scan is main-thread by design |
| 36 | The API freeze — five doors, dark-safe, fixture-guarded | Accepted, in force | 2026-11-06, `be3a1b3` | "Any deviation requires a ruling, not an implementation decision"; F24 polices it |
| 37 | `listNotes` — the sixth door | **Accepted** (implementation owed) | Dan 2026-11-18 — **"1, 2, 3, 4 agreed. 5. recommendation accepted. 6. That waits on that proposed addons list."** | The contract of record is `adr-37.md` (not restated here): six filter fields, one per lane, and the answer says which kind of answer it gives — a **set** or a **ranking** |
| 38 | The Plugin 2 corpus in Muninn is retained as a **named oracle** | Accepted | Dan 2026-11-17 | 15 tracked files, no production path reaches them, f25/f26 are the only consumers; the corpus is Muninn's referee for the interface `listNotes` must preserve |
| 39 | The three empty `src/` directories in Muninn are removed | Accepted | Dan 2026-11-17 | Git cannot track empty dirs, so the act leaves no commit — this ADR is the record; `.qwen/tmp` is out of scope (T36) |
| 40 | Working documents live in the repo; nothing is kept twice for provenance | Accepted | Dan 2026-11-17 | `docs/Tracked Issues.md` is canonical for both projects; `/tmp` is for the length of one task; stating a fact twice is a drift opportunity |
| 41 | Model roster closures bind the coding/production side, not the user side | Accepted | Dan 2026-11-17 | Roster closures are staffing judgements; they do not prohibit a small model on the user side, and `qwen3.5:4b` stays as Huginn's chat default (T33 closed) |
| 42 | Root placement for the four root documents; living references in `docs/` | Accepted | Dan 2026-11-17 | `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` at root in both repos; ADRs, Design Report, testing contract, protocol docs, stubs in `docs/` (T17/T18 closed) |
| 43 | Compute threading — the declared limitation is taken | Accepted | Dan 2026-11-18, **"Declared limitation, we can revisit if the problem bites."** | No worker, no scan restructuring; ADR-35's invariant stands for any new long-compute path; T4 closes, T8 stays open |

## Supersession map

| Superseded | Superseding | What changed |
|---|---|---|
| Spine-era architecture, R1/R2/R5, spine event-log vocabulary | ADR-22 | Architecture dies entire; durable generalizations mined out before sealing |
| `better-sqlite3` / `sql.js` engine candidates | ADR-19 | Official SQLite WASM, embedded base64 |
| FTS5 external-content row (decision of record) | ADR-16 | Self-contained row; deviation ledgered, unburying procedure named |
| Warmup `"_"` dimension probe | ADR-3 | Requirement stands (know the vector width); mechanism replaced by a settings-tab dimension (as-built `settings.ts:20 embedDim: 768`, UI at `main.ts:500-504` [R]) |
| Auto-apply write carve-out (2026-10-20 ✅ row) | ADR-31 | Ban, then gated re-admission in Huginn (11-15) |
| `isDesktopOnly` flip "owed pending mobile live receipts" | ADR-14 | The flag only blocks mobile activation; `false` is correct; supersession by Dan 11-16, no code change |
| Mobile linear-scan fallback (11-01 text) | ADR-14, ADR-19, ADR-30 | As-built serves FTS5 via WASM + brute-force kNN on both devices |
| "Embeddings future / not implemented" | ADR-30 | Semantic lane shipped |
| Per-row `cp` partition marker | ADR-27 | `chunker_epoch` sole authority |
| Frozen five-door surface (2026-11-06) | ADR-37, **accepted 2026-11-18** | Becomes six doors; contract ruled, **implementation owed** (ADR-10 order: contract → red f27 → implementation → fakes → release) |

## Cross-project acknowledgements (Muninn owns, Huginn consumes)

- **ADR-32, ADR-33, ADR-34** bind Huginn's `dispatch.ts`, harness, and `muninn-api.ts` mirror.
- **ADR-31** is the base; Huginn's `docs/Serial Contextual Operations Design (Ruled).md` (R1–R14,
  2026-11-15) is the gated re-admission of a write op. **That document is law for Huginn.**
- **ADR-8** is the release doctrine for both projects; Huginn has no release doc and needs a pointer.
- **ADR-20** packaging doctrine applies to both.
- **Shared docs owned by Muninn** (Dan, 2026-11-16): `LLM Coordination Protocol v1.0.md`,
  `Unified Project Definition v0.2.md` — byte-identical copies currently live in Huginn's `docs/`;
  Huginn keeps pointer stubs.

## Addendum (2026-11-17) — Phase 4 committed, Phase 5 executed, no ADR edited

Phase 4 is committed (`9b2a2bd`, 111 files, 2391+/5526− [R]) and pushed (`b75c408..9b2a2bd main -> main`
[R]). **Phase 5, archive→delete, executed 2026-11-17** on Dan's authorization: `git rm -r docs/archive` =
**34 tracked files** [R], every tombstone dated 2026-11-17. **88 evidence lines across 34 ADR files** cite
`docs/archive/...` [R]. Those lines are **dated statements at acceptance** and are **not edited** (ruling 2,
ADR-6): the facts behind each citation live in the ADR decision text, `docs/Initial Design Report.md`, and
`CONTRIBUTING.md`, and the cited files are recoverable from the git history. The living record is
`CHANGELOG.md` §Docs record and `docs/Initial Design Report.md` §22. Status lines that describe the archive
as a destination are read against this addendum.

## Addendum (2026-11-17, second pass) — ADR-38, ADR-39, ADR-40, and the docket's home

Dan's rulings of 2026-11-17 are recorded as **ADR-38** (Plugin 2 corpus kept as a named oracle),
**ADR-39** (the three empty `src/` directories removed), and **ADR-40** (working documents live in the repo;
nothing is kept twice for provenance). **No earlier ADR body is edited** (ruling 2, ADR-6): ADR-7, ADR-27,
ADR-28, and ADR-34 keep their acceptance-time text, and ADR-38 extends them. The tracked-issues docket moves
into the repo as `docs/Tracked Issues.md`, canonical for **both projects**, with a pointer stub in Huginn
(`Huginn/docs/Tracked Issues -- Pointer.md`). T1, T2, and T3 close; **T36** (`.qwen`) is raised and closes
the same day on Dan's ruling — see `adr-39.md`.

## Addendum (2026-11-17, third pass) — ADR-41, ADR-42, and four closings

Dan's later rulings of 2026-11-17 close four docket rows and add two ADRs. **ADR-41** — model roster closures
bind the **coding/production** side, not the user side: **"The closed models are closed on the coding/
production side, not the user side. The vault plugin is going to rely on small models, and qwen3.5:4b is a
popular default for users"** — Huginn's `chatModel` default is unchanged, `SECURITY.md` in both projects is
conformed to the scope, closing **T33**. **ADR-42** — **"T17/18 -- agreed, root"**: `README.md`,
`CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` sit at the repo root in both projects, living references in
`docs/`, closing **T17** and **T18**. **T10** closes by Dan's vault act — all memory files deleted, "to avoid
prejudicing future testing". **T24/T25** close: the executor completed `versions.json` on Dan's request
(Muninn 13 → 16 entries, Huginn 18 → 20), with `minAppVersion` measured from each tag's own `manifest.json`.
No ADR body is edited (ruling 2, `adr-06.md`), no version, tag, or release is touched.

## Addendum (2026-11-18) — ADR-43, and **T4** closed

Dan ruled compute threading, verbatim: **"Declared limitation, we can revisit if the problem bites."** The
ruling is `adr-43.md`; its details are not restated here. **T4 closes; T8 (ANN for >10k chunks) stays open.**
No ADR body is edited (ruling 2, `adr-06.md`), no version, tag, release, code, or fixture is touched.

## Addendum (2026-11-18, second pass) — ADR-37 accepted, **T15** closed

Dan ruled the `listNotes` contract, verbatim: **"Of course I agree the door."** … **"1, 2, 3, 4 agreed.
5. recommendation accepted. 6. That waits on that proposed addons list."** **The contract is Muninn
`adr-37.md` — not restated here.** `adr-37.md`'s status moves from **Proposed** to **Accepted**, and its
body is rewritten as the acceptance-time text — the ruling *accepts the proposed contract with amendments*,
so **no new ADR is created** (ADR-6 governs changed decisions, and the contract was never accepted before).
**T15 closes; T13 remains the loop's only gate.** Point 6 becomes docket row **T37** (the proposed add-ons
list: Dataview integration, structural/frontmatter predicates — deferred, to be looked at much later).
**No implementation is authorized**: no `api.ts` member, no `f27`, no mirror.

Two non-ADR acts on Dan's authorization the same day: `package.json` gains the `fixtures` chain
(`f01`–`f26`, appended in order, no gaps), so `npm run fixtures` is the canonical run-all in both repos
(Huginn's chain at `package.json:11` is the precedent Muninn mirrors); and `.gitignore` gains the
`AGENTS.md` / `docs/AGENTS/` paths in both repos, so the untracked agent files no longer sit in
`git status --porcelain`. Commit and push for this pass are Dan's authorized act, batched as **one commit
per repo**.

## Addendum (2026-11-20) — **T13 ruled and closed**: independent fixture chains, the M-/H- designation convention

Dan ruled (2026-11-20), closing **T13**: the two projects' fixture numbering has always been
**independent** (Muninn `f01`–`f26`, Huginn `f01`–`f30`, each its own `package.json` chain [R]); the
"collision" recorded by merged documentation was a **misunderstanding by the agents involved**, not a
fact on disk. **Standing convention, ruled:** every fixture number cited in prose, docs, or ADR text
carries its project prefix — **`M-fNN`** (Muninn) or **`H-fNN`** (Huginn); bare numbers are conformed as
their citing documents are touched, history stays history. **Release slotting, confirmed:** the Memory
Feedback Loop's ranking fixtures follow the op loop's H-f31–H-f36 and start at **H-f37**. The docket row
and the 2026-11-20 addendum in `docs/Tracked Issues.md` are the record; the op loop's gate list is empty,
and implementation of the `adr-37.md` door awaits Dan's explicit authorization. No ADR body is edited
(ruling 2, `adr-06.md`), no code, fixture, version, tag, or release is touched.
