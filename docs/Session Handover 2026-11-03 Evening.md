# Session Handover — 2026-11-03 Evening

**Serves as both session note and handover.** Read this file first, then the doctrine sources named in §0.

***

## 0. READ THESE FIRST (doctrine sources on disk)

| File                                         | Status                                             | Notes                                                                              |
| -------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/LLM Coordination Protocol v1.0.md`     | **\[R]** pasted whole this session                 | Two-model coordination, receipt markers, handover schema, anti-haunting discipline |
| `docs/Muninn Store Rewrite Specification.md` | **\[R]** authored this session (v3)                | The contract for the index layer                                                   |
| `docs/Unified Project Definition v0.2`       | **\[R]** read earlier this session, pre-compaction | Plan of record. Re-read from disk; do not trust memory of it                       |
| `docs/tool-skill-strategy.md`                | **\[U]** believed read this session                | Plugin 2 / skills strategy. Re-read from disk                                      |
| `docs/Project Prompt.md`                     | unread                                             |                                                                                    |
| `docs/Release Ritual -- Walkthrough.md`      | unread                                             |                                                                                    |
| `docs/ARCHIVE/*`                             | sealed receipts                                    | The morgue. Read selectively, never treat as current state                         |

***

## 1. CURRENT STATE

* **Commit:** `10763ab` (HEAD -> main) — "feat: skeleton, store spec v3, F01 fixture, build plumbing"
* **Parent:** `d2f8ce9` (Initial commit)
* **Branch:** `main`
* **Repo path:** `/home/danf/Projects/Muninn` — **directly under `Projects`**, no umbrella directory
* **Remote:** `https://github.com/iconoclast27/Muninn` — public. Do not belabor this fact; it is settled and Dan is tired of hearing it
* **Working tree at time of writing:** clean

***

## 2. WHAT WAS VERIFIED (WITH RECEIPTS)

### Repo & infrastructure

* `npm install` → 21 packages, 0 vulnerabilities; `package-lock.json` committed
* `git add -A && git commit` → `10763ab`, 38 files changed, 8374 insertions
* Node v26.13.0; tsx resolved at **4.23.15** (from the npx receipt)

### Dependency facts (transcribed from legacy `package.json`, not invented)

* `@sqlite.org/sqlite-wasm`: **`^3.54.1-build1`**
* esbuild: **0.28.2** (revealed by the legacy `allowScripts` block)
* Legacy carried `better-sqlite3@^13.0.3` + `@types/better-sqlite3` — **dropped** in Muninn (engine swap is a founding decision)
* Kept from legacy: `@types/node`, `builtin-modules`, `esbuild`, `obsidian`, `tslib`, `typescript`
* Added: `tsx` as a real devDependency (npx cache is not a reproducible toolchain)

### Engine receipts (both spikes GREEN, 2026-11-03)

* **WASM SQLite:** version 3.54.1, FTS5 compiled in, 879,084 embedded wasm bytes, 49,152 exported bytes
* **Ollama embed:** `/api/embed` responds from Obsidian's renderer; `nomic-embed-text:v1.5` returns **768 dims**; batch form `input: [texts]` confirmed; `keep_alive: '-1m'` works

### Engine API shape (from `spike-node.mjs` + `spike-plugin.js` pastes)

* `sqlite3InitModule()` is **async** in both Node and Obsidian lanes
* Obsidian lane: `wasmBinary: <Uint8Array>` + `locateFile: () => 'sqlite3.wasm'` (short-circuits a fatal `new URL(import.meta.url)` in CJS bundles)
* Base64 wasm arrives via esbuild `loader: { ".wasm": "base64" }`, decoded with `atob` → `Uint8Array`
* Statement API: `db.prepare(sql)` → `s.bind([...])` → `while (s.step()) s.get([])` → `s.finalize()`
* `db.exec(sql)` for single statements; `sqlite3.capi.sqlite3_js_db_export(db)` for export; `db.close()`
* DB flags **`'c'` only** — `'t'` is SQL trace spam
* **Results are ARRAYS, positionally indexed.** No `.all()`, no object-shaped rows

### Certified assets on disk (committed in `10763ab`)

* `src/chunker/chunker.ts` — pasted whole. `chunkNote(Uint8Array): ChunkResult` → `{chunks, carves, hadBom, fm}`; exports `CHUNKER_CP = 2`, `TARGET_BYTES = 2048`, `CEILING_BYTES = 3072`
* `src/chunker/render.ts` — **exists, never read.** Provides `embedVh`, `parseFmContext`, `renderEmbedInput`, `type FmContext` (names **\[R]** from chunker's import; signatures **\[H]**)
* `src/fixtures/csuite.ts`, `props.ts`, `test-harness.ts` — harness core, contents unread
* `spike-node.mjs`, `spike-plugin.js`, `spike-esbuild.config.mjs` — engine receipts, banked

### Rulings made (all folded into spec v3)

1. Schema split: `chunks` PK `(path, ord)`; `embeddings` PK `vh`; lazy retention for orphaned vectors
2. Governance lives in the vault under `Agents/` (`SKILLS/`, `Notebook/`, `Memories/`) — never `_vault-index/`
3. Trigram floor: 2-char → `LIKE` fallback with disclosed `mode: 'scan'`; 1-char → empty with reason
4. Clean start, new repo (`Muninn`) — not a branch of legacy
5. ngram tokenizer exploration: unnecessary
6. Per-row `cp` dropped from store schema; `chunker_epoch` in meta is sole authority
7. `forceReindex` takes a progress callback; read-only `query()` guards first SQL keyword as an allowlist
8. Delete purges chunks + FTS + watermark atomically (pairing invariant; closes the resurrection hole)
9. Dwell dies entire. Actor attribution dies. No timer for a dead spine
10. Embedding GC = lazy retention (cache hits beat kilobytes)

***

## 3. WHAT IS CLAIMED-BUT-UNVERIFIED

### Never read (on disk, contents unknown)

* `src/chunker/render.ts` — **highest priority gap.** `embedVh()`'s exact computation (full SHA-256? truncated?) is unknown
* `src/fixtures/csuite.ts`, `props.ts`, `test-harness.ts` — harness APIs unknown
* `spike-esbuild.config.mjs` — read; it is marked throwaway and proves only the base64 loader line
* `docs/Unified Project Definition v0.2`, `docs/tool-skill-strategy.md` — read pre-compaction; re-read from disk

### Does not exist yet

* `src/store/store.ts` ← F01 dies here, by design
* `src/api.ts`, `src/intake/lane.ts`, `src/main.ts`, `esbuild.config.mjs`, `manifest.json`

### Known defects in `src/fixtures/f01.ts` (needs amendment)

* Assumes **sync** `openStore()` — must be `await`ed (spike receipts: `sqlite3InitModule` is async)
* Assumes **object-shaped** query results — receipts say arrays, positionally indexed
* Import paths were corrected by Dan; the chunker import now resolves **\[R]** (the error moved from `../src/chunker/chunker.ts` to `../store/store.ts`)

***

## 4. OPEN QUESTIONS

1. What exactly does `embedVh()` compute, and where does the 16-hex truncation happen?
2. Does `render.ts` use `node:crypto` directly, or wrap it?
3. What are the harness trio's exported APIs (for wiring F01 into the suite)?
4. What is the plugin `id` in `manifest.json`, and does BRAT get re-pointed at Muninn?

***

## 5. NEXT SINGLE ACTION

**Paste `src/chunker/render.ts` whole.**

That closes the last context gap in the chunker→store chain: `embedVh`'s formula is needed to write `store.ts`'s vh handling correctly, and `renderEmbedInput` is what the embed path calls. Then amend F01 (async + array-shaped results), then write `store.ts`.

Execute one action, paste output, stop. No prioritized lists.

***

## 6. DOCTRINES WE WORK BY

_(This section was missing from the first draft of this handover. It is the part that would otherwise evaporate with the context.)_

### 6.1 Epistemics — receipts or nothing

* **Terminal output is the only fact source.** My predictions are hypotheses, not results.
* Provenance labels: **\[R]** receipt (pasted terminal/file), **\[U]** Dan's word (trusted, but does not authorize a cut), **\[H]** my inference, **\[GHOST]** retrieval-surfaced.
* **Retrieval surfaces real documents of unknown vintage.** A hint, never an authorization. Anything that decides a cut requires a paste.
* **Never invent:** versions, SHAs, paths, filenames, signatures, file listings, test results, package names.
* Corroboration requests are batched at natural checkpoints, not drip-fed.
* If context disagrees with the live tree: declare the mismatch, request a fresh dump, do not proceed.

### 6.2 Method — fixture-first

* **Contract text before implementation.** Fixtures are authored from the contract, not from the code.
* **Red must be earned.** A red against a nonexistent module is a type error, not a test failure. The meaningful red is a real interface behaving wrongly.
* Step-by-step, verified. Never run ahead of evidence.
* **Re-read your own drafts before delivering.** Cheapest place to catch defects.
* Fixing a defective draft = **re-emit the whole file**, never a prose patch.
* Declared limitations over hidden ones. Loud over silent.
* **Don't spiral.** Unreproduced anomalies get noted, not chased.
* Session end: everything verified is committed; everything unverified is named.

### 6.3 Interaction — Dan is the routing layer

* Judgment calls get **a recommendation plus the reasoning**, then Dan rules.
* **But:** if I can decide it with a stated reason, _decide it_. Handing back a menu is a documented failure mode (see §6.6).
* **Asking for receipts is always right. Asking for decisions I can make myself is the failure.**
* Handovers carry **one** next action. Lists of next actions cause wrong picks.
* No moralizing, no lecturing, no hedging padding, no flattery. Dry humour welcome.

### 6.4 Output format

* **Whole-copy content → a creation** (canvas). **Fragment-paste content → a chat code block.** Never mix.
* Takeaways, reviews, summaries → **unwrapped Obsidian markdown** unless told otherwise.
* Handovers and session notes → markdown documents, committed to `docs/`.

### 6.5 Architecture doctrine

* **Zone 1 = authored human law:** vault-resident, synced, editable (`Agents/SKILLS/`, `Agents/Notebook/`, `Agents/Memories/`).
* **Zone 2 = derived machine state:** plugin folder, disposable, never synced, never human-edited.
* **One writer, one reader door.** The index has exactly one consumer: the plugin's own API.
* **The LLM never touches the index.** Plugin 2's harness calls Plugin 1's frozen API and renders the form to the model. _Model judges, harness acts._
* **Dark-safe:** absent service → `null` + reason. Never crash, never block, never silently substitute.
* **Degraded modes disclose themselves** (`mode: 'scan'`, carve notes, skip disclosures).
* **Epoch bump on any behavioural change.** Nothing enforces it; it is a rule, not a mechanism.
* **Killer invariant:** byte offsets reproduce the chunk text exactly. Everything else is negotiable furniture.
* **Determinism:** pure functions. No clock, no locale, no random, no iteration-order luck.
* **Escalation ladder for the local model:** refactor → driver/module swap → small module → participation. Bounded, fixture-refereed, one rung at a time, human-approved.

### 6.6 Failure catalogue — recognise these symptoms in yourself

* **Confident hallucination:** inventing a SHA, path, version, or file listing.
* **Ghost ingestion:** treating a retrieval-surfaced document as Dan's paste.
* **Menu fatigue:** ending a reply with options dressed up as questions.
* **Flailing:** empty tool calls; prescribing paths never asked about; prose patches instead of full re-emits.
* **Stale-doc-wins-over-receipt:** reciting an old constraint against an observable current fact.
* **Running ahead:** designing the next three steps before the current one is receipted.

***

## 7. ENVIRONMENT FACTS

* **Machines:** Garuda Mokka x86_64 / RTX 4070 (primary); Garuda Mokka on Dell Latitude 5400 (secondary)
* **Shell:** fish. **Editor:** micro (not nano)
* **Repo:** `/home/danf/Projects/Muninn`
* **Legacy repo:** `/home/danf/Projects/vault-overseer/vault-overseer-index` — **GitHub remote has been removed.** Disk copy only, if it still exists. Do not attempt to fetch it remotely
* **Ollama:** runs on the **host**, not containerised. Reachable at `localhost:11434` from Obsidian's renderer **\[R]**; `host.containers.internal:11434` from containers
* **open-webui:** podman quadlet. The `:ro` flag was **removed** from the `/home/danf/Projects:/projects` bind mount, so the containerised local model can now write anywhere under `Projects`. Rollback = restore `:ro`
* **Local model:** `qwen3.5:9b` via open-webui, coordinated per `docs/LLM Coordination Protocol v1.0.md`
* **Git:** GitHub Desktop drives operations; **receipts still come from the CLI**
* **BRAT:** installs plugins from GitHub; will need re-pointing at Muninn
* **Test vault:** currently carries two spike plugins (`spike-sqlite-wasm`, and the old `vault-overseer-index`) that are **noise and should be deleted**

***

## 8. SIGNATURE

Written 2026-11-03. Verified by Dan by continuation. Any claim in this file marked **\[H]** is an inference and must be re-derived from disk before it decides anything.
