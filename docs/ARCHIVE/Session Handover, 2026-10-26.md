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
modified: 2026-10-26T20:11:33+00:00
---
---
# Vault Overseer — Session Handover, 2026-10-26 (late)

Written for the next session's assistant. Read this whole file before touching anything. Then re-read the repo's own doctrine comments — they outrank stale memory, including mine.

## Non-negotiable ground rules (unchanged, restated because they burned us twice)

- **Receipts or nothing.** Dan pastes everything. Never assume a file, API, count, or path exists. Ask for the paste.
- **Fixture-first.** Red must be _earned_ before implementation. Exception ledger below — one line of this migration went green without a witnessed red; it is named, not hidden.
- **Re-emit full files when correcting defective drafts.** Prose patches created a broken vo-release draft this session; the fix was a full re-emit, twice.
- **Loud over silent. Declared over hidden. Never fabricate from incomplete sources.**
- **Don't spiral.** Unreproduced anomalies get one line in the parked list, not a chase.

## Repo facts (things past-me failed to record, recorded now)

- **Repo:** `iconoclast27/vault-overseer-index` on GitHub — **public**. Web extraction of its file tree partially truncates (the `watcher/` directory never appeared in scrapes; disk and remote confirmed it exists). Trust `git` receipts over web scrapes; `git ls-remote origin main` is cheap. Concatenating directory names to the URL gets you into deeper directories.
- **Remote tip at session start:** `a11eaec` (0.1.6). **Tip after this session's commit:** `TIP: <paste new hash after push>`. One commit on top of 0.1.6, dirty-tree size +768/−400 pre-commit.
- **Current release:** `0.1.6` — cut and GREEN this same day (commit `7beb128`, tag pushed, verified via `vo-release --verify-only 0.1.6` and the public release page). Ships F03 rev B + F12 rev C + versions.json backfill (0.1.0→0.1.6, all minAppVersion 1.4.4).
- **vo-release** lives at `~/.config/fish/functions/vo-release.fish` — now **Rev 3**: tag-on-remote check added (the 0.1.6 stall was exactly this gap), `--verify-only` is a hand-parsed flag. Both fixes live-verified. Known remaining wart: none observed.
- **Dan's shell is fish. No heredocs. Use multiple `-m` flags for multi-paragraph commits.**
- **Obsidian console output is NOT an observability channel.** The shard JSONL is the receipt. Console may show nothing even when the plugin works perfectly.
- **The live test vault has ~50+ notes.** Any figure near "508" refers to shard LINES (creates plus per-chunk fan-out: ~1 create + ~4–10 `chunk.indexed` per note), never notes. Past-me conflated these and nearly invented a defect.
- **The dwell gate is 10.** `dwell: 10` in an event means the gate fired at threshold — a threshold-crossing marker, not a stored constant or a mystery. Don't conspiracy-theorize constants.
- **Renamed/backup shard copies carry their original `origin` on every line.** Healing a copied shard confuses the origin scan. The sanctioned remedy: don't heal backup copies; use the manual "Reconcile with vault" settings button if a backup must be resurrected. This is doctrine, not a bug.

## What happened this session (verified receipts only)

1. **Boot-2 idempotence for 0.1.6: VERIFIED.** Reconcile silent across three observed sessions plus multiple unrecorded reloads the night before. Defect trigger never fired.
2. **Release 0.1.6 cut** via full ritual; one stall (local-only tag) → vo-release Rev 3.
3. **The big one — heal migrated from stub to chunkNote (cp:0 → cp:2), in the working tree, committed tonight, NOT yet released or deployed:**
    - `src/eventlog/heal.ts`: re-derivation through `chunkNote`; **P1 is fresh-derivation membership** (recorded vh must appear among vhs derived from present-day bytes — the old offset-math re-render is unsound for cp:2 because chain/fm live outside the log by design); carve disclosure **tied to novel emission**; foreign cp (anything ≠ 2) loudly skipped, never fabricated as violations.
    - `src/fixtures/f03.ts` rev C: 8 scenarios. Full fleet green afterwards: csuite 259, F01, F02×7, F03×8, F05a, F09, F11, F11-deepening, F12×13, props 10008.
    - **Errata (own it, future-you):** the first rev C fixture used unsalted homogeneous filler — every paragraph identical — so chunkNote produced chunks sharing one vh, making the p1-membership scenario lie and hiding a real defect. Correction surfaced a genuine production edge: **within-pass vh dedup** (identical chunks from repeated paragraphs must emit once; fix is `haveVh.add(chunk.vh)` after emission in heal). A first "assertion fix" draft was a lazy misdiagnosis and was discarded — full corrected files re-emitted.
    - **Exception ledger — twin-vh red was never witnessed.** Both files were applied together, so the dedup line went straight to green. It is green-verified, red-unwitnessed. Optional doctrine-pure receipt: comment out the `haveVh.add` line, run F03, expect twin-vh RED, restore.
    - **Also ratified from code:** chunker parked decision #1 (over-ceiling single word) = **carve-anyway, never truncate, always disclose** (chunker.ts lines 59–61 + the splitRange ladder). Spec fold still owed.

