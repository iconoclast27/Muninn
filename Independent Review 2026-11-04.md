# Muninn v0.2.0-test.2 — Independent Architect Review

**Reviewer:** Lumo (cloud, adversarial). **Subject:** `main.ts`, `api.ts`, `store.ts`, `lane.ts`, `TESTING1.md` at `118d58d`/`c22c040`. **Method:** read from pastes, not memory; findings ranked critical→low; every claim cites its file. No code changes proposed beyond named fixes — Dan rules, kimi executes.

***

## Verdict up front

The store layer is genuinely solid — the read-only guard is stricter than spec, the FTS5 delete-and-reinsert workaround for the UNINDEXED-update limitation is clever and honest, array-shaped mapping is explicit everywhere. The wounds are concentrated in **one architectural hole and its blast radius**: volatile persistence in the renderer, a test document asserting things the build provably cannot do, and an intake lane with two unguarded crash paths. Your buzzer on the `:memory:` redesign was the correct call; here is the receipt trail proving why, plus what nobody caught.

***

## CRITICAL — the economy-killer, now traced through actual code

**C1. Every plugin reload re-embeds the entire vault.** Chain: browser-entry WASM cannot open OS paths (receipted: `SQLITE_CANTOPEN`, your console paste) → `:memory:` fallback fires → on next `onload`, `onLayoutReady` runs `forceReindex()` → watermarks table is empty → `ingest` runs for _every_ file → `findMissingEmbeddings()` finds _every_ vh missing → `embedMissing()` calls Ollama for every chunk of the vault. Multiply by: every Obsidian restart, every plugin disable/enable toggle, **every BRAT reinstall** (your console paste shows BRAT reloading the plugin twice in one session — that's two full re-embeds in ninety seconds). The watermark economy — "embed once, rename for free, cache hits beat kilobytes" — is fully built and fully void at the only place it matters. The fix is the one you already ruled: **Phase A round-trip fixture (Node) → Phase B persistence seam (`load`/`save` injected into `openStore`, renderer lane backed by `Vault.adapter`) → Phase C renderer receipt.** Spec §4.1's `open()`/`close()` and its WAL pragma need amending in the same stroke — WAL on an in-memory DB is inert furniture, and the seam is where flush-on-`onunload` gets its hook (currently `close()` just destroys everything, silently).

***

## HIGH — crashes and holes in the intake lane

**H1. `drain()` has no per-op isolation.** `applyOp`'s delete and rename cases are _synchronous_ store calls with no try/catch. Any throw — see H2 for a live candidate — escapes `drain`, kills the microtask, and **drops every remaining buffered op unapplied**. One bad path poisons the whole queue. Violates never-crash doctrine at exactly the layer the doctrine was written for. Fix: wrap each op; log, continue, drain the rest.

**H2. `renamePath` onto an already-indexed path throws.** `UPDATE chunks SET path = ?` against PK `(path, ord)` → constraint violation if the destination has chunks. Obsidian prevents name collisions so it's mostly unreachable — but "mostly" plus H1 equals an uncaught exception in the event lane. Fix alongside H1: catch, log, fall through to delete+reinsert or refuse loudly.

**H3. Fire-and-forget ingest enables resurrection races.** `drain()` fires `ingestTouch(path)` async and moves on. A `delete` scheduled _after_ a `modify` can commit before the modify's async read-chunk-embed-write finishes → the deleted file's rows get re-inserted by the in-flight touch → the hole §5.4's pairing invariant exists to close, reopened from the side. Low probability, catastrophic shape. Fix: serialize — chain a per-path promise queue (the "one pump ever" doctrine, applied literally) or await ops inside an async drain.

***

## HIGH — the test document fails its own doctrine

**H4. `TESTING1.md` scenarios assert the impossible, and its console snippets don't run.**

* Scenario A expects "`index.db` is created on disk" — **provably unachievable** with the browser platform build; the renderer _will_ log `SQLITE_CANTOPEN` on every load, not "only if cache-dir creation failed." Scenario I (persistence round-trip) cannot pass until Phase B exists. The "Known limitations" footer even says persistence "relies on SQLite WASM writing to disk normally" — **receipted false by your own console paste** from before the doc's last update. The test doc and the code have diverged; the next smoke test would "fail" for reasons that aren't bugs, which is the soft form of passing-for-the-wrong-reason.
* Scenario C/E/F snippets call `plugin.api.searchText(...).then(...)` — but `searchText`, `relatedChunks`, and `tagVocabulary` are **synchronous** in the frozen interface (and in the code). `.then()` on their return values is a guaranteed `TypeError`. Dan, your report that "TESTING1.md barely applies" is confirmed twice over: conditions unmatched _and_ the probes themselves broken.
* Fix: amend TESTING1.md **in the same commit** as the persistence seam — Scenario A expects the disclosure status, Scenario I becomes the Phase C receipt. Sync-methods snippets drop the `.then()`s. A test procedure that can't run is worse than none: it manufactures noise that gets mistaken for signal.

***

## MEDIUM

**M1. Semantic search permanently leaks query vectors into the store.** `api.ts → searchSemantic` inserts the ephemeral query embedding via `store.insertEmbeddings(recs)` and _nothing ever evicts it_ — lazy retention only collects at epoch bump/full reindex, and `forceReindex` doesn't wipe embeddings. Every distinct query adds \~3KB forever. The `'search_query:'` prefix keeps them out of the chunk namespace (good design instinct), but a transient artifact living in a durable cache is a slow leak. Fix: keep the query vector in local scope for the scan only.

**M2. Folder renames are dropped, and `renamePrefix` is dead code.** `main.ts`'s rename handler filters via `isMarkdownFile` — a `TFolder` has no `extension`, so folder-rename events vanish. If Obsidian does _not_ emit per-child `rename` events for folder moves (I hold no receipt either way), a single folder rename stales every child path until the next walk. `renamePrefix` — boundary-discipline and all — is wired to nothing. **Receipt owed:** smoke-test a folder rename, watch child paths. If children don't fire, wire `renamePrefix` into the folder branch.

**M3. `insertChunks` standalone can duplicate FTS rows.** Chunks use `INSERT OR REPLACE`; `chunk_fts` inserts are plain — calling `insertChunks` on an already-indexed path duplicates FTS rows. Safe today (lane only reaches it through `replaceChunksForPath`, which deletes FTS first), but it's a landmine for the next caller. Fix: either document "delete-rows-first is the caller's contract" loudly, or make the FTS insert idempotent.

**M4. `replaceChunksForPath` isn't atomic on its own.** Spec §4.4 says "delete+insert, atomic." The method relies on callers wrapping it in `transaction()` (the lane does). Spec-conformance gap: either it opens its own transaction internally or the contract wording changes. Given the watermark delete-reinsert dance inside it, self-transaction is safer.

**M5. Declared-but-unenforced furniture:** the `tags` FK references `embeddings(vh)` but `PRAGMA foreign_keys` is never ON, so the FK is decorative. Harmless under lazy retention — but declared limitations over hidden ones means: drop the FK or enable the pragma. Similarly, the `PRAGMA journal_mode = WAL` block is inert on `:memory:` (falls under C1's amendment).

***

## LOW — noted, not chasing

* **L1.** `cosineSimilarity` silently uses `min(a.length, b.length)` — a dim-mismatched pair yields confident garbage instead of a rejection. Loud over silent: assert equal dims, discard with reason.
* **L2.** `ensureReadOnly`'s blanket semicolon ban also rejects legitimate string literals containing `;`. Safe-by-default; acceptable; worth one comment line so a future reader doesn't "fix" it into a hole.
* **L3.** 1-char query: spec §5.7 wanted a _disclosed reason_; the frozen shape has no reason channel, so it returns `{hits: [], mode: 'scan'}` with the reason buried. Ratify the deviation in the spec amendment — this is a ruling-sized change the implementation already made.
* **L4.** `renamePrefix`'s LIKE patterns: unescaped `%`/`_` in folder names mis-match, and SQLite LIKE is ASCII case-insensitive — `Notes/` vs `notes/` variance bites on case-sensitive filesystems. Rare; note and move on.
* **L5.** `foldState`'s rename branch is dead code — both arms return the same value.
* **L6.** `fail()`'s comment promises "diagnostic tools can read the last logged reason" — no such accessor exists. Aspirational comment; fix the comment or add the accessor (that one's arguably spec-relevant, since dark-safe disclosure was a doctrine).
* **L7.** `main.ts` claims `TFile` can't be imported directly (`isMarkdownFile` does the property sniff). `import { TFile } from 'obsidian'` and `instanceof` is the standard pattern; the sniff works, but the justification reads like a hallucinated constraint. Cosmetic, but of the exact genre this project hunts.

***

## Credit where receipts allow

The query guard (allowlist + comment-prefix rejection + semicolon ban) exceeds spec §4.8. The FTS5 UNINDEXED-update workaround in `renamePath` — move the real tables, rebuild FTS rows from source-of-truth — is the right shape: chunks table as canon, FTS as derived furniture, exactly doctrine. The `IntakeOp`/`PathState` fold and delete-dominates logic show real thought. And kimi's _disclosure_ of the `:memory:` workaround as a workaround (handover paste 2) was honest engineering. The sin was trajectory, not craft.

***

## Recommended next single action

Per protocol, one action, the rest queued behind it:

**Amend `TESTING1.md`** (drop the `.then()`s; rewrite Scenario A/I expectations around the current volatile reality and the coming persistence seam; delete the false "persists via normal disk writes" limitation note). It's the cheapest fix on the board, it makes the _next_ smoke test produce signal instead of noise, and it doesn't prejudge the persistence ruling — the ruling itself (Phase A/B/C, already endorsed in my prior message) is the packet after that.

Queued behind it, in order: Phase A round-trip fixture (Node lane, closes the build order's oldest owed receipt) → Phase B persistence seam + spec §4.1 amendment → H1/H2/H3 lane hardening (kimi-fixable, fixture-refereeable, perfect escalation-ladder rungs) → M2's folder-rename receipt during the Phase C smoke pass.

Everything above is from the four pastes plus the console receipt. If you want kimi to contest any finding — hostile review of the hostile review, which is exactly the adversarial shape this project likes — paste her rebuttals and I'll defend or concede on the merits. The architect has spoken; the engineer may open fire.
