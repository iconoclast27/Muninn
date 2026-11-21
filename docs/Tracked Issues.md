# Tracked Issues — the docket (canonical)

**Canonical home:** this file in **Muninn** is the single tracked-issues docket for **both projects**
(Muninn and Huginn). Huginn keeps a pointer stub at `docs/Tracked Issues -- Pointer.md`. Issues are not
duplicated across the two repos; the facts live here.

**The docket rule (Dan, 2026-11-16):** "The three findings should go on a list of tracked issues and stay on
the docket until investigated." A raised finding stays on this list until it is investigated; it is not
chased down a rabbit hole in the meantime. Findings of the **ghost-citation class** (T3, T23, T26, T27, T31)
are closed by correction, not by chase.

**Receipts rule (Dan, 2026-11-16, standing):** "**Receipts or nothing**" — a claim needs pasted terminal
output, and every file cited in a row of this docket, a tombstone, a Design Report, or a registry must be a
measured `git ls-tree`/`git grep` line from the repo, never a name remembered from context. Committed
documents are ghosts until measured.

**Storage rule (Dan, 2026-11-17):** a working document that outlives a single task lives in **the repo**;
`/tmp` exists only until the next restart and is for the length of one task. **Preserving a copy whose facts
are stated elsewhere creates duplication and drift** — having something stated twice is an opportunity for
drift, so this docket does not copy facts that the repos already state: it points at them.

**Rulings that govern this docket** are recorded in the repos, not copied here:
- Rulings 1–14 of 2026-11-16 (archive layout, `docs/decisions/` as the ADR home, handovers archived, ADR
  immutability, `CHANGELOG.md`/`SECURITY.md` owed, archive→delete is a later human-approved step) — recorded
  in Muninn `docs/decisions/index.md` (dated addendum) and the Muninn Design Report §18/§20, and in Huginn
  `docs/decisions/index.md` (`adr-28.md` names rulings 8–14).
- Rulings of 2026-11-17 that close T1, T2, T3 — recorded verbatim below, and in Muninn `adr-38.md`,
  `adr-39.md`, `adr-40.md`.
- The serial-contextual-operations rulings R1–R14 of 2026-11-15 are law in
  `Huginn/docs/Serial Contextual Operations Design (Ruled).md`.
- The ruling of 2026-11-18 that closes **T4** — recorded verbatim below, and in Muninn `adr-43.md`.
- The ruling of 2026-11-18 that closes **T15** and opens **T37** — recorded verbatim below, and in Muninn
  `adr-37.md` (the contract itself).

## Tracked issues (the docket — stays open until investigated)

