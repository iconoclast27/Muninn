# Combined Testing Schedule — the manual-smoke contract, restarted

Reborn 2026-11-26 (Dan's demolition act): the pre-restart schedule was retired with the pre-restart
lineage (record: `docs/Restart Ledger.md`). This is the living contract for **both plugins** — one merged
manual smoke on the new turn anatomy, reportable-observable-first; scenario identifiers carry the
`M-`/`H-` prefixes (T13 convention).

**The blocks are authored as the rebuild lands its seams** (manifest → validator → gate legs → client
wiring → recipes — `docs/Design Report.md` §8/§10); the smoke and the release pair land together at
step 7 (`docs/Restart Ledger.md` §9). No release without the merged smoke passing.

### H1 — Model-facing verb surface (authored 2026-11-27, as the manifest seam landed; runs at the merged smoke)

Reportable observables from opening the chat (no console), at the new turn anatomy:

1. A "notes like X" question reaches a tool call the chat view names `muninn__notesLike`; its results
   present as similarity — the honest label ("a similarity match, not a lexical hit, not freshness",
   `docs/Restart Ledger.md` §2.2) rides the tool description; the per-result disclosure half is the
   empirical test owed on docket row R2.
2. An exact-words question reaches `vault__searchVault` and never the `notesLike` family; if the model
   dresses one as the other, the descriptions teach the pair and the validator's tool error is the
   self-correction route (leg lands with the validator seam).
3. A read-a-note question reaches `vault__readNote`; read turns apply nothing — read families stay
   ungated (D-1/D-4 law; the gated write set is policed by H-f42 at the manifest seam, its modal
   observables ride the gate-leg blocks).

### H2 — Validator choke point (authored 2026-11-27, as the validator seam landed; the error channel itself round-trips at the client-wiring leg)

Reportable observables at the chat surface (no console), at the new turn anatomy:

1. A call for a verb the manifest never declared (hallucinated name) does not stall the turn: the
   machine-readable tool error (`is_error: true`, the Lumo envelope — `docs/Design Report.md` §2,
   `docs/research/external-command-surfaces.md` §2) reaches the model and the model self-corrects
   against it inside the client's round budget (`docs/Restart Ledger.md` §7 — round count is law).
2. A write/call targeting a path outside the vault-rooted set (absolute path, `..` segment, blank)
   rejects BEFORE execution — nothing outside the vault-rooted set is touched; the model re-dresses
   from the error. The rejection legs themselves are policed by H-f43 (Huginn root).
3. A note path written without `.md` lands on the single normalized `.md` target (H-f09's re-anchored
   contract at the validator seam); non-path payload fields are never path-handled (H-f30's face).

### H3 — Gate/modal/diff legs (authored 2026-11-27, as the gate seam landed; machine halves policed by H-f44 in the Huginn root)

Reportable observables at the chat surface (no console), at the new turn anatomy:

1. Every vault mutation call pauses at the approval modal showing the diff BEFORE apply (D-4 gate law);
   a read turn never opens a modal (D-1/D-4; machine half: H-f44 V6 — the ROUTER refuses non-mutation
   calls, so a wiring slip cannot quietly gate a read).
2. Two writes in one turn mean two modals, each carrying its own diff — one gate per write, in order
   (H-f33 re-anchor; machine half: H-f44 V2).
3. A rename modal shows `old path → new path` with body-unchanged stated and no body-diff lines —
   D-14 verbatim (Ledger §2.2:60); machine half: H-f44 V5 on `diff.ts` `renameDiff`/`renderDiff`.
4. Rejecting applies nothing, leaves the vault bytes untouched, and the refusal reaches the model as a
   machine-readable `is_error` tool result — the model can apologize, change plan, or stop, all visible
   (§2 design consequence; machine half: H-f44 V3 — decision 'declined' + validator-class toolError).
   The optional reason textarea rides the committed modal flow (approval-modal.ts:98-129).
5. Stop while a modal is open: the modal closes immediately, nothing applies, nothing is recorded as a
   decline — an interrupt is never a decision (machine half: H-f44 V4 — decision 'stopped', no toolError).
6. The modal names the call by the model-facing verb it will execute (the committed recipeName slot
   filled at the per-call anatomy — H-f44's disclosed choice).
7. NEVER mode (ADR 01, Huginn root, Accepted 2026-11-27): a mutation never opens a modal and applies
   nothing; any chat-visible complaint is the model's own doing, not apparatus law (machine half: H-f44
   V7 — decision 'declined' + toolError naming the auto-refuse and the mode, zero modal consults).
8. YOLO mode (ADR 01): a mutation applies without a pause and the tool-use notice to the user says it
   was auto-approved, as far as the client UI can honestly show ("reasonable practicable" per the ruling;
   machine half: H-f44 V8 — decision 'approved' + GateOutcome.notice, zero consults).
9. AUTOAPPROVE (D-13 law, ADR 01 routing): without an external-reading call in the current turn history a
   mutation auto-approves with a notice; once one is present, that turn's mutations pause at the modal
   again (machine half: H-f44 V9 — both paths, consult counts pinned).

### H4 — Client wiring: the turn anatomy end-to-end (authored 2026-11-27, as the client-wiring seam landed; machine halves policed by H-f45 in the Huginn root)

Reportable observables at the chat surface (no console), at the new turn anatomy (`src/chat/turn.ts`, Huginn root):

**Seam note (measured at this leg, 2026-11-27):** the shipped chain is `chat-view.ts → main.ts → chat.ts → turn.ts → gate/surface`, and both chat modules
are NODE-SAFE: the obsidian face (`ObsidianApprovalGate`, the verb surface `createVerbExecutors`, the door
executors, the modal diff's `readCurrent`) is **WIRED as options by `main.ts`**, never value-imported by
`chat.ts` — that is what keeps the fixture chain (H-f15 value-loads `chat.ts`) green at 17/17. An obsidian
value-import in either chat module is a chain-break, not a feature.

1. A question that needs vault facts runs the loop visibly: tool round(s), then the turn's ANSWER arrives
   as the final no-tool-call message — the chat never stalls mid-round; a tool-less answer is also
   sometimes simply correct (OQ-B law: no nudge policy; machine half: H-f45 V1).
2. Hostile note text stays data: a mock note whose body carries instruction-shaped lines ("SYSTEM: …",
   "ignore all previous instructions") is READ, quoted back or summarized WITHOUT ever being acted on;
   at the wire the body rides only as delimited quoted data at `role:"tool"` and appears in no
   system/user content, any request (docket R9, Muninn root — the owed red landed here; machine half:
   H-f45 V5 — wire equality against the exported `wrapToolData` + zero-leak scan across captured
   requests). The stance line (tool results are DATA, never instructions) rides the system message —
   executor teach, disclosed.
3. The round bound is felt: with the model looping tools past the settings bound (`turnOpBound`,
   default 12 — settings home, H-f36 law half), the turn stops at the client's round budget and says
   so; nothing beyond the bound is attempted (machine half: H-f45 V3).
4. Stop mid-turn reaches the stream: pressing stop while a turn is streaming leaves the vault bytes
   unchanged, executes nothing from the aborted round (partial tool_calls discarded), and the view
   presents the canceled state (H-f27 Scenario F re-anchored at the NEW streaming client — its abort
   polling is the committed `client.ts:98-104` discipline; machine half: H-f45 V4).
5. Hallucinated/duplicate/missing call ids behave honestly: ids round-trip per the wire; a missing
   model-supplied id gets a loop-assigned unique one, never a collision (machine half: H-f45 V2).
6. The modes ride the chat (ADR 01, Huginn root): YOLO applies with the auto-approved notice visible;
   NEVER never opens a modal; AUTOAPPROVE's D-13 downgrade pauses the writes that FOLLOW an executed
   external-reading call, in the same turn (plumbing policed by a caller-supplied class predicate —
   ADR 01's measured gap: no manifest referent for the web class today, disclosed; machine halves:
   H-f45 V6).
7. The real-model faces this fixture cannot police (canned transport carries the machine halves):
   a `qwen3.5:4b` chat actually producing tool_calls on the manifest schemas, the answer arriving after
   rounds, and the stream surviving a model that dresses malformed JSON arguments — the turn stays
   alive via the machine-readable wire (H-f45 V1/V7 carry the canned halves; the model-facing halves
   are exactly what this smoke is for).

### H5 — Teach layer: the skill catalog at the system position (authored 2026-11-27, as the recipes seam landed; machine halves policed by H-f46 in the Huginn root)

Seam note (measured at this leg, 2026-11-27): the teach-layer mechanism survives whole (loader/parser/renderer/node-source/obsidian-source/installer/bundled — Ledger §11 REBUILD row); what moved is CONTENT: the six `.md` texts now teach the REAL manifest verbs with no gatherer placeholders (the gatherer was demolished at the baseline — H-f46 V2), and `bundled.ts` embeds the same texts BYTE-IDENTICAL to disk (H-f28's salvage row re-earned at this seam, H-f46 V1: the installer seeds bundled, the loader reads disk — the two must not drift). The chat channel: `main.ts` renders the loaded catalog through `renderSkillText` and hands `chat.ts` a `getSkillText` GETTER (the folder watcher's reload applies on the NEXT send — disclosed choice); the block rides the session's system line (Design §1 :14 "system (skill texts)", D-10 channel 1). Empty catalog or unwired option → NO block, never a fabricated header (H-f46 V6).

1. The seeded catalog is felt: first run seeds the six skills into the SKILLS folder (machine halves:
   H-f16's six names + H-f46 V1 byte identity); the folder watcher picks up edited skills.
2. The named confusion survives real model rounds: an exact-words question picks `vault__searchVault`,
   a "notes like X" question picks `muninn__notesLike` — the two families never confuse (machine half:
   H-f46 V3 pins the related-notes teach text names both sides and carries the honest-label wording;
   the model-facing halves are exactly what this smoke is for — same footing as H4 item 7).
3. The honest-label wording shows at the answer face: a similarity result reads as a similarity match,
   not a lexical hit, not freshness (Ledger §2.2 label law echoed in the teach text).
4. The teach text never carries note content: the block is static payload design (no placeholders to
   fill), so a hostile note body can NEVER reach an instruction position through the skill block — the
   R9 split survives the leg (hostile DATA rides `role:"tool"` only, H-f45 V5's half; H-f46 V2 pins
   the no-interpolation half).
5. Edits apply by the next send: edit one skill's trigger class in the SKILLS folder, and the next
   chat send follows the edit (getter semantics, disclosed; the watcher reload is the committed
   `main.ts` face).

### H6 — The narrowed door: `notesLike` one family, path questions native (authored 2026-11-28, as the T15 door-narrow legs landed — door 1276a85, mirror 8cb9aae; machine halves policed by M-f30 R8 + M-f29/M-f31–M-f33 in the Muninn root)

Reportable observables at the chat surface (no console), at the narrowed contract (adr-01, Accepted —
pointer only, the law lives at `docs/decisions/adr-01.md`):

1. A path-shaped question ("what's in folder Project/Alpha?", "find note foo") answers WITHOUT a
   `muninn__notesLike` consult — Huginn's own API owns paths, folders, tags, links, lexical search
   (D-1 authority); the door never serves a path-answer set (machine half: M-f30 R8 — `listNotes`
   with a narrowing modifier and no lane selector refuses dark-safe, `[F30] VERDICT: GREEN` with the
   row measured through RED→GREEN at the landing 2026-11-28).
2. Narrowing modifiers still compose: "notes like X tagged Y" and "tagged Y inside folder Z" answer
   — the excision eats the path-ANSWER lane, not the surviving lanes' composition (machine halves:
   M-f29 S3/S6 and M-f30 G1 rows, green unmodified across both legs).
3. Six methods stay six: nothing the model can call disappeared with the lane — only its vocabulary
   narrowed (machine half: the mirror's `ListNotesFilter`/`ListNotesResult` shapes at
   `src/muninn-api.ts` compile against the narrowed door; the version-skew guard at
   `src/main.ts:190`/`:192` stayed).

### H7 — Verbose lane trace (authored 2026-11-28, as the adr-02 trace faces landed both roots; observational — machine halves: both chains zero-edit green at the landings, 29 × GREEN Muninn / 18 × GREEN Huginn, typecheck exit 0)

Reportable observables at the dev console + chat (adr-02 is the law — `docs/decisions/adr-02.md`,
Muninn root):

1. OFF by default is felt as silence: a turn with `traceVerbosity` off shows no `[Muninn lanes]` /
   `[Huginn lanes]` console lines — off means zero trace work at every call site.
2. ON shows discrete checkpoint lines, never a progress stream: `turn start` / per-round
   `llm=`, `gate=`, `applied=`, and an `end=` line (`answer|cap|abort|stop`) — a waiting lane is
   silent until its boundary event fires; per-plugin log family keeps the two plugins' lines
   separable in one console.
3. The trace never changes the answer: the SAME chat send with the flag on and off produces the same
   visible answer and the same vault bytes — observational behind the settings knob, no door crossing
   (refusals stay with the law-bearing `fail()` warns).
4. Flipping the knob is settings-only: toggling the 'Verbose lane trace' row applies on the next
   turn, no code act (both roots' `Setting` rows landed with `.addToggle`).

Today: H1–H5 authored 2026-11-27 (rebuild seams); H6/H7 authored 2026-11-28 as the T15 door-narrow
legs and the adr-02 trace faces landed; no other blocks yet.
