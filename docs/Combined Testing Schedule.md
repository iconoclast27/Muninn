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

Today: H1 + H2 authored; no other blocks yet.
