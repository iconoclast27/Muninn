# Muninn v0.2.0-test.2 — Manual Testing Scenario

Use this document to smoke-test the Plugin 1 build in Obsidian with the developer console open. Install the plugin via BRAT from the GitHub release tag `0.2.0-test.2`.

## Environment

- Obsidian Desktop (minAppVersion `0.15.0`).
- A test vault with at least a few markdown notes.
- Ollama running locally with `nomic-embed-text:v1.5` pulled (`ollama pull nomic-embed-text:v1.5`).
- Developer console open before enabling the plugin (`Ctrl+Shift+I` / `Cmd+Opt+I`).

## Install

1. Install and enable the BRAT plugin in the test vault if not already present.
2. In BRAT, choose **Add Beta Plugin** and enter: `iconoclast27/Muninn`.
3. BRAT should fetch the release for tag `0.2.0-test.2`. If it offers a version picker, select `0.2.0-test.2`.
4. Enable **Muninn** in Community Plugins.
5. Keep the console open.

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
- A log line appears: `[Muninn] failed to open store:` **only if** cache-dir creation failed; otherwise no error.
- A log line may appear: `[Muninn] initial reindex failed:` **only if** Ollama is absent; otherwise the initial background reindex should start silently.
- The command palette shows **Muninn: Force reindex vault**.
- The file `.obsidian/plugins/muninn/cache/index.db` is created on disk.

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
const app = app || window.app;
const plugin = app.plugins.plugins.muninn;
if (!plugin) { console.error('Muninn not loaded'); }
plugin.api.searchText('machine').then(r => console.log('bm25:', r));
plugin.api.searchText('ab').then(r => console.log('scan:', r));
plugin.api.searchText('a').then(r => console.log('one-char:', r));
plugin.api.searchText('').then(r => console.log('empty:', r));
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
const app = app || window.app;
const plugin = app.plugins.plugins.muninn;
plugin.api.searchSemantic('introduction').then(r => console.log('semantic:', r));
plugin.api.searchSemantic('').then(r => console.log('empty semantic:', r));
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
const app = app || window.app;
const plugin = app.plugins.plugins.muninn;
plugin.api.relatedChunks('notes/alpha.md', 3).then(r => console.log('related:', r));
plugin.api.relatedChunks('', 3).then(r => console.log('empty path:', r));
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
const app = app || window.app;
const plugin = app.plugins.plugins.muninn;
plugin.api.tagVocabulary().then(r => console.log('tags:', r));
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
3. Search for a word that was inside the note.

### Expected results
- Search returns the hit under the new path `new-name.md`.
- The old path does not return hits.
- No re-embed is triggered (no new Ollama request for that content).

## Scenario I — Persistence round-trip

### Conditions
- Plugin has indexed the vault.

### Steps
1. Note the current search result count for a query.
2. Close Obsidian completely.
3. Reopen Obsidian and the same vault.
4. Run the same search before any reindex.

### Expected results
- The same search returns the same results without requiring a reindex.
- The cache file `.obsidian/plugins/muninn/cache/index.db` persisted across the restart.
- No full reindex is triggered automatically on relaunch beyond the initial background walk (which should be a no-op for unchanged files).

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

## What to capture

For each scenario, record:

- Pass / Fail.
- Any console errors or warnings (copy the stack if present).
- Whether the expected results matched.
- Obsidian version and Ollama version/model if relevant.

## Known limitations of this test build

- Semantic search is brute-force over all embeddings in JavaScript, capped at 10k chunks. Large vaults may freeze briefly.
- The plugin has no settings UI; Ollama endpoint and timeout are hardcoded (`localhost:11434`, 30s).
- No sidebar UI yet; all search must go through the console API.
- Import-from-bytes / explicit DB export on unload is not implemented; persistence relies on SQLite WASM writing to disk normally.

## Reporting results

Open a new chat with the scenario results, the Obsidian version, and any console output. Flag failures with the scenario letter and the verbatim console message.
