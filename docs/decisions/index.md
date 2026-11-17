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
| 37 | `listNotes` — the sixth door | **Proposed — ruling owed** | drafted 2026-11-16 | Contract text prepared for the ruling; nothing implemented |

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
| Frozen five-door surface (2026-11-06) | ADR-37 **if accepted** | Becomes six doors; ruling owed, no implementation done |

## Cross-project acknowledgements (Muninn owns, Huginn consumes)

- **ADR-32, ADR-33, ADR-34** bind Huginn's `dispatch.ts`, harness, and `muninn-api.ts` mirror.
- **ADR-31** is the base; Huginn's `docs/Serial Contextual Operations Design (Ruled).md` (R1–R14,
  2026-11-15) is the gated re-admission of a write op. **That document is law for Huginn.**
- **ADR-8** is the release doctrine for both projects; Huginn has no release doc and needs a pointer.
- **ADR-20** packaging doctrine applies to both.
- **Shared docs owned by Muninn** (Dan, 2026-11-16): `LLM Coordination Protocol v1.0.md`,
  `Unified Project Definition v0.2.md` — byte-identical copies currently live in Huginn's `docs/`;
  Huginn keeps pointer stubs.
