---
source:
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
modified: 2026-10-30T19:09:56+00:00
---
---
# Vault Overseer — Session Note: 2026-10-30

**Read this first.** You are a fresh session with no memory of the day this describes. Everything you know about this project comes from the repo docs plus this note. This note therefore carries four things: what we did, how we work, what is still open, and what will bite you if nobody warns you. Dan is the authority on all rulings; where this note says "ruled," he said it out loud and it stands unless he re-opens it.

---

## 1. State at close

- **Repo:** `github.com/iconoclast27/vault-overseer-index`, branch `main`, version **0.1.7** (no bump this session — deliberate).  Concatenating directories on the URL will allow you to navigate the repo to see files.
- **HEAD:** `4ebbf53` — "F14: folder.renamed transcription + planner rev B cancelPrefix". Contains the six work files plus a stray scratch file (see §9).
- **Push status:** branch is **ahead of `origin/main` by 1 commit**. Not pushed at time of writing.
- **Verification:** typecheck clean, build clean, **FLEET GREEN — all 13 suites** (f14 registered in the fleet runner by Dan).
- **Docs:** live in the repo (the whole project is on GitHub), edited in **Zettlr**. The architecture map was updated this session (`docs/architecture-map.md`, ±45 lines).

**Files touched this session:** `src/eventlog/types.ts`, `src/eventlog/projection.ts`, `src/planner/planner.ts`, `src/main.ts`, `main.js` (build output), `docs/architecture-map.md`, `src/fixtures/f14.ts` (new).

---

## 2. What we did

### 2.1 Item 1 — planner live receipt (F08)

The planner was wired on 2026-10-29 but had never been observed firing in a live vault. Procedure: fresh install in the test vault (canonical quartet copied, `origin.txt` deleted, `data.json` present but empty brackets — a defaults-on-load shape, nothing to scrub).

Findings, in order:

- **The vault booted dark.** No origin → Rung 2 of the origin ladder → writer refuses to write until a human certifies an origin in the settings surface. A virgin install gets an empty candidate list, so Dan declared a new origin: **`Desktop`** (test-vault shard; does not collide with production).
- **Settings UI verified on cold install** — both the origin-certification flow and the reconcile button render and function. This was load-bearing: without that button the writer stays dark forever and no receipt is possible.
- **Reconcile backfilled 508 first-contact paths** at attach (spine seq 511, actor `plugin`).
- **Edits landed:** seq 512/513 `note.modified` on `BRAT-log.md` (distinct `content_sha`, ~60s apart), seq 514 `note.opened` dwell 10, seq 515/516 `note.modified` on `Notes/Extra testing note.md`.
- **Chain confirmed live:** planner → scheduler → writer → spine. Actors correctly attributed (`user` on note events, `plugin` on the backfill).

Prediction of mine that was **wrong**, on the record: I said the shard would be "born nearly empty." It was born at 511 lines. The receipt was the truth-holder.

### 2.2 The owed citation — closed

`obsidian.d.ts` **line 10439**:

```text
on(name: 'modify', callback: (file: TAbstractFile) => any, ctx?: any): EventRef;
```

Shape had been typecheck-verified on 2026-10-29 (the first draft wrongly assumed `TFile`; TS2739 caught it). The line number was owed and is now delivered. Note for future shell work: Dan's `grep` is aliased to **ugrep**, which treats patterns as regex — use `grep -nF` for literal patterns containing parentheses.

### 2.3 Doc alignment — map re-emitted

`docs/architecture-map.md` re-emitted in full as **v0.4 rev. 2026-10-30**, unwrapped markdown for Zettlr. Deltas applied:

1. Planner-wiring row: ⏳ → ✅ **Verified live 2026-10-30** (citation: spine seq 512–516).
2. Implementation-status callout: "awaiting live receipt" struck; `obsidian.d.ts:10439` named.
3. Frontier: F14 promoted to slot 1; live-receipt item removed.
4. New callouts: Rung 2 verified live (settings surface), dwell gate marked production-witnessed, "Production witnesses" line added to the verification posture so live receipts stay distinct from fixture certifications.

### 2.4 F14 — folder.renamed transcription

