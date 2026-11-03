# Session Handover — 2026-11-02

**Project:** Vault Overseer (FOVEYE) — Obsidian plugin, event-log spine + derived index **Repo:** `/home/danf/Projects/vault-overseer/vault-overseer-index/` **Git state at handover:** branch `main`, commit `5fb1b0b`, manifest v0.1.7, working tree dirty (+1205/−8 tracked, plus untracked spike files). BRAT still shows 0.1.6 as latest release; manifest is higher, so no overwrite risk. **Session type:** Continuity-break recovery session. Previous instance ran out of context before updating docs; predecessor rebuilt the doc family and wrote a session note. Dan spent 2026-11-01 ensuring full context was available. This session then **invalidated a foundational engine decision and reopened the architecture.**

***

## 0. Read This First

The single most important thing to carry forward: **this session destroyed the `better-sqlite3` engine decision and put the entire spine architecture under indictment.** Neither has been ruled on yet. Do not resume as if the architecture is settled. It is not.

Second: **four of my own claims this session were fabrications or errors, caught by Dan.** They are catalogued in §7. The pattern is consistent and it is the thing to guard against.

***

## 1. Rulings Locked This Session

| # | Ruling                            | Detail                                                                                                                                                                                                                                                                                    |
| - | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Dark-writer rebuild disclosure    | **C**, then narrowed to **C-narrow**: FTS constructs inside `startWriter` ONLY. Dark boot = no lane, no rebuild, nothing owed. Certification lights the writer; probe → rebuild-if-dirty → arm run on a live spine.                                                                       |
| 2 | `staleSkips` reporting            | **A**: route to `reportIntegrity`, ONE aggregated line per search call (reasons tallied), never a toast, never per-hit chatter.                                                                                                                                                           |
| 3 | Project Definition "Database" row | **A**: annotate as decided-vs-as-built (self-contained FTS5 table, not external-content). Corpse-marker rationale included. **See §7.1 — the original annotation contained a fabrication and has a corrected replacement.**                                                               |
| 4 | `lane.ts` disclosure door         | **Yes** — optional `reportIntegrity` dep added; doomed events disclose on the spine instead of dying in devtools.                                                                                                                                                                         |
| 5 | Unload ordering                   | **A**: declared limitation. Lane disposed before store close; in-flight pump finishes its current event. Shard impact nil (lane never writes the spine except through its null-guarded disclosure door); index impact self-heals via probe `'grown'` next boot. Loss bounded to one boot. |
| 6 | Shard naming                      | **Desktop** and **Laptop**. Not "Latitude" — that's historical. Machines differ by _role_, not OS (both Garuda Mokka). `origin.txt` has changed identity several times during testing; the name is a shard id, not a hardware claim.                                                      |
| 7 | Engine                            | **Option A**: official SQLite WASM (`@sqlite.org/sqlite-wasm`). Ruled before the spike; **spike then succeeded** (§3).                                                                                                                                                                    |

***

## 2. Code Changes Landed

Nine changes to `src/main.ts` (delivered as a change set with search-first anchors; all applied):

