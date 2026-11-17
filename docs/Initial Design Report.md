# Muninn Initial Design Report

**Recorded:** 2026-11-16 (body revision date; frontmatter `modified:` is not evidence — ADR-6).
**Describes as-built at:** HEAD `b75c408`, version `0.2.0-test.15` [R].
**Method:** retrospective. This report is the canonical single-source description of Muninn, built by
mining all 23 sealed files in `docs/ARCHIVE/` (all read and mined) plus the 14 live `docs/` files,
against code measured at the current HEAD. Every claim carries a provenance label.
**Provenance:** **[R]** pasted terminal/file receipt · **[U]** Dan's word (trusted, does not authorize a
cut) · **[H]** inference from measured code · **[GHOST]** retrieval-surfaced, a hint never an
authorization.
**Companions:** `docs/decisions/` ADR-1 … ADR-37 (index at the end of the ADR set);
`docs/TESTING1.md` remains the manual smoke of record. The store/API contract of record is **§4, §6, §8
of this report + ADR-4, ADR-9, ADR-10, ADR-22, ADR-31, ADR-32, ADR-36**: `docs/Muninn Store Rewrite
Specification.md` (Final v3) was mined into those docs, archived 2026-11-17 with a tombstone
(triage row 25), and **deleted 2026-11-17** (Phase 5, Dan's authorization) [R]; it is recoverable from
the git history.

---

## 1. Purpose and non-goals

**Purpose.** Muninn is Plugin 1: an Obsidian vault index. It chunks markdown at paragraph/heading
level, stores chunks in a disposable SQLite (WASM) cache, serves lexical search (FTS5) and semantic
search (Ollama embeddings + brute-force kNN), keeps the index current from Obsidian vault events, and
exposes **one frozen door** — `getMuninnApi()` (`main.ts:197-199` [R]) — to Plugin 2 (Huginn).

The project's own framing of purpose, from the sealed project definition: **"the tools and skills built
along the way, not just the artifact"** — the fixture discipline, the release ritual, and the evidence
doctrine are product, not overhead [U/archived].

**Non-goals, all ruled:**
- Community release is a non-goal; distribution is private by default via BRAT; issues disabled; MIT +
  "Personal/experimental use. No warranty; use at your own risk" (ADR-17) [U].
- **No tool menu for the model** — the model judges, the harness acts (ADR-32) [U].
- **No plugin-owned write-audit log** — revertibility is rented from Obsidian's version history and
  trash (ADR-31) [U].
- **No vector index / ANN** — brute-force kNN with a declared cap; acceleration is named debt behind an
  epoch bump (ADR-30) [R].
- **No extra installations** — no sidecar, no staged `node_modules`; engine embedded as base64 in
  `main.js` (ADR-19, ADR-20) [U].
- **No sync of derived state** — Zone 2 is per-device by construction (ADR-2).
- Ngram tokenizer exploration is dropped (ADR-26) [U].
- **Feature parity on mobile is explicitly not promised** (ADR-14) [U].

"Infrastructure is seductive procrastination; every phase needs a blunt *done means this runs and I can
see it*" [U/archived].

## 2. Requirement table R1–R12 (requirements of record, ADR-3)

| # | Requirement | Status in as-built |
|---|---|---|
| R1 | Append-only per-origin event log (spine) | **Dead** (ADR-22) |
| R2 | Sync-exposed event history | **Dead** — never a Dan requirement, "I was talked into it" [U] |
| R3 | Embedding prefixes `search_document:` / `search_query:` | **Live** — `chunker/render.ts:53`, `api.ts:144` [R] |
| R4 | Embedding model fingerprint (model identity bound to vectors) | **Live** — `embeddings.model_tag` (`store.ts:162, 521`), `embedder_model_tag` meta (`store.ts:193`), model change forces re-embed (receipt 2026-11-06) [R] |
| R5 | Loud integrity logging (spine schema) | **Live as doctrine** (ADR-18), dead as spine machinery |
| R6 | Rename never re-embeds | **Live** — path change is metadata (`store.ts:455-492`) [R] |
| R7 | `/api/embed` with `input: texts[]` as the batched endpoint | **Live** [R] |
| R8 | No volatile runtime state in `data.json` | **Live** — settings are `ollamaUrl`, `ollamaModel`, `embedTimeoutMs`, `embedDim` only (`settings.ts:8-21`) [R] |
| R9 | Recipe contracts, not tool menus | **Live as doctrine** (ADR-32), as-built lives in Huginn |
| R10 | The diff gate as the headline differentiator | **Live as doctrine** (ADR-32), as-built lives in Huginn |
| R11 | Paragraph/heading-chained chunker | **Live** — `src/chunker/chunker.ts`, title = heading chain (`intake/lane.ts:423`) [R] |
| R12 | Paste regions, not bundles | **Live as doctrine** |

Dead requirements are recorded, not deleted (ADR-3).

## 3. Zones, sync, and persistence

Zones are named by **sync class**, not folder (ADR-1):

| Zone | Content | Sync behaviour |
|---|---|---|
| 1 | Authored human law, the visible vault under `Agents/` (ADR-24) | fully synced, human- and agent-editable |
| 2 | Derived machine state: `cache/index.db` at `.obsidian/plugins/muninn/cache/index.db` (`main.ts:251-254` [R]) | **structurally excluded by Sync** (quartet-only), silently, no error, no log, no retry (ADR-2) |
| 3 | The quartet `manifest.json`, `main.js`, `styles.css`, `data.json` | synced; settings only (R8) |

**Persistence as-built** (ADR-29, proven live 2026-11-04): the store is opened as **`:memory:`** SQLite
(`main.ts:68` [R]) and made durable by an **import/export byte seam**: cache bytes are read on load and
passed to `openStore(path, { load })` (deserialize, `store.ts:843-862` [R]); on flush,
`store.serialize()` is copied out of the WASM heap into a right-sized `ArrayBuffer` and written via
`vault.adapter.writeBinary` (`main.ts:313-321` [R]). Live proof: `[Muninn] loaded cache: 510 files,
3779 chunks` at `0.2.0-test.4`, post-reload walk a no-op, cache ~38 MB [R].

Two gotchas, both earned, both permanent doctrine:
- **A `Uint8Array` view over a heap buffer is not the buffer.** Passing `serialize()` straight to
  `adapter.writeBinary` wrote the entire heap; the copy at `main.ts:317-320` is the fix [R].
- **The `:memory:` fallback for `SQLITE_CANTOPEN` is a named workaround, not a persistence solution**,
  and open items are never closed by workaround (ADR-29) [U].

Persistence is **debounced** (flush 2 s after the last mutation) and `onunload` flush is
best-effort/async — durability is not guaranteed on forced quit. Named debt, stated in `TESTING1.md`
[understood] [R].

**Zone 2 disposability contains the engine failure mode: broken binary ⇒ search dark, durable state
unaffected, rebuild on repair.** Verified live 2026-11-02 [U/R]. General rule: **derived-state failure
must never damage durable state** (ADR-1).

## 4. Store as-built

Schema, measured in `store.ts:138-185` [R]:

```
files(path PK, size, mtime, content_hash)
chunks(path, ord, vh, bs, be, text, title)  PK (path, ord)   + idx_chunks_vh
embeddings(vh PK, vector BLOB, dim, model_tag, epoch)
meta(key PK, value)
tags(vh PK, tags)  FK → embeddings(vh)          # declared FK, pragma never enabled (named furniture, ADR-28)
chunk_fts  USING fts5(text, title, path UNINDEXED, ord UNINDEXED, bs UNINDEXED, be UNINDEXED, vh UNINDEXED,
                       tokenize = 'trigram')     # self-contained serving row (ADR-16)
```

Meta defaults stamped inside the DB, never in the filename (`store.ts:190-194` [R]):
`schema_version: 3`, `chunker_epoch`, `embedder_epoch: 1`, `embedder_model_tag:
'ollama/nomic-embed-text:v1.5'`. Migration path is **wipe and rebuild**; a behavioural change bumps the
epoch **as a rule, not a mechanism** (ADR-27); foreign epochs and foreign model tags are **loudly
skipped with disclosure, never fabricated as violations** (`intake/lane.ts:479` [R]).

**All SQL lives behind named doors** (`store.ts:85-130` interface: `getMeta`/`setMeta`/
`recordFile`/`getFile`/`deleteFile`/`clearFiles`/`insertChunks`/`replaceChunksForPath`/
`deleteChunksForPath`/`countChunks`/`countFiles`/`renamePath`/`renamePrefix`/`insertEmbeddings`/
`deleteEmbeddingsForVh`/`getEmbedding`/`countEmbeddings`/`insertTags`/`getTags`/`tagVocabulary`/
`searchText`/`searchScan`/`deleteRowsForPath`/`serialize`/`close`) [R]. The diagnostic door `query()` is
**read-only by a first-keyword allowlist** (`ensureReadOnly`, `store.ts:230-243`: rejects
comment-prefixed, non-`SELECT`/`WITH`, and any `;`) — stricter than the spec required [R] (ADR-28).

**SQLite WASM returns positional arrays, not row objects.** Every wrapper maps columns explicitly, "or
fixtures will pass for the wrong reason" [U] (ADR-16). Pragmas: `journal_mode = WAL`,
`synchronous = NORMAL`, `busy_timeout 5000` [R].

`tagVocabulary()` returns **counts, not paths** (`TagInfo { tag, files, chunks }`, `api.ts:41-45` [R]) —
so a tag→path filter is inexpressible through the frozen surface today, and the proposed `listNotes`
filter must use the `chunks.vh → tags.vh` join, not invent an index (ADR-37).

## 5. Intake lane — events as triggers, disk as truth

`src/intake/lane.ts` owns the vault→store pipeline; filesystem access is abstracted behind `FileSource`
so fixtures drive it without Obsidian (`lane.ts:46-48` [R]).

- Handlers: `onCreate` `lane.ts:114`, `onModify` `120`, `onDelete` `126`, `onRename` `133`,
  `onRenamePrefix` `158` [R]; `drain()` `215`, `forceReindex(onProgress)` `264`, `stop()` `331` [R];
  `LaneShutdownError` interrupts an in-flight reindex on `stop()` (fix at `0.2.0-test.6` [R]).
- **Single-flight: one pump, ever** (ADR-13). Intake ops are **serialized per-path**, so a `delete`
  arriving during a `modify` cannot resurrect deleted rows (H3, closed at `0.2.0-test.7` [R]); the
  delete path purges chunks + FTS + watermark **atomically** — the pairing invariant (ADR-23).
- The **watermark is recorded inside `replaceChunksForPath` even for a zero-chunk note**
  (`lane.ts:431-435` [R]) — so `files` contains every walked file, which is what makes a vault
  enumeration door possible without a schema change (ADR-37).
- Vault handlers are registered inside `onLayoutReady` to skip the initial create storm for every
  existing file (`main.ts:93-97` [R]); the initial background walk runs behind a reindex-in-progress
  guard (`main.ts:99-122` [R]) and `onunload` awaits in-flight reindex/flush before closing the store
  (`main.ts:166-172` [R] — the `DB has been closed` crash class closed at `0.2.0-test.6`).
- **Subscriber-seam doctrine** (ADR-12), generalized to any async lane: tail not poll; notification
  latency == persistence latency; FIFO; subscriber errors logged with attribution and never propagated
  to the producer; **integrity events never re-enter fanout — a subsystem must never amplify its own
  failure**; every failure path closes what it opened, leaves fields null, and discloses; unload order =
  lane disposed before store close, synchronous, no awaits, in-flight work finishes its current unit.
- **Global `ts` is never trusted for ordering** (ADR-22) — `files.mtime` is recorded, and ordering is
  always stated explicitly by the door that returns an ordered set.

## 6. The chunker contract (ADR-4, ADR-9)

`src/chunker/chunker.ts` + `src/chunker/render.ts` [R].

- **The killer invariant:** recorded byte offsets must always reproduce the chunk text from the file
  (`file.slice(bs, be)` === served text). "If the offsets can't re-derive the bytes that produced the
  embedding, the citation-jump feature is fiction and dedupe is fraud" [U/archived].
- Range is **inclusive-exclusive `[bs, be)`**; **the chunker normalizes nothing** — `bs`/`be` index the
  file *as stored*, a CRLF vault yields CRLF-straddling offsets, and a line-ending flip is a real
  content change that gets re-embedded ("honest, not wasteful"). **JS string indices ≠ UTF-8 byte
  offsets**; BOM occupies bytes 0–2 and is accounted.
- `vh = sha256(prefix || chain || fm_context || chunk_text)`; chunker and embed path share **one**
  `renderEmbedInput()` — "two implementations would be two drift opportunities".
- Prefixes `search_document:` / `search_query:` (`render.ts:53`, `api.ts:141` [R]) are required by the
  nomic model card; raw Ollama adds no prefixes (R3). Query-side prefix use: `api.ts:144`.
- `fm_context` keys `type`, `tags`, `aliases`, `description`; canonical serialization = compact JSON,
  keys alphabetical, strings/array elements trimmed, no coercion; parsing **degrades to "no fm_context",
  never throws** (five ratified degeneracy variants, pinned by fixture C05 in the corpus design) [U].
- Over-ceiling words/paragraphs are **carved, never truncated, always disclosed**
  (`reason=over-ceiling-byte-carved`, pieces counted); 28 carves receipted 2026-10-27 (ADR-9). Consumers
  must not assume one chunk per paragraph.
- Property suite P1–P6 (offsets reproduce text; partition; determinism; atomicity; chain correctness;
  idempotent `vh`) plus hostile fixtures C01–C06.

## 7. Search lanes

**Lexical** — FTS5 with `tokenize = 'trigram'` (`store.ts:185` [R]), plus the ruled floor (ADR-25):
- 1-character query → empty; 2-character → `searchScan` (`store.ts:633-638` [R]);
- disclosure rides the frozen `mode` field: `mode: 'scan'` for the 1- and 2-char paths,
  `mode: 'bm25'` for the FTS path (`api.ts:116-128` [R]); `LIKE` fallback escapes wildcards
  (`store.ts:675`, `WHERE text LIKE ? ESCAPE '\\'` [R]);
- origin of the ruling: `MATCH 'bl'` returned **0 rows with no error** — "a silent miss, not a throw",
  CJK two-character words would fail silently [U/R]. Declared limitations over hidden ones.
- **Partial indexes never served as complete; a gap ⇒ loud refusal** [U/archived].

**Semantic** — `api.ts:228-269` [R]: `SEMANTIC_SEARCH_HARD_CAP = 10000`; brute-force join
`chunks ⋈ embeddings` limited to the cap, cosine over each vector, sort by score, slice `k`
(`cosineSimilarity` rejects dimension-mismatched vectors — L1 fix, `0.2.0-test.7` [R]). Query
vectors stay in local scope only; persisting them "would leak ~3KB per distinct query forever"
(`api.ts:141-144` [R], M1 fix). Model-bound facts, receipted live 2026-11-06: **changing the Ollama
port breaks semantic search, restoring it restores it; a major model change forces a re-embed** (ADR-30)
[R]. The 10k cap is a declared limitation, not silent truncation; **brute-force scan may freeze large
vaults** is named debt (ADR-30, ADR-35).

**Plugin load never blocks on `localhost:11434`; the lexical lane never touches the network** (ADR-17)
[R]. Dark-safe surfaces: `embedClient === null → fail('embedder unavailable')` (`api.ts:134` [R]).

## 8. The frozen API (ADR-36, ADR-37)

Five doors, `api.ts:65-71` [R]; dark-safe `fail()` logs the reason and returns `null`, never throws
(`api.ts:77-83` [R]); "breaking one is a version event" (header, `api.ts:4-5` [R]). The freeze is
fixture-guarded, not convention-guarded: **F24** asserts `keys.length === 5` with the five names
enumerated (`f24.ts:84-90` [R]), pins every return shape field-by-field, and verifies dark-safe `null`
against the real API for empty/invalid inputs (`f24.ts:149-154` [R]). Spec footer, verbatim: **"Any
deviation requires a ruling, not an implementation decision"** [U].

Consumers: Huginn via `getMuninnApi()` (`main.ts:196-199` [R]; commit `8b6efed` exposes the door,
`084a076` removed all Plugin 2 wiring from Muninn [R]). API design targets code ergonomics, not LLM
friendliness (ADR-33): explicit fields, stated ordering, `limit` as a parameter, `null` in the dark.

The **sixth door, `listNotes`, is Proposed** (ADR-37) — contract text written, ruling owed, nothing
implemented. Huginn's vault enumeration (`app.vault.getMarkdownFiles()`) is **forbidden**: a second
source of truth (ADR-34, Dan 2026-11-15 [U]). Growing the surface grows the full-shape fakes
(`f22.ts:41`, `f24.ts:56` [R]) — `npm run typecheck` fails at both until both grow (ADR-11).

## 9. Ontology and rename semantics (ADR-5, ADR-22)

**Folders are administrative grouping; the link graph is the organic organization; paths are storage
addresses, not relationships** (ruled 2026-10-24) [U]. Consequences as-built:
- Path changes are metadata operations; rename never re-embeds (R6).
- **`renamePrefix` exists** (`store.ts:469`, rewriting `chunks`, `files`, `chunk_fts` by `path LIKE`
  prefix [R]) because stock Obsidian emits **ONE rename event for a folder with NO child events**;
  links are maintained, child paths are not. The `onRenamePrefix` handler is `lane.ts:158` [R].
  **Production receipt for folder-rename child paths is still owed** — the 2026-11-04 review asked to
  "smoke-test a folder rename, watch child paths" [R].
- A folder rename rewrites addresses and must not be read as a semantic move; related-notes ranking is
  graph-shaped, not folder-shaped.

**The spine is dead** (ADR-22): shards, sync-exposure, the origin ladder, merge-scan, seq/checkpoint,
foreign-origin guard, heal, projection, Tier-2 buffer, `_vault-index/events/`, `origin.txt`, dwell,
actor attribution. Its irreplaceable cargo had no consumer; its only production consumer read data
re-derivable from disk. **Requirements-interrogation rule (durable, binding):** a subsystem is
interrogated against the project's stated requirements; vendor- or assistant-proposed features with no
Dan requirement and no consumer die. Durable generalizations mined out before sealing: *facts survive,
derivatives heal*; one writer per artifact; `adapter.append()` is O(line) while `vault.modify()`
rewrites the whole file (the 28 MiB exhibit — governs every vault write, including Huginn's `write` op);
`content_sha` = SHA-256 truncated to 16 hex; forward-only, idempotent, version-keyed migrations with
downgrade guard; the judgment-vs-exposure criterion (Dan 2026-07-23: editing is judgment, opening is
exposure) parked with the dead heat model.

## 10. Governance residency (ADR-24)

**Law lives in the vault under `Agents/` (`SKILLS/`, `Notebook/`, `Memories/`) — never
`_vault-index/`.** Zone 1 is authored law; Zone 2 is derived machine state and is never the home of law;
the LLM never touches the index (ADR-1). Recipe residency ruling: **plugin defaults + vault overrides
by same-name precedence — "code delivers, vault remembers; survives reinstall"** [U]. As-built residency
lives in Huginn (`Agents/Huginn/SKILLS/`, `Agents/Huginn/MEMORY/`) [R].

Measured artifact: `Muninn/docs/AGENTS/SKILLS/` is an **empty untracked directory, 0 files** [R] — the
vault governance namespace appearing in the repo, a boundary-confusion artifact. **Ruled: delete**
(Dan, 2026-11-16) [U].

Three more empty untracked directories measured 2026-11-16 in `src/`: **`src/search/`, `src/probe/`,
`src/rebuild/`, each 0 files** [R] — filesystem leftovers of the spine-era module layout (git cannot
track empty dirs, so they are invisible in the inventory). **Ruling owed** (raised as a triage question,
§18 item 5, not acted on).

## 11. UI as-built

- **Settings tab** (`main.ts:460-513` [R]): Ollama base URL, Embedding model, Embedding timeout (ms),
  Embedding dimensions, and **Force reindex vault** with a progress status — force reindex lives in
  Settings, **not in the sidebar** (the K/L UX fix, 2026-11-06 [U]). Defaults
  `http://localhost:11434`, `nomic-embed-text:v1.5`, 30000 ms, 768 dims (`settings.ts:16-21` [R]);
  `sanitizeSettings` strips a trailing slash on the URL (`settings.ts:27-29` [R]). Dimension is a
  **setting, not a probe** — the warmup `"_"` discovery trick is superseded (ADR-3).
- **Search view** (`src/ui/search-view.ts`, `search-state.ts`, `search-controller.ts` [R]): registered
  leaf view `main.ts:142-152`; `getState`/`setState` restore query, mode, and results across sidebar
  close/reopen (`search-view.ts:75-83` [R], receipted Scenario L PASS 2026-11-06 [R]); text/semantic
  mode buttons; result cards open the note.
- **Command palette**: `Muninn: Force reindex vault` (`main.ts:127-130` [R]), `Muninn: Open search view`
  (`main.ts:135-138` [R]) [R]. Ribbon icon = magnifying glass.
- The chat/skill command (`Muninn: Run test recipe`) is **gone** — Plugin 2 moved to Huginn
  (`TESTING1.md` Scenario M pointer [R]).
- UI doctrine: **"start as we mean to finish"** (ruled 2026-10-31) [U]; console output is **not** an
  observability channel (ADR-20) [U].

## 12. Disclosure and determinism doctrine

- **Aggregated disclosure:** fold per-path aggregation, **emit one line total** — no toast, no per-file
  chatter; the 508-buffer-window incident proved disclosure volume is a capacity problem (ADR-18) [U/R].
  Integrity reporting routes through the store's disclosure door as one aggregated line per call,
  reasons tallied; **reporting is the adapter's decision, not this module's** — the module returns
  structured counts (`{ hits, staleSkips }`) [U].
- **Silence is disqualifying** (R5). Every integrity action is logged, loud and named. Declared
  limitations over hidden ones. The known-no-op event map moved from "unknown type" warn to explicit
  no-ops with rationale [U].
- Two-level logging: terse info + reconstructive trace; add logging at each seam to pinpoint a drop
  (the Scenario H method) [U/R].
- **Determinism: pure functions — no clock, no locale, no random, no iteration-order luck.** Ordering is
  always explicit (ADR-27, ADR-22).
- **"A slow staleness check is a broken staleness check"**: probe baselines are recorded **after** the
  disclosure line, which closed the infinite-rebuild loop [U/R].
- **Never claim a side effect you did not perform** (origin-ladder Rung 3 lesson) [U].
- **Declared-but-unenforced furniture is a defect**: decorative FK with `PRAGMA foreign_keys` never ON,
  WAL on `:memory:` (inert) — "drop the FK or enable the pragma" [U/R] (ADR-28). Aspirational comments
  and hallucinated constraints are named defects (the `fail()` accessor comment, the `TFile` import
  justification) [U/R].
- **A test procedure that can't run is worse than none: it manufactures noise that gets mistaken for
  signal** — the `TESTING1.md` review finding, directly applicable to Huginn's test doc [U/R].

## 13. Compute threading — declared invariant, named deviation (ADR-35)

**"A blocked main thread kneecaps model tool calls"** is a declared v1 invariant, observed empirically
[ U/R]. As-built Muninn runs the WASM store, the semantic scan, and the embedding calls **on the main
thread, with no worker** — `grep` for `Worker` in `src/` returns **0 hits** [R] — and the semantic lane's
own comment says the cap exists to bound "the worst-case CPU/RAM cost in the main thread"
(`api.ts:234` [R]). The invariant is unmet as-built; the deviation is named, not hidden. **Ruling owed**
for the next long-compute path: a worker for the store/embedding path, or chunked/aborted scan, or a
declared limitation with disclosure. Any new long-compute path in either plugin inherits the obligation,
which makes this ADR binding on Huginn's op loop as well.

## 14. Fixture and test discipline

**Fixtures:** 26 files, `src/fixtures/f01.ts … f26.ts` [R]. Runner: plain Node via `npx tsx` (Node
26.13.1, tsx 4.23.15). Muninn's `package.json` has **no `fixtures` script** (measured `package.json:7-11`:
`dev`, `build`, `typecheck`) [R]; the run-all convention is the loop
`for n in $(seq -w 1 26); do npx tsx src/fixtures/f${n}.ts || break; done`.

**Fresh receipt, measured 2026-11-16 at `b75c408`:** `npm run typecheck` → `EXIT:0` [R]; f01 … f26 →
`[F0n] VERDICT: GREEN` for all 26 [R] (pasted in `receipt-fixtures.txt`). **F24 polices the frozen
surface; f12/f15 police the persistence round-trip and the mobile read lane (zero native imports); f22
builds a full `MuninnApi` literal; f23 polices search-view state serialization** [R].

**Doctrine (ADR-7, ADR-10, ADR-11, ADR-15, ADR-18), all earned:**
- Definition of done includes at least one **initially-red** fixture: *"a corpus that passes on first
  contact hasn't been hostile enough."*
- **Red must be earned. A red against a nonexistent module is a type error, not a test failure.** Red
  taxonomy earned / contrived / vacuous; mutation red is a labelled wiring check, never counted;
  "untested path" ≠ red; casts are confessions.
- **House-order inversion (implementation before fixture) is named debt**, not hidden; the exception
  ledger is the ancestor of first-green-with-written-justification (Huginn R14).
- **Sequencing: contract text → rulings → implementation → fixture authored from the contract, not from
  observed behavior** ("fixture-first is for regressions, not virgin territory", precedent F08
  `ec42c33`) (ADR-10).
- Fixtures exercise the **public API only**; corruption injected at the file level; **no mocks of the
  subject's own code, ever**; deterministic seeds; fast/slow split; salt fixture worlds; each fixture
  names its fail smells; every fixture asserts the integrity contract where applicable.
- **Hostility ledger counts both directions** — "the fixture wrong, the code right" convicts the
  fixture; paid entries are paid, the parked remainder is next sprint's, not smuggled.
- **Wiring debt named, not hidden: fixture-green is not production-live.** Muninn's own instance of
  this is the mobile lane: fixture-proven M1–M3, **no live mobile receipt** (ADR-14); in Huginn it is
  Scenario F, `f27`-guarded, never smoked.
- **No erasable-TS syntax in Node-executed files** (no parameter properties, enums, namespaces,
  decorators) — "the modules had typechecked but never executed" (ADR-15); **typecheck green is not
  runtime green**, so the baseline ritual (175 pre-existing, zero new) is a session-close gate
  (ADR-11).
- **A fixture may keep dead code alive as a named oracle** — see §18 item 4 for the live case.
- **Every vault bug becomes a fixture before it's fixed**; **add logging at each seam to pinpoint a
  drop**; amend the test doc in the same commit as the seam.
- Platform claims require receipts: four fabricated claims about Obsidian mobile runtime were
  contradicted by docs.obsidian.md — **"training data is not a receipt for vendor behavior"** (ADR-14).
  **Reasoned ≠ receipted.**

**Manual smoke:** `docs/TESTING1.md` — Scenarios A–L + M (pointer to Huginn), conditions, steps,
expected results, "what to capture", known limitations, and **manual receipts dated 2026-11-06** (K
PASS, L PASS, port-change and model-change facts) [R].

## 15. Release and deploy doctrine (ADR-8)

- **`manifest.json` is the version authority.** Measured in agreement at `0.2.0-test.15`:
  `manifest.json:4`, `package.json:3`, and the `versions.json` tail entry [R].
- **Never release from a dirty tree.** The bump **is** the release commit; the tag is a fixed pointer;
  `vo-release` checks the branch push **and** the tag (the gap, "Resolved in Rev 3") [U].
- Release assets are exactly three: `main.js`, `manifest.json`, `versions.json` (+ `styles.css`),
  committed by convention. Measured: `main.js` **1,429,941 bytes**, `manifest.json` 291 bytes,
  `styles.css` 1,534 bytes [R] (the esbuild-reported 1.6 MB figure is the build report, not the file).
- Annotated tag notes carry the changelog **and the remaining owed items**: **"A release is not THE
  release."** Deliberate version restraint is legitimate ("no bump this session — deliberate").
- Deploy: **BRAT at release; between releases, manual copy** into the plugin folder. The plugin triggers
  on vault reload, not on install; **one reload after BRAT is the activation ritual**.
- `versions.json` records 14 test prereleases (`0.2.0-test.3 … test.15`) plus `0.2.0` [R]. Repo total:
  **61 commits** [R]. Release lineage of record: `0.1.5` → `65136c8`, `0.1.4` → `d280699`,
  `0.2.0-test.9` head `169b259`, latest `0.2.0-test.15`
  (https://github.com/iconoclast27/Muninn/releases/tag/0.2.0-test.15) [R].
- **`CHANGELOG.md` is owed in each project, "at least by releases"** (Dan, 2026-11-16) [U]; Muninn's
  release doctrine (this ADR) is the doctrine **Huginn lacks** — Huginn has no release doc and needs a
  pointer stub (ADR-8, Phase 3 triage item).
- **`SECURITY.md` is owed in each project** (Dan, 2026-11-16) [U], stating the private/experimental
  posture, no warranty, no issue channel, and the external requirement (Ollama) (ADR-17, ADR-20).

## 16. Staffing, executor contract, model roster (ADR-21)

- **Design authority stays with the high-capability model. Implementer output is a draft requiring
  fixture verification — never a fact.**
- **Executor contract (seven rules):** raw output only ("a summarized traceback is a lie"); one command
  per receipt, never chained; append-only receipts file; **no side effects unless the task authorizes
  them** (git commit/checkout/reset/clean, `rm`, `mv`, `tee`, `npm install` forbidden by default);
  **on any surprise, halt** — "Surprises belong to the human"; no memory across sessions ("the files
  win"); **"IF A FIELD CANNOT BE FILLED FROM A RECEIPT, WRITE 'UNKNOWN'. Never infer. Never estimate.
  Never remember."** The file `docs/Standing Qwen prompt.txt` (undated body) was **archive material** by
  ruling — "We don't plan on using those models again"; the durable rules are mined into conventions
  first (ADR-21, Dan 2026-11-16) [U]. The file was tombstoned in `docs/archive/` and **deleted
  2026-11-17** (Phase 5, Dan's authorization); the rules live in `CONTRIBUTING.md` and ADR-21.
- **Escalation ladder, bounded and fixture-refereed:** behaviour-preserving refactor → single-file
  driver swap → small new module → participation in the rework only if all green. **The first supervised
  run is the human's call, not the model's.**
- **Adversarial specs:** "Specs must be written **adversarially** — as if for a contractor who cannot
  ask questions and will silently resolve any ambiguity wrongly." Underspecified design documents are
  the primary hazard of the architect/mason split. This report obeys that rule.
- **Provenance labels are canonical: [R] / [U] / [H] / [GHOST].** Assistant-authored `[!decision]`
  blocks are proposals, not rulings; **"Retrieval surfaces real documents of unknown vintage. A hint,
  never an authorization."**
- **Adversarial review protocol:** reviewer ranks critical→low, cites files, proposes no fixes beyond
  named ones; Dan rules; the implementer executes; the engineer may open fire on the review. Credit
  discipline: "The sin was trajectory, not craft." Precedent: 21 findings at `0.2.0-test.1/2`, all fixed
  in two commits [R].
- **Model roster (Dan, 2026-11-15/16):** Gemma4:12b retired, qwen closed, kimi (paid plugin) is the
  known-good path with a declared ~$120 cap. Muninn's embedding model stays `nomic-embed-text:v1.5`
  [R]; `Never Try To Teach A Pig To Sing.md` (65 lines, tracked in **Huginn** [R]) was archive material
  (ruling 9), tombstoned in Huginn's `docs/archive/`, and **deleted 2026-11-17** with Huginn's archive
  (Phase 5, Dan's authorization). The closure facts rest on Dan's ruling and the committed handover
  narratives, never on stored transcripts [U].
- **Interaction rule:** judgment calls get a recommendation plus the reasoning, then Dan rules; "if I
  can decide it with a stated reason, *decide it*. Handing back a menu is a documented failure mode.
  Asking for receipts is always right. Asking for decisions I can make myself is the failure."
  **Handovers carry one next action; lists of next actions cause wrong picks.**
- **Epistemics:** "Between-session ghosts: training-data memories are contamination-prone. If it wasn't
  in a pasted file or committed URL, it didn't happen." **Committed-doc claims are ghosts until
  measured** (the paste-ritual shrink, 2026-10-24). "When numbers conflict, ask the witness
  immediately, don't re-derive." "A question is a deliverable; a guess is a liability."
  **Predictions require proofs** — trace the interleaving and state why the fix closes the window.
  **Re-emit full files, never prose patches.** **Forest before trees** (check the map before a task).
  **Doc alignment at session close** is mandated ("Before committing a phase, check whether any of the
  seven docs has drifted from what the code now does") — the seven-doc set is exactly what this
  rationalization is collapsing. Docs aligned at verification, in the same commit as the code they
  contextualize.
- **Authorization rule of record:** "No further code changes should happen without the user's
  go-ahead"; open items are not to be closed by workaround; **ask before pushing**; no commits, version
  bumps, release cuts, or tags without Dan's explicit authorization (ADR-29) [U].
- Untracked-at-root files are named, not deleted ("do not touch unless asked").

## 17. Environment (measured)

Mokka desktop (Garuda, RTX 4070) and Latitude 5400; fish shell; micro editor; GitHub Desktop drives
operations while receipts come from CLI; open-webui under podman quadlet (`:ro` removed); Ollama on the
host at `localhost:11434` from Obsidian's renderer [R]; BRAT re-pointed at Muninn; legacy
`vault-overseer-index` remote removed (disk copy only); the test vault carries two spike plugins that are
noise and recommended for deletion [U/R]. Renderer reality: esbuild `platform: 'browser'` +
externalized Node built-ins (`obsidian`, `crypto`, `fs`, `path`, `os`, `module`, `node:*` measured in
`esbuild.config.mjs:13` [R]), Node `Buffer` replaced by `TextEncoder`/`TextDecoder` (not guaranteed in
the Electron renderer), CJS bundle + `loader: { ".wasm": "base64" }` (measured [R]), `locateFile`
mandatory, open flag `'c'` never `'ct'`, `sqlite3InitModule` async so `openStore()` is async, JSON1 not
compiled in, FTS5 compiled in, trigram is part of FTS5 (SQLite 3.34.0+), `spike-node.mjs` recommended as
a permanent one-command engine regression test [R/U]. Paste discipline: smallest paste that answers the
question; line count printed before pasting; digests go stale immediately; `node_modules` inflates every
digest; frontmatter timestamps are not evidence. Container installs evaporate at image update.

Naming lineage (so archive filenames do not read as product claims): **Vault Overseer (FOVEYE) / repo
`vault-overseer-index` → Muninn** (ADR-26) [U/R].

## 18. Deferred, parked, and owed (the standing ledger)

Parked items are **registered, not scheduled** — an untested path, not a red (ADR-7).

1. **`listNotes` ruling (ADR-37)** — contract written, status Proposed, ruling owed. Nothing
   implemented. Sequencing is binding: Muninn `api.ts` → Huginn mirror → `list` in the loop; Muninn
   leads, Huginn cannot lead [U].
2. **Compute threading ruling (ADR-35)** — no workers as-built; main-thread scan by design.
3. **ANN / vector index for >10k chunks** — named debt behind an epoch bump.
4. **Plugin 2 code left in Muninn, measured 2026-11-16** [R]: commit `084a076` moved chat/skills to
   Huginn and removed every Plugin 2 import from `main.ts` and `settings.ts`, yet
   `src/harness/` (5 files), `src/llm/` (1), `src/recipes/` (7, incl. `tag-assignment.md`) remain on
   disk, and **only fixtures `f25.ts` and `f26.ts` import them** (measured imports [R]). So Muninn
   ships green fixtures that referee code production no longer wires. This is the doctrine case in
   action ("a fixture may keep dead code alive as a named oracle", ADR-7) and the ADR-22 interrogation
   question at the same time (no production consumer). **Ruling owed**: delete f25/f26 + the 13
   modules, keep them as a named oracle, or archive. (Huginn has its own harness, ported 2026-11-07, so
   the corpus is duplicated [R].) Raised for investigation, not acted on.
5. **Three empty untracked directories `src/search/`, `src/probe/`, `src/rebuild/`** (0 files each,
   spine-era layout leftovers) [R] — ruling owed alongside Dan's ruling 10 (empty dirs deleted). Not
   acted on. `docs/AGENTS/SKILLS/` is the ruled case.
6. **Mobile live receipt owed** (ADR-14). `isDesktopOnly` is a parked question, not a bug: `false` is
   correct, no code change; the archived "flip owed pending mobile live receipts" text is the stale
   artifact, superseded (Dan 2026-11-16) [U].
7. **Folder-rename child-path production receipt owed** (ADR-5).
8. **`onunload` durability** — best-effort/async, not guaranteed on forced quit (named debt).
9. **`CHANGELOG.md`** in both projects (ruling 5) and **`SECURITY.md`** in both (ruling 6), written in
   Phase 4, pending approval.
10. **Muninn `TESTING1.md` update** (ruling 8): the doc pins `0.2.0-test.6`/`test.7` in "Fixed in this
    build" and Scenario K's "post-`0.2.0-test.7`" condition, and its manual receipts are dated
    2026-11-06 (`test.8` era), while the release is `test.15` [R] — drift. Update in Phase 4.
11. **Canonical doc set** (Phase 3/4): conventions doc, ADR set, this report, `CHANGELOG.md`,
    `SECURITY.md`, `README.md`, `TESTING1.md`, Store Spec; archived: 23 sealed files, 14 committed
    handovers/reviews, `Plugin 2 Harness.md` + `tool-skill-strategy.md` (tombstone → Huginn),
    `Standing Qwen prompt.txt`, empty-dir cleanup; shared docs owned by Muninn with pointer stubs in
    Huginn (rulings 1–10) [U]. Archive→delete remains a later human-approved step, never mine
    (ruling 13). **Both steps executed 2026-11-17 on Dan's authorization** — Phase 4 wrote the canonical
    set (commit `9b2a2bd`, pushed `b75c408..9b2a2bd` [R]); Phase 5 deleted `docs/archive/` (34 tracked
    files) — see §22.
12. **Phase 1 count correction** — my own drift, recorded honestly: Phase 1's header said
    "34 tracked docs + `README.md`" and labelled the live-doc table "11 live Muninn files". Measured
    2026-11-16: `git ls-tree` = **37 tracked files under `docs/`** (23 in `docs/ARCHIVE/`, 14 live) +
    `README.md` = **38 tracked doc files** [R]. The Phase 1 file rows were complete; the header count
    was wrong. Corrected here (ADR-6: corrections ledgered, not edited away).

## 19. Known drift register (doc ↔ code)

Measured, dated 2026-11-16. Each line is a Phase 3 triage input, not an action taken.

| # | Drift | As-built truth [R] |
|---|---|---|
| 1 | `TESTING1.md` pins `0.2.0-test.6/7` conditions and 11-06 receipts; release is `test.15` | `manifest.json:4`, `package.json:3`, `versions.json` all `0.2.0-test.15` |
| 2 | `isDesktopOnly` "flip owed" doctrine | `manifest.json:10` `isDesktopOnly: false` — correct; supersession text owed (ADR-14) |
| 3 | Archived "embeddings future / not implemented", "mobile linear-scan fallback", warmup `"_"` dimension probe, FTS external-content row | semantic lane shipped (`api.ts:228-269`); FTS row self-contained (`store.ts:176-185`); dim is a setting (`settings.ts:20`, `main.ts:496-504`) |
| 4 | `src/search` as a module (the "search lane" narrative, and my own earlier citation) | `src/search/` is an **empty untracked directory**; the lexical doors live in `store.ts:633-675` and `api.ts:116-128` |
| 5 | Plugin 2 as a Muninn feature (Plugin 2 Harness.md, tool-skill-strategy.md, f25/f26, `src/harness`, `src/llm`, `src/recipes`) | `084a076` removed Plugin 2 wiring; `main.ts:90-91` states the harness has moved to Huginn; only f25/f26 import the modules |
| 6 | Auto-apply ✅ row (2026-10-20 archive map) vs write-class rulings | one gate, no write-class in v1 (2026-11-03), then gated `write` re-admission in Huginn (2026-11-15); `batch-suggest`/`auto-apply` superseded by name |
| 7 | Spine vocabulary in sealed docs (shards, heal, projection, Tier-2, origin ladder, `_vault-index/events/`) | demolished 2026-11-03; durable generalizations preserved in ADR-22 |
| 8 | `docs/AGENTS/SKILLS/` as a repo copy of the vault namespace | empty untracked dir, 0 files — ruled: delete |
| 9 | Phase 1 header doc counts (34 / "11 live") | 37 tracked under `docs/`, 14 live, 38 tracked including `README.md` |
| 10 | `main.js` "1.6 MB bundle" quoted from the build report | file measures 1,429,941 bytes |

## 20. Source registry (mining destinations)

Tracked docs measured 2026-11-16: 37 under `docs/` + `README.md` = 38 [R]. All 23 archived files were
read and mined; destinations below. **All archive material is deleted 2026-11-17** (Phase 5, Dan's
authorization): **34 tracked files** under `docs/archive/` [R], each carrying the tombstone *"Archived
2026-11-17. Superseded by <doc>. Not authoritative."* The deleted files are recoverable from the git
history (§22).

**`docs/archive/` (renamed per ruling 1; 23 sealed files, deleted 2026-11-17)** — durable facts → ADRs /
this report / conventions:

| Archived file | Destination |
|---|---|
| `architecture-map.md` (Map v0.5, rev 11-01) | ADR-1, ADR-5, ADR-7, ADR-12, ADR-18, ADR-31 (superseded row), ADR-34, ADR-35; report §12 |
| `comparison.md` (v2, CLOSED 10-24) | ADR-3, ADR-6, ADR-17, ADR-30; report §2 |
| `project-definition-file.md` (10-18, rev 11-01) | ADR-1, ADR-2, ADR-14, ADR-16, ADR-17, ADR-27, ADR-30; report §1, §3, §17 |
| `chunker-spec.md` (v0.1, rev 10-24, 10-27) | ADR-4, ADR-9; report §6 |
| `event-log-schema.md` (v0.2, 10-24) | ADR-22, ADR-5; report §9 |
| `event-log-fixture-corpus.md` (v0.1, rev 11-01) | ADR-7, ADR-15, ADR-28; report §14 |
| `REPORT.md` (11-04/11-05) | ADR-16, ADR-19, ADR-22; report §4, §17 |
| `Fleet test block.md` | no mining required (superseded by the `npx tsx` convention) |
| `testresults-2026-11-06.md` | report §7 (port/model facts), `TESTING1.md` receipts |
| `Session Gitingest Paste Playbook.md` (rev 11-01) | conventions doc; report §17 |
| `Session Handover Note 2026-10-24.md` | report §16 (paste-ritual scope), ADR-26 |
| `Session Note 2026-10-25.md` | conventions doc (session-verified rule); spine inventory discarded |
| `Session Handover, 2026-10-26.md` | ADR-7 (ground rules + exception ledger); report §14, §16 |
| `Session Handover — post-0.1.7, 2026-10-27.md` | conventions doc (forest-before-trees, doc alignment); report §16 |
| `Session Handover — 2026-10-28.md` | ADR-10, ADR-11; report §14 |
| `Session Note — 2026-10-29.md` | ADR-12, ADR-11 (witness rule); report §16 |
| `Session Note 2026-10-30.md` | ADR-8 (deliberate restraint), ADR-5; report §15 |
| `Session Note -- 2026-10-31.md` | ADR-13, ADR-14, ADR-15, ADR-25, ADR-28; report §14, §16 |
| `Session Note -- 2026-11-01 Morning.md` | ADR-11, ADR-12, ADR-13, ADR-16, ADR-18, ADR-28, ADR-34; report §12, §16 |
| `Session Handover Note 2026-11-02.md` | ADR-2, ADR-14, ADR-19, ADR-20, ADR-21, ADR-25; report §4, §17 |
| `Session Note -- 2026-11-03 Morning.md` | ADR-21, ADR-22, ADR-31, ADR-32, ADR-33, ADR-34; report §16 |
| `HANDOVER - 2026-11-05.md` | ADR-7, ADR-8, ADR-20, ADR-30; report §14, §15 |
| `HANDOVER - 2026-11-06.md` | ADR-36, ADR-8; report §8, §15 |

**Live `docs/` (14 files)** — disposition per rulings 7, 8, 9, 11 and Phase 3:

| Live file | Disposition |
|---|---|
| `Muninn Store Rewrite Specification.md` (Final v3) | **mined, then archived** (approved triage row 25), tombstoned *Archived 2026-11-17*, **deleted 2026-11-17**; the contract of record is this report §4, §6, §8 + ADR-4, ADR-9, ADR-10, ADR-22, ADR-31, ADR-32, ADR-36 |
| `Unified Project Definition v0.2.md` | **canonical, Muninn owns**; Huginn keeps a pointer stub (ruling 4) |
| `LLM Coordination Protocol v1.0.md` | **canonical, Muninn owns**; Huginn keeps a pointer stub (ruling 4); conventions lineage |
| `TESTING1.md` | **canonical**, updated (ruling 8) |
| `Release Ritual -- Walkthrough.md` | **canonical** conventions (ADR-8 authority) |
| `Project Prompt.md` | **merged into `CONTRIBUTING.md`, then archived** (approved triage row 26), tombstoned *Archived 2026-11-17*, **deleted 2026-11-17** |
| `README.md` (repo root) | **canonical** |
| `Tracked Issues.md` | **canonical for both projects**, added 2026-11-17 (second pass, ruling 40 / `adr-40.md`); Huginn keeps a pointer stub. The docket's facts are measured findings, Dan's rulings verbatim, and pointers to the committed execution record — it copies nothing that this report already states |
| `Plugin 2 Harness.md` | **archive with tombstone → Huginn's harness doc** (ruling 7) |
| `tool-skill-strategy.md` | **archive with tombstone → Huginn** (ruling 7); R9/R10 mined into ADR-32 |
| `Standing Qwen prompt.txt` | **archive** (ruling 9); seven-rule contract mined into ADR-21/conventions |
| `Session Handover 2026-11-03 Evening.md` | **archive** (ruling 3); the ten rulings live on as ADR-23, ADR-24, ADR-25, ADR-26, ADR-27, ADR-28 |
| `Independent Review 2026-11-04.md` | **archive** (ruling 3); findings mined into ADR-28, ADR-29, report §12 |
| `HANDOVER - 2026-11-04.md` / `… Evening.md` / `… Review.md` | **archive** (ruling 3); mined into ADR-23, ADR-29, ADR-16, report §17 |

**All rows marked archive above are deleted 2026-11-17** (Phase 5, Dan's authorization). The destinations
named in each row are where those facts live now: they are canonical and this report and the ADR set are
the only authoritative carriers.

**New canonical docs (Phase 4, written 2026-11-17, committed `9b2a2bd` [R]):** `docs/decisions/` ADR-1 …
ADR-37 + `index.md`, this Design Report, `CONTRIBUTING.md` at the repo **root** (the planned
`docs/Conventions.md` name was not used; it carries the mined conventions corpus: receipts-or-nothing,
provenance labels, paste discipline, timestamp doctrine, fixture rules + hostility ledger, red taxonomy,
sequencing, erasure-TS, doc alignment at session close, session-close ritual, executor contract,
interaction rule, forest-before-trees, platform-receipt rule), `CHANGELOG.md`, `SECURITY.md` (both at the
root, matching Huginn — placement ruling owed, T17/T18), `README.md` refresh.

## 21. One next action

Present Phase 2 Muninn (ADR-1 … ADR-37 + this report) to Dan, **wait for approval**, then write the
Muninn triage table for approval (ruling 12) — nothing moves in the repo before written approval
(Phase 4).

**Discharged 2026-11-17:** Phase 2 approved, the Phase 3 triage approved, Phase 4 executed (`9b2a2bd`,
pushed), Phase 5 (archive→delete) executed on Dan's authorization. The next action is §22's: the code
thread behind its gate, in binding order, with Dan's tasking owed (rulings 0/1/3) and ADR-37 **Proposed,
ruling owed**.

## 22. Phase 4 and Phase 5 records (dated 2026-11-17)

**Phase 4 executed 2026-11-17** on Dan's written authorization ("Approved and proceed on phase 4",
2026-11-16; Phase 2 Muninn and the Phase 3 Muninn triage table approved 2026-11-16). Executed in Muninn:
37 ADRs + `index.md` written into `docs/decisions/`; this Design Report written into
`docs/Initial Design Report.md`; `docs/ARCHIVE/` renamed `docs/archive/` and every moved file stamped
with the tombstone *"Archived 2026-11-17. Superseded by <doc>. Not authoritative."*; `docs/archive/README.md`
(the archive rule + index); `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` written at the repo **root**;
`README.md` Docs section; `docs/TESTING1.md` version-of-record header (`0.2.0-test.15`, tag commit
`084a076`); the empty untracked `docs/AGENTS/SKILLS/` deleted. Commit `9b2a2bd` —
`docs(rationalisation): phase 4 canonical set — ADRs, Design Report, archive with tombstones` — **111 files,
2391+/5526−** [R], pushed `b75c408..9b2a2bd main -> main` [R]. Receipts tied to the commit:
`TYPECHECK EXIT:0`, **26 `VERDICT: GREEN`**, `FIXTURES LOOP DONE` [R]. Docs-only: no `src/` change; tags
untouched (15 local, 27 remote refs [R]).

**Phase 5 executed 2026-11-17** on Dan's authorization ("Phaswe 5 and the docs commit pushed", Dan
verbatim, 2026-11-17). The deletion is `git rm -r docs/archive`: **34 tracked files** [R], the measured
`git ls-files docs/archive` count taken immediately before the deletion. The tombstoned copies leave the
working tree and the index; the content remains recoverable from the git history (all 34 were tracked).
Huginn's Phase 5 is the same act on 19 tracked files. Live-doc conform, same commit: `README.md` (the
archive bullet → the deletion record), `CONTRIBUTING.md` (the archive sentence), `docs/TESTING1.md:325`
(the `docs/ARCHIVE/testresults-2026-11-06.md` citation), `docs/Unified Project Definition v0.2.md:7` (the
store-spec supersession note), this report's header companion claim, §18 item 11, §20 registry rows, §21,
`CHANGELOG.md`'s docs record, and `docs/decisions/index.md`'s dated addendum. **No ADR body is edited**
(ruling 2, ADR-6): **88 lines in 34 ADR files** cite `docs/archive/...` [R] as acceptance-time evidence;
the facts behind each citation live in the ADR decision text, this report, and `CONTRIBUTING.md`, and the
cited files are recoverable from history.

**Live doc set measured after Phase 5:** `git ls-files docs README.md CHANGELOG.md SECURITY.md
CONTRIBUTING.md` = **47 tracked files** [R]: `README.md`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`;
`docs/Initial Design Report.md`, `docs/TESTING1.md`, `docs/Release Ritual -- Walkthrough.md`,
`docs/LLM Coordination Protocol v1.0.md`, `docs/Unified Project Definition v0.2.md`; `docs/decisions/`
(37 ADRs + `index.md` = 38). `docs/archive/` is gone from the index.

**Next action:** the code thread stays behind its gate, in binding order, once Dan tasks it (rulings 0/1/3):
Muninn `listNotes` (ADR-37, **Proposed — ruling owed**) first, then Huginn's mirror at
`src/muninn-api.ts:57`, then `list` in the op loop. **Huginn cannot lead.** No version bump, tag, release
cut, or release push is authorized.

## 23. Second pass, 2026-11-17 — rulings on T1, T2, T3, and the docket's home

Three rulings from Dan closed docket rows and are recorded as ADRs:

- **T1 — "T1, keep as a named oracle… It may even be useful to test your additive method"** (Dan,
  2026-11-17), **"Let's go with A."** → `adr-38.md`. Measured census before the ruling:
  `git ls-files src/harness src/llm src/recipes` = **15 tracked files**; `git grep -l "recipes/" HEAD -- src`
  returns **only the 7 recipe files' self-imports**; only `f25.ts`/`f26.ts` import the corpus; Design Report
  §14 line 150 already recorded dormancy. The 15 files stay tracked and green; the fixture chain
  `f01..f26` stays gapless; f25/f26 are named as Muninn's referees for the interface **ADR-37 (`listNotes`)
  must not disturb** — f26 guards harness reference counting and dwell, f25 the registry/approval/prompt-safety
  contract.
- **T2 — "T2, remove the empty directories."** (Dan, 2026-11-17) → `adr-39.md`. Executed 2026-11-17:
  `rmdir src/probe src/rebuild src/search` after measuring the dirs empty, 0 files, 0 tracked. Re-measured
  after: no empty dirs in `src`, `git status --porcelain` clean. **The act leaves no commit** — git cannot see
  an empty directory, so the ADR is the record. `.qwen/tmp` measured empty in the same pass and is **out of
  this ruling's scope** → **T36**, ruling owed.
- **T3 — "T3, that's fine."** (Dan, 2026-11-17) → closed. The Phase 1 count correction is §18 item 12,
  committed in `9b2a2bd`.
- **The storage ruling → `adr-40.md`:** a working document that outlives one task lives in the repo;
  `/tmp` is for the length of one task; provenance-only copies are not preserved, because stating a fact
  twice is a drift opportunity. The docket therefore moves into the repo as **`docs/Tracked Issues.md`,
  canonical for both projects**, with a pointer stub in Huginn. It copies nothing: the execution record,
  approvals, and dispositions stay where this report and `CHANGELOG.md` state them, and the docket points at
  them.

**T36 — "You can remove .qwen"** (Dan, 2026-11-17). Measured before removal: `find .qwen -type f` = **1**
(`.qwen/settings.json`), `git ls-files .qwen | wc -l` = **0**; `rm -r .qwen`. Re-measured:
`find . -maxdepth 2 -type d -empty -not -path "./.git*"` → **no output**, `git status --porcelain` shows only
the docs of this pass. Tool residue, untracked, so it leaves no commit; `adr-39.md` carries the scope.

**Receipts for this pass, measured at HEAD `6b76e41` before the docs commit (pasted, not stored):**
`HEAD: 6b76e41` · `TYPECHECK EXIT:0` · `grep -c 'VERDICT: GREEN'` → **26** · `FIXTURES LOOP DONE`
(`bash` loop over `f01..f26`, exit 0). Huginn measured the same day at HEAD `9030196`:
`TYPECHECK EXIT:0` · `FIXTURES EXIT:0` · **30 `VERDICT: GREEN`**. The `rmdir` act leaves no commit, and
`git status --porcelain` in Muninn shows only the docs of this pass (`M docs/Initial Design Report.md`,
`M docs/decisions/index.md`, `M README.md`, `M CONTRIBUTING.md`, `?? docs/Tracked Issues.md`,
`?? docs/decisions/adr-38.md`, `?? docs/decisions/adr-39.md`, `?? docs/decisions/adr-40.md`).
**Measured doc counts before this pass:** Muninn **47** tracked doc files, Huginn **50** [R]. This pass adds
4 tracked files to Muninn (`docs/Tracked Issues.md`, `adr-38.md`, `adr-39.md`, `adr-40.md`) and 1 to Huginn
(`docs/Tracked Issues -- Pointer.md`); the new files are untracked until Dan authorizes the commit, so the
counts above are the pre-pass numbers, not the post-pass claim.