| ID | Issue | Measured [R] | Status | Investigation owed |
|---|---|---|---|---|
| **T1** | Plugin 2 code left in Muninn, referee'd by fixtures | `084a076` removed all Plugin 2 imports from `main.ts`/`settings.ts`; `main.ts:90-91` states the harness has moved to Huginn; `src/harness/` 5 files, `src/llm/` 1, `src/recipes/` 7 (incl. `tag-assignment.md`) exist; only `f25.ts`/`f26.ts` import them; f25/f26 are GREEN | **CLOSED — ruled 2026-11-17, Muninn `adr-38.md` (option A: kept as a named oracle)** | Rule taken. The consumer census was measured before the ruling: `git ls-files src/harness src/llm src/recipes` = **15 tracked files**, `git grep -l "recipes/" HEAD -- src` returns **only the 7 recipe files' self-imports**, `main.ts:90-91` states the harness has moved to Plugin 2, `settings.ts` imports nothing from the corpus, and Design Report §14 records "Plugin 2 harness is dormant — `harness.ts`/`recipe-registry.ts` exist, nothing calls them" (line 150). f25 (protocol conformance) and f26 (dwell + harness reference counting, 13 assertions) are the corpus's only consumers and are the referees for the interface `listNotes` must preserve (T15). Huginn's harness is the ported live copy, so the corpus is duplicated; the duplication is accepted as the price of the oracle. |
| **T2** | Empty untracked directories in Muninn `src/` | `src/search/`, `src/probe/`, `src/rebuild/` — 0 files each, dated 2026-11-03; `docs/AGENTS/SKILLS/` 0 files (ruled: delete, ruling 10) | **CLOSED — ruled by Dan 2026-11-17 ("T2, remove the empty directories"), executed the same day; Muninn `adr-39.md`** | Executed: `rmdir src/probe src/rebuild src/search` after measuring `find src -maxdepth 1 -type d -empty` (the three dirs), `find ... -type f | wc -l` = 0, `git ls-files src/probe src/rebuild src/search | wc -l` = 0. Re-measured after: `find src -maxdepth 1 -type d -empty` = empty, `git status --porcelain` = clean. Huginn measured no empty dirs in `src/`. Git cannot track empty directories, so the act leaves no commit. `.qwen/tmp` is **not** in this ruling's scope — see T36. |
| **T3** | Phase 1 doc-count error (my own drift, ledgered) | Measured 2026-11-16: 37 tracked files under `Muninn/docs/` (23 `docs/ARCHIVE/` + 14 live) + `README.md` = 38 [R]; Phase 1 header said "34 tracked docs + README" and "11 live files" | **CLOSED — corrected 2026-11-17; Muninn Design Report §18 item 12, committed `9b2a2bd`** | Discharged by Dan's ruling 2026-11-17 ("T3, that's fine"). The Phase 1 file rows themselves were complete; only the header counts were wrong. Huginn re-counted with the same method (Phase 3, 24 tracked `docs/` files + 2 root `README.md`/`CONTRIBUTING.md`). |
| **T4** | Compute threading invariant unmet as-built (ADR-35) | Measured 2026-11-18: `git grep -il worker HEAD -- src` = **0 hits in Muninn, 0 hits in Huginn**; `searchSemantic` (`api.ts:133-155`) has one `await` — the embedder at `:144` — so its scan runs synchronously inside an `async` method | **CLOSED — ruled 2026-11-18 by Dan, verbatim: "Declared limitation, we can revisit if the problem bites." Muninn `adr-43.md`** | Rule taken. The ruling, its disclosure obligation, the reopening trigger, and the frozen-shape guard are in `adr-43.md` — not restated in this row. **T8** (ANN for >10k chunks) stays open: today's ruling was about threading, not the index. |
| **T5** | Mobile live receipt owed (ADR-14) | Mobile lane fixture-proven M1–M3 only; `isDesktopOnly: false` is correct, supersession text owed | OPEN — parked by Dan (ruling 11) | Live mobile index test. Not a bug. |
| **T6** | Folder-rename child-path production receipt owed (ADR-5) | `renamePrefix` exists at `store.ts:469`, `intake/lane.ts:163`; the 2026-11-04 review asked to "smoke-test a folder rename, watch child paths" | OPEN | Live receipt in Obsidian. |
| **T7** | `onunload` durability best-effort/async (named debt, ADR-29) | `main.ts:179` comment "unload-time flush is best-effort" [R]; 2 s debounce | OPEN — named debt | Accept as declared limitation, or a durability ruling. |
| **T8** | ANN / vector index for >10k chunks (named debt, ADR-30) | `api.ts:228` `SEMANTIC_SEARCH_HARD_CAP = 10000` | OPEN — named debt | Epoch-bump ruling if the scan must scale. |
| **T9** | Scenario F never smoked in Obsidian ("fixture-green is not production-live") | `f27` guards it at `69a4b45`; the merged smoke is the release gate | OPEN — release gate | Merged manual smoke in Obsidian at release. |
| **T10** | Stale `LLM client returned null` entry in the vault's `Agents/Huginn/MEMORY/corrections.md` (keyed by `tag-assignment`) | Pre-release manual step | **CLOSED — Dan did it 2026-11-17, and deleted all memory files: "T10 done, I deleted all memories to avoid prejudicing future testing"** | Discharged and extended: `corrections.md`, `user.md`, `chat-summaries.md` were removed from the vault, so the memory scenarios start from a clean slate. Measured in `docs/TESTING1.md`: the memory assertions are **gains** (`:90` "is appended", `:184` "gains **no** entry", `:208` "contains exactly two … entries", `:229` "contains a new … entry", `:333` "whether `MEMORY/` was created automatically"), so no scenario precondition is broken by the deletion — the files are created by the plugin under test. |
| **T11** | Verbose coverage for the four channel-less recipes (`tag-assignment`, `title-suggestion`, `link-suggestion`, `related-notes`) | Pending Dan ruling | OPEN | Ruling owed. |
| **T12** | Bounded tag-assignment retry | Slotted for the next release | OPEN | Ruling + fixture. |
| **T13** | Memory Feedback Loop release | Design + Implementation Guide exist; the guide drafted fixture numbers **F26–F30** which were **Huginn-sequence draft numbers, not a collision** — the perceived collision was a documentation-convention failure: merged documentation treated the two projects' **independent** chains (Muninn `f01..f26`, Huginn `f01..f30`, each its own `package.json` `fixtures` script [R]) as one shared sequence | **CLOSED — ruled 2026-11-20 by Dan, verbatim in intent: "we need to just reconcile the fact that the numbering is separate … include designation in the documentation for the source of the fixture number being referenced"; release slotting confirmed the same day** | **Standing convention (ruled): every fixture number cited in prose or docs carries its project prefix — `M-fNN` (Muninn) or `H-fNN` (Huginn).** Release slotting: the Memory Loop's ranking fixtures **follow the op loop's H-f31–H-f36 and start at H-f37**. The guide's draft "F26–F30" = H-f26–H-f30, all shipped; no live restatement uses bare numbers. History stays history; the guide itself remains deleted (recoverable at `0a066d7`). |
| **T14** | Null-failure cause (chat) | Blocked on recurrence | OPEN — blocked | Recurrence receipt. |
| **T15** | `listNotes` ruling (ADR-37, Proposed) | Contract text drafted 2026-11-16; Huginn enumeration forbidden; `criteria.tag` inexpressible today (`tagVocabulary()` returns counts, not paths) | **CLOSED — ruled 2026-11-18 by Dan ("I agree the door" … "1, 2, 3, 4 agreed. 5. recommendation accepted. 6. That waits on that proposed addons list"). Muninn `adr-37.md` — Accepted; contract of record, not restated here** | Rule taken. The contract and its implementation obligations are in `adr-37.md`; the implementation is a **separate authorization** (contract → red `f27` → `api.ts` → fakes → Muninn's release → Huginn's mirror → `list`). |
| **T16** | Huginn has no release doc; Muninn's ADR-8 is the doctrine | Muninn `docs/Release Ritual -- Walkthrough.md` exists; Huginn `docs/` has none [R] | **CLOSED — pointer stub written 2026-11-17** (`Huginn/docs/Release Ritual -- Pointer.md`, Phase 4) | Discharged. Muninn's `docs/Release Ritual -- Walkthrough.md` remains the doctrine of record; the stub names the three differences (Huginn owns the bump commit, the tag, and the release). |
| **T17** | `CHANGELOG.md` owed in both projects (ruling 5) | Measured: neither repo has one | **CLOSED — written in both repos 2026-11-17, placement ruled 2026-11-17: root** (`T17/18 -- agreed, root`; Muninn `docs/decisions/adr-42.md`) | Discharged. Muninn `CHANGELOG.md` from 15 measured tags, Huginn from 20. Root placement: `README.md:13` (Muninn) and `README.md:62` (Huginn) name the file, GitHub discovers `CHANGELOG.md`/`SECURITY.md` at the root without a click, and a release page links them. |
| **T18** | `SECURITY.md` owed in both projects (ruling 6) | Measured: neither repo has one | **CLOSED — written in both repos 2026-11-17, placement ruled 2026-11-17: root** | Discharged. Private/experimental posture, no warranty, no issue channel, external requirements. Root placement, same ruling as T17. `SECURITY.md` in Huginn is conformed to the model-layer scope ruling below (T33). |
| **T19** | Muninn `TESTING1.md` version drift (ruling 8) | Pins `0.2.0-test.6/7` conditions and 11-06 receipts; release is `test.15` [R] | **CLOSED — version-of-record header added 2026-11-17** | Discharged: `docs/TESTING1.md` now opens with the version of record (`0.2.0-test.15`, commit `084a076`) and names the pinned `test.6/7` conditions as valid K/L conditions, not a version requirement. |
| **T20** | Huginn `TESTING1.md` Scenarios B, D, F, I to be redefined for the op loop | Ruled 2026-11-15 (`(Ruled).md` §10, assessment G6 `:141-148`); measured scenario line numbers `TESTING1.md:44, 63, 92, 108, 126, 163, 193, 213, 234, 273, 293` [R] | OPEN | Redefine **B, D, F, I plus the E/G chat legs** + write the new loop scenario (turn receipt as the observable). **Scenario A survives unchanged** — `Scenario A passed` is the written precondition of the other ten (`:66, 111, 129, 166, 196, 216, 243, 276, 296` [R]); the "A superseded by name" claim is measured absent (T26). |
| **T21** | Three empty `docs/decisions/` placeholders (both projects) | 0 files each, git cannot track empty dirs | **CLOSED — deleted 2026-11-17 (ruling 10)** | `docs/AGENTS/SKILLS/` measured empty (0 files, 0 bytes) and deleted. The `docs/decisions/` placeholders vanished naturally when the ADR files were written; Muninn now has 38 files in `docs/decisions/`, Huginn 37. |
| **T22** | Model-roster verdicts: the closure is Dan's ruling, the transcripts are not recoverable, and **the qwen verdict docs I first cited are ghosts** | Measured Muninn: `git ls-tree -r --name-only HEAD -- docs | grep -i "qwen\|roster\|pig"` → **only `docs/Standing Qwen prompt.txt`**; `git grep -in "12b" HEAD` in Muninn → **0 hits**; `git grep -in "don't plan on using\|do not plan on using\|not plan on using" HEAD` in Muninn → **0 hits**. Muninn's tracked qwen model names are `qwen3.5:9b` (`LLM Coordination Protocol v1.0.md:8`, `Session Handover 2026-11-03 Evening.md:196`), `qwen3.5:4b` (archived `comparison.md`, `event-log-schema.md`, `project-definition-file.md`), `qwen3:1.7b` (archived `comparison.md`). **There is no `qwen3.5:12b (audition closed).md` and no `LLM Roster 2026-11-03.md` in Muninn — the two files I quoted in my first draft of this row do not exist; the quotes were context remnants, not receipts.** The real verdict lives in Huginn's handovers: `docs/Handover 2026-11-13.md:55` "**qwen is closed**: that model is not suitable for this job. The qwen-code settings roster-honesty item is moot (`.qwen/` deleted, qwen-code no longer used)"; `:126` "Model roster — auditions paused; `kimi` inherits …; Gemma retired; qwen closed"; `:52` "The worktree/branch removal is attributed to **qwen3.5:12b performing badly**". The failure evidence Dan's new ruling describes is already recorded in `docs/HANDOVER - 2026-11-08.md:40-41`: `qwen2.5-coder:7b` "declared victory without doing the work ('Mission Accomplished')"; `qwen3.5:9b-32k` "best behaved … but died repeatedly: context starvation as agent, then commit-substitute-for-action, then terminal dithering/timeout during the harness edit; her partial rewrite corrupted `harness.ts` (restored via `git checkout`). Right diagnosis, wrong anatomy, insufficient stamina." — intention-action failure, paralysis, and inability to output a simple file, exactly as Dan describes. Archive material: Muninn's `Standing Qwen prompt.txt` (ruling 9) + Huginn's `Never Try To Teach A Pig To Sing.md` (ruling 9) + the roster paragraphs inside the handovers. **Reading Qwen3.5:12b's chats is permitted** (Dan, 2026-11-16): "not prohibited. I just don't think they contribute anything. They are full of agent paralysis, intention-action failures, and a sad case of not being able to output simple files." Measured the store — the verdict cannot be evidenced there: `select model, count(*) from session_v2 group by model` → `swift-1.5-iq2xs` 9 · `gemma4:12b` 3 · `qwen3.8:27b` 1; **no `qwen3.5` in the `model` column** — `group by model` lists only swift, `gemma4:12b`, `qwen3.8:27b`; note the parts-table LIKE grep I first ran is **vacuous**: `select count(*) from session_part` → **0 rows**, so a 0-hit LIKE proves nothing; store history begins `select datetime(min(time_created)/1000,'unixepoch','localtime') from session_v2` → **2026-11-10 13:38**, **after** the audition window the docs describe (11-07 → 11-10); assistant-side content is unrecoverable (`select count(*) from session_part` → 0 · `select count(*) from event` → 0 · `select count(*) from blob` → 0). The store's only qwen session: `ses_e3a0460f6ffec50tlCDzuif573`, `qwen3.8:27b`, 2026-11-10 15:02–15:08, 7 messages, 4 assistant turns with **empty** `$.text`, 2 readable user prompts ("read the handover note for 2026-11-08"; "The previous response was interrupted. Continue from where you left off…"). **Finding: `qwen3.5:12b` appears only in Huginn's 11-10 and 11-13 handovers, as the attribution of the worktree/branch removal — never as a session the store records. The audition transcripts are unrecoverable from the measured store, so the closure rests on Dan's ruling plus the committed handover narratives.** | **CLOSED — ruling 9 executed 2026-11-17; the two files archived with tombstones → Muninn `adr-21`/Huginn `adr-21`, then deleted in Phase 5** | The closure of record is Dan's ruling plus the committed handover narratives (`HANDOVER - 2026-11-08.md:40-41`; `Handover 2026-11-13.md:52, 55, 126`), never store transcripts: `qwen3.5` does not appear in the store's `model` column, the parts tables are 0 rows, and store history begins **after** the audition window. The roster paragraphs lived inside the handovers, which are archive material (ruling 3). The **Gemma4:12b** chat prohibition is unchanged; reading **Qwen3.5:12b**'s chats is permitted, not required. No roster doc exists in either repo, and none was created. |

