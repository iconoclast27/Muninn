# Handover — Muninn v0.2.0-test.5

**Date:** 2026-11-04 (evening)
**Repo:** `/home/danf/Projects/Muninn`
**Head:** `64acd7d` on `main`
**Test tag:** `0.2.0-test.5` (pushed to origin, GitHub prerelease created)

---

## What happened this session (continuation of 2026-11-04 handover)

1. **Proved persistence round-trip in live Obsidian (`0.2.0-test.4`).**
   - Restart loaded cache: `[Muninn] loaded cache: 510 files, 3779 chunks`.
   - Post-reload walk was a no-op: only 9 embeddings refreshed, not a full re-embed.
   - Cache file present at `.obsidian/plugins/muninn/cache/index.db` (~38 MB).

2. **Diagnosed and fixed silent / incorrect cache writes (`0.2.0-test.4`).**
   - `flushCache()` was passing the entire WASM heap buffer to `Vault.adapter.writeBinary` because `store.serialize()` returns a `Uint8Array` view.
   - Fix: copy serialized bytes into a right-sized `ArrayBuffer` before writing.
   - Added success logs for cache load, initial walk, and force-reindex command.
   - Added `Store.countFiles()` API door for load diagnostics.

3. **Diagnosed Scenario B (silent command).**
   - Force reindex command was working; it simply logged no success path.
   - Added `[Muninn] force reindex complete:` log so the command-palette action is visible.

4. **Started diagnosing Scenario H (rename) / newly-created notes not searchable.**
   - User added a distinctive word to a new note, renamed it, and searched via `app.plugins.plugins.muninn.api.searchText('...')` — result was `{hits: Array(0)}`.
   - Persistence is working, so the issue is isolated to the vault event → lane → store path for new files.
   - Released `0.2.0-test.5` with verbose diagnostic logging around vault events (`create`, `modify`, `delete`, `rename`) and intake lane (`onCreate`, `onModify`, `schedule`, `drain`, `ingestTouch`, `ingest`) so the next session can pinpoint where the create pipeline drops the note.

5. **Updated `TESTING1.md`** to reference `0.2.0-test.5` and document the new expected log lines.

---

## Current state

- `npm run typecheck` ✅
- `npm run build` ✅
- Fixtures F12–F15 (persistence, lane crash/resurrection, folder rename, adapter round-trip) all `VERDICT: GREEN` ✅
- Live Obsidian smoke-test results as of `0.2.0-test.4`:
  - **Scenario A** (initial load + cache creation): PASS
  - **Scenario B** (force reindex): PASS (now visible via logging)
  - **Scenario C** (text search): PASS
  - **Scenario D** (semantic search): PASS
  - **Scenario E** (relatedChunks): PASS (paths are case-sensitive)
  - **Scenario F** (tagVocabulary): PASS
  - **Scenario G** (vault event handling): partial — events fire and produce POSTs, but detailed behavior not fully verified
  - **Scenario H** (rename): **FAIL / under investigation** — new note with distinctive word not searchable after creation and rename
  - **Scenario I** (persistence round-trip): PASS
  - **Scenario J** (Ollama dark-safe): not yet run
- `main.js` rebuilt and committed with each source change.
- `main` is at `64acd7d`.

---

## What the next instance must read first

1. **`TESTING1.md`** — current smoke-test script referencing `0.2.0-test.5`.
2. **`HANDOVER - 2026-11-04.md`** — earlier in the day; covers the rebuild, fixtures F01–F11, and base architecture.
3. **`src/main.ts`** — especially `registerVaultHandlers` and the new diagnostic logging.
4. **`src/intake/lane.ts`** — especially `onCreate`, `schedule`, `drainLoop`, `applyOp`, `ingestTouch`, and `ingest` logging.
5. **`src/store/store.ts`** — persistence seam, `serialize()`, `countFiles()`, `countChunks()`.
6. **`src/api.ts`** — public API methods (`searchText`, `searchSemantic`, `relatedChunks`, `tagVocabulary`).
7. **Live smoke-test logs from `0.2.0-test.5`** — the user will run Scenario H again with the new logging and paste the output.

---

## Open items / next steps

- **Await `0.2.0-test.5` Scenario H logs.** The new logging should reveal whether the failure is in:
  - Vault event firing (no `[Muninn] vault event: create` log),
  - Lane scheduling/draining (no `[Muninn] lane ...` logs),
  - File read (read returns `null` or wrong bytes),
  - Chunking (zero chunks produced),
  - Storage (chunk store/FTS insert failure), or
  - Search (FT5 query not matching the word).
- **Once H is fixed, re-run Scenario G end-to-end** (create → modify → delete) to confirm event handling is solid.
- **Run Scenario J** (Ollama dark-safe) when convenient.
- **Remaining deferred review items** from Lumo: M1 (query-vector leak into embeddings), M3–M5 (insertChunks FTS idempotency, replaceChunksForPath atomicity, FK/WAL pragmas), L1–L7 (cosineSimilarity dim assert, read-only semicolon comment, 1-char query reason channel, renamePrefix LIKE escaping, foldState dead branch, fail() comment, TFile import).
- **No settings UI** yet; Ollama endpoint and timeout remain hardcoded.
- **Sidebar UI** not built; all testing is console-API driven for now.

---

## Key conventions to preserve

- **Fixture-first:** new behavior needs a failing fixture first. F12–F15 cover the new persistence/event areas.
- **A release is not THE release:** intermediate tags like `0.2.0-test.5` are for testing; flag remaining owed items in tag messages.
- **API door terminology:** the store interface methods are "API doors" per spec v3.
- **Include doc changes in the same commit** when they contextualize code changes.
- **Dark-safe:** frozen API returns `null` + reason, never throws.
- **Wait for plugin readiness logs** before running console diagnostics in Obsidian (`[Muninn] loaded cache:` or `[Muninn] no existing cache to load:`).

---

## Useful commands

```bash
cd /home/danf/Projects/Muninn
npm run typecheck
npm run build
for n in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15; do npx tsx src/fixtures/f${n}.ts; done
git log --oneline -n 10
```
