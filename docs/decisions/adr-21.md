# ADR-21: Staffing — the architect/mason split, the executor contract, the escalation ladder, adversarial specs

**Status:** Accepted (retrospective; recorded 2026-11-16); live as method doctrine. Model roster is
current; the qwen-era contract is archived (Dan, 2026-11-16).
**Ruled:** 2026-11-02 (split + ladder), 2026-11-03 (first supervised run), executor contract
(`Standing Qwen prompt.txt`, undated body, git 2026-11-05).

## Context

The project runs one high-capability design authority and a local model as mechanical executor, with
the fixture fleet as referee. The failures it hunted: confident fabrication, summarized tracebacks,
side-effecting "help", assistant-authored `[!decision]` blocks read as rulings.

## Decision

- **Design authority stays with the high-capability model.** Implementer output is **a draft
  requiring fixture verification — never a fact.**
- **The executor contract (seven rules):** raw output only ("A summarized traceback is a lie"); one
  command per receipt, never chained; append-only receipts file (never edit/reorder/delete); **no side
  effects unless the task authorizes them** (git commit/checkout/reset/clean, rm, mv, tee, npm install
  forbidden by default); **on any surprise, halt** — "Surprises belong to the human"; no memory across
  sessions ("the files win"); **"IF A FIELD CANNOT BE FILLED FROM A RECEIPT, WRITE 'UNKNOWN'. Never
  infer. Never estimate. Never remember."**
- **Escalation ladder, bounded and fixture-refereed:** behaviour-preserving refactor → single-file
  driver swap → small new module → (only if all green) participation in the rework. The first
  supervised demolition run stays with the architect, by Dan's call.
- **Adversarial specs:** "Specs must be written **adversarially** — as if for a contractor who cannot
  ask questions and will silently resolve any ambiguity wrongly. Underspecified design documents are
  the primary hazard of the architect/mason split."
- **Provenance labels:** assistant-authored `[!decision]` blocks are proposals, not rulings. The label
  system is canonical: **[R]** receipt (pasted terminal/file), **[U]** Dan's word (trusted, does not
  authorize a cut), **[H]** inference, **[GHOST]** retrieval-surfaced — "Retrieval surfaces real
  documents of unknown vintage. A hint, never an authorization."
- **The first supervised run is the human's call, not the model's.**
- **Adversarial review protocol**: an independent reviewer ranks findings critical→low, cites files,
  proposes no fixes beyond named ones; Dan rules; the implementer executes; and the engineer may open
  fire on the review ("paste her rebuttals and I'll defend or concede on the merits"). Credit
  discipline: "The sin was trajectory, not craft."
- **Model roster (current, Dan 2026-11-15/16):** Gemma4:12b retired, qwen closed, kimi (paid plugin)
  is the known-good path with a declared ~$120 cap. `Never Try To Teach A Pig To Sing.md` (why 12b
  models fail this project) and `Standing Qwen prompt.txt` are archive material.

## Consequences

Every ruling in this corpus is attributable to Dan's word [U] or a pasted receipt [R]. The roster
changes; the contract shape does not. Huginn acknowledges the roster (its ops live there); Muninn
acknowledges that its embedding model stays `nomic-embed-text` [R].

## Sources

`docs/archive/Session Handover Note 2026-11-02.md` L286, L248, L262, L269–275, L282, L276, L211–212;
`docs/archive/Session Note -- 2026-11-03 Morning.md` L21, L41;
`docs/Standing Qwen prompt.txt` (rules 1–7); `docs/Independent Review 2026-11-04.md` (review
protocol, credit discipline); `docs/Session Handover 2026-11-03 Evening.md` (label system).