| **T23** | **My own ghost-file citations, caught by measurement 2026-11-16** | In drafting T22 I quoted two Muninn files that do not exist: `docs/qwen3.5:12b (audition closed).md` and `docs/LLM Roster 2026-11-03.md`, with quoted verdict lines. Measurement: `git ls-tree -r --name-only HEAD -- docs` (14 tracked) + `find docs -maxdepth 1 -type f` (14 on disk) → **neither name present**; `git grep -il qwen HEAD` → 12 files, none of them the two; `git grep -in "12b" HEAD` → 0 hits in Muninn. The quotes were retrieval remnants inside my context, not receipts. Phase 1's inventory (`phase1-inventory.md:75,104,226`) is clean — it names only the two real ruling-9 files. | CLOSED — corrected in T22 | **Rule for Phase 3/4 wording: every file cited in a triage table, tombstone, or Design Report must be a measured `git ls-tree`/`git grep` line from the repo, never a name remembered from context. Committed-doc quotes are ghosts until measured.** Same error class as T3.
| **T24** | `versions.json` incompleteness — **Muninn** | Muninn: 13 entries in `versions.json` vs **15 tags**; **missing `0.2.0-test.1` (`92d68076`) and `0.2.0-test.2` (`c22c0402`)** [R, tags peeled 2026-11-17] | **CLOSED — Dan asked the executor to do it ("Can you do T24-25 for me?", 2026-11-17); entries added the same day** | Measured before: 13 entries, 15 tags. After: **16 entries**; `node -e` JSON parse OK, and the set comparison reports **every tag present** (`tags not in entries: []`). The 16th entry is `"0.2.0": "0.15.0"`, a **seed entry, not a tag**: the plugin's first `manifest.json` (`5516c44`) declared version `0.2.0` before any tagged release, so `0.2.0` names the pre-release declared version. `minAppVersion` for both new entries is measured from the tag's own `manifest.json` (`git show 0.2.0-test.1:manifest.json` → `0.15.0`; same for `test.2`), not copied from neighbours. Entries kept in chronological order. |
| **T25** | `versions.json` incompleteness — **Huginn** | 18 entries vs **20 tags**; **missing `0.1.0-test.14` (`dda5fa4c14e4…`) and `0.1.0-test.15` (`0e1611548d…`)** [R, `git rev-list -n1` peels measured 2026-11-17; note the tag **objects** are `0971c79`/`b812655` for annotated tags, the commits are the bump commits] | **CLOSED — Dan asked the executor to do it ("Can you do T24-25 for me?", 2026-11-17); entries added the same day** | Measured before: 18 entries, 20 tags. After: **20 entries**, and `tags not in entries: []` with `node -e` JSON parse OK. `minAppVersion` measured from each tag's `manifest.json` (`git show 0.1.0-test.14:manifest.json` → `0.15.0`; `test.15` → `0.15.0`). Inserted between `test.13` and `test.16` to keep the file's chronological order. `versions.json` is a **bump-commit file**, so these entries ride the next release act; no version, tag, or release was touched by this act. |
| **T26** | The "Scenario A superseded by name" claim is a context ghost | `git grep -n "Scenario A" HEAD -- docs README.md` → **only** `TESTING1.md:44` (the scenario header) and the ten precondition lines `:66, 111, 129, 166, 196, 216, 243, 276, 296` + `TestReport.md:1` ("Scenario A - PASS"). **No supersession text exists anywhere in the repo** [R] | CLOSED — corrected | Scenario A survives unchanged as the precondition of all eleven scenarios (ADR-25). The claim was my context remnant, the same class as T3/T23. |
| **T27** | Three ghost names listed by a committed handover | `docs/Handover 2026-11-14.md:6` names `docs/Chat Context Architecture.md`, `docs/Code Review Plugin 2.txt`, `docs/Huginn Plugin 2 Memory Feedback Loop.md` as companions; `git ls-tree -r --name-only HEAD -- docs` (24 files) contains **none of the three** [R]; the guide is tracked as `Memory Feedback Loop Implementation Guide.md` (494 lines, first commit 2026-11-07) | **CLOSED — wording rule in force; the handover is archive material (ruling 3), archived 2026-11-17 and deleted in Phase 5** | Nothing to create. The three names remain absent from the index; the receipts rule in this docket's header is the standing guard against re-citing them. |
| **T28** | `docs/Huginn Plugin 2 Harness.md` fixture table is stale at f27 | The table runs `src/fixtures/f01.ts … f27.ts` (`:114-140`, last row `f27.ts` `:140` [R]); shipped chain is f01–f30 (`package.json:11` [R]); `f28`/`f29`/`f30` rows missing | **CLOSED — conformed 2026-11-17** | The table was conformed to f01–f30 in `docs/Huginn Plugin 2 Harness.md`, then that doc was archived (Phase 4) and deleted (Phase 5). The canonical fixture list of record is `package.json`'s `fixtures` script line, then `README.md:40`. |
| **T29** | `UserMemory` filename drift — four docs against the code | Code writes **`user.md`** (`src/memory/kinds.ts:89`); `TESTING1.md:203, 208` and the Implementation Guide `:196` agree. **`README.md:55`, `Huginn Plugin 2 Definition v0.1.md:28`, `Huginn Plugin 2 Harness.md:151`, `Memory Feedback Loop Design.md:13` say `user-memory.md`** [R] | **CLOSED — the live docs conformed 2026-11-17; no code change, no vault file renamed** | `README.md`, `Memory Feedback Loop Design.md`, `TESTING1.md`, and the Implementation Guide now read `user.md`; `Huginn Plugin 2 Definition v0.1.md` and `Huginn Plugin 2 Harness.md` were archived with their stale text intact, then deleted in Phase 5 — history stays history, no rename. |
| **T30** | Model-roster paragraphs sit **inside** Huginn's handovers, not in standalone roster docs | Measured: no roster doc exists in either repo (T22's Muninn measurement; Huginn's 24 tracked docs contain no roster file [R]). The roster facts live in `docs/HANDOVER - 2026-11-06.md`, `… - 2026-11-07.md`, `… - 2026-11-08.md:40-41`, `docs/Handover 2026-11-10 Scenario F.md:94`, `docs/Handover 2026-11-13.md:52, 55, 126`, `docs/Handover 2026-11-14.md`, `docs/Architect Response To Handover 2026-11-15.md` — all archive material (ruling 3) | **CLOSED — the handovers are archive material (ruling 3): archived 2026-11-17, deleted in Phase 5** | Discharged by the same measurement that closed T22. No roster doc exists in either repo, and none was created; the ADR set owns the facts. |

