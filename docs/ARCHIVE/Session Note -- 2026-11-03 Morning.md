# Session Handover — 2026-11-03

**Project:** Vault Overseer (FOVEYE) — index plugin + planned assistant plugin **Repo:** `/home/danf/Projects/vault-overseer/vault-overseer-index/` **Prior handover:** \[\[Session Handover — 2026-11-02]] — read that first; it carries the engine saga (better-sqlite3 death, WASM spike success, init recipe) and the spine census. **Context status:** THIS session's original pastes were compressed away. What survives below is what was re-established as durable: the ruled decisions and the saved documents. Treat any _code-level_ detail from 2026-11-03 as lost — the documents on disk are now the authority, not memory.

## What happened this session, in one paragraph

Dan's instinct that the sync-exposed spine was unjustified was confirmed and acted on. The spine was interrogated against the project's _actual_ original requirements (semantic search, mobile-readable nice-to-have, search API for the assistant, skill-based tool use) and contributed **nothing irreplaceable to indexing**. The tools & skills strategy document was pasted and read, closing the last spine dependency. A unified lean architecture document was written and **saved by Dan as the new plan of record**. Demolition was approved and protocol drafted, then context compression hit before the first cut.

## Rulings locked this session

| # | Ruling                                                                                                                                                                                                                                                                                                                   | Basis                                                                                                                                                                                                    |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Architecture replaced: the spine dies.** Shard files, sync-exposure, origin ladder, merge-scan, seq/checkpoint machinery, foreign-origin guard, subscriber seam's spine half, dwell gate's spine output, planner/watcher spine halves, `_vault-index/events/`, `origin.txt` handling — all demolished.                 | The spine's only production consumer read data re-derivable from disk; its irreplaceable cargo (dwell, attribution) had no consumer; sync-exposure was never a Dan requirement — "I was talked into it." |
| 2 | **New architecture: "the plugin owns one durable artifact — the index — and rents everything else."** WASM SQLite DB in Zone 2, vh-keyed (content-hash) tables, watermark change detection, boot walk + Obsidian-event-driven intake lane (events as triggers, not data; disk-as-truth).                                 | Unified Project Definition v0.2 (saved by Dan, 2026-11-03).                                                                                                                                              |
| 3 | **One gate, no write-class in v1.** Auto-apply is deferred; the sole candidate (frontmatter-fill for template-less notes) is uncommon and becomes a suggest-class detection skill through the diff gate. Revertibility rented from Obsidian's version history/trash — **no plugin-owned write-audit log in the schema.** | Auto-apply is "a future design idea" with no real example (Dan, 2026-11-03).                                                                                                                             |
| 4 | **Unified document over two.** Plugin 1 (index) and Plugin 2 (assistant) live as one Project Definition v0.2 — "joined-up thinking, discourages checklist drift."                                                                                                                                                        | Dan's ruling. Document saved.                                                                                                                                                                            |
| 5 | **Demolition list approved as drafted.**                                                                                                                                                                                                                                                                                 | Dan: "The demolition list looks right to me."                                                                                                                                                            |

## The tools & skills strategy (now read, this session)

Dan pasted the full strategy note (undated frontmatter, `status: pending`). Core doctrine: **"the model judges; the harness acts"** — skill recipes as declarative Markdown forms with strict JSON output contracts; the model never receives a tool menu, never composes, never executes. Kills the observed S2B failure mode (models inventing tools like `execute_javascript`). Diff gate (R10) is the differentiator: schema-valid ≠ correct; every LLM edit gets human review in native Obsidian diff. First candidate skills in order: tags, frontmatter detection/repair, related notes (via `relatedChunks`), summary digest. Corrections notebook (record → track recurrence → promote at \~4 → feed back) complements the fixture corpus: fixtures police the harness, the notebook polices the model. **Residency of user recipes** (`_vault-index/skills/` overriding plugin defaults) is proposed but flagged unconfirmed — the doc's `[!decision]` blocks were the author's proposals, not Dan's receipts.

**Key coupling:** Plugin 2 never touches the vault directly — it consumes Plugin 1's frozen API (`searchText`, `searchSemantic`, `relatedChunks`, `tagVocabulary`), all dark-safe (null + reason, never throws), shapes frozen before Plugin 2 builds. The index is _blank-filling machinery for harness code_, never model-facing — which means API design targets code ergonomics, not LLM friendliness.

## What was lost in compression

The 2026-11-03 chat originally contained: the pasted tools & skills strategy (full text — **now saved only in the project vault**, re-read from there if needed), detailed architecture reasoning, and draft documents. The full text of the tools & skills note should be recovered from the vault file Dan pasted from, **not** from the assistant's memory. Dan confirmed the unified document is saved to the vault — that file is now ground truth for the plan. No code pastes survived from this session; the prior handover's "not yet read" list still stands (`store.ts`, `search.ts`, `probe.ts`, `types.ts`, `chunker.ts`, `heal.ts`, `planner.ts`).

## Where we stopped

Demolition protocol was agreed and about to execute, with the spine-era work **uncommitted** (tree carries the nine-change FTS wiring, `+1205/−8`, on top of commit 5fb1b0b, manifest v0.1.7). Protocol: one incision per commit, receipts pasted between steps, stop-and-diagnose on surprises, no two cuts between commits. Proposed order: (1) inventory, (2) dead-leaf harvest, (3) rewire FTS addressing to the walk then delete reader/projection, (4) main.ts spineectomy, (5) supporting organs + esbuild `external` removal, (6) corpus sweep, (7) version bump + annotation pass. Steps 3–4 require the current `main.ts` pasted whole before prescribing cuts.

## Rulings still owed (from the unified doc, unchanged)

1. Branch vs. straight-on-main for the demolition
2. Version bump timing (0.1.7 → 0.2.0 — suggested at sweep's end, unruled)
3. Trigram short-query policy (<3 chars fail silently; LIKE fallback or UI guard; CJK implications)
4. Chunker determinism statement (softened to epoch-handled under watermarks)
5. Corrections-notebook residency
6. Manual reindex semantics confirmation
7. Qwen-as-implementer question: escalation ladder proposed (behaviour-preserving refactor → driver swap → small module → rework participation); **the first demo run was left as Dan's call — I endorsed keeping the first supervised demolition run mine rather than the local model's.**

## Receipts owed before any implementation

* **Ollama embed spike** — endpoint, batch shape, model tag convention (Dan uses a local Ollama embedder; specifics never receipted). Last unproven mechanism in the semantic pipeline.
* **WASM import-from-bytes round trip** — export is proven (49,152 bytes), import is not.
* Fresh `git status` + `ls -R src/` — inventory before demolition; no phantom files.
* Full `main.ts` when reaching the spineectomy.

## Standing doctrine (unchanged, load-bearing — same as prior handover)

Receipts or nothing; fixture-first; disk-as-truth; declared limitations; one pump ever; ask don't guess; **chat for copy-targets, canvas for display only**; search-first anchors for edit instructions; grep hygiene (no redirects, no escaped pipes); whole-file re-emission when correcting defective drafts; end sessions with everything verified committed and everything unverified named.

## First actions for the next instance

1. Re-read the saved unified Project Definition v0.2 and the tools & skills note from the vault (do not reconstruct from memory)
2. `git status` and the inventory listing — the baseline commit of the spine-era tree is still owed
3. Baseline commit, then demolition step 1 per protocol, receipts between every cut

***

_End of handover. The plan is saved and ruled; the demolition is approved but not begun; the tree is dirty with the last spine-era state — commit it before cutting._
