# Obsidian native verb surface — measured at the source

**Method (2026-11-26):** `curl` of `obsidianmd/obsidian-api` `master/obsidian.d.ts` (307,387 bytes,
saved at `research/raw/obsidian.d.ts`; HTTP 200), greps/awk against that file. All line numbers refer
to that saved copy. Where the d.ts is silent, that silence IS the finding: the official published API
is what a plugin may rely on; untyped surfaces need runtime verification at build time.

## 1. Vault — the full structural CRUD (line 10212: `export class Vault extends Events`)

Measured methods: `getName`, `getFileByPath`, `getFolderByPath`, `getAbstractFileByPath`, `getRoot`,
`create(path, data, opts)`, `createBinary`, `createFolder`, `read(file)`, `readBinary`, `getResourcePath`,
`delete(file, force?)`, `rename(file, newPath)`, `modify(file, data, opts)`, `modifyBinary`,
`append(file, data, opts)`, `appendBinary`; `getMarkdownFiles(): TFile[]` at line 10448.

Design consequence: these are the **native tool verbs**. The write surface the gate law (D-4) covers is
exactly: `create`, `modify`, `append`, `delete`, `rename`, `createFolder`. `rename` is the mutation whose
diff is a path change. `append` is worth keeping in the manifest (memory stores append; cheap diff).

## 2. Structure facts — MetadataCache + CachedMetadata

`export class MetadataCache extends Events` (line 6452): official surface measured as
`getFirstLinkpathDest`, `getFileCache(file)`, `getCache(path)`, `fileToLinktext`, plus events
(`changed`, `deleted`, `resolve`, `resolved`).

`interface CachedMetadata` (line 2391) carries the authoritative structure: `links`, `embeds`, `tags`,
`headings`, `footnotes`, `footnoteRefs`, `referenceLinks`, `sections`, `listItems`, `frontmatter`,
`frontmatterPosition`, `frontmatterLinks`, `blocks`.

Design consequence: tags/frontmatter/links/headings answers ride `metadataCache.getFileCache` — Obsidian
owns them (D-1). Events (`changed`/`deleted`) give freshness for free: a semantic/door result can be
flagged stale against cache change events — supports the door's honest-label duty at low cost.

## 3. Findings on what is NOT in the official published API

- **Lexical search:** no `SearchQuery`/`search.query` in this d.ts (grep: no `class SearchQuery`, no
  `search(` in a class surface). Core has a search plugin at runtime (`this.search.query`), but it is
  **not officially typed**; community typings (obsidian-typings) cover it. Design must verify it at
  runtime, or expose lexical search via core's untyped surface with a written justification. Flagged,
  not assumed.
- **Command palette — CORRECTED by Dan's act 2026-11-26 (D-9): the palette is API/MCP-facing.** The
  official typings do expose the command object: `export interface Command` at line 2826 — `id`, `name`,
  `icon`, `mobileOnly`, `repeatable`, `callback`, `checkCallback`, `editorCallback`, `editorCheckCallback`,
  `hotkeys`. `addCommand(Command)` is official registration. So registered commands are callable objects,
  and the manifest may legitimately expose palette commands as a tool family (direct `callback` invocation).
  And Dan's measured act 2026-11-26: plugins can run any palette command via the API —
  `app.commands.executeCommandById("daily-notes:show-today")`.
- **The core command surface, measured in community core typings** (`@obsidian-typings/obsidian-public-1.15.1`,
  saved at `raw/typings-1.15.1/package/dist/esm/types.d.mts`; these type the actual core implementation, so
  they are the API as made available, per Dan's steer): `export interface Commands extends Events` —
  `app: App`, `commands: CommandsCommandsRecord`, `editorCommands: CommandsEditorCommandsRecord`,
  `addCommand(Command)`, `executeCommand(Command): boolean`, **`executeCommandById(commandId: string): boolean`**,
  `findCommand(commandId): Command | undefined`. The palette plugin itself: `CommandPalettePluginInstance`
  carries `getCommands(): Command[]` and `recentCommands: string[]`. So palette commands are addressed by
  `namespace:name` ids (`daily-notes:show-today`) and executing any registered command — own or foreign —
  is a typed core call, not a leap of faith nor a runtime gamble.
- **`obsidian://` URI API:** not touched this pass (external client was NOT chosen — OQ-1 resolves to the
  in-plugin client, so URIs are out of scope). Recorded as a gap, not a finding.
- **Mobile/desktop:** unmeasured. If the restart ever ships mobile, the API assumptions here are desktop-measured;
  flag for the release acts.

## 4. Mapping implication (the ledger's REBUILD rows)

The manifest's structural families map 1:1: list/read/write/edit(=modify)/append/create/delete/rename
→ Vault methods; tags/properties/links/headings → `CachedMetadata` via `MetadataCache`; free lexical
search → core search (untyped: verify at runtime); semantic `notesLike` → Muninn door (the only family
with no native verb). The second-source criterion (criterion 3) has exactly one survivor on the Muninn
side: the embedding index, because nothing in this file has an equivalent.