| **T31** | Ghost doc names in committed headers, and in my own registry draft | `git ls-tree -r --name-only HEAD -- docs` in Huginn = **24 tracked files** [R]. These names are **not tracked** and appear in committed text: `docs/Design Review - Serial Contextual Operations 2026-11-15.md` (`(Ruled).md:4`, the `Amended in response to:` line — the tracked file it describes is `Serial Contextual Operations Design Assessment.md`), the v1 draft `docs/Serial Contextual Operations Design v1.md` (the `Supersedes:` target), `docs/Chat Context Architecture.md` + `docs/Code Review Plugin 2.txt` + `docs/Huginn Plugin 2 Memory Feedback Loop.md` (`Handover 2026-11-14.md:6, 39`, T27), and the four review/UX names (`Plugin 2 Chat View UX Design.md`, `Plugin 2 Code Review 2026-11-07.md`, `Code Review 2026-11-06.md`, `Code Review 2026-11-07.md`) **which I listed in my own design-report draft and which are not in the repo** — removed from the registry this pass, drift row 11 added | **CLOSED — header citation fixed 2026-11-17; the naming fact is recorded in `adr-28.md`** | `(Ruled).md`'s header now cites the tracked `docs/Serial Contextual Operations Design Assessment.md`; the v1 draft and `Design Review - …` names were recorded in `adr-28.md` as documents that were never committed, not invented. The ghost rows were removed from the Design Report §19 registry, and drift row 11 added. |
| **T32** | Ruling 9's companion file is in **Huginn**, not Muninn | `docs/Never Try To Teach A Pig To Sing.md` — 65 lines, **tracked in Huginn** (`git ls-tree -r --name-only HEAD -- docs` row 16) [R]. Muninn's ruling-9 companion is `docs/Standing Qwen prompt.txt` (29 lines, tracked in Muninn) [R]. Muninn has **no** pig file (`git grep -i "pig"` in Muninn docs → 0 hits) | **CLOSED — both files archived 2026-11-17 with tombstones → Muninn `adr-21` and Huginn `adr-21`, then deleted in Phase 5** | Discharged as triage assigned. The two files are the same roster fact recorded twice across the projects (T22); the ADR set owns it, and Muninn is the home of the protocol documents (ruling 8). |
| **T33** | The shipped chat-model default names a closed model | `DEFAULT_SETTINGS` (`src/settings.ts:20-27`) ships `qwen3.5:4b` as `chatModel`, and `qwen` is closed (ADR-21, `Handover 2026-11-13.md:52, 55, 126` [R]; `HANDOVER - 2026-11-08.md:40-41` [R]) | **CLOSED — 2026-11-17, Dan ruled the finding a misunderstanding: "The closed models are closed on the coding/production side, not the user side. The vault plugin is going to rely on small models, and qwen3.5:4b is a popular default for users."** | No code change, no default change. The roster closures (qwen, Gemma4:12b, the paid `kimi` path) are **staffing rulings for the coding/production side**; the plugin's chat default is a **user-side** choice, and `qwen3.5:4b` stays as the popular small-model default. `SECURITY.md` in Huginn is conformed to this scope, and Muninn `SECURITY.md` carries the same scope line; recorded in Muninn `docs/decisions/adr-41.md`. |

