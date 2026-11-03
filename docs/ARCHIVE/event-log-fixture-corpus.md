---
source:
status: living document
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
modified: 
---
---
# Vault Overseer — Event Log Fixture Corpus v0.1 (rev. 2026-11-01)

> [!abstract] Purpose Hostile fixtures proving the Event Log Schema v0.2 spine survives its own failure modes. Scenario fixtures (stateful, scripted corruption) — distinct from the chunker's property tests. Lives in the test vault at `~/Documents/Test Vault/_fixtures/log/`. Companion to Event Log Schema v0.2, Project Definition File, and Chunker Spec v0.1.

## Corpus design rules

1. **Fixtures run against the log module's public API only** — `appendEvent()`, `mergeScan()`, `startupChecks()`, `dispose()`. No test reaches into internals; if a test needs an internal, the internal is really a public.
2. **Corruption is injected at the file level** (hand-crafted shards on disk), never by mocking internals mid-flight. The log must survive hostile _files_, not hostile _method calls_.
3. **Every fixture asserts the `log.integrity` contract** where applicable: integrity actions are logged, loud, and named — silence is disqualifying (R5).
4. **Deterministic seeds.** Random generators seeded per-fixture; a fixture that fails intermittently is a fixture that hasn't diagnosed itself.
5. **Fast/slow split.** F01–F03, F06–F11 are fast (pure Node, no vault dependency, run on every commit). F04–F05 are slower harness tests (run pre-release / on-demand). Keeping the tight loop tight matters more than total coverage numbers.

> [!note] Revision 2026-10-24 — rule 5 scope note F05 has split (see F05a/F05b below): **F05a is fast** (pure-module gate semantics, virtual clock, no vault dependency) and joined the tight loop; F05b remains slow/harness, blocked on the embedder and batch queue. Rule 5's intent — protect the tight loop — is honored, with the split as the mechanism.

## Harness prerequisites

A tiny `FakeAdapter implements DataAdapter` (`read`, `write`, `append`, `mkdir`, `exists`) over a temp directory, plus a `spawnContext(origin)` helper returning an isolated `EventLog` instance with its own settings, simulating one device. Two contexts pointed at the same directory = a converged vault. No mocks of the log's own code, ever.

> [!note] Revision 2026-10-24 — a second harness idiom exists The dwell-gate fixtures (F09, F05a) do not use `spawnContext` at all: their subject is `src/dwell/gate.ts`, a pure module with injected clock/timer, driven directly with a virtual clock and a manual timer queue. Two idioms, two subjects: `spawnContext` for the spine, direct-drive for extracted gate semantics. Both obey rules 1–4 (public API only, no internal mocks, deterministic).

---

## F01 — Torn tail line

**Threat:** process death mid-`append()`; fsync lies; power loss on Latitude.

**Setup:** craft `mokka.jsonl` with 50 valid events, then append the first 140 bytes of a would-be 51st event (no trailing newline, mid-UTF-8 **mandatory** — tear inside a multi-byte character, e.g. ending mid-CJK or emoji, not just mid-ASCII).

**Procedure:** `startupChecks()` → `mergeScan()` on the damaged shard.

**Pass requires:**

- Reader consumes events 1–50 cleanly
- Partial line 51 discarded **and reported**: a `log.integrity` event lands with detail naming origin, offending byte length, and recovered-through seq
- Recovery is non-destructive: the torn bytes stay on disk untouched — no truncation, no rewrite
- The _next_ `appendEvent()` succeeds — writes resume from seq 51 without complaint, seq contiguity intact

**Fail smells:** silent truncation of the tail; startup refuses to boot; append forever blocked.

> [!note] Revision 2026-10-24 — parked boundary variant (registered, not scheduled) A known unbitten lane: **Tier-2-first flush after torn-tail boot**. F01 exercises torn-tail burial via a Tier-1 write-through; a boot on a torn shard whose _first_ write is a Tier-2 buffer flush would exercise `flushLocked()`'s torn-tail handling directly rather than relying on `startWriter`'s Tier-1 beacon landing first (defense by ordering, not structure). Candidate for the next F01-family variant. Not a red against current behavior — an untested path.

> [!note] Revision 2026-11-01 — regression re-receipt F01 re-run green after `reader.ts`'s `parseLine` was ported from `Buffer` to `TextDecoder` (2026-11-01, Obsidian-mobile compatibility; see F15's status ledger). The reader swap is behavior-neutral for the desktop corpus — receipted, not assumed.

---

## F02 — Sequence gap

**Threat:** dropped sync line; truncated transfer; hand-edited shard.

**Setup:** 100 valid events; delete line 57 (and separately, test variant: delete lines 57–60).

**Procedure:** `mergeScan()` with gap-halting enabled (projection mode).

**Pass requires:**

- Scan yields events 1–56 and stops
- Report names `(origin: mokka, expected_seq: 57, got_seq: 58)` — precise, actionable, greppable
- `log.integrity` emitted naming the gap bounds
- **Never skips, never pads, never fabricates** — the missing event is a hole in the record, and the record admits it
- **Repair is refusal, not reconstruction.** On a gapped spine the repair path (`--repair` equivalent) refuses with disclosure: it emits `log.integrity` naming the gap, fabricates nothing, and leaves the hole intact — the hole survives the attempt. Re-deriving tier-2 lines from mtime+sha is **F03's regime** (a provably lost buffer window), not F02's: a gap is a hole in the record, and no rescan can know what belonged in it. F02 tests that the spine admits ignorance; F03 tests that it recovers what it provably lost.

**Fail smells:** "best effort" scan continuing past the gap; gap healed invisibly with no trace; repair path fabricating filler lines to close the gap.

**Status (2026-10-24):** clause 5's repair-refusal path is live in `f02.ts` (flipped 2026-10-21, calling `healScan` directly) and green. Verified green in the 2026-10-24 full-suite baseline. **Re-receipted green 2026-11-01** post-`TextDecoder` port (F15 status ledger).

