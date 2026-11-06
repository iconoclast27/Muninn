# Muninn — Manual Testing Scenario

Use this document to smoke-test the Plugin 1 build in Obsidian with the developer console open. For released builds, install the plugin via BRAT from the latest GitHub prerelease tag. For unreleased changes, build from source and copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/muninn`.

## Environment

- Obsidian Desktop (minAppVersion `0.15.0`).
- A test vault with at least a few markdown notes.
- Ollama running locally with `nomic-embed-text:v1.5` pulled (`ollama pull nomic-embed-text:v1.5`).
- Developer console open before enabling the plugin (`Ctrl+Shift+I` / `Cmd+Opt+I`).

## Install

1. Install and enable the BRAT plugin in the test vault if not already present.
2. In BRAT, choose **Add Beta Plugin** and enter: `iconoclast27/Muninn`.
3. BRAT should fetch the latest release. If it offers a version picker, select the latest test tag.
4. Enable **Muninn** in Community Plugins.
5. Keep the console open.
6. For unreleased builds, instead of BRAT copy the built `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/muninn/` and reload Obsidian.

## Scenario A — Plugin load and initial reindex

### Conditions
- The plugin is freshly enabled.
- The cache directory `.obsidian/plugins/muninn/cache/` does not exist yet.
- Ollama is reachable on `localhost:11434`.

### Steps
1. Enable Muninn.
2. Wait 5–10 seconds without touching files.

### Expected results
- No uncaught exception in the console on load.
- The SQLite store is now an in-memory database (`:memory:`) that is loaded from and flushed to `.obsidian/plugins/muninn/cache/index.db` bytes via `Vault.adapter.readBinary` / `writeBinary`.
- A log line may appear: `[Muninn] no existing cache to load:` — expected on the very first enable (no cache file yet), but not on subsequent loads.
- A log line may appear: `[Muninn] cache file found at ...:` with a byte count — expected on subsequent loads when the cache exists.
- A log line may appear: `[Muninn] loaded cache: N files, M chunks` — expected when a cache was successfully imported.
- A log line may appear: `[Muninn] initial walk complete:` with the walk result once the background reindex finishes.
- A log line may appear: `[Muninn] initial reindex failed:` **only if** Ollama is absent or the walk crashes; otherwise the initial background reindex should log success.
- The command palette shows **Muninn: Force reindex vault**.
- The file `.obsidian/plugins/muninn/cache/index.db` is created on disk after the first successful flush (within a few seconds of the initial reindex completing or after running **Force reindex vault**).

## Scenario B — Force reindex command

### Conditions
- Plugin is enabled.
- Several markdown notes exist; at least one has frontmatter containing `tags: [foo, bar]`.

### Steps
1. Open the command palette.
2. Run **Muninn: Force reindex vault**.
3. Watch the console for up to 30 seconds per batch.

### Expected results
- No exception in the console.
- A log line appears: `[Muninn] force reindex complete:` with the result object (`files`, `chunks`, `embedded`, `durationMs`).
- If Ollama is running: embedding requests are sent to `localhost:11434/api/embed` and a successful reindex completes.
- If Ollama is absent or returns an error: the console logs a warning (`[Muninn] Ollama embed timed out` or `[Muninn] Ollama embed failed:`) and the plugin remains enabled; no uncaught exception.
- The cache database file does not grow unboundedly; after reindex it should reflect the number of chunks in the vault.

## Scenario C — Text search via public API (console)

### Conditions
- Reindex has completed at least once with some markdown files indexed.

### Steps
1. Open the Obsidian developer console.
2. Run the following, replacing the plugin access if your setup differs:

```js
const app = window.app;
const plugin = app.plugins.plugins.muninn;
if (!plugin) { console.error('Muninn not loaded'); }
console.log('bm25:', plugin.api.searchText('machine'));
console.log('scan:', plugin.api.searchText('ab'));
console.log('one-char:', plugin.api.searchText('a'));
console.log('empty:', plugin.api.searchText(''));
```

### Expected results
- `bm25` returns an object `{ hits: [...], mode: 'bm25' }` with hits from indexed notes.
- `scan` returns `{ hits: [...], mode: 'scan' }`.
- `one-char` returns `{ hits: [], mode: 'scan' }`.
- `empty` returns `null` and a console warning `[Muninn API] dark-safe failure: empty query`.

## Scenario D — Semantic search via public API (console)

### Conditions
- Ollama is running and embeddings have been stored (reindex completed with Ollama available).

### Steps
1. In the console:

```js
const app = window.app;
const plugin = app.plugins.plugins.muninn;
console.log('semantic:', plugin.api.searchSemantic('introduction'));
console.log('empty semantic:', plugin.api.searchSemantic(''));
```

### Expected results
- With Ollama: `semantic` returns `{ hits: [...] }` ranked by cosine similarity.
- With Ollama unavailable: returns `null` with a `[Muninn API] dark-safe failure:` reason.
- `empty semantic` returns `null` with reason `empty semantic query`.

## Scenario E — relatedChunks via public API (console)

### Conditions
- A note path is known to be indexed, e.g. `notes/alpha.md`.

### Steps
1. In the console:

```js
const app = window.app;
const plugin = app.plugins.plugins.muninn;
console.log('related:', plugin.api.relatedChunks('notes/alpha.md', 3));
console.log('empty path:', plugin.api.relatedChunks('', 3));
```

### Expected results
- `related` returns `{ neighbors: [...] }` with up to 3 chunks that are semantically similar to the first chunk of `notes/alpha.md`, excluding the chunk itself.
- `empty path` returns `null` with reason `empty path`.

## Scenario F — tagVocabulary via public API (console)

### Conditions
- At least one indexed note has frontmatter with `tags: [ml, research]` or similar.

### Steps
1. In the console:

```js
const app = window.app;
const plugin = app.plugins.plugins.muninn;
console.log('tags:', plugin.api.tagVocabulary());
```

### Expected results
- Returns `{ tags: [ { tag: 'ml', files: n, chunks: m }, ... ] }`.
- `files` counts distinct note paths that contain the tag.
- `chunks` counts chunk occurrences.
- Tags from notes with no chunkable content should not appear (or appear with `chunks: 0` only if they somehow persisted; report if so).

## Scenario G — Vault event handling

### Conditions
- Plugin enabled and initial reindex complete.

### Steps
1. Create a new markdown note in the vault with content:

```markdown
---
tags: [event-test]
---