| **T34** | The Muninn Design Report §20 registry contradicted the **approved** triage table | The §20 row said `Muninn Store Rewrite Specification.md` "**canonical**, stays" and `Project Prompt.md` "**canonical**", against the approved triage rows 25 ("Mined, then **archive**") and 26 ("**Merge**, then archive"). Measured 2026-11-17: **88 lines in 34 Muninn ADR files** cite the store spec; the contract text survives in ADRs and Design Report §4/§6/§8, so nothing was lost | **CLOSED — registry conformed 2026-11-17 (the execution followed the approved table)** | The two §20 rows are conformed, the header names the store contract of record (Design Report §4/§6/§8 + ADR-4, 9, 10, 22, 31, 32, 36), and `docs/Unified Project Definition v0.2.md:7` carries the supersession note. Nothing further owed. |
| **T35** | ADR and design-doc evidence citations point at deleted archive files | Measured after Phase 5: **88 lines in 34 Muninn ADR files** [R] and **60 lines in Huginn `docs/decisions/`** [R] cite names in `docs/archive/`, which is now deleted; the bodies of Muninn `adr-31.md`/`adr-32.md` and `Huginn/docs/decisions/adr-31.md` name `Muninn Store Rewrite Specification.md` as the canonical store spec | **RECORDED STATE — not an issue to fix** | Ruling 2 (ADR immutability, Muninn `docs/decisions/adr-06.md`) forbids editing the bodies. The dated addenda in both `docs/decisions/index.md`, `CONTRIBUTING.md` in both repos, and Design Report Muninn §22 / Huginn §19+§21 carry the rule: citations are **dated statements at acceptance**, the facts are in the canonical docs, and the cited files are recoverable from git history (`git log --diff-filter=D`). Nothing further to do. |
| **T36** | `.qwen/tmp` was an empty directory in the Muninn working tree | `find . -maxdepth 2 -type d -empty -not -path "./.git*"` in Muninn, 2026-11-17: `./src/probe`, `./src/rebuild`, `./src/search`, **`./.qwen/tmp`** [R]; `find .qwen -type f` = **1 file** (`.qwen/settings.json`, qwen-code permission settings), `git ls-files .qwen | wc -l` = **0** (untracked) [R]; `.qwen/` was deleted by Dan 2026-11-13 (`docs/archive/Handover 2026-11-13.md:55`, archived then deleted, recoverable from history) [R] | **CLOSED — Dan ruled "You can remove .qwen" 2026-11-17; removed the same day** | Executed: `rm -r .qwen` after measuring the file count and 0 tracked files. Re-measured: `find . -maxdepth 2 -type d -empty -not -path "./.git*"` → **no output**; `git status --porcelain` shows only the docs of this pass. Tool residue, not project layout; Muninn `adr-39.md` carries the scope. |
| **T37** | The **proposed add-ons list** — features deferred past the enumeration door: **Dataview integration** and **structural predicates** (e.g. "notes in a folder with no frontmatter") | Measured 2026-11-18: `frontmatter` appears **nowhere in the store schema** (`git grep -n "frontmatter\|fm\b" HEAD -- src/store/store.ts` = **0 hits**), the partition lives in the chunker (`chunker/chunker.ts:152`, `:167`), and structural queries need a column on `files` — a schema ruling and epoch bump. Dataview is a third-party plugin: reading it from Huginn touches the ADR-34 boundary, so it is Muninn-side, not Huginn-side | **OPEN — deferred by Dan's ruling of 2026-11-18, point 6: "That waits on that proposed addons list"** — "much, much later" | A list, not a plan. When it is opened, each item gets its own ruling: Dataview = a boundary ruling (ADR-34) plus a door; structural predicates = a schema ruling plus an epoch bump plus a fixture. Nothing in T15's contract anticipates them. |
| **T38** | **`[R]` receipt shelf-life** — docket measurements rot at HEAD after the archive→delete purge: receipts measured before Phase 4/5 no longer reproduce | Found by Coder's S-1 audit 2026-11-20, examiner-verified: T22's "0 hits for `12b`" now returns **11 hits** across 6 files (later commits supply the text); the "sole hit" `docs/Standing Qwen prompt.txt` is deleted; `Session Handover 2026-11-03 Evening.md` unmeasurable at HEAD. T24's closure prose misstates `versions.json` (seed entry `0.2.0` sits **third**, not "16th"; pre-fix count was **14**, not 13; not chronological — `5516c44` predates `test.1`). T26/T29 rows cite grep outputs and files that have drifted or vanished at HEAD. **Confirmed legs measured then are still true; the row prose ages.** | **OPEN — raised by Dan's ruling 2026-11-20 (ruling 4); a re-measurement sweep or a row-annotation convention owes a ruling** | The docket is a working document, but its `[R]` citations are undated promises. Options for Dan: (a) a dated-receipt convention (each `[R]` carries its measurement commit), (b) a periodic audit fixture/process, (c) annotate stale rows as "measured at <commit>, superseded at HEAD". The audit itself lives in the vault (`Agents/Huginn/CALIBRATION/S-M Task Calibration 2026-11-20.md` — outside the repo, per the 2026-11-20 home ruling). |
| **T39** | **Docket self-citation inflation** — a row that quotes its own measurement commands becomes its own grep hit, so "0 hits"/"N hits" claims about repo-wide text cannot be audited from the docket alone | Found by Coder's S-1 audit 2026-11-20, examiner-verified: T22's row text contains `don't plan on using`, so `git grep` for that phrase returns **the docket itself** among the hits — the row's "2 lines found, not 0" is partly *the row quoting itself*. Same class in T26 (`adr-25.md:25` and `index.md:62` carry "Scenario A superseded by name" inside negative citations). | **OPEN — raised by Dan's ruling 2026-11-20 (ruling 4)** | Structural, not a bug: any repo-wide grep claim must either exclude `docs/Tracked Issues.md` from its own measurement or disclose the self-hit. Convention ruling owed; until then, grep claims in rows should name their exclusion set. |
| **T40** | **ADR-28 wording vs the six-door precedent** — "no SQL in the door" read strictly forbids what all six shipped doors do | Measured 2026-11-20: the five committed doors already pass SQL through the store's read-only `query()` gateway (`api.ts:157`, `:191`, `:413`, `:470+`); Coder's Stage 2 `listNotes` follows the same pattern (`api.ts:477-480`, `:500-503`). Dan ruled the wording conformed, **ruling 2 of 2026-11-20: "I agree"** — the base ban means *SQL only through `store.query()`*, per the six-door precedent | **CLOSED — Dan's ruling 2026-11-20; ADR-28's interpretation is the six-door precedent, no ADR body edit (ruling 2, ADR immutability — the interpretation lives here and in the calibration record)** | The store's read-only `query()` gateway is the sanctioned SQL door; raw string interpolation outside it remains banned. Coder's Stage 2 implementation stands as-written. |
| **T41** | **The T12 row's verbatim-copy claim is false** — `:117–118` says Design A's design text "is recorded verbatim in the vault record (`Agents/Huginn/CALIBRATION/S-M Task Calibration 2026-11-20.md`), not the repo"; the record contains no design text | Measured 2026-11-21 [R @ Muninn `eb484e0`, Huginn `ed7e517`]: the vault record is **63 lines**, `grep "Design A"` → **0 hits**, `grep -i retry` → **0 hits** (Dan supplied the full text for review; the record carries only the carry-forward clause: M-2's red "assertions carry into H-f31 authoring — the ruled Design A shape"). The verbatim text lived **only** in `Huginn/src/fixtures/check-task.ts` (Coder's M-2 red, deleted per the brief's own reset clause): **never tracked** — `git log --all -- '*check-task*'` and `git log --all -S "check-task"` → **0 commits in both repos** [R @ both HEADs]; exact string `Design A` exists in **no tracked file outside `docs/Tracked Issues.md` in either repo** [R] (Huginn's 12 apparent hits are the substring `Design Assessment`, excluded; per the T39 convention the grep claims here hit `docs/Tracked Issues.md` itself — the T12 row, the addenda, and this row — disclosed, not counted). Blame: the claim lines `:117–118` were added by `9ab0c55` (the commit that moved the record out of the repo) — the text was already deleted with `check-task.ts` and never existed in the record at `1e07141` either | **OPEN — raised 2026-11-21 by Dan's instruction ("raise the documentation drift … so that it can be reviewed by the reviewer. Note the need for doc-correction"); closure is Dan's ruling. Doc-correction owed: re-point `:117–118` to the third addendum's ruling-3 clause (`:290–294`) as the assertion source of record, or Dan supplies the verbatim text** | **Design A appears legitimately only in the docket** (Dan, 2026-11-21); no ADR carries it. H-f31's T12 legs assert exactly the ruling-3 vocabulary (bound in harness.ts, one retry, run-local feedback never corrections, infra nulls consume nothing, Stop parity, terminal shape unchanged). Where ruled text is silent on mechanism the executor chose — all choices enumerated in `Huginn/src/fixtures/f31.ts`'s header as reviewer review items; **the lacking design detail is harness-side drift, not executor fault**. |
| **T42** | **The 2026-11-20 (second) addendum contradicts itself on the calibration record's home** — `:267` says the record "lives in **the vault** … not the repo" (ruling 5), `:271` says "the calibration record **persists in `docs/`**" | Measured 2026-11-21 [R @ Muninn `eb484e0`, Huginn `ed7e517`]: `git ls-tree -r --name-only HEAD` grepped for `calib` → **0 files in both repos**; the record exists only in the vault (`Agents/Huginn/CALIBRATION/S-M Task Calibration 2026-11-20.md`, 63 lines); Huginn docs carry 0 calibration references [R]. Blame: `:271` was added by `1e07141` where the claim was **true** — that commit introduced `docs/S-M Task Calibration 2026-11-20.md`; `9ab0c55` moved the record to the vault (`git rm`) and re-pointed `:267–268` but left `:271` stale, so the same paragraph carries both claims at HEAD | **OPEN — raised 2026-11-21 by Dan's instruction; closure is Dan's ruling. Doc-correction owed: rewrite or annotate `:271` (the row-annotation convention of T38 option (c) fits exactly)** | T38 shelf-life class, live example: undated row prose rotted one commit after measurement. Reinforces the owed T38 convention ruling. The vault is the home of record per ruling 5; the record's project-relevant facts stay in the docket rows and commit messages. |

