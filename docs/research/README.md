# research/ — grounding pass for the restart design (started 2026-11-26)

Durable reference material. Reusable beyond the restart: the Obsidian API surface and Ollama tool
anatomy will be needed again. The design authored from this ground: `../Design Report.md`.

| File | What | Method |
|---|---|---|
| `obsidian-verb-surface.md` | The real Obsidian native verb surface (Vault CRUD, MetadataCache/CachedMetadata, official-API silences as findings) | downloaded `obsidian.d.ts` (official `obsidianmd/obsidian-api` master, 307,387 B) + greps; line numbers cite the saved copy |
| `ollama-tool-calling.md` | Native tool-calling anatomy: request/response shape, agent loop, streaming, no-`tool_choice`, parser/accuracy notes, per-model capability facts | one Tavily pass (docs.ollama.com pages + blogs) + measured `/api/tags` |
| `prototype-findings.md` | One native-tool-calling turn against local models — rounds, timings, tool discipline, prefill reality | `scripts/prototype-tool-loop.mjs`, CPU-only (foreign GPU process untouched — trust rule) |
| `external-command-surfaces.md` | Prior art: the palette IS API/MCP-facing (coddingtonbear's Local REST API/MCP plugin), and the gated-agent approval/error anatomy (Proton Lumo Desktop) | GitHub API + raw fetches + one named lookup |
| `raw/local-rest-api-readme.md` | Local REST API plugin README (commands surface + MCP tools) | raw fetch |
| `raw/lumo-connectors.ts` | Lumo Desktop connector bridge (ToolRegistry, OpenAI-format tool errors, approval anatomy) | raw fetch |
| `raw/obsidian.d.ts` | The typings file itself | as above |
| `raw/typings-1.15.1/` | Community core typings `@obsidian-typings/obsidian-public-1.15.1` — types the REAL core app: the command surface (`app.commands.executeCommandById`), `internalPlugins`, `commandable` surfaces | npm tarball fetch (the API that makes the palette available, per Dan's steer) |
| `raw/prototype-runs.json` | Full prototype transcripts (appended per run) | the script |
| `scripts/prototype-tool-loop.mjs` | Runnable prototype; also a template for the restart's client loop | authored 2026-11-26 |

**Owed, still open (gaps, not findings):** runtime verification of core `search.query` (untyped surface);
real-vault door cost (embed + FTS) inside a tool round; approval pause inside a live tool loop;
GPU-class timings; `stream:true` partial accumulation.

**Sources fetched this pass (dates measured):** `https://github.com/obsidianmd/obsidian-api/raw/master/obsidian.d.ts`
(HTTP 200); Tavily one-query pass returning `docs.ollama.com/capabilities/tool-calling`,
`docs.ollama.com/api/chat`, `docs.ollama.com/api/openai-compatibility`, `ollama.com/blog/tool-support`
(2024-07-25), `ollama.com/blog/streaming-tool` (2025-05-28), `ollama/ollama docs/api.md`.
Search engine used once — per "stick to only necessary searches." Second pass (2026-11-26, named lookups
only after Dan pointed at them): GitHub API for `coddingtonbear/obsidian-local-rest-api`, raw fetches of its
README and of `ProtonLumo/lumo-desktop` `webview/bridges/connectors.ts`, one Lumo Desktop search.
