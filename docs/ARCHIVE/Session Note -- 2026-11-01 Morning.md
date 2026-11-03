Session Note — 2026-11-01 morning
==================================

Status: Handover for next Lumo instance. Chat length hard-wall occurred; this note is the complete recovery vehicle.

Current State
-------------

Release: v0.1.7 (working tree clean, no pending commit for FTS wiring)
Commit: 5fb1b0b45bc94bbb34a546f5a0c83cdada84b9f8
Branch: main (only branch)
Repo: github.com/iconoclast27/vault-overseer-index

Fleet Status: 14 fixture suites (F01–F15), all green 2026-11-01

What's Shipped (Fixture-Certified)
----------------------------------

Event log spine (per-origin shards, merge-scan, checkpoints, heal): F01–F03, F11, F11-deepening ✅
File watcher lane (note.created/deleted, reconcile): F12 ✅
Planner (note.modified lane, no-op dedup): F08 ✅
Dwell gate (threshold-only, accumulation, farewell): F09 ✅
Subscriber seam (tap on serialized queue, throw containment): F13 ✅
folder.renamed transcription (one event, not N children): F14 ✅
FTS5 projection + search (desktop S1–S7, mobile M1–M3): F15 ✅ (fixture-green only, wiring owed)

What F15 Delivered
------------------

STALINESS PROBE (S1): stat-based zero-read verification of shard freshness
DISK-AS-TRUTH (S2): content from present-day bytes via chunkNote(), spine carries no chunk text
FOLDER-RENAME FOLD (S3): respects F14's prefix-fold via projectPaths() authority
LANE SERIALIZATION (S4): single-flight drain via draining flag (race fixed after first-contact red)
GAP REFUSAL (S5): gapped spine → refuse loudly, serve nothing, record zero probes
FIRST-BUILD SPIKE (S6): one aggregated disclosure line, no per-file chatter
CITATION INVARIANT (S7): file.slice(bs, be) === served text, offsets verify