## Where the execution record lives (no copies in this docket)

The rationalisation's approvals, executions, commits, pushes, receipts, and measured doc-set counts are
recorded **in the repos**, and this docket points at them rather than restating them:

- **Muninn** `docs/Initial Design Report.md`: §18 (drift ledger, incl. the Phase 1 count correction, T3),
  §20 (document registry, conform note, Store Spec and `Project Prompt.md` rows, T34), §21 (discharged
  archive-removal duty), §22 (Phase 4/5 record: commits `9b2a2bd` and `6b76e41`, pushes
  `b75c408..9b2a2bd` and `9b2a2bd..6b76e41`, live doc set = **47** tracked files, code-to-archive
  references = 0, tags untouched).
- **Muninn** `CHANGELOG.md` §Docs record; `docs/decisions/index.md` dated addenda.
- **Huginn** `docs/Initial Design Report.md`: §19 (registry + conform note), §20 (state), §21 (Phase 4/5
  record: commits `2eb0c29`, `968c7f4`, `9030196`, the three pushes, live doc set = **50** tracked files,
  code-to-archive references = 0, tags untouched).
- **Huginn** `CHANGELOG.md` §Docs record; `docs/decisions/index.md` dated addenda.

**Authorization rule, unchanged:** no commits, version bumps, release cuts, tags, releases, pushes, or
deletions without Dan's explicit authorization. Phase 4 and Phase 5 were authorized and executed
(2026-11-17), including the archive→delete step. Tags are immutable and never force-pushed.

## Open rulings owed to Dan