This is a new event-test note for Muninn.
```

2. Wait 5 seconds.
3. Modify the note (add a sentence).
4. Wait 5 seconds.
5. Delete the note.
6. Wait 5 seconds.

### Expected results
- On create: no exception; the note is eventually indexed (search for `event-test` returns a hit after a few seconds).
- On modify: no exception; search reflects the new sentence.
- On delete: no exception; search for `event-test` eventually returns no hits for that path.
- Console may show `[Muninn] intake error for ...` if something goes wrong, but no swallowed silent failures.

## Scenario H — Rename handling

### Conditions
- A note is indexed.

### Steps
1. Rename an indexed note from `old-name.md` to `new-name.md`.
2. Wait 5 seconds.
3. Via the **Muninn API console method**, search for a distinctive word that was inside the note:

```js
const app = window.app;
const plugin = app.plugins.plugins.muninn;
console.log('rename search:', plugin.api.searchText('your-word'));
```

### Expected results
- `plugin.api.searchText` returns `{ hits: [...], mode: 'bm25' }` where the hit path is `new-name.md`.
- The old path does not return hits.
- No re-embed is triggered (no new Ollama request for that content).
- The console does **not** show `[Muninn] initial reindex failed: SQLite3Error: DB has been closed.` when BRAT reloads the plugin during install.

## Scenario I — Persistence round-trip

### Conditions
- Plugin has indexed the vault.

### Steps
1. Note the current search result count for a query.
2. Close Obsidian completely.
3. Reopen Obsidian and the same vault.
4. Run the same search before any reindex.

### Expected results
- A log line appears on load: `[Muninn] cache file found at ...:` followed by `[Muninn] loaded cache: N files, M chunks`.
- The same search returns the same results without requiring a reindex.
- The cache file `.obsidian/plugins/muninn/cache/index.db` is present on disk and was imported on load via `Vault.adapter.readBinary`.
- A few `POST /api/embed` requests may still appear (e.g., from a homepage note that Obsidian re-opens and modifies on startup); these should not be hundreds of requests.

## Scenario J — Ollama dark-safe behavior

### Conditions
- Plugin is enabled.
- Ollama is **not** running, or a non-existent model is requested.

### Steps
1. Disable Ollama or stop the ollama server.
2. Run **Muninn: Force reindex vault**.
3. Run `plugin.api.searchSemantic('anything')`.

### Expected results
- Console shows `[Muninn] Ollama embed timed out` or `[Muninn] Ollama embed failed:`.
- Plugin remains enabled.
- `searchSemantic` returns `null` with a reason, not an exception.

## Scenario K — Settings UI

### Conditions
- Plugin is enabled.
- A build that includes the Muninn settings tab (post-`0.2.0-test.7`).

### Steps
1. Open **Settings** → **Community plugins** → **Muninn**.
2. Change the **Ollama base URL** to a different host or port (e.g., `http://192.168.1.10:11434`).
3. Change the **Embedding model** to another valid model name (e.g., `mxbai-embed-large`).
4. Change the **Embedding timeout (ms)** to `60000`.
5. Close settings, then reopen the Muninn settings tab.
6. Click **Force reindex** in the Muninn settings tab.

