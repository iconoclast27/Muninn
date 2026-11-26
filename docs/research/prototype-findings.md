# Prototype: one native-tool-calling turn — measured 2026-11-26

**Run:** `scripts/prototype-tool-loop.mjs` against local Ollama (`stream:false`, `temperature:0`,
`num_ctx:8192`, CPU-only per the trust rule — foreign GPU process untouched). Mock vault behind four
manifest-shaped tools: `searchVault` (lexical), `notesLike` (mock door: ranked+scored+labeled),
`listFolder`, `readNote`. Task: "find the note about the Phoenix project, read it, summarize status
in one short sentence." Raw transcripts: `raw/prototype-runs.json`.

## Results (all times CPU; environment caveated in `ollama-tool-calling.md`)

| Model | Rounds | Wall | Tool discipline | Outcome |
|---|---|---|---|---|
| `llama3.2:3b` | 2 | 46.0 s | 3 parallel calls in round 0: 1 well-formed, 2 pseudo-shell placeholders (`$(searchVault …)`) → mock errors → recovered | correct final answer |
| `qwen3.5:4b` (old design's model) | 3 | 82.1 s | every call well-formed, sequential: search → read → answer | correct |
| `qwen2.5-coder:3b` | 1 | 27.5 s | **made no tool call at all** — answered without touching the vault | fabricated answer (rounds=1, no calls, eval=20) |

## What the numbers substantiate

1. **The latency claim.** New anatomy on the design's own model: 3 rounds, 82 s on CPU at ~5 tok/s.
   The old loop measured ~4 minutes for ~8 serial authored calls on the same model, GPU-class.
   The floor "one model turn + N × milliseconds" holds in round structure (3 not 8) and in per-round
   generation size (~80 tokens/round vs full payload authoring); wall clock on GPU is below these CPU
   numbers, which bound it honestly from above.
2. **Prefill chain.** Token math: `qwen3.5:4b` prompt_eval grows 552 → 639 → 714 (full re-prefill each
   round on CPU — no reuse observed); `llama3.2:3b` round 1 re-evaluated only 262 against a longer
   prompt (prefix reuse happened). KV-prefix reuse is therefore **model/quantization-dependent, not
   guaranteed** — the design must not price prefill reuse into doctrine; only round count and prompt
   growth are doctrine (both are the teach layer's job: fewer rounds, smaller tool results).
3. **Tool discipline tiers.** The three outcomes map to the two constraints already found in the
   Ollama anatomy (no `tool_choice`): (a) thrash-but-self-correct (3b llama — machine-readable tool
   errors worked as designed); (b) clean native use (4b qwen3.5); (c) **tool-skip** (3b coder answered
   without tools — a silent-failure mode the client must guard: e.g. one nudge-when-task-implies-a-tool
   policy, or tier floor). This is evidence for OQ-B's decision, not the decision itself.
4. **The mock round-trip proves the validator channel**: unknown/unknown-shaped args returned as
   `role:"tool"` error text, model recovered — no envelope machinery needed for self-correction.
5. **Dependent-call batching hazard:** the 3b model emitted three parallel calls where two depended on
   the first's result — nonsense dependency graph, rescued by the error channel. A manifest note
   ("call search before read; don't reference other calls' results") is a teach-layer candidate.

## Gaps this prototype does not close

Real vault sizes/paths, door embeddings cost (mock), approval-mid-turn pause semantics (writes absent
here on purpose — gating is design-side), GPU-class timings, `stream:true` accumulation. Recorded in
`README.md` as owed.