**The contract.** From Event Log Schema v0.2 (designed 2026-10-24): `folder.renamed` is a **Tier-1 write-through file fact** — a single mass-invalidation of every storage address beneath `from/`. Payload `{from, to}`, mirroring `note.renamed`. One event, not N children. Links are Obsidian's province; chunk identity is path-independent (`vh`), so nothing re-embeds.

**Ratified rulings (Dan, 2026-10-30):**

1. **`cancelPrefix` fires BEFORE the emission.** Pending state dies before the fact lands; no window where the spine holds a `folder.renamed` line while a stale-addressed observation still sits pending.
2. **The prefix-fold lives inside `projectPaths()`**, in the ordered fold — not in the subscriber callback. One implementation serving cold replay now and the future incremental subscriber path later. Splitting them would recreate the two-drifting-copies defect the `renderEmbedInput` precedent exists to prevent.
3. **Dead-path tombstones keep their death address.** A path that died before the folder rename is not re-addressed; history is not rewritten. The live set moves wholesale; the autopsy record stays where the deaths happened.
4. **`cancelPrefix(from)` returns the cancelled count.** Deliberately unconsumed in `main.ts` (quiet on the spine — the cancelling event *is* the record); the count serves fixtures and receipts.

**Implementation (four files):**

- **`types.ts`** — `'folder.renamed'` added to the `EventType` union; `FolderRenamedPayload {from, to}`; serializer case in `payloadInOrder()` (the exhaustiveness guard screams if this is missed).
- **`projection.ts`** — `folder.renamed` case in the ordered live-set fold. Boundary discipline mirrors `gate.renamePrefix` exactly: prefix + `/`, so `Area` never captures `Area 2/x`; destination normalized of trailing slashes. Snapshots the live set before mutating (cannot iterate a Set while adding to it).
- **`planner.ts` rev B** — `cancelPrefix(from)` deletes every pending key under `from/`, returns the count, stands the window down when the map empties. Observations die with the address; no migration (boot-heal covers the renamed subtree).
- **`main.ts`** — the `TFolder` branch of `onVaultRename` unmuted. Order: `plannerLane?.cancelPrefix(oldPath)` → `dwellGate.renamePrefix(oldPath, file.path)` → `void this.emitFolderRename(oldPath, file.path)`. New private `emitFolderRename` mirrors `emitRename` (Tier-1 direct typed append, drops silently while dark). Header blocks annotated: 0.1.8-bound block added, the 0.1.7 **stale-pending gap marked CLOSED**, the 0.1.5 "pending ruling" note marked SUPERSEDED, the `on('modify')` citation debt retired.