---

## F03 — Mid-flush crash with live buffer

**Threat:** Tier-2 buffer part-full at process death — the case the two-tier design _predicts_, so it must be tested harder than the unpredictable ones.

**Setup:** `spawnContext('mokka')`; append 40 Tier-2 events (buffer threshold: 64) + 3 Tier-1 events; **kill without `dispose()`** — no farewell flush. Simulate by abandoning the instance (the harness owns the fs; torn-write injection not needed here — we want the _clean_ crash case first, dirty crash is F01's job).

**Procedure:** fresh `spawnContext('mokka')` on same directory; `startupChecks()`; heal scan.

**Pass requires:**

- The 3 Tier-1 events are present in the shard — **facts survived, full stop**
- The 40 Tier-2 events are absent, and that absence is _known_: heal scan detects mtime/`content_sha` of the affected file vs. last indexed seq and schedules re-index
- Heal scan logs itself (`log.integrity`, detail: "buffer window lost, N events re-derived from sha")
- Recovery costs one rescan, zero lost facts, zero duplicate `chunk.indexed` events after healing (idempotent re-derivation — the `vh` collision with the lost lines must not double-emit)
- **Re-derived `chunk.indexed` events must satisfy P1 (offsets-reproduce-text) against present-day file content** — the chunker spec's killer invariant policed at recovery, not just at creation

**Fail smells:** re-derivation emitting duplicates; heal scan silent; any Tier-1 loss; re-derived offsets failing to reproduce their text.

**Status (2026-10-27):** migration debt closed 2026-10-26 (F03 rev C rev D rev D reseed), stub deleted 2026-10-27 (Phase 4). Heal now re-derives via `chunkNote` (cp: 2) on all live paths; foreign cp (≠2) loudly skipped with disclosure; within-pass vh dedup verified (scenario twin-vh, 2026-10-26 errata). Fresh-shard recertification (Phase 3) verified cp:2 uniformity, idempotent boot-2 growth noise-level. No mixed-cp shards exist or will exist. **Re-receipted green 2026-11-01** post-`TextDecoder` port (F15 status ledger).


---

## F04 — Simultaneous indexing during sync convergence

**Threat:** the scenario no incumbent survived — both machines appending while shards travel. Run first among the slow suite; it exercises shards, write-through, and merge in one pass.

**Setup:** two `spawnContext`s, `mokka` and `latitude`, same directory (pre-convergence). Each indexes a _disjoint_ set of ~20 new notes: Mokka gets `projects-*.md`, Latitude gets `journal-*.md`, with deliberate overlap in _content_ — 5 paragraphs shared between both machines' notes (dedupe bait: same `vh` should appear from both origins).

**Procedure:** Phase A: both contexts index concurrently (interleaved by the harness's scheduler, seeded). Phase B: "convergence" — simulate by both contexts mounting the full two-shard directory; run `mergeScan()` from each perspective.

**Pass requires:**

- Neither shard ever carries a foreign `origin` value — each context appended only to its own file
- Merge-scan from both perspectives yields the **identical total event multiset** (order may differ by `(origin, seq)` grouping; events must not)
- All Tier-1 facts from both machines present exactly once
- Shared-`vh` paragraphs produce two `chunk.indexed` events (different paths, same `vh`) but the projection's embed plan dedupes them to one vector fetch
- No seq collisions within a shard; no cross-shard seq assumptions (Mokka's seq 42 and Latitude's seq 42 coexist without complaint)
- Both contexts' sequence counters continued monotonically across convergence
- **Shared `vh` values are byte-identical across origins** — cross-machine determinism of `renderEmbedInput` proven here, not just assumed from the chunker's P3 (this is the integration point where the two designs meet; the fixture asserts what the property test implies)

**Fail smells:** any write to the wrong shard; merge-scan results differing by perspective; seq treated as globally unique; `vh` byte mismatch for identical content across origins.

---

## F05 — Rename handling (split 2026-10-24)

Split by dependency: the gate-side semantics are testable now; the embed race is not. **F05a is the former, F05b the latter.**

### F05a — Rename wiring: gate semantics and spine facts

**Threat:** path staleness. Emissions and farewells naming dead paths; uncorrectable placeholder emissions (`Notes/Untitled.md` recorded permanently with no rename record to resolve it); folder renames mass-invalidating storage addresses with the gate unaware.

**Scope ruling (2026-10-24):** the fixture bites the **extracted gate's rename lanes** (`renamePath`, `renamePrefix` in `src/dwell/gate.ts`) — pure-module, virtual clock, no vault dependency. The spine half — `note.renamed` landing on the log via `main.ts` — is adapter wiring and earns its proof by **live receipt** (rename a note in the test vault, read the shard tail), the same way the session beacon does.

**Procedure:** drive the gate through the Untitled lifecycle, renames at every phase (open, banked, post-emission), foreign renames, and folder-rename prefix rewrites.

**Pass requires:**

- **R1** Rename while open, pre-threshold: crossing emission names the NEW path — the common Untitled case dies at the source
- **R2** Rename while banked: return visit crosses under the new path; farewell names the new path
- **R3** Foreign rename (no known lane): harmless no-op
- **R4** History preservation: recorded emissions keep their old paths FOREVER — the gate never rewrites history; `note.renamed` on the spine carries the chain and the projection resolves it
- **R5** Untitled lifecycle, both portraits: rename-before-crossing emits the real title (wart avoided); crossing-before-rename records the placeholder — the **declared correctable** case — and the farewell still names the new path
- **R6** Folder rename prefix rewrite: paths under the renamed prefix follow; sibling prefixes (`Area` vs `Area 2`) untouched; chained prefixes (A→B→C) compose

**Status (2026-10-24: SHIPPED, CERTIFIED.)** `f05a.ts`: 26 checks, 6 scenario groups, ALL GREEN. **First contact drew two legitimate reds** — fixture arithmetic, not gate semantics (a single oversized `fastForward` hop consumed the crossing and post-emission dwell in one clock advance; fixed by splitting the hop). The reds satisfy this corpus's own hostility clause. Spine tier note: `note.renamed` is **Tier-1 write-through** (verified against `TIER2_TYPES` 2026-10-24: `note.opened`, `chunk.indexed`, `chunk.evicted` only) — a lost rename poisons every downstream path resolution.

**Fail smells:** emissions naming dead paths; gate re-writing recorded emissions (history-editing); prefix match catching siblings; farewell under a stale prefix.

### F05b — Rename during embed-in-flight

**Threat:** R6's crown jewel — the assertion that rename never re-embeds. If this fixture passes, R6 is proven, not promised.

**Blocked on:** the embedder, batch queue, and `embed.batch` — none exist yet (indexer Phase 3). Transcribing `embed.batch` before its fixture-loaded consumer would violate the transcription doctrine. **Deferred, not weakened** — the pass requirements below stand as written.

**Setup:** context indexes `Projects/alpha.md` (4 chunks), embedding completes. Then: schedule a rename to `Projects/beta.md` _while a re-embed batch for `alpha.md` is queued_ — harness forces the race: rename event emitted after embed dispatch begins but before `embed.batch` resolves.

**Procedure:** let the race resolve; run `mergeScan()`; inspect subsequent embed plan for `beta.md`.

**Pass requires:**

- `note.renamed` with `from: Projects/alpha.md, to: Projects/beta.md`, and nothing else — no re-chunk, no re-embed events for unchanged content
- Post-rename `content_sha` check passes (sha identical, `vh`s path-independent — chunks carry over untouched)
- The in-flight embed result lands against `beta.md` — the queue is path-remapped, not discarded (discarding wastes work; remapping preserves it)
- If the harness contrives sha-drift (rename actually changed content mid-flight — the adversarial variant), a _targeted_ re-embed of only drifted chunks fires — never full-note re-embed
- Total embed calls for the whole fixture: exactly one batch (the original), zero additional after the rename

**Fail smells:** full re-embed after rename — that's vector-search's crime, and this fixture exists specifically to prevent us committing it by accident.

---

## F06 — Sync conflict copy

**Threat:** Obsidian Sync's silent conflict resolution — the event class exists to make the quiet loud.

**Setup:** `Projects/plan.md` indexed; craft `Projects/plan conflicted copy 2026-10-20.md` on disk with diverged content.

**Procedure:** file watcher picks it up; `mergeScan()`.

**Pass requires:**

- `note.conflicted` fires with `actor: sync`, both paths in payload
- Conflict copy indexed like any other note — separate `content_sha`, separate chunks (it _is_ a real file; pretending it isn't is the incumbent's disease)
- The two notes' differing `content_sha`s are both live in the projection — user decides survivorship, the plugin records the fork
- Extension edge cases pass: non-md conflict copies ignored gracefully; nested conflict-copy-of-conflict-copy indexed without recursion panic

---

## F07 — Foreign-origin guard (parked)

Shard whose last line's origin mismatches local id ⇒ loud startup rejection, no append.

> [!note] Status nuance (2026-10-24): the guard itself is live in `reader.ts`/`main.ts` (startup rejects, writer dark) and has a code-level witness; the formal _fixture_ remains parked. Promote when next touching the corpus.

---

## F08 — No-op modification dedup (SHIPPED, CERTIFIED 2026-10-28)

Same sha + mtime ⇒ zero events, zero seq consumed. Must prove the seq counter _doesn't_ advance — off-by-one here poisons everything downstream. Fixture authored from contract text (not code behavior) after the planner's design contract was ratified: state basis (spine read at flush), mtime rule (either field differing ⇒ emit), cancel-on-delete/rename, gap-refusal, and coalescing rules were all ruled before F08 was written.

Fixture idiom: direct-drive the planner lane (F05a/F09 pure-module style). Spy harness records appendEvent calls; zero calls proves zero seq consumed. Shard bytes compared before/after no-op flush as the disk-side witness.

**First-contact reds earned** — not contrived:
  - `mergeScan` required `listDir` on ByteSource (declaration #1 disproven by receipt; fixed by pasting reader.ts)
  - S10 leaked S9's gap spine (spine-bleed drafting defect; fixed by rewriting clean spine at S10 start)

**Status (2026-10-28: SHIPPED, CERTIFIED.)** `f08.ts`: 25 checks across 11 scenarios, ALL GREEN. Verified against contract text, not observed behavior. Sequencing-ruling precedent for future-new-subsystems: design contract → rulings → implementation → fixture-from-contract-text.

**Deferred (not silently dropped):** real-writer continuity probe (appending through live EventLog, shard-tail seq+1 verification) pending test-harness contract paste; overflow disclosure; stat/sha mid-coalescing disagreement.

**Fail smells:** any seq advancement on no-op; silence on unwired routing hooks; retain pending across gap refusal; silent drop of pre-arm observations.



---

## F09 — Dwell gate (PROMOTED 2026-10-24)

**Promoted from the parked list, with a semantics correction:** the parked entry read "note open at session end emits with dwell-so-far; dwell below 10s gate emits nothing." The first clause was superseded by the ratified v1 semantics — farewell returns **over-gate post-emission accruals only**. The promotion transcribes the ratified law, not the parked sketch.

**Threat:** a noisy spine. Ungated opens flood the log with swipe-throughs; the dwell signal drowns. Also: the accumulated-collision wart — successive `Untitled.md` creations inheriting a dead predecessor's banked dwell via path-keyed accrual (live-observed 2026-10-23, seq-11-gap session).

**Subject:** the extracted dwell gate (`src/dwell/gate.ts`) — pure module, injected clock and timer, emit via callback. v1 semantics per schema (ratified 2026-10-23; extraction ratified 2026-10-24).

**Pass requires:**

- **S1** Threshold-only: gate fires at 10s accrued; emission carries dwell = 10 FLAT; overshoot still one emission; 9.999s stays silent
- **S2** Accumulation across openings: 8s banked + return visit arms for the remaining 2s; combined 10s fires one event, flat 10; 9s combined stays silent
- **S3** One event per crossing, no re-arm: post-emission dwelling emits NOTHING further; the banked post-emission dwell surfaces as farewell only
- **S4** Farewell: over-gate post-emission accruals returned with actual dwell (floor seconds) and last-known path; under-gate discarded silently; second `sessionEnd()` returns nothing; multiple lanes resolve independently
- **S5** Collision fix: accrual keyed by opaque noteId — a fresh note at a reused path (`Untitled.md` twice) inherits NOTHING; the newcomer crosses on its own dwell; same-note reopen still accumulates (the fix narrows the blast radius, not the feature)

**Status (2026-10-24: SHIPPED, CERTIFIED.)** `f09.ts`: 32 checks, 5 scenarios, ALL GREEN. Live witnesses concur: `Desktop.jsonl` seq 13 (dwell 52 — exactly the post-emission remainder) and seq 24 (dwell 25 — same arithmetic through the extracted module).

**Fail smells:** re-arming timers after a crossing; farewell measuring from the open instead of the last emission; path-keyed accrual leaking between note identities; under-gate farewells emitting.

**Declared boundary:** placeholder-path emissions (crossing before the title is typed) remain **correctable-not-prevented** — v1 behavior, resolved by the projection over `note.renamed` chains. F05a's R5b asserts this exact behavior.

---

## F10 — `write.reverted` replay (parked)

Revert of an auto-applied write restores `before` exactly, event-by-ref. Blocked on Plugin 2.

---

## F11 — Checkpoint verification

**Threat:** checkpoint chain integrity; coverage invariants; falsified-ledger attacks; tail-drop losses.

**Setup:** multiple scenarios testing shutdown checkpoints, threshold auto-checkpoints, tamper under checkpoint, truncation under checkpoint, and coverage-violation (falsified last_seq field).

**Scenarios:**

1. **shutdown** — append 3 events, dispose → checkpoint present, chain verifies end-to-end
2. **threshold** — cross checkpointInterval mid-stream → auto-checkpoint emitted, chain verifies across checkpoint boundaries
3. **tamper** — mutate a covered line's bytes → digest mismatch, verification fails loudly
4. **truncation** — delete a covered line → digest mismatch, chain witnesses the hole
5. **coverage** — falsify checkpoint's last_seq field only → digest still matches chain, but positional witness catches the lie (vanished lines)

**Pass requires:**

- Shutdown checkpoint emitted on dispose() when events were appended
- Threshold auto-checkpoint emitted when interval crossed (configurable via settings)
- Coverage invariant: checkpoint's last_seq equals preceding data max seq (not overall shard max)
- Tamper under surviving checkpoint fails verification with digest-mismatch detail
- Truncation of covered line fails verification with digest-mismatch detail
- Falsified last_seq field (carried digest intact) fails verification with coverage-violation detail
- Honest limitation documented: tail drop consuming checkpoint line itself has no single-file witness; that detection is cross-machine territory (schema clause 3: received-vs-sent)

**Fail smells:** checkpoint missing; chain verifies despite tamper; coverage violation silent; falsified last_seq accepted; no distinction between digest failure and positional failure.

---

## F11-deepening — Hostile encore (PROMOTED 2026-10-24)

**Was parked as "hostile encore owed per doctrine; corpus passed first contact." Shipped since and green:** torn-tail checkpoint, interleaved Tier-2 buffers across threshold, intermediate chain segments asserted independently. `f11-deepening.ts` runs in the tight loop; verified green in the 2026-10-24 full-suite baseline (alongside csuite's C01–C06 and the property corpus). The encore is owed no more — it is paid.


---

## F12 — Watcher file-fact producers (note.created/deleted)
  Threat: doubled emissions, path-fused facts (the F09 Untitled
    lesson inverted), seq consumption on silent paths (the F08
    poison), stat drift between observation and flush, tier-of-loss
    on dark boot, and Tier-1 facts lost while the writer is dark
    (identity-uncertified boot, foreign-origin guard). Plus: the
    installation black hole — a fresh origin whose spine names no
    paths, so the heal projection examines nothing and the vault
    is invisible.
  Setup: spawnContext('mokka') over the FakeAdapter; a
    WatcherLane (src/watcher/watch.ts) fed synthetic FileLike
    events; writer attached mid-session to exercise dark-boot
    buffering.
  Procedure: drive every scenario group; assert disk lines, payload
    parity, key order, seq accounting, and silence contracts.
  Pass requires:
    - TFile md create ⇒ exactly one note.created, actor 'user',
      Tier-1 write-through (line on disk after the await, pending 0).
    - Folder create/delete ⇒ ZERO events, ZERO seq consumed.
    - Non-md create ⇒ ZERO events, ZERO seq consumed.
    - Extension matching case-insensitive in the lane: ext 'MD' IS
      a note and emits.
    - Untitled lifecycle: create→delete→create same path ⇒ THREE
      facts (two created, one deleted with the FIRST creation's sha
      as its tombstone) — facts never fused by path.
    - Causal order on disk: events in emission order, seq contiguous.
    - Dark boot: facts observed while the writer is dark are
      captured with stats AT OBSERVATION TIME and flushed in order
      on attach.
    - Arming: flushAfterAttach() discloses overflow, drains AND
      arms; post-attach facts append directly.
    - Dark-buffer overflow (cap 2): third create while dark drops
      the OLDEST, survivors flush in order, overflow disclosed
      through reportIntegrity — never a silent loss.
    - Unknown-path delete: path-only tombstone, no fabricated sha.
    - Storm: 50 rapid creates ⇒ 50 events, contiguous seq, no loss,
      no coalescing.
    - Sync-arrival attribution: actor 'user' (DECLARED v1 limitation,
      registered roadmap debt — asserted so the limitation is at
      least uniform, never intermittent).
    - Reconcile (rev C): fresh spine ⇒ every vault path emitted
      with real stat/sha and its tombstone populated; second run ⇒
      ZERO; partial spine ⇒ exactly the gaps; unarmed lane ⇒
      refusal (-1) with ZERO buffer growth; create→delete→reconcile
      ⇒ a third fact (no hidden ever-seen dedup).
  Fail smells: create firing twice for one file; path-keyed dedup
    fusing distinct creations; seq advancing on silent paths;
    note.* landing in the Tier-2 buffer; stats computed at flush
    time; dark-boot facts vanishing without disclosure; empty-array
    checks passing vacuously; tombstones fabricating shas for
    unobserved paths; overflow dropping NEWEST instead of OLDEST;
    reconcile re-emitting known paths (per-reload cost); reconcile
    running dark and truncating the inventory through the cap.
  Fixture: src/fixtures/f12.ts (shipped 2026-10-25, green 2026-10-29)
  Status: ✅ CERTIFIED (2026-10-29) — fixture green, corpus entry live.



---

## F13 — Subscriber seam (live tap on serialized queue)
  Threat: subscriber errors propagating to the writer, subscribers
    receiving events before disk persistence (violating "notification
    latency == persistence latency"), and no attribution for
    subscriber failures in integrity reports.
  Setup: EventLog with subscribe() hook; fake adapter; multiple
    subscribers registered simultaneously.
  Procedure: drive the subscriber seam contract scenarios (S1–S5).
  Pass requires:
    - S1: Single subscriber receives all event categories (Tier-1,
      Tier-2, checkpoint); notification fires AFTER disk append.
    - S2: Multiple subscribers receive in FIFO registration order.
    - S3: Unsubscription stops delivery; others unaffected.
    - S4: Subscriber throw logs `log.integrity` with subscriber name;
      writer continues (no propagation).
    - S5: Tier-2 notifications fire only after flush (idle timeout
      + hard-cap variants); no premature notification.
  Fail smells: subscriber throws crashing the writer; Tier-2
    notifications before flush; out-of-order delivery; integrity
    reports without subscriber names; unsubscribe failing silently.
Fixture: src/fixtures/f13.ts (shipped 2026-10-29, green 2026-10-29, 30 checks, 5 scenarios — one legitimate first-contact red: S3 fixture arithmetic, fixed same session) 
Status: ✅ CERTIFIED — seam live. Hazard ruling CLOSED 2026-10-29 (same session, post-fixture): subscriber throws on integrity events are console-visible but never re-enter fanout — the shard cannot self-amplify (Architecture Map v0.4, subscriber-throw hazard row).


---
## F14 — folder.renamed transcription (mass-invalidation, one event not N children)
  Threat: a folder rename silently invalidates every storage address beneath it. Stock Obsidian emits one 'rename' for the folder with no child events; links are maintained (Obsidian's province), child paths are not. The spine must record the fact as ONE Tier-1 write-through event — payload {from, to} mirroring note.renamed — and the systemic gap closes with it: a pending planner modify under the renamed folder previously survived the rename and flushed against a stale address. Also in range: the boundary trap (prefix 'Projects/A' must never capture 'Projects/A 2/x'), history rewriting (dead-path tombstones must keep their death address), and the emission window (cancelPrefix must fire BEFORE the emission, so no folder.renamed line ever coexists on the spine with a stale-addressed pending observation). The spine-side sibling of F05a's R6 gate-prefix family.
  Setup: EventLog over the fake adapter for the spine assertions; planner rev B (cancelPrefix) driven with fake deps; projection fold via projectPaths() over synthetic spines. The fixture drives the pure modules and the ruled orderings by hand — main.ts's real TFolder handler is NOT exercised (ledgered below).
  Procedure: drive scenario groups R1–R5; assert disk lines, payload shape and key order, seq accounting, cancelled counts, and the silence contracts (zero child events, no integrity chatter on a clean rename).
  Pass requires:
    - R1: One folder rename ⇒ exactly ONE folder.renamed on the spine, payload {from, to}, Tier-1 write-through — line on disk after the await, seq contiguous, ZERO child events.
    - R2: Disk-at-callback — persistence-latency witness: when the append resolves, the line is readable from disk.
    - R3: Planner cancelPrefix — every pending key under from/ dies; boundary discipline prefix + '/' (Projects/A does NOT capture Projects/A 2/x); returns the cancelled count; stands the window down when the map empties; ordering witness — cancelPrefix fires BEFORE the emission.
    - R4: Projection fold — live paths under from/ re-address wholesale to to/; dead-path tombstones KEEP their death address (history never rewritten); boundary mirrors gate.renamePrefix; destination normalized of trailing slashes.
    - R5: Chained renames compose (A→B, B→C).
  Fail smells: N child events for one folder rename; prefix match catching siblings (Area vs Area 2); tombstones re-addressed (history editing); a pending modify flushing against a stale address after the rename; cancelPrefix running after the emission; any re-chunk or re-embed triggered by a folder rename (vh is path-independent — chunks carry over untouched, by construction).
  Ledgered coverage gaps (declared, not hidden):
    - HOUSE-ORDER INVERSION: implementation preceded the fixture — the reverse of doctrine. First contact therefore tested contract-vs-implementation agreement, not earned red. The corpus's hostility clause (definition of done: at least one initially-red fixture) is UNSATISFIED for this entry; the debt is named, not denied. Recorded in the fixture header ledger.
    - ADAPTER-INTEGRATION COVERAGE OWED: the fixture does not exercise main.ts's real handler — R3 drives makePlanner with fake deps and reproduces the ruled cancel-before-emit ordering by hand. The ordering is verified in the fixture but has NOT been witnessed live.
  Ratified rulings carried (Dan, 2026-10-30):
    - cancelPrefix fires BEFORE the emission — pending state dies before the fact lands; no window where the spine holds a folder.renamed line while a stale-addressed observation still sits pending.
    - The prefix-fold lives inside projectPaths()'s ordered fold, not in the subscriber callback — one implementation serving cold replay and the future incremental subscriber (renderEmbedInput precedent; splitting them recreates the two-drifting-copies defect).
    - Dead-path tombstones keep their death address; the live set moves wholesale, the autopsy record stays where the deaths happened.
    - cancelPrefix(from) returns the cancelled count — deliberately unconsumed in main.ts (quiet on the spine; the cancelling event IS the record); the count serves fixtures and receipts.
Fixture: src/fixtures/f14.ts (authored 2026-10-30, green 2026-10-30 — 5 scenarios, 20 checks, ALL GREEN; f14 registered in the fleet runner same day; FLEET GREEN all 13 suites).
Status: ✅ CERTIFIED (2026-10-30) — fixture green, fleet green, transcription doctrine satisfied (first new event type transcribed against its fixture-loaded consumer, the F13 subscriber seam). Live receipt, test-vault spine origin Desktop: seq 4820 folder.renamed Notes/Untitled → Notes/New subfolder and seq 4822 Notes/New subfolder → Notes/New subfolder name 2 — chained renames, one O(1) line each, no child explosion; riding along note.renamed × 3 (4814/4815/4817), note.created (4818), note.opened dwell 10 (4819). House-order inversion and the adapter-integration witness remain ledgered above.

---
## F15 — FTS5 projection + search UI (the first user-visible capability)

  Threat: the index serving stale truth. An index that answers a query
    with a deleted note's text, misses a live note, or silently serves
    a snapshot older than the spine has failed at its only job — the
    incumbent disease (vector-search's permanent holes, no incumbent's
    machine-switch survival). Also in range: a staleness probe that
    re-reads the whole spine (self-defeating), rebuild-after-folder-
    rename-folds (the novel hostile content), subscriber notification
    ordering, gap fabrication, and the first-build spike masquerading
    as a defect. The customer contract: desktop PCs build and maintain
    the index (Ollama present or not — this lane never touches the
    network); mobile devices read and search the same spine with zero
    native dependencies (Option A, ruled 2026-10-31).
  Setup: pure FTS projection module (src/fts/) with injected deps
    (adapter, scheduler, sqlite handle factory) driven directly —
    F05a/F09/F14 pure-module idiom. The seam consumer subscribes via
    EventLog.subscribe() with a synchronous callback that enqueues into
    its own serialized work lane (corpus rule 1: public API only; the
    subscriber callback is sync, storage is async — the lane owns the
    decoupling). SQLite operations exercised through the real
    better-sqlite3 handle in Node; Obsidian UI (sidebar pane) is
    adapter territory, live-receipt owed, not fixture territory.
  Procedure: drive scenario groups S1–S7 (desktop FTS lane) and M1–M3
    (mobile read lane); assert DB state via SQL queries, disclosure
    lines on the spine, probe behavior, and the citation invariant.
  Pass requires (desktop lane):
    - S1 STALENESS PROBE: per-shard (origin, last_seq, byte_length)
      recorded in the DB's shard_probe table at last build (as-built;
      this entry's draft wording said "meta table" — corrected in rev.
      2026-11-01, see deviations ledger below); probe issues
      adapter.stat() per shard — ZERO file reads, ZERO mergeScans;
      all sizes equal ⇒ SERVE, no rebuild work, zero spine events;
      any shard grown ⇒ dirty ⇒ full rebuild. Probe must not itself
      read the spine (the classic self-defeating-staleness trap).
    - S2 REBUILD TRUTH SOURCE: content derives from PRESENT-DAY disk
      bytes via chunkNote() (fresh derivation, NOT the spine's
      chunk.indexed stream — the chunk stream is embeddings-lane
      fuel; spine chunk records are never re-addressed by any fold
      and are therefore unfit as an index content source). Addressing
      resolves through projectPaths() — one implementation, no third
      drifting copy. A renamed-then-modified note indexes under its
      final address with its final bytes. A tombstoned path is ABSENT
      from the index. A resurrected path (deleted then re-created)
      is PRESENT.
    - S3 FOLDER-RENAME FOLD: after a spine containing folder.renamed
      chains (including A→B→C and the Area/A 2 boundary trap), the
      rebuilt index serves descendants ONLY under their post-fold
      addresses; pre-fold addresses return nothing. The F14 prefix-
      fold (inside projectPaths()) is the addressing authority — the
      FTS module contains NO re-addressing logic of its own.
    - S4 SEAM-DRIVEN INCREMENT: a subscriber notification (fired
      after disk commit, per the F13 contract) lands in the index
      WITHOUT a rebuild: the work lane processes the event and the
      next query reflects it. The sync subscriber callback never
      awaits storage. A subscriber throw inside the FTS lane is
      contained by the lane (logged, attributed, not propagated —
      and never re-enters fanout; the F13 hazard ruling is honored,
      not re-litigated). Tier-2 events arrive only post-flush.
    - S5 GAP REFUSAL PARITY: a gapped spine ⇒ the projection refuses
      LOUDLY (log.integrity naming the gap) and serves NOTHING from
      the truncated stream — never a partial index presented as
      complete, never fabricated coverage. Same posture as heal and
      reconcile (F03 doctrine).
    - S6 FIRST-BUILD SPIKE: a fresh build over a large vault emits
      exactly ONE aggregated disclosure line to log.integrity
      (counts: paths, chunks, duration) — never per-file chatter.
      The expected shape is the heal-flood analog (§2.5 precedent):
      large first-build spike is DESIGNED BEHAVIOR, and the fixture
      asserts the disclosure, not the panic. A second build with a
      clean probe emits ZERO new spine events (rebuild is per-device
      Zone 2 work; the spine is not polluted by rebuild telemetry
      beyond the one disclosure line per rebuild).
    - S7 CITATION INVARIANT: every search hit carries (path, ord, bs,
      be) and the offsets REPRODUCE the served text from present-day
      disk bytes — file.slice(bs, be) === indexed text. The chunker's
      killer invariant policed at the search boundary, not just at
      creation. A path the spine says is live but whose file is
      absent on disk ⇒ loud skip with disclosure, never a ghost hit.
  Pass requires (mobile read lane — pure JS, zero native deps):
    - M1 NO NATIVE IMPORTS: the mobile read path executes none of
      better-sqlite3, node:crypto, or Buffer — it consumes projectPaths()
      addressing and reads note bytes through the vault adapter,
      searching text directly. (Fixture runs in Node, so this is
      asserted by construction/module boundary: the mobile module's
      import graph contains no native node builtins.)
    - M2 TORN-TAIL SAFE: a shard with a torn tail searches cleanly —
      the spine reader's byte-first line-split discipline is shared
      (reader.ts), not duplicated.
    - M3 LIVE-SET ONLY: the mobile search serves only paths the fold
      says are live AND whose files exist on disk. Tombstones,
      renamed-away paths, and absent files return nothing — no
      exceptions thrown at the searcher.
  Fail smells: serving a deleted note's text; missing a live note; a
    probe that reads the spine (slow staleness check = broken
    staleness check); rebuild emitting per-file integrity lines;
    per-event spine pollution from index internals; a second
    subscriber-copy of the folder-fold; notification before disk
    commit; an await inside the subscriber callback; partial indexes
    served as complete across a gap; ghost hits from absent files;
    any network call in this lane (Ollama-down survival is the
    constraint — nothing here may degrade when Ollama is absent).
  Scope fence (ruled 2026-10-30/31, consolidated):
    - Engine: better-sqlite3 + FTS5 — RATIFIED, not open.
    - Storage: Zone 2 (cache/bm25/), schema version stamped INSIDE the
      DB, not the filename. Disposable, rebuildable at any time.
    - v1 is BM25/text search only. Vectors, kNN, embeddings: NOT
      BUILT (later frontier).
    - Ruling 4 as amended 2026-10-31: chunk text re-chunked from
      present-day bytes via chunkNote() — determinism-equivalent to
      recorded offsets when consistent; the spine's chunk stream is
      not the FTS content source.
    - Mobile shape (Option A, ruled 2026-10-31): desktop builds and
      maintains; mobile reads and searches the same spine with a
      pure-JS reader. Feature parity is explicitly NOT promised to
      mobile in v1 — mobile gets text search, not BM25 ranking.
      Future mobile parity, if pursued, is the WASM lane (option B),
      a separate ruling.
  Declared limitations (loud, not hidden):
    - The Obsidian sidebar-pane UI is NOT exercised by this fixture —
      pure-module idiom; the pane earns its proof by live receipt
      (F14's adapter-integration precedent).
    - better-sqlite3's native binary must match Obsidian's Electron
      ABI; staging/BRAT mechanics UNVERIFIED (dependency now IN
      package.json as of 2026-11-01 — previously untracked at
      drafting; esbuild.config.mjs staging not yet verified —
      verification owed at build-wiring time, the typeof-Buffer
      precedent). The Zone 2 disposability fence contains the
      failure mode: broken binary ⇒ search dark, spine unaffected,
      rebuild on repair.
    - isDesktopOnly must eventually become false for the mobile read
      lane; until then the desktop bundle's native import must be
      conditionally loaded (lazy require at the desktop lane) so the
      plugin does not crash a mobile runtime. Adapter territory,
      live-receipt owed.
    - Foreign-origin catch-up (shards arriving via Sync between
      sessions): the probe detects growth via stat; catch-up is a
      mergeScan-and-fold increment. Whole-file read per foreign catch-
      up is the DataAdapter tax — declared, accepted, one read per
      convergence, not per query.
  Ratified rulings carried (Dan, 2026-10-30/31):
    - Seam-driven, not boot-rebuild-only: increments arrive through
      EventLog.subscribe(); boot rebuilds when the probe says stale.
    - Stat-based staleness probe: per-shard (origin, last_seq,
      byte_length) vs adapter.stat() — the probe must not re-read the
      spine.
    - UI is a sidebar pane in v1 — "start as we mean to finish."
    - Chunk text never syncs; the FTS content source is present-day
      disk via chunkNote(), addressed by projectPaths().
  As-built deviations from contract text (2026-11-01, at
    certification — loud, not laundered):
    - SELF-CONTAINED vs EXTERNAL-CONTENT FTS5 TABLE: the Project
      Definition's Database row says "external content"; as-built,
      chunk_fts is a SELF-CONTAINED table (text rides in the virtual
      table, no content= companion). TRIGRAM is as locked. Full
      ledger in src/fts/store.ts ("DEVIATIONS FROM EARLIER DOCS");
      the Project Definition row's annotation awaits Dan's ruling.
    - SHARD_PROBE TABLE vs "META TABLE" WORDING: S1's contract text
      said the probe record lives in "the DB's meta table"; as-built
      it is a dedicated shard_probe table (origin PRIMARY KEY).
      Wording drift, not architecture — this entry's S1 text now
      matches the code, and the drift is recorded here rather than
      silently papered over.
  Fixture: src/fixtures/f15.ts (authored 2026-11-01, green
    2026-11-01 — 53 checks, S1–S7 desktop + M1–M3 mobile, ALL
    GREEN; f15 registered in the fleet runner same day; FLEET
    GREEN all 14 suites.)
  Status: ✅ CERTIFIED (2026-11-01) — fixture green, fleet green
    (14 suites), hostility clause SATISFIED IN VOLUME. First-contact
    reds earned, four fault classes:
    - ERASABLE-TS VIOLATION (pre-run): constructor parameter
      properties in store.ts and the f15 harness crashed Node's
      direct .ts execution (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX) —
      receipt that the modules had typechecked but never EXECUTED
      under Node. Fixed to field-declaration + body-assignment
      (the harness's own pattern). Doctrine earned: no parameter
      properties, enums, or namespaces in Node-executed files.
    - SQL STATEMENT ROUTING: an UPDATE routed through the read-only
      query() door (.all) — better-sqlite3 refuses row-less
      statements ("This statement does not return data"). Fixed by
      pathsInRange()/updateChunkPath() doors in store.ts; doctrine
      earned: ALL chunk-table SQL lives behind store doors, the
      lane composes calls only, query<T>() stays read-only.
    - FIXTURE-WORLD REALISM: S3A/S3B/S4 failures traced to the
      fixture's OWN worlds — folder.renamed spine events asserted
      without the corresponding disk file moves, violating the
      disk-as-truth contract the fixture itself polices. The code
      was right; the fixture was wrong. Worlds corrected (files
      written at post-rename paths before events append); the
      one-off diagnostic deleted after its finding was encoded in
      the fixture's world-realism header. Recorded openly: this
      red class convicts the fixture, not the implementation —
      the hostility clause's purest form, but not a code red.
    - CONCURRENT-PUMP RACE: two lane pumps in flight when
      folder.renamed outpaced note.created — interleaved drains
      produced inconsistent index state. Fixed with a single-flight
      draining flag; one pump in flight, always.
  Same-session collateral, receipted: reader.ts parseLine ported
    Buffer → TextDecoder (Obsidian mobile lacks Node APIs — settled
    by web-search receipt, not training recall; regression-receipted
    green by F01/F02/F03 above — the verify-over-guess doctrine's
    founding case); rebuild churn fix (probe stats recorded AFTER
    the disclosure line, closing the infinite-rebuild loop).
  
  ---

## Secondary clauses demanding fixtures (parked, not forgotten)

Remaining parked entries after the 2026-10-24 promotions:

- ~~F09 farewell-flush dwell event~~ — **promoted 2026-10-24, certified** (above, with semantics correction)
- ~~F11 deepening~~ — **promoted 2026-10-24, green** (above)
- **F07 foreign-origin guard** — kept parked with a status nuance (guard live in code, fixture owed)
~~F08 no-op modification dedup~~ — **promoted 2026-10-28, certified** (full entry above, with sequencing-ruling precedent for new subsystems; deferred continuity probe registered there)
- **F10 `write.reverted` replay** — kept parked, blocked on Plugin 2
- **Tier-2-first flush after torn-tail boot** — registered 2026-10-24 under F01's boundary note

Parked per house rules — the promoted entries above are paid; the parked remainder is next sprint's, not smuggled into this one.

## Definition of done for this phase

All seven fixtures green in the test vault, reproducible from a clean clone with seeded inputs, **and** at least one fixture initially red against the first implementation — a corpus that passes on first contact hasn't been hostile enough. If the first implementation passes everything untouched, add nastier variants (deeper UTF-8 tears in F01, wider gaps in F02, checkpoint-chain tamper variants in F11) before trusting green.

**Hostility ledger (2026-10-24):** the clause has teeth — F05a drew two legitimate first-contact reds (fixture arithmetic, fixed) and F11's family drew first-contact reds in its original pass (per the 2026-10-22 footer). F09 itself passed first contact against extracted code; its hostility is inherited from the extraction's drafting history (four self-caught drafting defects before it ever ran — logged in the session, not the corpus).

**Hostility ledger extension (2026-11-01):** F15 drew reds in volume — four fault classes across first contact: erasable-TS syntax (pre-run), SQL statement routing, fixture-world realism (the fixture wrong, the code right — reds drawn against the corpus's own draft, recorded as such), and a concurrent-pump race. The standing exception remains F14 (house-order inversion, debt named in its ledger). The clause has now bitten implementer and fixture-author alike — both directions counted, neither inflated.

---

Footer note on versioning: **rev. 2026-11-01 folds in:** (1) F15 shipped and certified — 53 checks, S1–S7 + M1–M3, fleet 14 green, hostility clause satisfied in volume (four fault classes ledgered in the entry, fixture-world realism honestly attributed to the fixture, not the code); (2) F15's S1 "meta table" wording corrected to the as-built shard_probe table, with the drift recorded in the entry's deviations ledger rather than papered over; (3) F15's declared limitations updated — better-sqlite3 dependency now in package.json (2026-11-01), ABI/staging verification still owed at wiring time; (4) F01/F02/F03 gain regression re-receipt notes for the 2026-11-01 `reader.ts` `TextDecoder` port; (5) hostility ledger extended (2026-11-01 block); (6) same-session collateral recorded in F15's status: verify-over-guess doctrine's founding case and the rebuild churn fix. No pass requirements were weakened — F15's contract text stands as drafted 2026-10-31; corrections are wording-vs-as-built drift, recorded openly. v0.1 (rev. 2026-10-24) folds in: (1) F09 promoted from parked to a full certified entry, with the parked sketch's "dwell-so-far" farewell wording corrected to the ratified over-gate-post-emission rule; (2) F05 split into F05a (shipped, certified — rename wiring, gate semantics) and F05b (deferred — embed-in-flight race, blocked on the embedder, requirements unchanged); (3) F11-deepening promoted from parked (shipped, green); (4) F03 gains the stub→chunker migration debt annotation; (5) F02 clause 5's repair-refusal status confirmed live and green; (6) F01 gains the Tier-2-first-flush boundary variant as a registered candidate; (7) rule 5 scope note for the split's effect on the fast/slow line; (8) second harness idiom (pure-module direct-drive) noted. Previous rev. 2026-10-22 amendments (F02 clause 5 reinterpretation, F11 seating) and rev. 2026-10-20 amendments (F01 multi-byte tear, F03 re-derived-offsets, F04 byte-determinism) remain in place. No pass requirements were weakened by any amendment; F05b's deferral changes scheduling, not the bar.