**T11** (verbose coverage for the four channel-less recipes), **T12** (bounded tag-assignment retry),
**T14** (null-failure cause —
blocked on recurrence), **T37** (the proposed add-ons list — Dataview integration, structural predicates —
deferred by Dan's ruling of 2026-11-18, "much, much later"). **T4 closed 2026-11-18** (declared limitation,
Muninn `adr-43.md`); **T15 closed 2026-11-18** (the door is ruled, Muninn `adr-37.md` **Accepted**); **T13
closed 2026-11-20** (chains independent; **M-/H- designation convention in force**: every cited fixture
number carries its project prefix, `M-fNN`/`H-fNN`; Memory Loop ranking fixtures slot after the op loop's
H-f31–H-f36, starting at **H-f37** — see the T13 row and the 2026-11-20 addendum). **Door implementation
ACCEPTED 2026-11-20 (ruling 1): M-f27's red (Gyro-S) and the Stage 2 green (Coder) are ruled the real
acts and committed — Stage 3 (Muninn's release act) awaits Dan's slotting.** **T12 also carries a ruled
design (2026-11-20): Design A — the retry bound lives in the harness, one retry, feedback run-local
(never corrections), infra nulls consume nothing; the ruled shape asserts at the op loop's H-f31; the
design text is recorded verbatim in the vault record (`Agents/Huginn/CALIBRATION/S-M Task Calibration
2026-11-20.md`), not the repo.**

**The red plan is written (2026-11-17, Dan's request "Go ahead with the red plan document"):**
`Huginn/docs/Op Loop Red Plan.md` — planning only. It re-measures every seam at HEAD `de228d0`
(Muninn) and `a541f68` (Huginn), corrects the citation drift recorded in §5 of that document
(`dispatch.ts` nulls measured at `:94, 97, 104`; `ApprovalRequest` at `harness.ts:29-36`; Stop parity
at `approval-gate.ts:41-44, 47-50`; the Muninn typed fakes at `f22.ts:41`/`f24.ts:56` and the Huginn
mirror fakes at `f19.ts:20`/`f30.ts:37`, with `f07.ts:41` a cast that does not grow), states the
sequence (Muninn `f27` red at the five-door surface → implementation with fakes grown → Muninn's own
release act → the Huginn mirror → `f31`–`f36` in ADR-34's order → the loop and UI leg → `TESTING1`
redefinition → the merged smoke), and lists the authorization gates. **No coding, no fixture, no code
commit is authorized** — the docs pass that carries this pointer is Dan's authorized act, batched as
one commit per repo. **T13 is its remaining gate** (T4 was ruled 2026-11-18, Muninn `adr-43.md`; **T15 was
ruled 2026-11-18, Muninn `adr-37.md` Accepted**, so the door's contract is law and its implementation is a
separate authorization). The plan
is tracked in Huginn as `docs/Op Loop Red Plan.md`; this docket row is its canonical pointer, and each
repo's Design Report records the act as work, not as a status list.

**Closed by rulings of 2026-11-17** — T1 (named oracle, `adr-38.md`), T2 (`rmdir` of the three empty `src/`
dirs, `adr-39.md`), T3 (Phase 1 count correction, Design Report §18 item 12), T10 (all memory files deleted
from the vault by Dan), T17/T18 (root placement agreed), T24/T25 (`versions.json` completed by the executor
on Dan's request), T33 (model closures are coding/production-side, not user-side), T36 (`.qwen` removed,
`adr-39.md`). **Closed by Dan's rulings of 2026-11-18:** **T4** (declared limitation, Muninn `adr-43.md`)
and **T15** (the enumeration door ruled, Muninn `adr-37.md` **Accepted** — the ruled contract is the record,
not restated here; **implementation is a separate authorization**).
**Parked by Dan, not open for the executor:** T5 (mobile live receipt, ruling 11). **Live-receipt
items requiring the app open** (Dan's act in Obsidian): T6, T9 (the merged manual smoke is the release gate).
**Named debts needing a ruling that is not cheap:** T7 (`onunload` best-effort flush), T8 (ANN for >10k
chunks). **Work that moves with the op loop, not before it:** T20 (Scenarios B, D, F, I + E/G chat legs,
whose observable — the turn receipt — does not exist yet).

## Addendum, 2026-11-17 — Dan's rulings verbatim

- **T1 — "Let's go with A"** (2026-11-17), after the options were presented: **"T1, keep as a named oracle.
  It's likely it was used to test the API before freezing. It may even be useful to test your additive
  method, I don't know."** Recorded in Muninn `adr-38.md`.
- **T2 — "T2, remove the empty directories."** (2026-11-17). Recorded in Muninn `adr-39.md`; executed the
  same day.
- **T3 — "T3, that's fine."** (2026-11-17) — the Phase 1 count correction is discharged by the Design
  Report §18 item 12, committed in `9b2a2bd`.
- **T36 — "You can remove .qwen"** (Dan, 2026-11-17). Removed the same day; recorded in Muninn `adr-39.md`
  as part of the empty-directory scope.
- **The storage rule (2026-11-17)** — **"The place to store project files that are going to persist is the
  repo, and your plan for Tracked Issues.md in Muninn sounded good. As far as the rest of the documents,
  the point of rationalising the project documents was to reduce duplication and confusion. To keep things
  solely for provenance when they are explicitly stated elsewhere creates duplication, doesn't it? Having
  something stated gives clarity. Having something stated twice is an opportunity for drift."** Recorded in
  Muninn `adr-40.md`. Consequence: no provenance-only copies are preserved outside the repos; every fact in
  this docket is either measured, quoted from Dan, or a pointer to a committed doc.

**Rulings of 2026-11-17, later in the same day, verbatim:**

- **T10 — "T10 done, I deleted all memories to avoid prejudicing future testing."** Dan did the vault act
  himself and removed the memory files wholesale, so the memory scenarios in `Huginn/docs/TESTING1.md` run
  against a clean slate (they assert gains, measured at `:90, 184, 208, 229, 333`).
- **T33 — "T33 -- misunderstanding. The closed models are closed on the coding/production side, not the
  user side. The vault plugin is going to rely on small models, and qwen3.5:4b is a popular default for
  users."** The default stays; `SECURITY.md` in both projects is conformed to the scope.
- **T17/T18 — "T17/18 -- agreed, root."** `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` live at the repo
  root in both projects.
- **T24/T25 — "Can you do T24-25 for me?"** The executor completed `versions.json` in both repos (Muninn
  13 → 16 entries, Huginn 18 → 20) with `minAppVersion` measured from each tag's own `manifest.json`, not
  copied.
- **"Go for 1-4."** Authorization for the quick pass: record this pass's commit hashes in the Design
  Reports, verify the docket's pointers resolve, and confirm the archive-language and version-consistency
  measurements. No version bump, no tag, no release cut.

## Addendum, 2026-11-18 — Dan's ruling on **T4**, verbatim

- **T4 — "Declared limitation, we can revisit if the problem bites."** (Dan, 2026-11-18). The ruling is
  Muninn `adr-43.md`; its content is not restated here. **T4 closes; T8 stays open; the op loop's gate list
  becomes T15 and T13.** No code, fixture, version, tag, or release is authorized by this act.

## Addendum, 2026-11-18 — Dan's ruling on **T15**, verbatim (second pass)

The contract's choice points were put to Dan as six numbered questions, in prose, with the measured seams at
the end as backing. Dan ruled:

- **"Of course I agree the door."**
- **`title` → two fields.** "I suppose title has to be filename, since null information has null value",
  then, on the two kinds of query: "One would require the path and filename, the other requires the semantic
  header. **So we need to have filename AND header.**"
- **`mtime` stays.** "mtime should stay in determining hot/cold notes later. It hasn't been used because the
  eventlog drifted away from doing anything useful before it was removed."
- **`total` approved; `mode` agreed.**
- **`limit` optional, per recipe** — Dan's own proposal ("requested but optional (could be required or not in
  the recipe)"), after naming the unbounded-set problem: **"Queries can be open questions. 'Add tags to all
  notes in the Guitar folder' is an unbound set. How do you propose to cap that kind of query without giving
  it a false boundary?"** With the answer accepted, he added the guard: **"a hard limit is a sign that the
  model's query was not specific enough"**, and **"the phrasing of the prompt is the quick guard."**
- **`query` must exist.** "Not having query poses a risk to functionality, because the model needs a way to
  query ground state. Muninn is intended to be the safe enabler of that."
- **The two kinds.** "I just realised we have two different kinds of queries in the use case. One is defined
  easily by path, which is 'all notes in X folder' type. The other type is 'all notes like X' type, which is
  semantic. We need to somehow be able to handle both."
- **Rulings 1–6:** **"1, 2, 3, 4 agreed. 5. recommendation accepted. 6. That waits on that proposed addons
  list."** Points 1–4 = `filename`+`header`, `mode` in the answer, field-per-lane `query`, `limit` optional
  with `total` as truth and `offset` for paging; point 5 = the semantic lane enters the door now, as a
  ranking; point 6 = the deferral, opened as **T37**. **The contract itself is Muninn `adr-37.md`; the shape
  is not restated here.**
- **The add-ons list is Dan's act:** "6. is part of the Dataview idea, which just needs to go into a list of
  proposed addons to be looked at much, much later."

**The contract itself lives in Muninn `adr-37.md` (Accepted)** and is not restated here. **T15 closes; T13 is
the loop's only remaining gate.** The docket's measured add-ons row is **T37**. **No implementation is
authorized by this act**: no `api.ts` member, no `f27`, no mirror, no `main.js`, no version, no tag, no
release.

**Two acts on Dan's authorization the same day, not rulings:** `package.json` gains the `fixtures` chain
(`f01`–`f26` in order, appended with no gaps), mirroring Huginn's precedent at `package.json:11`, so
`npm run fixtures` is the canonical run-all in both repos; and `.gitignore` gains the `AGENTS.md` /
`docs/AGENTS/` paths in both repos, so the untracked agent files leave `git status --porcelain`. The
fixture-script act closed a false receipt: a pass record cited `npm run fixtures` in Muninn where **no such
script existed** (`npm` answered `Missing script: "fixtures"`), and `FIXTURES LOOP DONE` is a **label for the
loop finishing with exit 0**, not literal stdout — the loop's literal output is the 26 `[F0n] VERDICT: GREEN`
lines. Records now name what is reproducible: `EXIT:0` + `26 VERDICT: GREEN` (Muninn), `EXIT:0` +
**30 `VERDICT: GREEN`** (Huginn). Commit and push for this pass are Dan's authorized act, batched as **one
commit per repo**.

## Addendum, 2026-11-20 — Dan's ruling on **T13**, verbatim in intent

Dan ruled (2026-11-20), after identifying that his three earlier rulings on T13 had been given to a model
that misrecorded them: the fixture-numbering difficulty was **a misunderstanding by the agents involved** —
the two projects' fixture chains have always been **independent** (Muninn `f01..f26`, Huginn `f01..f30`,
each its own `package.json` `fixtures` script [R]); merged documentation treated them as one shared
sequence, manufacturing the "collision" recorded in this row and in Huginn `adr-30.md`'s ledger entry.
Reconciliation: *"we need to just reconcile the fact that the numbering is separate. And include
designation in the documentation for the source of the fixture number being referenced."*

**Ruled and in force from this pass forward:**
- **The designation convention:** every fixture number cited in prose, docs, or ADR text carries its
  project prefix — **`M-fNN`** (Muninn) or **`H-fNN`** (Huginn). Bare `fNN` citations are conformed as
  the documents citing them are touched; history stays history.
- **Release slotting (confirmed):** the Memory Feedback Loop's ranking fixtures **follow the op loop's
  H-f31–H-f36 and start at H-f37** — f37 as the first newly-authored Huginn number after the loop reserves
  f31–f36.

**T13 closes.** The op loop's gate list is empty: what remains before any code is Dan's **authorization to
implement the door** (the ruled `adr-37.md` contract authorizes no code by itself). No code, fixture,
version, tag, or release is touched by this act — docs-only conform, one commit per repo.

## Addendum, 2026-11-20 (second) — the calibration rulings

Six rulings (2026-11-20): **(1)** M-f27's red (Gyro-S) and the Stage 2 green (Coder) are **ACCEPTED as the
real Stage 1/Stage 2 acts** — the sixth door exists, committed below; **(2)** ADR-28's wording conforms to
the six-door precedent ("I agree" — see **T40**, closed); **(3)** Coder's M-2 terminal receipts verified by
the examiner's independent re-run (S1 RED, exit 1, typecheck 0) after the file paste was feared lost;
**(4)** the S-1 audit findings enter the docket as **T38** (`[R]` shelf-life), **T39** (docket
self-citation inflation); **(5)** test-design debts acknowledged (examiner sheet placement, S-3 brief
conflation) — the calibration record lives in **the vault** (`Agents/Huginn/CALIBRATION/`), not the repo:
model-audition records are agent memory, not project law, per Dan's ruling of 2026-11-20; **(6)** chain numbering stands: M-f27
occupied by the accepted red; Huginn's loop begins H-f31; Memory Loop at H-f37+ (T13's ruling, unchanged).
**Test detritus removed same day:** the six S/M-Task briefs, the examiner sheet, `freemem.md` deleted; the
calibration record persists in `docs/`. M-2's Huginn red (`check-task.ts`, design A, verified S1 RED at
HEAD) is deleted per its reset clause — its assertions carry into H-f31. One commit per repo.

