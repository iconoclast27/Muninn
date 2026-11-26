# External command-facing surfaces — prior art for the manifest (measured 2026-11-26)

Receipts for Dan's D-9 ("the command palette is API/MCP facing") and for the restart's client/gate
shape. Raw copies: `raw/local-rest-api-readme.md`, `raw/lumo-connectors.ts`.

## 1. coddingtonbear's Local REST API plugin (REST + built-in MCP server)

Repo `coddingtonbear/obsidian-local-rest-api` (measured via API call, description verbatim: "A secure
REST API and Model Context Protocol (MCP) server for your vault", updated 2026-11-26). README receipts
(lines cite the saved copy):

- L59: "List and execute commands — trigger any Obsidian command as if you'd used the command palette".
- L183/184: `GET /commands/` (list) and `POST /commands/{commandId}/` (execute) — the palette is an
  addressed surface.
- L403: the plugin ships a built-in MCP server with "direct access to your vault's live metadata,
  active file, and command palette"; third-party MCP servers are "no longer necessary".
- L454/455: MCP tools `command_list`, `command_execute` — palette commands are model-facing tools
  in the ecosystem today.

Design consequences: (a) D-9 is precedented, not aspirational — plugins already address palette commands
through core's machinery; the exact core call remains an implementation detail, but existence is receipted.
(b) This plugin is the REST/MCP route the predecessor plan measured *slower* than in-process; the restart
does not duplicate it and must not — but its vocabulary (`command_list`/`command_execute`) is the
model-facing naming precedent. (c) Its signed, claim-at-authorization upload scheme shows what careful
write-authorization looks like over a wire; in-process the gate modal subsumes it.

## 2. Lumo Desktop (Proton) — gated-agent anatomy in the OpenAI-format tool world

Repo `ProtonLumo/lumo-desktop`; measured from `webview/bridges/connectors.ts` (saved copy, grep receipts):
header "calls Rust ToolRegistry via Tauri invoke"; OpenAI-format tools named `{connector_id}__{tool_name}`
(L10 area); `executeToolCall` returns the error envelope `{role:'tool', tool_call_id, name, content,
is_error:true}` (3 `is_error` occurrences in the saved file); native-tool-unavailable is returned as a
tool error, not an exception — the model self-corrects. README facts from search (Proton announcement,
Nov 17 2026): connectors registered into a ToolRegistry, exposed as OpenAI-format tools; approvals:
"every tool is set to auto-approve, ask, or disabled. Tools set to ask wait for your answer before they
run"; scheduled execution guard throws rather than executes silently.

Design consequences for our D-4 and D-5:
- Approval states have a shipped precedent in a gated-agent desktop product —
  `auto-approve / ask / disabled` maps onto our `AUTOAPPROVE / ASK / NEVER` (with our + `YOLO`
  and the external-reading modifier). The settings UI owes nothing novel for the shape.
- Adopt the OpenAI-format tool-error envelope (`is_error: true`, error as tool content) as our
  validator seam's machine-readable error convention — it is the emerging ecosystem shape, and our
  prototype already round-trips it.
- Tool naming: namespace manifest verbs (`vault__readNote`-style or plugin-prefixed), following the
  connector__tool precedent — one more reason two plugins' verbs cannot collide.

## 3. Name collision flag

"Lumo" is also a different Windows desk-companion project (`Rccrd12/Lumo`) in agent-adjacent circles;
the Proton one is meant here. And Proton Lumo's inference runs through Proton's servers — relevant only
if an external client were ever chosen; OQ-1 resolves to the in-plugin client, so this stays a note,
not a design input.