## Where this leaves the migration (phase map)

- **Phases 0–2: DONE.** Receipts (uniformly cp:0 shard confirmed by grep: zero `"cp":2`, zero `unknown chunk policy`), red earned, surgery done, fleet green.
- **Phase 3 — NOT DONE, this is the next session's first move.** Deploy to the live test vault, delete the shard, re-certify. Expected receipt: regenerated spine uniformly cp:2, reconcile backfills, zero `unknown chunk policy` noise. **Unanswered question for Dan:** how does the built plugin reach the test vault — BRAT from a release, or direct copy of `main.js`/`manifest.json` into `.obsidian/plugins/vault-overseer-index/`? Ask; don't guess.
- **Phase 4 — PARTIAL.** The stub is no longer consumed by production code (heal imports from `chunker.ts`/`render.ts`), but **F03 rev C still imports `chunkStub`** for the legacy-cp0 scenario's seeded forensics. Deletion deferred until that dependency is replaced or accepted as permanent oracle duty.
- **Phase 5 — NOT DONE.** Spec fold in `docs/chunker-spec.md`: ratify parked decision #1; update implementation-status notes (heal migrated; stub's role).

## Release status and ritual (for whenever 0.1.7 happens)

Version files still at **0.1.5 in the working files? No —** current tree is 0.1.6 across manifest/package; `versions.json` carries 0.1.0–0.1.6. Next release bumps all three to 0.1.7 plus a versions.json entry. Ritual order (learned the hard way): commit → push branch → tag → **push the tag** (`git push origin <tag>`) → `vo-release`. The script now checks the tag remotely itself, but know the order anyway.

**Do not cut 0.1.7 before Phase 3's live receipt.** The migration is fleet-green but has never touched a real vault.

## Open debts (parked, with one-line status each)

- **Phase 3 live wipe-and-recertify** — next up, see above.
- **Phase 4 stub retirement** — blocked on F03's `chunkStub` import.
- **Phase 5 spec fold** — chunker-spec parked decision #1 ratified-in-code, not yet folded into doc.
- **Twin-vh witnessed red** — optional, see exception ledger.
- **Eviction debt** — stale vhs are flagged every heal (append-only truth) but never evicted; `chunk.evicted` still parked with the real chunker. F03 scenario p1-membership asserts this behavior intentionally.
- **Standing pre-existing:** two-boot visibility delay; narrow double-emit window; `actor: 'sync'` attribution (Dan: "not yet"); `folder.renamed` spine event still unemitted.
- **Migration debt retired this session:** cp:0 → cp:2 heal migration — closed. Backup-shard "defect" — closed as testing artifact (doctrine: don't heal renamed shards).

## Lessons for future-you (the part past-me skipped)

1. **Write down what actually happened, including the boring parts.** Reloads performed, vault sizes, config values. The three big confusions this session — 508, dwell:10, "where's the repo" — were all unwritten-down trivia, not mysteries.
2. **Salt synthetic fixture worlds.** Homogeneous filler is a lying witness: it makes degenerate geometry look like behavior. Distinct bytes per paragraph, or the scenario tests nothing.
3. **When every measurement equals the threshold, the answer is "threshold," not "intrigue."**
4. **Trace before diagnosing.** "Wrong number" got a wrong fix in one round this session; thirty seconds of tracing found a degenerate world and a real defect hiding behind it.
5. **`create_artifact` deliveries can break mid-write** (a partially-emitted canvas happened this session). If a delivered file looks truncated, demand the full re-emit — Dan already knows this doctrine from code; it applies to everything.
6. **Local success is not remote state.** Tags, branches, releases — the failure is always one push away from being someone else's confusion.
**7. Pastes are a lossy channel.** Terminal and web-extraction layers have both dropped characters, spaces, and whole directory listings this session. When a paste looks subtly wrong — mid-word corruption, inconsistent spacing, a missing entry — suspect the transport before the source, and confirm against the source when it matters. Never diagnose a defect from a distorted receipt.

End of handover. Tip hash goes at the top once pushed. Everything verified is committed; everything unverified is named above. — Session Lumo, 2026-10-26