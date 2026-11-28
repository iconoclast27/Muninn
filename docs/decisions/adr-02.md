# ADR 02 — The verbose lane trace mode (console fault-localizer)

**Status: Accepted 2026-11-27.** Ruling act (Dan, verbatim): "The proposal is approved." —
approving the checkpoint proposal seeded at measured seams (his seed words, 2026-11-27:
"verbose-logging means that once it's fully developed, flipping a switch in the settings will
report all those points to the console log" and "the point of the verbose log is that if there is
something wrong and we don't know where, copying the log will give us the data of the places to
search … having verbose logging doesn't flood the console and swamp the main process. It just
logs checkpoints … It has to be discrete points"; recorded in `docs/Restart Ledger.md`). The
design conformations below are the executor's choices, disclosed at acceptance; a conforming
revision is a new ADR or a dated addendum here, never an edit.

## 1. Law

1. **One switch per root.** `traceVerbosity: boolean` in `MuninnSettings` and in `HuginnSettings`,
   default `false` in each `DEFAULT_SETTINGS`, sanitized by the scalar-guard pattern of each root.
   It is a Settings knob (the `semanticBand` precedent): a post-epoch revisit is a settings edit,
   not a code act. No cross-plugin settings read exists — nothing sanctions a plugin reading the
   other's settings.
2. **Sink: each plugin's own console stream.** Measured law (Dan): the streams are NOT shared
   between plugins; each plugin's lines group under that plugin's log. Every trace line must
   therefore read STANDALONE inside its own plugin's block; cross-plugin pairing joins only on
   discrete `t=<epoch-ms>` stamps at boundary events and the query/path keys already carried on
   both sides.
3. **Line family.** `console.log` with the prefixes `[Muninn lanes]` and `[Huginn lanes]`,
   siblings of — never folded into — the law-bearing warn families (`[Muninn API]` / `[Muninn]` /
   `[Huginn]`), which stay unconditional: the warns are the refusal-side disclosure; the trace
   adds the answered-side and internal-dispatch checkpoints.
4. **Discrete points only.** Progress / waiting / heartbeat / "not yet" lines are banned at every
   tier: a waiting lane emits NOTHING until its boundary event fires; the accumulating stream
   loops (`client.ts` and `readAssistantStream`) stay silent inside; a checkpoint whose only
   information is "not yet" does not exist.
5. **Bounded.** Emissions are O(turn × checkpoint) — per round at most transport-completion,
   per-call decision, gate-consult lines; never per chunk, token, candidate, or retry. Off-state
   does zero string work. Taps sit at seam ENDS, never inside chunk decoders. A tap that throws
   never breaks a lane (swallow inside the helper). No vault/note bodies in the log: `bytes=`
   counts plus a bounded preview, N = 120 characters (executor's choice, disclosed).
6. **Localizer.** Every line carries its address — round number, lane tag, seam key — so a
   copied block bisects to a checkpoint-map anchor without re-deriving anything: the last
   well-formed line before an anomaly plus the anomaly line is the search pair.
7. **Observational, honest.** No checkpoint changes lane behavior; the trace never feeds the
   model (the notices/model channels stay as law); the trace never lauds efficacy — the R2 label
   face stays the smoke task.
8. **No door crossing.** Refusal reasons reach the human face through the existing dark-safe
   warns at the door (measured: `fail()` logs reason unconditionally). The accepted Surface-M
   text's "null channel with reason" fidelity face against the frozen TS shape is NOT crossed by
   this decision — the model-facing answer stays generic; the reason rides the door's own log.
   The proposal's G1 gap resolves as scope-down; a door-diagnostics face or a widened
   `SemanticSearchResult` would be separate contract acts, Muninn leads, T15 order.
9. **Chain law.** No fixture rows and no chain edits yet: fixture numbering is a chain edit and
   awaits its own authorization. The adjudication at each landing is the chain unchanged:
   Muninn `M-f01–M-f24 + M-f29–M-f33` and the Huginn chain all GREEN, zero fixture edits, exit 0.
   The first-green justification (written, per law): the legs are observational-additive behind a
   default-false flag — defaulted parameters at the factory/option sites keep every existing
   caller on the inert path, return shapes are byte-identical, and no fixture passes the flag.
10. **Smoke law.** The Combined Testing Schedule's H-block observables are explicitly "(no
   console)": the verbose console mode is a test aid and closes no H-row by itself.

## 2. Checkpoint inventory (the seam families; per-checkpoint pins live in the packets)

- **Muninn door** (`api.ts`): `searchSemantic` answered line (top score, hits, tie counts);
  `listNotes` answered line both lanes (mode — adr-50's mechanism name, totals, cap state).
  Refusals stay lawful `fail()` warns. Intake-lane outcomes stay lawful `[Muninn]` warns today.
- **Huginn anatomy**: turn start (bound, injected bytes, history count); per-round transport
  completion (content bytes, malformed-stream SKIP count — the R9 anatomy drift detector, tool-
  call count); per-call decision lines (`malformed-args`, validator reject with its bounded
  message, gate consult mode/decision, applied bytes, `no-executor`); end lines (`answer`,
  `cap`, `abort`); one-shot `chat()` completion line (summarize arc, skipped count).

## 3. Pointers

Design conformance and the packet pins: the Inkling Tasks staging carrier (agent family,
mine-then-delete) — packets P-M2 (Muninn root) / P-H2 (Huginn root). The act and the seed words:
`docs/Restart Ledger.md`. Huginn keeps a pointer stub in its decisions index (shared doctrine is
Muninn's).