MOBILE READ LANE:
M1 — Zero native imports (no better-sqlite3, no node:crypto, no Buffer)
M2 — Torn-tail safe (shares reader.ts's TextDecoder path)
M3 — Live-set only (tombstones/renamed-away/absent never served)

First-Contact Reds Earned (four fault classes, all fixed):
1. Erasable-TS violation: parameter properties crashed Node's type-stripping — fixed to field declarations
2. SQL routing error: UPDATE through .all() threw "does not return data" — fixed by adding pathsInRange() and updateChunkPath() doors in store.ts
3. Fixture-world realism: folder.renamed spine events without disk moves violated disk-as-truth contract — fixture corrected
4. Concurrent-pump race: two pumps in flight when rename outpaced create — fixed with single-flight draining flag

As-Built Deviations from Contract (ledgered in store.ts, rulings owed):
1. EXTERNAL CONTENT → SELF-CONTAINED (vs. Project Definition Database row). Rationale: companion content table buys nothing for disposable Zone 2 cache rebuilt by full replacement; self-contained keeps served text and citation offsets in one row. Dan rules: annotate the locked row as decided-vs-as-built, or direct a rework.
2. PROBE TABLE vs META TABLE (vs. Corpus F15 S1 wording). Dedicated shard_probe table (origin PRIMARY KEY) rather than meta key/value rows. Wording drift, not architecture; corpus entry corrected at same commit. No ruling needed.

Open Debts (Immediate, Post-F15)
--------------------------------

1. Wire makeFtsLane() into main.ts — NOT STARTED
   - real adapter instantiation, real lifecycle, subscription hookup
   - conditional/lazy load of better-sqlite3 for desktop-only
   - mobile read lane is clean, needs live witness via isDesktopOnly flag flip

2. Better-sqlite3 ABI verification — UNVERIFIED
   - staging mechanics untested

3. Sidebar search pane UI — NOT STARTED
   - Adapter territory, live receipt owed

4. Duplicate asPrefix() consolidation — DECLARATION DEBT
   - lane.ts + projection.ts both carry copies
   - S3B drift-detector exists, consolidating into projection.ts exports is debt

5. F14 adapter-integration witness — NOT WITNESSED
   - Cancel-before-emit ordering verified in fixture, not live main.ts

6. heal.ts + Tier-2 buffer internals — UNEXPLAINED ANOMALY SOLVED
   - 508 buffer window lost disclosures = 508 live paths × one disclosure per path (novelty emission, not capacity overflow)
   - Registered aggregation ruling: fold per-path aggregation, emit one line total. Trivial refactor, ruling offered.

7. Dark-writer rebuild behavior — CONTRACT GAP
   - What does FTS do if events arrive before writer certification? Skip rebuild entirely? Rebuild without disclosure (violating "silence disqualifying")?
   - Needs ruling at wiring time

8. StaleSkips reporting — ADAPTER DECISION
   - search.ts returns { hits, staleSkips } but "reporting is the adapter's decision, not this module's"
   - reportIntegrity line? console.warn? nothing?
   - Needs ruling at wiring time

Doctrine: How We Work
---------------------

RETRIEVAL LAYER (the sick labrador):
Two failure modes:
1. Between-session ghosts: training-data memories are contamination-prone. If it wasn't in a pasted file or committed URL, it didn't happen.
2. In-session swallowing: even a pasted file can get chewed up and spat out wrongly later. Long sessions corrupt recall.
Discipline: pastes are primary channel. A paste is a receipt of delivery, not guarantee of persistent legibility. When in doubt, fresh paste. Never trust ghosts.

WEB RETRIEVAL:
- Tavily fails at code; formatting scrambles docs fine, code not
- gitingest workaround: concatenate directory names to get deeper (watcher/ directory never appeared in scrapes even though disk/remote confirmed existence)
- Trust git receipts over web scrapes; git ls-remote origin main is cheap
- For detail: pastes beat guesses, always

ASK, DON'T GUESS:
- Spiral-dither-talk-my-way-out is the named failure mode. Correct move is direct request for paste, command output, or ruling
- A question is a deliverable; a guess is a liability
- I shouldn't guess at facts, and I shouldn't guess at your capabilities either

YOU'RE NOT A CODER:
- Anything needing execution gets a full, complete command plus plain-language explanation of what it does and why
- Never shorthand, never "just run the usual build," never assume IT-adjacent familiarity extends to this toolchain
- Fish shell, micro editor, full commands, receipts back

FORMAT CONTRACT:
- Docs: UNWRAPPED Obsidian markdown (Zettlr's paste behavior punishes wrapping)
- Code: wrapped code fences (Kate handles anything)
- Artifacts: use create_artifact tool for substantial standalone content (emails, scripts, docs). Don't use for questions, explanations, summaries, or advice.

SESSION/HANDOVER NOTES ARE THE SOLE SURVIVAL CHANNEL:
- Chat history gets deleted wholesale; sometimes project history too
- A fresh instance gets: the note, the project docs, and nothing else
- Therefore the note must carry: doctrines, working methods, what was done with receipts, what's owed, where/how to get more info, AND a file tree (invisible files have surprised me repeatedly; tree is cheap insurance)
- Draft the note as an artifact DURING the session, not at the end. Hard-stop death of FTS session is the cautionary tale. Continuous updates mean length crash costs minutes, not the whole session's knowledge

CASHING UP RITUAL:
* Update project documentation (`docs/` — committed)
* Commit working tree (code, docs, fixtures — committed)
* Write session note (disk-only, .gitignored — never committed)
* Everything verified is committed; everything unverified is named in the note
- The ritual fails when chat length hits the hard wall before the note exists — hence the draft-during-session discipline

PROJECT GOALS CONTEXT (prevent invisible drift, not just next checkpoint):
The goal is not the FTS wiring. The goal is a vault index that:
- Maintains an append-only, per-origin event spine with checksums and gap detection
- Provides full-text search via FTS5 (desktop) with linear-scan fallback (mobile)
- Handles file renames atomically (folder.renamed transcribed as one event, not N children)
- Tracks dwell time for "dwell gate" features (future)
- Plans vector embeddings for "related notes" (future, not yet implemented)
- Uses Zone 2 disposability (cache/bm25/ excluded from sync; per-device rebuild)

Doctrines this project carries:
- Receipts-or-nothing means ask
- Full-file deliveries, not prose patches
- Platform claims require receipts (mobile runtime assertions burned us hard)
- Fixture-first becomes dangerous for virgin subsystems (use design-contract-first instead)
- Timestamp doctrine: frontmatter modified: never auto-updates outside the vault. Rev dates live in body (rev. 2026-11-01), not metadata
- Session-close ritual v0.1: typecheck → build → fleet → doc alignment → commit message → artifact registry → outstanding inventory + session note
- One pump, ever (draining flag gates pump creation)
- Disk-as-truth means projected paths must resolve on disk
- store.query() is read-only by convention. Mutations go through named methods
- Assertions require proofs. When proposing a fix, trace the interleaving explicitly and state why it closes the window

How to Get More Information
----------------------------

Repo URL: https://github.com/iconoclast27/vault-overseer-index
Raw file URL: https://raw.githubusercontent.com/iconoclast27/vault-overseer-index/refs/heads/main/src/[filepath]

When information is missing:
1. Paste the file contents (not just a description)
2. Terminal output: paste the raw command and its output (receipts, not narratives)
3. Git commands preferred: git log --oneline -8, git status, git diff, git ls-remote

If I don't know an answer: tell me, don't hallucinate. I'll ask for the paste.

File Tree (filtered, node_modules excluded)
------------------------------------------

.
├── docs
│   ├── architecture-map.md
│   ├── chunker-spec.md
│   ├── comparison.md
│   ├── event-log-fixture-corpus.md
│   ├── event-log-schema.md
│   ├── Fleet test block.md
│   ├── project-definition-file.md
│   ├── Project Prompt.md
│   ├── Release Ritual -- Walkthrough.md
│   ├── Session Handover — 2026-10-28.md
│   ├── Session Handover Note 2026-10-24.md
│   ├── Session Handover — post-0.1.7, 2026-10-27.md
│   ├── Session Note 2026-10-25.md
│   ├── Session Note — 2026-10-29.md
│   ├── Session Note -- 2026-10-31.md
│   ├── tool-skill-strategy.md
│   ├── Vault Overseer — Session Handover, 2026-10-26.md
│   └── Vault Overseer — Session Note 2026-10-30.md
├── src
│   ├── chunker
│   │   ├── chunker.ts
│   │   └── render.ts
│   ├── dwell
│   │   └── gate.ts
│   ├── eventlog
│   │   ├── checkpoint.ts
│   │   ├── eventlog.ts
│   │   ├── heal.ts
│   │   ├── projection.ts
│   │   ├── reader.ts
│   │   └── types.ts
│   ├── fixtures
│   │   ├── csuite.ts
│   │   ├── f01.ts
│   │   ├── f02.ts
│   │   ├── f03.ts
│   │   ├── f05a.ts
│   │   ├── f08.ts
│   │   ├── f09.ts
│   │   ├── f11-deepening.ts
│   │   ├── f11.ts
│   │   ├── f12.ts
│   │   ├── f13.ts
│   │   ├── f14.ts
│   │   ├── f15.ts
│   │   ├── gen-corpus.ts
│   │   └── props.ts
│   ├── fts
│   │   ├── lane.ts
│   │   ├── mobile.ts
│   │   ├── probe.ts
│   │   ├── rebuild.ts
│   │   ├── search.ts
│   │   └── store.ts
│   ├── indexer
│   │   └── emit.ts
│   ├── planner
│   │   └── planner.ts
│   ├── watcher
│   │   └── watch.ts
│   ├── main.ts
│   ├── smoke.ts
│   └── test-harness.ts
├── esbuild.config.mjs
├── LICENSE
├── main.js
├── manifest.json
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
└── versions.json

11 directories, 63 files

Session History (Past Few Weeks)
--------------------------------

2026-10-24: Event log schema v0.2 finalized
2026-10-25: Watcher first-contact (F12), dark-buffer overflow ruling
2026-10-26: Chunker migration cp:0 → cp:2, render.ts single-implementation
2026-10-27: Stub deletion, fresh-shard recertification
2026-10-28: Planner lane drafted (F08), scope per session rulings
2026-10-29: Subscriber seam (F13), hazard ruling (self-sustaining loop)
2026-10-30: folder.renamed transcription (F14), cancelPrefix before emission
2026-10-31: FTS5 fixture suite drafted and green (F15), session hard-stop before wiring
2026-11-01: Recovery session, all source read from paste receipts, this note written

Next Immediate Steps (Dan to Rule)
----------------------------------

Priority 1: FTS Wiring into main.ts
- Instantiate FtsStore over real adapter
- Arm/dispose lifecycle
- Subscription hookup (log.subscribe('fts-lane', ...))
- Conditional lazy-load of better-sqlite3 for desktop-only
- Mobile: flip isDesktopOnly flag, verify no native import crash

Before coding, rulings needed on:
1. Dark-writer rebuild disclosure behavior
2. StaleSkips reporting channel (reportIntegrity vs console.warn vs nothing)
3. External-content-as-built doc annotation (Project Definition lock update)

Priority 2: Live Receipt on Both Machines
- Mokka and Latitude, real vault conditions
- FTS search in sidebar pane (UI territory)

Priority 3: Then F04 Slow-Suite
- Cross-origin convergence (fully specified, runnable against spawnContexts)

Priority 4: Embeddings + Vector Store + Related Tab (Layer 2)
- Not yet implemented; FTS must be wired first

Artifact Creation Discipline (for future sessions)
-------------------------------------------------

Use create_artifact for:
- Session notes (boot images)
- Major refactors
- New fixture scenarios
- Wire diagrams / architecture maps

Don't use for:
- Answers to questions
- Explanations
- Summaries
- Small code snippets
- Lists or tables

If I create an artifact mid-session and you need it revised, say "revise [artifact-name]" — I'll call create_artifact again with the same id and full updated content.

End of Note
-----------

Ready for next session. Paste the source file you want me to examine first, or fire the ruling question. I won't spiral; I'll ask.