### Expected results
- The settings tab is listed under **Community plugins** as **Muninn**.
- Reopening the tab shows the values you entered (settings are persisted via `Plugin.saveData`).
- A trailing slash on the Ollama URL is stripped automatically.
- Clicking **Force reindex** disables the button, shows a `Reindexing...` status with progress (`walk N/N`), and completes without an exception.
- `forceReindex` sends embedding requests to the configured URL and model.
- Console shows `[Muninn] force reindex complete:` with the result.
- **Muninn: Force reindex vault** remains available in the command palette as an alternative.

## Scenario L — Sidebar search view

### Conditions
- Plugin is enabled and the build includes the sidebar search view.
- The vault has at least a few indexed markdown notes.
- Ollama is running if testing semantic search.

### Steps
1. Click the **Muninn search** ribbon icon (magnifying glass) or run **Muninn: Open search view** from the command palette.
2. Type a distinctive word that appears in your notes and press Enter while **Text** mode is selected.
3. Click the **Semantic** button and type a related concept, then press Enter.
4. Click a result title to open the note.
5. Close the right sidebar, then reopen the search view via the ribbon icon.

### Expected results
- A **Muninn Search** leaf opens in the right sidebar and shows a magnifying-glass tab icon.
- The view shows mode buttons (**Text** / **Semantic**), a search input, a status line, and result cards. (The **Reindex** button is no longer in the sidebar — it lives in Settings.)
- Text search returns result cards with the matching note title, path, chunk number, and a text snippet.
- Semantic search returns ranked result cards when Ollama is available; returns a status error if Ollama is unavailable.
- Clicking a result title opens the corresponding note in a new leaf.
- Reopening the view from the ribbon icon restores the previous query, selected mode, and results (or the empty state if nothing was searched).

## What to capture

For each scenario, record:

- Pass / Fail.
- Any console errors or warnings (copy the stack if present).
- Whether the expected results matched.
- Obsidian version and Ollama version/model if relevant.

## Known limitations of this test build

- Persistence is **debounced**: changes are flushed to disk 2 seconds after the last store mutation. A crash or forced Obsidian quit within that window may lose recent changes.
- The `onunload` flush is best-effort and asynchronous; Obsidian does not wait for it. Run **Force reindex vault** or wait a few seconds after your last edit before quitting to maximize durability.
- Semantic search is brute-force over all embeddings in JavaScript, capped at 10k chunks. Large vaults may freeze briefly.

## Fixed in this build

- **0.2.0-test.6** resolves the `SQLite3Error: DB has been closed.` crash that could occur when BRAT reloaded the plugin while the initial reindex was still embedding chunks. The lane now interrupts `forceReindex` on `stop()`, and `onunload()` awaits the in-flight reindex/flush before closing the store.
- **0.2.0-test.7** closes the remaining high/medium holes from Lumo's review:
  - **H3:** Intake lane operations are now serialized per-path, so a `delete` that arrives while a `modify` is still in flight cannot resurrect deleted rows.
  - **M1:** Semantic search no longer persists transient query embeddings in the store; query vectors stay in local scope only.
  - **M3/M4:** `insertChunks` deletes existing FTS rows for the affected paths before re-inserting, and `replaceChunksForPath` wraps its delete + insert + watermark + tags sequence in its own transaction.
  - **L1:** `cosineSimilarity` now rejects dimension-mismatched vectors instead of silently truncating.
  - **L6:** The `fail()` helper's comment no longer promises an accessor that does not exist.

## Reporting results

Open a new chat with the scenario results, the Obsidian version, and any console output. Flag failures with the scenario letter and the verbatim console message.
