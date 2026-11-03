---
source: Lumo-generated
status: pending
para:
context:
description:
Topics:
Concepts:
Meeting notes:
Permanent: false
type: note
word_count: 1
language: en
updated:
modified: 2026-10-18T15:52:28+01:00
aliases:
  - Project Vault Overseer
---
---

# Vault Overseer — Project Definition

**Status:** Active — v0.2.0-start. Planning phase closed. The spine (event log, writer, merge-scan, checkpoints, heal), the file watcher lane, the planner (`note.modified`), the dwell gate, the subscriber seam, and `folder.renamed` are shipped and live-witnessed on the test-vault spine. The FTS5 projection lane is fixture-certified (F15: 53 checks, S1–S7 + M1–M3) and awaiting `main.ts` wiring.
**Type:** Obsidian plugin project (two plugins)
**Working title:** Vault Overseer (FOVEYE, affectionately)

## Purpose

Build a local-first semantic index and LLM assistant for the vault, replacing the jobs currently done by Vector Search and Vault Curate — then growing into a full standalone vault assistant. Built as a longer-term project: **the goal is the tools and skills built along the way, not just the artifact.**

Core jobs:

- Fuzzy search across the vault
- Related notes, even if not linked
- LLM note maintenance: generate descriptions and frontmatter, tag per taxonomy, set parent relationships
- Background vault-health scan producing a problem report
- Later: knowledge capture and RAG

## Philosophy

- The build manufactures ground truth. Fixtures, event logs, property tests, and traces make LLM-assisted development verifiable instead of hopeful.
- Qwen is an apprentice supervised by instruments, not an oracle consulted with generic prompts.
- Conventional stack, chosen deliberately for maximum documentation and LLM familiarity.
- Infrastructure is seductive procrastination; every phase needs a blunt "done means this runs and I can see it."
- Step-by-step execution with verification; no running ahead of evidence. Platform and runtime claims — what a host, library, or runtime actually supports — are settled by receipts (a search, a doc, a paste), never by recollection.

## Constraints (locked)

1. **Obsidian Sync** is the transport. Settings configured: sync installed plugins + settings, **not** the enabled-plugins list — enablement is per-device and is the sanctioned mechanism for plugin topology.
2. **Durable state lives where Sync can carry it; rebuildable state lives where Sync cannot.** The spine (`_vault-index/events/`), recipes, and skill overrides sit in the visible vault and sync in full. Settings sit in the plugin folder's canonical quartet. Derived caches (vectors, BM25, kNN-graph) sit in the plugin folder's `cache/` subtree — structurally excluded from Sync by Obsidian's quartet-only rule, and rebuilt per device from the spine. Exceptions only for true host-level dependencies (Ollama, models, OS caches).
3. **Two plugins, desktop-write / mobile-read topology:**
    - **Plugin 1 (Vault Overseer Index)** — index, search, related notes. Active on both machines (Mokka desktop, Latitude 5400). **On Obsidian mobile, Plugin 1 is a read lane only (Option A, ruled 2026-10-31, fixture-proven F15 M1–M3):** desktops build and maintain the index; mobile reads and searches the same spine with zero native dependencies (no better-sqlite3, no node:crypto, no Buffer). Mobile feature parity is explicitly NOT promised in v1 — text search, not BM25; a future mobile BM25 is the WASM lane, a separate ruling. The plugin remains `isDesktopOnly` until mobile live receipts exist; until then the native import loads lazily on the desktop lane only.
    - **Plugin 2 (Vault Overseer Assistant)** — LLM jobs. Desktop only; simply never enabled elsewhere.
4. **Plugin 1 must remain useful with Ollama down** — lexical search survives, semantic features degrade gracefully. The FTS lane never touches the network, on any device.
5. Distribution: **private by default**, installed via BRAT on both machines. Community release is a non-goal for now — see Open Questions.

## Architecture

### Layered, event-sourced

* **Layer 0 — Event log (spine).** Append-only JSONL, the synced source of truth. **Per-origin shards** (`_vault-index/events/{origin}.jsonl`), one writer per shard, merge-scan ordered by `(origin, seq)`. Human-readable in micro, greppable, replayable. Records file and folder facts (`note.created`, `note.deleted`, `note.modified`, `note.opened`, `note.renamed`, `folder.renamed`), chunk/link derivatives, plus integrity, checkpoint, and settings lines. Chunk text is **not synced**; only metadata (offsets, hashes) rides the spine.
* **Layer 1 — Projection (per-device, derived).** `better-sqlite3` + FTS5. **Addressing comes from the spine's fold** — `projectPaths()` is the single re-addressing authority; **content comes from present-day disk bytes** via `chunkNote()`, never from the spine's chunk stream. Rebuildable at any time; disposable by design. Vectors, BM25, kNN-graph live in Zone 2 (plugin folder, structurally excluded from Sync). **Mobile does not run Layer 1** — the mobile read lane serves text search straight from spine addressing + adapter reads.
* **Layer 2 — Assistant (Plugin 2).** HTTP to local Ollama, consumes Plugin 1's Retriever API. Batch jobs: gather → propose → diff review → approve → write via `app.vault`.