## Addendum, 2026-11-20 (third) — the merged-release doctrine, the increment shape, T12 roped in

Three rulings (2026-11-20):

1. **Release doctrine amended.** Stages 3+4 are merged: one release pair — Muninn carrying the sixth door
   (its M-f28 browse mode if it lands in time), Huginn carrying the mirror **and H-f31's executed slice**
   (envelope parses all four ops; `list` and `respond` execute; `write` refused at the envelope with its
   machine-readable string; `read` at Dan's discretion) — tested by one manual smoke whose observables are
   **browse lists what the index holds** and **chat answers a list-shaped query through door→mirror→op**.
   The remaining loop (serial writes, expiry, Stop-between-ops, the bound, the full Stage 11 driver, the
   T20 scenario redefinitions, Design A's retry) still lands as the Stage 13 merged release with one
   smoke. ADR-34's staging and the 11-15 no-piggybacking line are amended by reference; ADR bodies stay
   immutable. Dan's attribution note: the original staging was accumulated agent pressure, not Dan's
   choice; this amendment is Dan's choice.
2. **Increment shape agreed** (Lumo's recommendation, Dan approved): as in (1) — envelope-complete,
   `list`+`respond` execute, `write` refused, `read` optional at Dan's one-sentence discretion.
3. **T12 roped in:** Design A's retry implementation lands **inside this release pair**, not deferred to
   Stage 13: the retry loop lives in `harness.ts` (SCHEMA_RETRY_LIMIT = 1, feedback run-local, never
   corrections, infra nulls consume nothing, Stop parity inside the retry window, terminal shape
   unchanged), and its red asserts the ruled shape at Huginn HEAD before the loop exists. T11's "next
   release" is clarified: T11 rides **Stage 13**, not this pair.
