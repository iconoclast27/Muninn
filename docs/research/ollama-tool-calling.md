# Ollama native tool-calling anatomy — sources and measured environment

**Measured locally (2026-11-26):** `GET 127.0.0.1:11434/api/tags` — per-model `capabilities`; models with
`"tools"` include `qwen3.5:4b` (4.7B — the old design's model), `llama3.2:3b` (3.2B), `qwen2.5-coder:3b`,
`qwen3.5:9b`, `ornith:9b`/`ornith-1.5:9b` (qwen35 family), `gemma4:e4b/12b`, `llama3.1:8b`, `qwen3.8:27b`.
Embeddings: `nomic-embed-text(-v1.5,v2-moe)`, `embeddinggemma`. Server binary at `/usr/bin/ollama`.
**Environment caveat for the prototype measurement (measured 2026-11-26):** the 12 GB GPU was held at
10.8 GB by a foreign compute process (pid 53883, not ours — untouched per the trust rule); the prototype
ran CPU-only (`num_gpu: 0`, `num_ctx: 8192`) because of it. Wall-clock numbers below therefore
understate GPU-class throughput; token counts and prefill-reuse counts are not skewed by it.

**Docs (one Tavily pass, 2026-11-26; sources: docs.ollama.com/capabilities/tool-calling, docs.ollama.com/api/chat,
docs.ollama.com/api/openai-compatibility, ollama.com/blog/tool-support 2024-07-25, ollama.com/blog/streaming-tool 2025-05-28,
github ollama/ollama docs/api.md):**

## 1. Anatomy of `/api/chat` with tools (OpenAI-shaped)

Request: `tools: [{type:"function", function:{name, description, parameters:<JSON Schema>}}]`, `stream:false`
or true. Response assistant message: `tool_calls:[{type:"function", function:{index?, name, arguments:<object>}}]`.
Feeding results back: append the assistant message as-is, then one message per result:
`{role:"tool", tool_name:<name>, content:<result string>}`; loop again until a message with no `tool_calls`
(the agent loop per the official multi-turn example). `arguments` arrives parsed; a defensive JSON.parse
for stringified args is cheap insurance (older/edge models may emit JSON text — the parser story below).

## 2. Loop and prefill facts that matter to the latency doctrine

- The official multi-turn example is exactly a while-loop appending assistant+tool messages — one
  conversation, growing prefix. Ollama keeps the model resident (`keep_alive` default 5m) and prompt-cache
  reuses the prefix; per-round `prompt_eval_count` is the direct measurement of reuse (see
  `prototype-findings.md` when run).
- Streaming: accumulate partial `thinking`, `content`, `tool_calls` across chunks, then return them together
  with any tool results (official streaming-tool example).
- The parser (blog, 2025-05-28): prefix-matching parser, handles partial prefixes, falls back to JSON parsing;
  accuracy note — previously models re-emitting their own prior tool call produced spurious extra calls;
  the new parser improves reliability. Some models emit tool calls without the trained prefix.
- **No `tool_choice`** in native or OpenAI-compat endpoint (compatibility table: `tool_choice` unchecked).
  Force-tool behavior must be done by prompt/protocol design (e.g., refusing empty-content rounds), not a
  server knob. Constraint on the design: the client decides "no tool call = done", and a small model that
  forgets to call is a client-policy question (nudge-once policy belongs to the teach layer or the client,
  ratifiable).
- `think` knob: boolean or level ("low"… "max") on thinking models; OpenAI-compat exposes
  `reasoning`/`reasoning_effort`. Relevant to latency: thinking models on small quantization can dominate
  round time; a restart policy may pin `think` per model tier — Dan's act.

## 3. Consequences for the restart doctrine

1. The latency floor "one model turn + N × milliseconds" is honest ONLY against tool-capable models; the
   capability list is a per-model fact the plugin should read from `/api/tags` (`capabilities: ["tools"]`)
   rather than a name-table. Measured: even 3.2B models declare tools — but declaring ≠ using well.
2. Tool schemas (names, descriptions, JSON Schema params) are exactly where the **teach layer** attaches:
   descriptions ARE the recipe payload shaping. The recipe apparatus survives without an op dialect.
3. Malformed/unknown tool → return a machine-readable error as the `role:"tool"` content (the mock in
   `scripts/prototype-tool-loop.mjs` demonstrates the round-trip) — this is the validator seam's
   self-correction loop, no bespoke envelope needed.
4. `notesLike` as a tool description can carry the door's honest label ("ranked, semantic, not freshness")
   and its response carries scores — the per-result disclosure doctrine (D-5) rides this channel for free.
