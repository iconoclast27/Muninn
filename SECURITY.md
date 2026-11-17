# Muninn Security Policy

**Private, experimental software. No warranty. No public issue channel.** Muninn is a personal
plugin for a personal vault, developed for local use with Dan as the sole maintainer and ruling
authority (ADR-21). There is no security bounty programme, no embargo process, and no promise of
timely response. Report problems to Dan directly.

## What Muninn touches

- **Vault content is read from disk and sent to local Ollama** for embeddings and semantic search
  (`nomic-embed-text:v1.5`). Nothing is sent to any hosted API. The base URL is a user setting
  (default `http://localhost:11434`).
- **The index lives in the plugin folder** as SQLite (WASM, `sqlite-wasm`, with an in-memory fallback);
  Zone 2 is per-device by construction, and Obsidian Sync ferries the canonical quartet only
  (Muninn ADR-1, ADR-2). Derived state is disposable; it never damages durable state.
- **No secrets are stored by Muninn.** If a note contains a secret, that note is indexed, embedded, and
  searchable; indexing a secret-bearing vault is a user decision, and Muninn has no redaction layer.
- **The API door is frozen at five methods** (`getMuninnApi()`, ADR-36); `listNotes` is **Proposed**
  (ADR-37, ruling owed). Additive methods are rulings, not implementation decisions.

## The write lane

Muninn has **no write path to vault content.** It indexes and answers queries. All vault mutation is
Huginn's, and every Huginn write is gated by human approval with that write's evidence in front of the
approver (`Huginn/docs/Serial Contextual Operations Design (Ruled).md`, R5, R10). Muninn forbids vault
enumeration in Huginn (`app.vault.getMarkdownFiles()`): a second source of truth is a safety defect, not
a convenience (ADR-34).

## Model layer

Model output is inert payload, never an instruction (Muninn ADR-31; Huginn R6). Instructions arising
from tool output are refused. Model roster closures (qwen, Gemma4:12b) are recorded in the ADR set
(ADR-21); the paid `kimi` plugin is the known-good path with a declared ~$120 cap. No model has
approval authority, and no model can reach the vault.

## External requirements

Obsidian desktop `minAppVersion 0.15.0`; local Ollama with the embedding model pulled; Node and tsx for
development. `isDesktopOnly: false` in `manifest.json:10` is correct: the flag blocks activation on
mobile, not function, and the mobile read lane runs with zero native imports (ADR-14; the live mobile
index receipt is owed, T5, parked by Dan as a question, not a bug).