1. Header block documenting rulings in force + C-narrow wiring shape + deferred lazy-load debt
2. FTS imports (`makeFtsLane`, `FtsStore`, `probeStaleness`, `rebuildIndex`, `search`, types)
3. Constants: `ZONE2_CACHE_DIR = 'cache'`, `FTS_DB_SUBPATH = 'bm25/index.db'`
4. `VaultLogAdapter.stat()` door (maps Obsidian's `null` → `undefined`)
5. Plugin fields: `ftsWarning`, `ftsStore`, `ftsLane`
6. `startWriter` tail calls `setupFtsLane(adapter)`; new `setupFtsLane` method (mkdir → open → probe → rebuild-if-dirty → makeFtsLane → subscribe → arm; every failure path closes what it opened, leaves fields null, discloses on spine)
7. `onunload` FTS disposal — synchronous, no awaits (lane → store → writer)
8. `searchVault(query, limit?)` public API; returns `null` when dark; `staleSkips` → aggregated `reportIntegrity`
9. Settings tab FTS darkness warning

`src/fts/lane.ts` revised: silence map completed (`note.opened`, `note.conflicted` moved from default's "unknown type" warn to explicit no-ops with rationale); `reportIntegrity?` door added; unload limitation declared inline.

`esbuild.config.mjs`: `"better-sqlite3"` added to `external`. **Now moot** — that engine is dead (§3).

**Receipts:** `npm run typecheck` clean. Build clean. **F15 fleet: ALL GREEN (53 checks, 10 scenarios)** after the lane revision.

***

## 3. The Engine Saga — Full Receipt

### 3.1 `better-sqlite3` died at first contact

Live receipt, Desktop, 2026-11-02:

```card
[vault-overseer] FTS setup threw: Cannot find module
'/usr/lib/electron43/resources/electron.asar/build/Release/better_sqlite3.node'
```

Diagnosis: esbuild bundles the JS wrapper but **cannot bundle a compiled ELF binary**. The wrapper resolved its `__dirname` into `electron.asar`, where no such file exists. Not an ABI mismatch — a missing file, structurally unfixable by bundling.

**The containment worked exactly as designed:** `cache/` was created, store construction threw, the catch fired, one `log.integrity` disclosure line landed on the spine, the plugin survived with search dark. Zone 2 disposability, verified live.

The proposed remedy (stage `node_modules/better-sqlite3` into the plugin folder) was **correctly rejected by Dan as a bodge, not a plugin** — it breaks BRAT compatibility, requires per-device manual staging, and violates the "plugin as self-contained package" principle. Dan's framing is the doctrine: _a plugin may have external requirements but must not require extra installations in itself._

### 3.2 The incumbent autopsy had the answer all along

Re-read of the Comparison Doc v2 revealed: **Vault Curate (strongest incumbent) uses sql.js 1.14.1 — WASM, no native binary — and hand-wrote BM25 in TypeScript because sql.js ships without FTS5.** They paid a large engineering cost to avoid a native dependency. That was testimony about the exact question the original engine decision never asked.

### 3.3 Research findings (web, cited)

* The **official** SQLite WASM build ships **FTS5 only** (no FTS3/4) — deliberate, per the SQLite forum. FTS5 is enabled by default in the amalgamation config.
* **Trigram is part of FTS5** (added SQLite 3.34.0, Dec 2020) — not a bolt-on.
* **sql.js specifically lacks FTS5** — corroborated from three independent directions. So Vault Curate's hand-written BM25 was a self-inflicted wound from choosing the wrong WASM build.
* **Obsidian precedent exists and is documented:** SQLite Explorer, SQL Viewer, SQLite DB Viewer all ship WASM SQLite. SQLite Explorer's 0.6.0 changelog documents embedding the WASM into `main.js` at build time specifically to remain compatible with the standard Community Plugin asset set.
* Obsidian's rigid plugin structure means **you cannot distribute a `.wasm` sidecar** — it must be embedded. Base64-in-`main.js` is the established technique.

### 3.4 The spike: SUCCESS

Package: `@sqlite.org/sqlite-wasm` **v3.54.1-build1** (published under the sqlite org's npm scope; a community repackaging by Thomas Steiner around upstream builds — ESM, built with tsdown).

Final console receipt, inside Obsidian:

```card
[SPIKE-B] Starting...
[SPIKE-B] Embedded wasm bytes: 879084
[SPIKE-B] Version: 3.54.1
[SPIKE-B] FTS5 compiled in: true
[SPIKE-B] Trigram hits: [[1,"time blocking is great"],[3,"the block party was cancelled"]]
[SPIKE-B] Exported bytes: 49152
[SPIKE-B] ===== VERDICT: SUCCESS — WASM SQLite viable inside Obsidian
```

**Bundle size: 1.6 MB** (esbuild-reported, not estimated). Quartet-compatible: `manifest.json` + `main.js` only.

### 3.5 Hard-won technical facts — do not rediscover these

**Init call requires BOTH options:**

```js
const sqlite3 = await sqlite3InitModule({
    wasmBinary: wasmBytes,              // decoded from base64
    locateFile: () => 'sqlite3.wasm',   // REQUIRED — see below
});
```

Why `locateFile` is mandatory: `findWasmBinary()` (`dist/index.mjs:136`) calls `new URL('sqlite3.wasm', import.meta.url)`, which **throws `Invalid URL` in CJS bundles** because esbuild blanks `import.meta`. Line 137 — `if (Module["locateFile"]) return locateFile("sqlite3.wasm")` — short-circuits it before the fatal expression. `wasmBinaryFile` is a bare `var` (line 135) and is **not** readable from config; passing it is a dead end. `locateFile` is the library's own supported extension point.

**DB open flags: `'c'`, never `'ct'`.** The `t` flag installs `sqlite3_trace_v2()` and floods the console with `SQL TRACE #N` lines. Source: `__dbTraceToConsole` in `index.mjs` — "installed by the DB ctor if its open-flags contain 't'."

**esbuild config requirements:**

```js
bundle: true,
format: 'cjs',
loader: { '.wasm': 'base64' },
```

plus `import wasmB64 from '@sqlite.org/sqlite-wasm/sqlite3.wasm'` — the package's exports map exposes `./sqlite3.wasm`, so this resolves.

**Export API:** `sqlite3.capi.sqlite3_js_db_export(db)` → `Uint8Array`. This is the persistence primitive (export → `adapter.write` to `cache/bm25/index.db`). Import path not yet exercised.

**Known limitation, live-verified:** trigram requires **≥3 characters**. `MATCH 'bl'` returned **0 rows with no error** — a silent miss, not a throw. **CJK implication (raised by Dan, unresolved):** in Chinese, two characters is a complete word, so a large fraction of natural queries would silently fail. Mitigation candidates: `LIKE '%q%'` fallback for short queries, or a UI guard. **Needs a ruling.** Note the irony: trigram is simultaneously the _best_ tokenizer for CJK substring search and structurally blind below three characters.

**JSON1 is not compiled in** — irrelevant to F15, noted so nobody is surprised.

### 3.6 Spike artifacts (all in repo root, untracked)

* `spike-node.mjs` — Node-only engine test. **Recommend keeping permanently** as a one-command engine regression test (`node spike-node.mjs`) requiring no Obsidian. Currently clean-output.
* `spike-plugin.js` — Obsidian spike source
* `esbuild-spike.mjs` — throwaway build config; `outfile` writes directly into the spike plugin folder
* `~/Documents/Test Vault/.obsidian/plugins/spike-sqlite-wasm/` — `manifest.json` + `main.js` (1.6 MB). Its `node_modules/` was deleted; the bundle makes it unnecessary.

***

## 4. The Architecture Interrogation — Unresolved

Dan spent the session dismantling the spine's justification. The findings are receipts, not opinions.

### 4.1 The merge-scan is real but its ordering is a landmine

`reader.ts:mergeScan()` reads **all** shards and sorts by **`(origin alphabetical, seq)`** — never by `ts` (the header is explicit: clock skew is real). Consequence: the merged stream is **grouped by origin, not chronological**. All of Desktop's events precede all of Laptop's.

`projection.ts:projectPaths()` performs an **ordered fold** over that stream and its header insists the caller supplies "spine order." Within one origin, resurrection is honored. **Across origins, concurrent edits to the same path fold in alphabetical order** — which is not causal order. This is a design-level defect in the exact mechanism that is the spine's only production utility. **Unfixed.**

### 4.2 Consumption status — corrected twice

* `startupChecks()` — **production-wired** (`main.ts:1309`), but reads only the **local** shard. Boot health: torn-tail, foreign-origin guard, seq priming.
* `mergeScan()` — imported at `main.ts:444` but **never called there**. Its only production consumer is `rebuild.ts:136`.
* `rebuild.ts` header, line 6: _"ADDRESSING comes from the spine: mergeScan → gap check → projectPaths()"_. **Content comes from disk** via `chunkNote()`. So: spine addresses, disk supplies bytes.
* `probe.ts` / `rebuild.ts:221-229` — per-origin shard byte-length accounting.

**Cross-machine effects that are provably costs, not benefits:**

* Foreign shard growth → local rebuild triggered (Laptop's edits tax Desktop)
* Foreign shard gap → local rebuild **refused** (Laptop's corruption blinds Desktop's search)

### 4.3 Structural constraints

* **Contiguity starts at seq 1** (`reader.ts`, with comment "Compaction is future policy"). There is **no way to trim a shard** — not head, not middle. Only whole-file deletion works. This is why Dan deletes the shard every other day during testing.
* **Growth rate is unmeasured at steady state.** \~4,860 events ≈ 1.5 days of _testing_ traffic. Extrapolation is unreliable; the shard has never been allowed to accumulate.
* **Obsidian Sync structurally excludes** everything in a plugin folder except the canonical quartet (`manifest.json`, `main.js`, `styles.css`, `data.json`). Verified four ways in the autopsy §4.2. So: spine in vault = travels; spine in plugin folder = per-machine island.

### 4.4 The census verdict

A **Spine Consumer Census v0.1** was drafted and revised with corrected paths (see §7.3 for my path errors). Its findings:

* **Every currently-wired consumer works fine with a local-only spine.**
* **The only data that genuinely requires a synced spine is dwell/heat history** (`note.opened` + dwell crossings → tiering) — because human exposure leaves no disk trace. **Tiering has no code.** `grep "tier|heat|dwell" src/planner/planner.ts` returned nothing relevant.
* `src/skills/` — **does not exist.** `src/embeddings/` — **does not exist.**
* Other irreplaceable spine cargo: actor attribution (mtime cannot testify), checkpoint/audit chain.
* So: **the parts of the spine that earn their keep are unread; the parts that are read don't earn their keep.**

Dan's framing, which is the honest executive summary: _"It collates." "Collates what?" "Things." "Things I might be interested in?" "No."_

### 4.5 Doc/code drift found

`eventlog.ts` header says Tier 2 (buffered) = `note.opened, chunk.*, link.*, embed.batch`. The code says `TIER2_TYPES = {'note.opened', 'chunk.indexed', 'chunk.evicted'}`. `link.*` and `embed.batch` are documented as buffered but implemented write-through. **One of the two is wrong.** Matters because it changes shard growth characteristics.

***

## 5. Decisions Owed (Tomorrow)

**Architecture:**

1. Major rework — yes/no, and what shape? (Moderate: spine → plugin folder, unsynced, becomes local audit + dwell store; FTS addresses by disk walk. Radical: spine shrinks to a dwell/attribution journal only; projection, checkpoint chain, heal's re-derivation machinery deleted; much of the corpus retired.)
2. Spine location ruling.
3. Merge-order correction: order by `ts` (introduces clock skew) or harden projection against unordered streams?
4. Foreign-growth trigger: local-origin only, or any origin?
5. Foreign-gap refusal: propagate, or limit refusal to the offending origin?
6. Promissory features: dwell-tiering, embeddings lane, skills with actor gating — keep or cancel? (None have code.)

**Engine/implementation:** 7. CJK / sub-3-character query policy. 8. Production FTS integration: `store.ts` driver swap. **Blast radius is contained** — `lane.ts`, `probe.ts`, `rebuild.ts`, `search.ts` all import `store.ts` **type-only**, so only the driver layer changes. F15 is the acceptance test. 9. Production `esbuild.config.mjs` changes (base64 loader + the two init options). 10. F15 re-certification after the driver swap — treat as proper re-certification, not a rubber stamp. 11. `isDesktopOnly` flag: WASM removes the native-binary barrier, so mobile becomes conceivable. Held for mobile live receipts.

**Doc work:** 12. Paste the corrected Project Definition annotation (§7.1). 13. Architecture Map's "Naming (2026-10-29)" note still asserts `Desktop.jsonl` + `Latitude.jsonl` as current truth — needs annotation. 14. Finalize the Spine Consumer Census (drafted, not ruled).

***

## 6. Standing Doctrine (unchanged, load-bearing)

* **Receipts or nothing.** No guessing at facts, capabilities, or platform claims. Paste > guess.
* **Fixture-first.** Hostile fixtures prove ground truth; first-contact reds are expected.
* **Disk-as-truth.** Content derives from present-day bytes via `chunkNote()`, not spine streams.
* **Zone discipline.** Zone 1 = spine, synced. Zone 2 = caches, excluded. Zone 3 = quartet-only settings.
* **Declared limitations over hidden ones.** Loud over silent.
* **One pump, ever.** Serialized work lanes, single-flight `draining` flags.
* **Ask, don't guess.** Spiral-dither-talk-my-way-out is the named failure mode.
* **Chat for copy targets, canvas for display only.** Dan cannot copy text out of the creation sidebar. Anything he must paste goes in the chat as fenced code.
* **Search-first anchors.** When giving edit instructions, provide an exact copy-pasteable string to Ctrl+F. Abstract references ("after the `exists()` method") are unusable and were rejected twice this session.
* **Grep hygiene:** no output redirects, no escaped pipes inside double quotes (fish treats them literally).

***

## 7. My Own Errors This Session — Calibration Record

Four fabrications/errors, all caught by Dan. The pattern: **asserting from compressed context instead of demanding the artifact.**

**7.1 Ghost document.** I twice referenced "the database-tour notes" as an artifact to unbury — including inside the Project Definition annotation I drafted. **No such document exists.** The original engine decision was made in a chat session whose only surviving output is one row in a locked-decisions table. Corrected annotation text:

```markdown
**Archaeology note (corrected 2026-11-02):** the "database tour" the
row cites left no surviving artifact — it was a conversational survey
whose entire durable output is this row. There is nothing to unbury:
the reasoning, including whether deployment/packaging constraints were
ever examined, is unrecoverable. Given that the tour could not have
asked runtime questions (native-binary loading inside Obsidian's
Electron), treat the row's "satisfies full constraint set" as
desk-verified only. The 2026-11-02 ABI failure receipt is the first
runtime evidence the engine choice ever received.
```

**7.2 "Dead code" from a failed grep.** A grep exited `[✖ERROR]` with no output; I read a _failed command_ as _no matches_ and built an entire argument — including a relocation recommendation — on that non-receipt. Voided. The re-run proved `mergeScan` **is** production-consumed via `rebuild.ts`.

**7.3 Guessed paths.** Asserted `src/planner.ts`, `src/skills/*`, `src/embeddings/*`. Actual: `src/planner/planner.ts`; the latter two directories don't exist.

**7.4 Wrong predictions, cheaply corrected:** predicted \~5 MB bundle (actual 1.6 MB); predicted `sqlite-wasm/jswasm/` layout (actual `dist/`); predicted `wasmBinary` alone would suffice (needed `locateFile` too); omitted `const { Plugin } = require('obsidian')` from the spike's first draft; suggested `require()` of an `.mjs` file.

**Also:** first `main.ts` draft had `await` inside synchronous `onunload`, and called a nonexistent `adapter.stat()`. Both self-corrected before delivery.

**The lesson, stated once:** a compressed context — summary, handover note, or my own recollection — is a lossy copy that drifts unless something forces reconciliation against ground truth. Dan's "paste the source or don't speak" regime caught all four of these. **Keep forcing it.**

***

## 8. Feasibility: Qwen3.5:9b-32k as Implementer

Dan is considering a major architecture rework, designed by me, possibly implemented by a local 9B model. Honest assessment — labeled as hypothesis, since I hold no receipts for that model's actual capabilities.

### 8.1 The structural mismatch

This project's defining failure mode **is** confident fabrication. That is a 9B model's native dialect. It will invent plausible API methods, plausible file paths, plausible function signatures — fluently, and without signalling uncertainty. Every safeguard in the doc family exists because a _much_ larger model (me) fabricates under compression pressure. Scale that risk up sharply.

### 8.2 What saves it

**The project already has a mechanical arbiter: the fixture fleet.** A wrong implementation fails F15 (or whichever suite governs), loudly, with a line number. That converts "trust the model" into "run the referee." This is the single strongest argument for the experiment.

Secondary: the **type-only import seam** means the blast radius of a bad file is contained by design. `store.ts` is the only driver-layer file; the rest import it as types and are erased at compile. A bad `store.ts` cannot corrupt the spine.

### 8.3 Context budget reality

32k tokens ≈ **one file + one fixture + one spec**. Not the repo. Not the doc family. Therefore:

* **Works:** single-file rewrites with complete inputs supplied in-context.
* **Fails:** cross-file refactors, anything requiring a held invariant across modules, anything requiring "ask instead of guess."

### 8.4 The ideal task shape

Give it, every time:

1. The **complete** current file (not a diff, not a fragment)
2. The **API receipt** — for the driver swap, `spike-node.mjs` is the perfect in-context reference for `@sqlite.org/sqlite-wasm`'s actual API. Without it, the model will invent the API.
3. The **fixture** that must pass, as the acceptance criterion
4. Exact signatures, exact error strings, exact expected behaviours

Specs must be written **adversarially** — as if for a contractor who cannot ask questions and will silently resolve any ambiguity wrongly. Underspecified design documents are the primary hazard of the architect/mason split.

### 8.5 Recommended trial protocol

**Do not start with the rework.** Start with a **behaviour-preserving refactor of an already-green file** — the duplicate `asPrefix()` consolidation (`lane.ts` + `projection.ts`) is ideal: small, bounded, single-concern, and F15 proves fidelity. If the model can do that without breaking green, escalate to `store.ts`. If it can't, the experiment cost one afternoon and one fixture run.

**Escalation ladder:** refactor → single-file driver swap → small new module → (only if all green) participation in the rework.

### 8.6 Division of labour

**Architect vs. mason, not two architects.** Design authority stays with the high-capability model, which holds doctrine, cross-file invariants, and the receipts. Qwen executes bounded, fully-specified, mechanically-verifiable units. Any Qwen output is a **draft requiring fixture verification** — never a fact.

### 8.7 Practical advantages worth weighing

Privacy (no third-party API), no rate limits, no context-window anxiety on the human side, cheap iteration, offline capability. For a project this doctrine-heavy and this small, a disciplined local implementer with a fixture referee is genuinely plausible — _provided_ the spec discipline above is maintained. The failure mode is not "Qwen writes bad code"; it's "Qwen writes confident code and nobody runs the fixture."

***

## 9. Quick Reference

**Repo:** `/home/danf/Projects/vault-overseer/vault-overseer-index/` **Test vault:** `~/Documents/Test Vault/` **Production shard dir:** `_vault-index/events/` (vault-relative) **Zone 2 cache:** `<plugin folder>/cache/bm25/index.db` **Machines:** Desktop (DT43WC01, RTX 4070) and Laptop (Dell Latitude 5400) — both Garuda Mokka **Shell:** fish. Editor: micro.

**Commands:**

```fish
node --experimental-strip-types src/fixtures/f15.ts   # single suite
node spike-node.mjs                                    # engine regression, no Obsidian
node esbuild.config.mjs production                     # production build
node esbuild-spike.mjs                                 # rebuild the WASM spike
```

**Key source files read this session (all pasted, in evidence):** `src/eventlog/reader.ts`, `src/eventlog/eventlog.ts`, `src/eventlog/projection.ts`, `src/fts/rebuild.ts` (partial, via grep), `src/fts/lane.ts`, `src/main.ts` (large, via change set), `esbuild.config.mjs`, `@sqlite.org/sqlite-wasm` package internals (via grep/sed).

**Not yet read this session:** `src/fts/store.ts` (referenced heavily, never pasted), `src/fts/search.ts`, `src/fts/probe.ts`, `src/eventlog/types.ts`, `src/chunker/chunker.ts`, `src/heal.ts`, `src/planner/planner.ts`.

***

## 10. Closing Note for the Next Instance

The engine question is **answered** — WASM SQLite works, with receipts down the whole stack, and the native-binary bodge is dead.

The architecture question is **wide open and hostile**. Dan is considering a major rework. Do not defend the existing design out of momentum; the receipts in §4 are damning and were assembled by him, not by me arguing. Equally, do not rush to demolish it — the census is drafted but unruled, and the promissory features (dwell-tiering especially) are the only real argument for the synced spine, and they have no code.

**The honest state:** a beautifully engineered machine whose only product no consumer consumes, and whose consumed product is a redundant copy of the filesystem.

Bring receipts. Ask before asserting. Run the fixture.

***

_End of handover. Session left open for tomorrow's discussion._