**Fixture `src/fixtures/f14.ts`** — 5 scenarios, 20 checks, **ALL GREEN** (Dan's receipt). R1 single event / no child explosion; R2 disk-at-callback (persistence-latency witness); R3 planner `cancelPrefix` incl. the `Projects/A` vs `Projects/A 2` boundary trap and the cancel-before-emit ordering witness; R4 projection fold incl. tombstone ruling; R5 chained renames compose.

**Live receipt (the independent witness):** spine seq **4820** `folder.renamed` `Notes/Untitled` → `Notes/New subfolder`, and seq **4822** `Notes/New subfolder` → `Notes/New subfolder name 2`. Chained folder renames, recorded live, one O(1) line each, no child-event explosion. Riding along: `note.renamed` chains (4814/4815/4817), `note.created` (4818), `note.opened` (4819).

### 2.5 The bloat episode (diagnosed, bounded)

Evening reload took the shard from **518 lines to ~4822**. Diagnosis, with receipts:

- **Cause: the two-boot visibility bill.** Heal runs *before* the reconcile gate in the boot order. Yesterday's fresh install therefore indexed nothing (spine knew no paths). This morning's boot backfilled the 508 first-contact paths but heal had already passed. Tonight's reload was the **first heal against a spine that knew the world** — hence ~500 files × ~8 chunks flooding in at one timestamp. One-time reconciliation of spine-truth to disk-truth, not a leak.
- **Decisive receipt: boot 3 was quiet.** 4823 → 4834 = **11 lines**. Coverage is read back and respected; the shard is not growing monotonically. The "subscription" theory is dead.
- **Still unexplained, demoted:** **508 per-file `buffer window lost` disclosures** — exactly matching the 508 backfilled paths. The killer counter-evidence to a capacity explanation: `Templates/wikilink.md` has **one** chunk indexed and still reports "buffer window lost, 1 events re-derived from sha." One event cannot overflow a buffer. So the declaration appears to fire per-file, unconditionally, during bulk heal. Mechanism unknown; `heal.ts` has never been seen by a session agent. See §5.2.

---

## 3. Lessons earned today (the curriculum)

These were paid for. Do not relearn them.

1. **Types-paste-first.** Payload shapes are never inferable from usage. Watching other files construct a payload tells you what worked in *their* context, not what the type requires. `content_sha` vs `last_content_sha` cost two typecheck rounds. **Any fixture session starts with `types.ts` on the desk before a line is authored.**
2. **Compiler errors are corrections, not discoveries.** The error tells you that you were wrong — not what is right. Extracting the minimum needed to clear *that* error is symptom-fixing. Ask why you are guessing at all.
3. **The thrash detector: two errors from the same root cause means stop.** Rounds 1 and 2 were both "I don't know the payload types." Recognize it at round 2, not round 3.
4. **Casts are confessions.** `payload as ModifiedPayload` says "trust me" with no grounds. Field-by-field reconstruction is longer but *checkable*. Bridges like `asModifiedPayload` earn their existence at production boundaries with receipts behind them; in a fixture, reconstruct.
5. **Benign-defect bias.** I produced two comfortable theories for the bloat ("one-time bill," then "capacity mismatch") that both filed unfamiliar-but-disclosed behavior as designed. Dan's count-match observation and the one-event receipt broke them. Disclosed ≠ benign.
6. **Frontier order is a ruled artifact, not a memory artifact.** I silently reordered the frontier list (put F04 ahead of FTS5) while restating it from memory. The map on my own desk had it right. **Any session stating the queue re-quotes the map's frontier section verbatim; deviations require an explicit ruling, offered aloud, never smuggled into a list.**
7. **Session amnesia is structural, not incidental.** Drift between docs and code is the standing risk. This note is the mitigation, and it is only as good as its honesty about what is *unverified*.
8. **Delivery format follows the paste route.** Different files travel by different routes; the format must match the route, not my preference.
9. **Git hygiene.** Never `git add -A` while scratch files are in the tree. Never prescribe "paste this into an editor" for a commit message when the clipboard route is the bottleneck.

---

## 4. Working method (codified doctrine)

**Core:** *Receipts or nothing.* Never assume, recall, or invent a file, API, or fact — **ask for the paste**. Stale files, retrieval remnants, and training-data memories of this project are ghosts.

**Sequence:** fixture-first — write the failing scenario before the implementation; **red must be earned**. Step-by-step, verified; never run ahead of evidence. When correcting a defective draft, **re-emit the full fixed file**, not a prose patch.

**Honesty:** declared limitations over hidden ones; loud over silent; never fabricate data from incomplete sources. Predictions are hypotheses, stated *before* evidence so they cannot be retrofitted. Wrong predictions go in the ledger, not under the rug.

**Discipline:** don't spiral — unreproduced anomalies get noted, not chased. Judgment calls get offered with a recommendation for Dan to rule on.

**Delivery formats (each learned by breaking it):**

| Deliverable | Route | Format |
|---|---|---|
| Markdown docs (maps, corpus entries, session notes) | Zettlr | **Raw, unwrapped.** No code fence around the document. |
| Code files | Kate | **Inside a fenced block.** Raw stream loses formatting. |
| Commit messages | Terminal | **Executable `printf` block** that writes the message file itself. Never "paste into micro." |

Large files may exceed what one delivery can carry — split into two parts with disposable splice-marker comment lines, and **deliver both halves before Dan mutates anything on disk**.

**Session close ritual:** typecheck → build → fleet → doc alignment → commit → artifact registry → session note. End with everything verified committed and everything unverified named.

---

## 5. Open items

### 5.1 Parked — timestamp anomaly

Evidence gathered, insufficient to conclude:

- Shard tail showed **22:59** while real time was **17:27Z**.
- But a note rename performed moments later logged **accurately at 1730**.
- Earlier timestamps varied; at 0623 the vault was not open.
- The morning's 06:23–06:28 receipts and the evening's 17:07–17:09 receipts both matched reality.

So: not system time, not obviously any local time, and **not consistently wrong**. Parked by Dan's ruling — not enough evidence.

**Investigation plan when resumed:** (1) baseline 3–4 boots logging `now()` at start, at append, at shutdown; (2) read `defaultLocalIso()` in `eventlog.ts` and where it is injected vs. used at append time; (3) check system UTC vs. local DST offsets vs. whatever the Electron renderer reports; (4) watch for monotonicity breaks — `ts` going backward between seq N and N+1 is a smoking gun. **Do not theorize without receipts.** Note also the doctrine: `ts` is diagnostic only, never trusted for ordering — so this is a correctness-of-record issue, not a spine-integrity issue.

### 5.2 Owed — the 508 `buffer window lost` disclosures

Mechanism unexplained (§2.5). One chunk + one window-lost line cannot be genuine overflow. Suspects: the heal↔buffer interaction declares the window lost unconditionally per file, or the Tier-2 buffer's sizing/flush discipline is wrong for bulk sweeps.

**Required before trusting bulk operations again:** a paste of **`heal.ts`** (never seen by a session agent) plus the Tier-2 buffer internals in `eventlog.ts`.

**Registered ruling for a future session:** bulk-heal disclosures could aggregate into one line per run ("buffer window lost, N events across M files re-derived from sha") — same information, ~1/400th the lines. Not chased.

**Second open question:** whether re-derivation produces *duplicate* `chunk.indexed` lines or *replacement* lines. A per-(path, ord, vh) duplicate count on the current shard settles it. Not yet run.

### 5.3 Watchlist

- **`dwell: 10` on every `note.opened`** — multiple sightings across the day, exactly 10 every time. Consistent with v1 threshold semantics (gate ≥ 10s before emission, rounded down), but the flatness is noted. Not chased.
- **Bridge-debt family** — `asModifiedPayload` and friends in `main.ts`; retirement owed at `watch.ts` source.
- **Two edits to `BRAT-log.md` exactly 60s apart** in the morning receipt. Plausibly deliberate save cadence. Noted, not chased.

### 5.4 Known coverage gaps (honest)

- **House-order inversion on F14.** Implementation preceded the fixture — the reverse of doctrine. Consequence: first contact tested contract-vs-implementation agreement, not earned red. Recorded in the fixture header ledger.
- **The fixture does not exercise `main.ts`'s real handler.** R3 drives `makePlanner` with fake deps (a proxy) and reproduces the ruled ordering by hand. The **cancel-before-emit ordering is verified in the fixture but has not been witnessed live.** Adapter-integration coverage is owed.
- **F14 corpus addendum placement unverified.** The entry was drafted and delivered as unwrapped markdown; whether it landed in the corpus doc in the repo is unknown to this note. **Check it.**
- **`f14.ts` was authored with `types.ts` read, but `reader.ts`'s exact `mergeScan` signature was inferred from usage.** It typechecked, so it is right — but it was inferred, not read.

---

## 6. Next session — FTS5

**Scope:** Layer 1 — FTS5 projection + search UI. The first user-visible capability. Consumes the F13 subscriber seam. Constraint 4 applies (Ollama-down survival — no external services).

### Ratified rulings (Dan, 2026-10-30) — final

1. **Seam-driven, not boot-rebuild-only.** Incremental updates arrive through the F13 subscriber seam (`EventLog.subscribe`). Reasoning: retrofitting the seam later costs more than building it in now. Boot still rebuilds when stale (ruling 2); the seam handles intra-session liveness.
2. **Staleness check before rebuild.** Probe cheaply, then serve or rebuild. Recommended probe: last-seq / checkpoint digest compared against what the projection recorded at last build. **The probe must not itself re-read the whole spine** — a self-defeating staleness check is a classic trap. Dirty → full rebuild, disclosed loudly via `log.integrity`, then serve.
3. **UI is a sidebar pane in v1.** "Start as we mean to finish" — like any other search index plugin. Not a modal, not command-palette-only.
4. **Searchable content: note text, chunked, re-read from disk.** The spine carries chunk metadata (offsets, hashes) only; **chunk text never syncs**. Rebuild re-reads note files and chunks per the recorded offsets. Per-device derived state.

### Scope fence (from Project Definition, Layer 1)

- **Engine: `better-sqlite3` + FTS5.** Ratified — not open for evaluation.
- **Storage: Zone 2** (plugin folder, structurally excluded from Sync). Disposable by design, rebuildable at any time.
- Vectors, BM25, and the kNN graph all live in Zone 2 — **but v1 is BM25/text-column search only.** Vectors and kNN are the later embeddings frontier. **Do not build them.**
- Layer 2 (Assistant, Plugin 2) is separate: HTTP to local Ollama, consumes Plugin 1's Retriever API, batch jobs gather → propose → diff review → approve → write.

### Open questions to rule before coding

1. Exact staleness probe mechanism (last-seq counter vs. checkpoint digest vs. both).
2. Database file location and naming inside Zone 2.
3. Whether the v1 index covers chunk text only, or also note titles/paths for title matching.
4. Rebuild disclosure format (single integrity line per rebuild, presumably).
5. Whether F14's prefix-fold is sufficient for the search index's path resolution, or the index needs its own addressing scheme.

### Expected shape

Bulk initial indexing will be the analog of the 508-path heal flood — **expect a large first-build spike, and do not panic when it appears.** Compare against §2.5 before diagnosing anything.

### Paste protocol for the FTS5 session

Obtain **before authoring code**: `types.ts` (this note's session has it; yours may not), `reader.ts`, the chunker source (offset/hash semantics), `main.ts`, `manifest.json`, the corpus doc, and any existing Plugin 2 / Retriever API surface. Then the FTS5 corpus entry — drafted from contract text, hostile scenarios around rebuild-after-rename-folds being the novel content.

---

## 7. Process proposals awaiting Dan's ruling

1. **Adversarial second-agent code review at phase boundaries.** A fresh agent, given the raw files (never my summaries), prompted hostilely: *"find where the fixture validates the implementation's behavior rather than the schema's contract, and find any payload constructed from inference rather than a type definition."* Pilot candidate: F14's artifacts, whose green is self-consistent rather than independently verified.
2. **Handover notes as debt trackers, not achievement logs.** Name what remains fragile and what is unverified, not just what shipped.
3. **Mandatory session-start paste protocol** — core schema files pasted before work begins, establishing ground truth for that session.

None of these are ratified. Raise them with Dan.

---

## 8. What to ask Dan for, first thing

Do not begin work from this note alone. Ask for the pastes you need, in priority order, and say why. Dan tracks the project's lineage across sessions better than any single agent can — when he raises an eyebrow, **he is usually right**, and the correct response is to check the receipt, not to defend the reasoning.

---

## 9. Housekeeping / outstanding at close

- **Unpushed:** `main` is ahead of `origin/main` by 1 commit.
- **Staged deletion pending:** `f14-commit.txt` (a scratch file accidentally committed inside `4ebbf53`) has been `git rm`'d but **not yet committed**. Either commit the deletion as trivial cleanup or amend it into `4ebbf53`.
- **Commit-message scratch files must never enter the tree again.** Use `/tmp`, or better, the `printf` block form that writes the file itself.
- **Verify** the F14 corpus addendum landed in the repo docs (§5.4).
- **Save this note** into the repo docs alongside the previous session notes.


Pushed clean — `7ac7326..386ed05`, both commits on the remote. The repo and the branch now agree with the ledger, and the day is officially interred with honors.

Final state, for the record:

- **F14:** implemented, fixture green (13-suite fleet), live spine witness (seq 4820/4822), committed and pushed
- **Item 1:** closed this morning — live receipt, `obsidian.d.ts:10439`, map aligned
- **Bloat episode:** diagnosed to root, bounded by the quiet-boot receipt, the 508-disclosure anomaly named for `heal.ts` inspection next time
- **Timestamp anomaly:** parked with an investigation plan, not a theory
- **Session note:** written to the stranger who inherits tomorrow, with every lesson, ruling, and open debt on the books
- **FTS5:** ruled on all four questions, scope fenced, paste protocol waiting