### Storage contract

* **Synced (in visible vault, \_vault-index/):** event log (per-origin shards), recipes, skills (overrides).
* **Synced (in plugin folder, quartet only):** `manifest.json`, `main.js`, `styles.css`, `data.json`.
* **Structurally excluded (plugin folder, never transported):** `cache/` subtree (vectors, BM25 at `cache/bm25/index.db`, kNN-graph). Rebuildable caches never travel.
* **Local-only per device:** vector payloads (deterministically re-derivable — same text + same model = same vector); origin identity (`origin.txt` in plugin folder, non-canonical, BRAT-proof).

**Verification tooling:** hostile fixtures corpus (every vault bug becomes a fixture before it's fixed), property tests (chunk offsets must reproduce chunk text — the killer invariant, policed at the search boundary as well: served text must equal `file.slice(bs, be)`), two-level logging (terse info + reconstructive trace), test vault. The fixture fleet stands at 14 suites, all green. New subsystems run **contract text → rulings → implementation → fixture**, in that order — the fixture is authored against the contract, not against observed behavior.

**Chunking:** paragraph-level, nearest-heading chain and frontmatter context attached, byte offsets recorded for citation jumps. One derivation (`chunkNote()`) serves indexing, healing, and search — one implementation, no drifting copies.

## Locked decisions

|Decision|Choice|Rationale|
|---|---|---|
|Language|TypeScript, esbuild, standard Obsidian template|Max examples, max docs, max Qwen familiarity|
|Database|better-sqlite3 + FTS5 (external content, trigram tokenizer)|Satisfies full constraint set after database tour; JSONL log + atomic writes borrowed from the losers – **Annotation (2026-11-01, Dan's ruling):** the Database row's "external content" wording is hereby marked **decided-vs-as-built**. As-built (F15, certified 2026-11-01), the FTS5 table is **self-contained** — chunk text rides in the virtual table; there is no `content=` companion. Trigram matches the row as locked. The decision of record is the row; the description of the shipped code is the deviation ledger in `src/fts/store.ts`. **Rationale (for a future unburying, per Dan's request):** external content exists to avoid storing text twice when a canonical content table already exists in the DB. This vault has no such table — chunk text re-derives from present-day disk bytes via `chunkNote()` (disk-as- truth, S2), and the spine carries metadata only. So external content bought zero storage here, while costing `'delete'`-command mutations carrying original text, manual rowid coupling between two tables, and a new drift mode between them — against a full-replacement rebuild lifecycle in a disposable Zone 2 cache that never had a duplicate to eliminate. The row's original motivation is NOT verified from any receipt in evidence: two candidate hypotheses (database-tour best- practice adoption, or an earlier DB shape that planned a chunk-text table whose consumer never materialized) sit in the F15 record. **To unbury the corpse later: paste the database-tour notes** and reconcile. If a future phase ever persists chunk text in SQLite for a real consumer, external content earns a re-ruling with a fixture to prove it.|
|Vectors|Brute-force kNN in JS, no ANN/sqlite-vec|5,527 files — jet engine on a bicycle otherwise|
|Embedding model|`nomic-embed-text:v1.5`, both machines|Already proven in existing plugins; runs on Latitude CPU|
|Dimensions|768 native|Scale trivially permits it; MTEB 62.28|
|Prefixes|`search_document:` on index + related-notes (both sides); `search_query:` on RAG queries|Required by model card; Nomic's symmetric/asymmetric split; our responsibility since raw Ollama doesn't add prefixes|
|Sync profile|Obsidian Sync Plus: 10 GB / 200 MB per file|Text-only payload nowhere near limits|
|Vectors synced?|No — locally derived|Determinism makes them recomputable; zero sync traffic, zero corruption risk; model-mismatch → rebuild, loudly|

**Annotation owed (2026-11-01):** the Database row's wording ("external content, trigram tokenizer") has **not** been reconciled against the F15 as-built table shape. As-built: trigram matches the locked row exactly; the table is **self-contained**, not external-content. As-built deviations are ledgered in `src/fts/store.ts`; this row gets annotated once Dan rules. Until then, treat the row as the original decision of record, not as a description of the shipped code.

## Phases

1. Plugin 1 skeleton: scaffold, BRAT-installable, event log, file watcher, incremental pipeline — _plus the five-minute sync experiment: does an arbitrary file in the plugin folder propagate? If not, index relocates to a visible vault folder_ → **Done.** Experiment answered: plugin folders sync the canonical quartet only. The spine lives in the visible vault; the caches exploit the exclusion (Zone 2).
2. Chunker + FTS5 fuzzy search (with fixture corpus and property tests from day one) → **Chunker done** (P1–P6; consumed by heal and the FTS lane). **FTS5 done and fixture-certified** (F15: 53 checks, S1–S7 desktop, M1–M3 mobile) — **`main.ts` wiring owed.**
3. Search sidebar + embeddings, **resequenced (2026-11-01)**: the original wording bundled "embeddings + related notes sidebar (two-tab: Search / Related)" as one phase; as ruled, they split. **First: the Search pane** — sidebar over the FTS/BM25 lane (fixture-green, wiring owed), the first user-visible capability, Ollama-down-proof. **Then: embeddings + vector store + the Related tab** — Layer 2 lane, prerequisite for the strategy-doc skills. The two-tab vision stands; the delivery order now leads with what needs no network.
4. Plugin 2 scaffold + single-note jobs: description, frontmatter per template, tagging per Taxonomy note
5. Maintenance job runner: batch jobs with diff-review approval; catch-up behavior on desktop convergence ("ensure notes in {folder} have frontmatter like {template}", "tag per taxonomy", "set parent")
6. Background vault-health scan → report
7. RAG chat and knowledge capture

## Wishlist (unscheduled)

- Atomised note generation
- MCP server exposing the index to any local client
- Relationship map — **explicitly deprioritized** ("not so fussed")

## Hardware & environment

- **Mokka desktop:** Garuda Linux (Mokka) x86_64, RTX 4070 — all layers, heavy work, Ollama with full model set
- **Latitude 5400:** Garuda Linux (Mokka) — Ollama with limited models (nomic for indexing; qwen3.5:4b for interpretation)
- Shell: fish; editor: micro

## Working rhythm

- Weekly minimum session, evening sessions as available; small chunks suit the project
- Qwen as editor-integrated assistant with explicit capability expectations: tagging, frontmatter fixing, atomised note generation
- Session notes and decisions land in the project folder — and, since 2026-11-01, in the repo's `docs/` alongside the code; this chat is working memory until checkpoints

## Open questions

- **Final name** — "Vault Overseer" is a working joke title
- **Community release** — deferred. Known cost: users want updates and have expectations. Decided for now: BRAT-only, private repo
- ~~**Plugin-folder sync of arbitrary files**~~ — **resolved** by the phase 1 experiment: quartet-only, hence the zone model
- **Taxonomy note schema / template conventions** for maintenance jobs — phase 4 concern
- **FTS5 as-built vs. the Database row** — the row's "external content, trigram tokenizer" wording is unreconciled against the F15 implementation (trigram matches; table shape does not). Deviations ledgered in `src/fts/store.ts`. Annotation pending Dan's ruling.
- **Mobile read lane's live witness** — Option A is fixture-proven (M1–M3) but has no mobile live receipt yet; the `isDesktopOnly` flip waits on one. Which physical device exercises it is undecided.

---

**Revision 2026-11-01:** status advanced to v0.2.0-start (planning phase closed); **constraint 2 rewritten** to the zone model — the plugin-folder assumption it encoded was disproven by transport research (quartet-only sync), so the constraint as previously written described the architecture backwards; **constraint 3 gains the mobile-read ruling** (Option A, 2026-10-31): desktop-write/mobile-read topology, zero native deps on mobile, parity explicitly not promised, `isDesktopOnly` flip held for live receipts — a ruled doctrine the charter previously had no home for; Layer 1 gains the addressing/content split (spine supplies addresses via `projectPaths()`, disk supplies text via `chunkNote()`) and the mobile exemption from Layer 1; Layer 0's event vocabulary broadened (`folder.renamed` live); storage contract names `cache/bm25/index.db`; verification tooling updated (14 suites, fixture-authoring order, citation invariant at the search boundary); chunking notes the single `chunkNote()` derivation; **phase 3 resequenced** — Search pane first, embeddings + Related tab after (the bundling was no longer the plan); phases 1–2 annotated with outcomes; the "parent" splice artifact in phase 5 repaired; hardware notes both machines as Garuda Mokka; working rhythm notes the repo `docs/` move; open questions record the plugin-folder experiment as resolved, the Database row as pending ruling, and the mobile live-witness gap. Frontmatter `modified:` left untouched — per timestamp doctrine it is not evidence, and body rev dates are manual.