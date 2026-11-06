Vault Overseer — Unified Project Definition v0.2 (Lean)

Status: draft for ruling — Plugin 2 harness skeleton implemented 2026-11-06 Date: 2026-11-03 Supersedes: the spine-centric architecture of the Project Definition (annotated, not deleted, once ruled) Companion: [[Tool & Skill Strategy]], [[Session Handover — 2026-11-02]], [[Lessons from the Incumbents — Comparison Doc v2]] Read this before: touching any component, recipe, fixture, or prompt — any model, any instance.

SUPERSESSION NOTE (added 2026-11-04, per Dan's ruling): The index store
layer (schema §table definitions, FTS row addressing, store API) is
SUPERSEDED by docs/Muninn Store Rewrite Specification.md (v3, 2026-11-03,
authored later the same session, written against real chunker receipts).
Where the two documents conflict on the store, v3 wins. v0.2 remains
operative for everything else: Plugin 2 architecture, skill doctrine,
diff gate, joint build order. Specifically deferred to v3: table set
(no tag_vocab/notices tables — to be derived or added when Plugin 2
demands them), FTS path-keyed addressing, forceReindex as a store API
door, WAL pragmas.

Origin and correction

The original goal, stated plainly: semantic search over the vault, with a nice-to-have mobile-readable mode, the search available to the next plugin (the assistant), which uses skill-based tool use to prevent models flailing at tool surfaces.

That was all. The event-log spine — shards, origin ladder, merge-scan, checkpoint chain, sync-exposure — was architected in and then consumed 0.1.x's development arc, before interrogation proved (2026-11-02–03, receipts in the handover): its only production consumer read data re-derivable from disk; its genuinely irreplaceable data (dwell, actor attribution) had no consumer; and its sync-exposure was a constraint Dan never asked for. One archived, irrecoverable "database tour" justified an engine choice that failed its first runtime test. This document is the reset: architecture now derives from stated requirements, not from inherited machinery.
Shared principles (govern everything below)

    The model judges; the harness acts. No LLM ever receives a tool menu or executes anything. Recipes are forms; the model fills blanks; the harness owns every side effect. Wide tool surfaces invite exactly the confusion this project exists to eliminate.
    The plugin owns one durable artifact — the index — and rents everything else. Obsidian owns history, trash, sync, events. Disk owns content truth. Everything the plugin writes is rebuildable by one full walk.
    Receipts or nothing. Paste > guess. Platform claims, APIs, and version facts require evidence. Compressed context drifts; reconcile against ground truth.
    Fixture-first, declared limitations, one pump ever. The failing scenario precedes the implementation; first-contact reds are expected; loud over silent; serialized single-flight lanes.
    Disk-as-truth. Watermarks remember, disk decides. Triggers are hints, not data.

PART 1 — Index Plugin (Plugin 1)
Mission

Maintain a semantic + text search index of the vault; expose it to Plugin 2 and to a sidebar UI; rebuild on demand.
Engine (receipted)

@sqlite.org/sqlite-wasm 3.54.1, embedded base64, one 1.6 MB main.js. Spike-green inside Obsidian (2026-11-02): FTS5 in, trigram working, BM25 live, export 49,152 bytes. Init requires both keys — wasmBinary and locateFile: () => 'sqlite3.wasm' (the second short-circuits a new URL(import.meta.url) crash under CJS). DB flags 'c', never 'ct'. Quartet-shipped, BRAT-compatible, no native binaries, no per-device staging.
Index schema (Zone 2, cache/index.db)
Table	Keys	Role
meta	key	schema_version, chunker_epoch, embedder_model_tag, embedder_epoch, embedder_dim
files	path	watermarks: size, mtime, content hash — cheap change gate
chunks	(path, ord)	occurrence rows keyed by vh for dedupe
embeddings	vh (PK)	vector BLOB, dim, model_tag, epoch
tags	vh (PK)	JSON array of canonical tags derived from fm_context
fts	rowid	FTS5 virtual, trigram, self-contained (F15 ruling stands)
notices	id	capped ring-buffer: dark conditions, stale-skip tallies (deferred; not yet implemented)

Keying embeddings and tags by vh, not path: they survive renames and partial edits. Epoch bumps (chunker or embedder change) cause clean full re-embeds, never mysteries.
Boot and runtime

    Init engine → open DB (import-from-bytes; export-to-bytes on debounced flush and unload).
    Full walk: every file vs files watermark. Unchanged → untouched. Changed/new → re-chunk → vh diff → embed deltas, evict vanishings.
    Epoch check → forced full pass if mismatched.
    Arm intake lane: Obsidian's own vault events, debounced, single-flight, one pump ever. An event is a trigger — "recheck that file's watermark" — never data. Anything missed offline is caught by the next walk; correctness never depended on the stream.
    Serve search.

Containment, disposal, darkness-warning, and stat() survive from the 2026-11-02 wiring; eventsDir inputs die.
Search modes

    Text: FTS5 trigram, BM25. For queries shorter than a full trigram, the API falls back to a substring scan for 2-char queries and returns `null` with reason for empty or 1-char queries (fixture F04).
    Semantic: query → Ollama embed (local, Dan's standing embedder; specifics = receipt owed) → cosine scan of embeddings. Brute force at vault scale; ANN later if receipts demand.
    Hybrid (text filter, vector rank): later, natural.

UI

Sidebar pane (query, mode toggle, debounced typing, scored results, click-to-open) — implemented 2026-11-05 as `MuninnSearchView` in `src/ui/search-view.ts`, registered in `src/main.ts` with ribbon icon and command. Settings tab implemented 2026-11-05 for Ollama base URL, embedding model, timeout, and dimension (`src/settings.ts`, wired in `src/main.ts`).
Public API (frozen 2026-11-06; the basis for Plugin 2)

Harness-facing, typed, dark-safe (null + reason, never throws):
searchText(query)             → { hits, mode: 'bm25' | 'scan' } | null
searchSemantic(text)           → { hits } | null
relatedChunks(path, k)         → { neighbors } | null   // skill #3's primitive
tagVocabulary()               → { tags: TagInfo[] } | null   // skill #1's validator

The `skipped` tally promised in earlier drafts is deferred; the `mode` field discloses which engine answered the query. Shapes frozen forever: a harness and recipes build against them; breaking one is a version event. Fixture F24 polices the surface.
Demolition list

src/eventlog/* entire; dwell gate's spine output; planner and watcher spine halves (subscription reborn as intake lane); _vault-index/events/, origin.txt; better-sqlite3 + its external entry. Fixture suites policing spine semantics retire with their subject (F01/F02/F03/F11 and friends — sweep owed); chunker and F15-derived scenarios migrate, re-pointed to the walk.
PART 2 — Assistant Plugin (Plugin 2)
Mission

An LLM-assisted curator of the vault that never lets the model act. Exists to kill the observed failure mode: models handed broad toolsets invent tools and spray calls, hoping something works. The remedy is not smarter models — it is removing the menu.
Mechanism

Skill recipes — declarative Markdown, one bounded task each: Metadata (name, version, model tier, risk class), Trigger, Inputs (harness-gathered before the model sees anything — searches, contents, vocabularies), Instructions (declarative, constraining), Output contract (strict JSON schema), Apply method (harness routine), Validation (ground-truth checks).

Flow: harness assembles context → renders the form with judgment targets blank → model returns schema-conforming output → harness validates against schema and vault truth → diff view → human approval → harness applies. A hallucinated call is a syntax error, not an incident.
The gate — v1 ruling (2026-11-03)

One gate, no exceptions. read-only and suggest ship; write (auto-apply) is deferred — its only candidate (frontmatter-fill for template-less new notes) is uncommon, so automation buys nothing. That candidate becomes a detection skill: harness detects missing fields (zero model involvement), model proposes, diff gate reviews. If write-class is ever admitted, revertibility is rented from Obsidian's version history and trash — no plugin-owned audit log. The diff gate is R10 and the differentiator: schema-valid ≠ correct; every LLM edit faces a human in native diff.
Candidate skills (validation order)

    Tag assignment (simple schema, grades easily)
    Frontmatter detection/repair (tests validation strictness)
    Related notes via relatedChunks (tests harness-assembled context)
    Summary digest (tests multi-input assembly)

Each ships only after failure modes are exercised on the pathological fixtures.
Corrections notebook

Model-side complement to the fixture corpus: record invalid outputs → track recurrence → promote repeating patterns (threshold ~4) into recipes with evidence trails → feed back into prompts. Fixtures police the harness; the notebook polices the model; recurring entries are free requirements discovery. Residency: pending ruling.
Scope guardrail

Curation and assistance only. One recipe, one output contract, or it isn't a v1 skill. No agentic wandering, no chaining, no autonomous browsing — out of scope.
Joint build order (the two plugins are one arc)

    ✅ Ollama embed spike — endpoint, batch shape, model tag convention; receipted by F06.
    ✅ WASM import-from-bytes receipt — round-trip proven by F12 and F15 (Obsidian `Vault.adapter` round-trip).
    ✅ Corpus sweep — fixture-by-fixture keep/retire/rewrite ruling list; F01–F25 retained, spine fixtures retired.
    ✅ Demolition + store rewrite — complete; the store layer, public API, intake lane, and Obsidian plugin entry point are implemented and fixture-green.
    ✅ Index green end-to-end on Desktop — sidebar search live receipt (Scenario L) and settings reindex live receipt (Scenario K) verified for 0.2.0-test.9.
    ✅ Freeze the Plugin 1 API — frozen 2026-11-06; policed by F24.
    ✅ Release for testing — 0.2.0-test.9 tag with `main.js` + `manifest.json` + `versions.json`.
    ✅ Plugin 2 harness skeleton — recipe loader, renderer, validator, diff gate, apply registry, LLM client abstraction, and harness orchestrator. See `docs/Plugin 2 Harness.md` and fixture F25.
    ⏳ Skill #1 (tags) — first end-to-end proof of the model-judges doctrine.
    ⏳ Remaining skills, corrections loop, then the deferred rulings revisit (write-class, notebook residency, mobile).

Rulings owed to close this draft: chunker determinism statement · corrections-notebook residency · manual reindex semantics · any veto on the demolition list. The Plugin 1 public API is now frozen (2026-11-06); Plugin 2 may build against it.

That's the unified draft — two parts, one spine-less whole, the coupling explicit at the API boundary and the build order. Per the Qwen feasibility question parked in the handover: note that steps 4–5 are exactly the escalation-ladder-shaped work a bounded local implementer could take on — single files, type-only seams, fixture referees — once you've ruled on the demolition list and the specs are frozen. Say the word on the remaining rulings or send corrections, and v0.2 graduates from draft to definition.
