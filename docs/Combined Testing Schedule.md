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

Today: H1–H3 authored (H3 amended same day for the ADR 01 mode ruling); no other blocks yet.
