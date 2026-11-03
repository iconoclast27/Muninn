---
source:
status: living document
para:
context:
description:
Topics:
Concepts:
Meeting notes:
Permanent: false
type: note
word_count: 1
language: en
updated:
modified: 
---
# Gitingest — Paste Generation Playbook (rev. 2026-11-01)

> [!abstract] Purpose Reference for turning the Vault Overseer repo into Lumo-readable pastes. Gitingest is the bulk channel; the Project Reader tool is the surgical channel. This note records which to reach for, when, and why — including the traps that cost us a session.

## The problem this solves

Lumo's retrieval layer is unreliable for code: web extraction truncates file trees (the `watcher/` directory never appeared in scrapes), Tavily scrambles code formatting, and pasted files can be chewed up mid-session. Pastes are the only trustworthy channel for detail.

But pastes have a second limit: **context size**. A full-repo gitingest digest of this project ran to 16,480 lines — far past what any single chat can ingest. So the goal is not "biggest possible paste," it is **the smallest paste that answers the question**.

Two channels, two jobs:

| Channel | Job | Strength | Limit |
|---|---|---|---|
| **Gitingest** (host CLI) | Bulk snapshots, archive digests, whole-subsystem reads | Complete, deterministic, one command | Size — must be sliced |
| **Project Reader** (open-webui tool) | On-demand single files, searches, exploration | Live, surgical, no context cost until asked | Model must ask; one file at a time |

## Install — host only, never in the container

```fish
pipx install gitingest
```

`pipx` keeps it in an isolated environment and puts the command on PATH. Verify:

```fish
gitingest --help
```

> [!warning] Do NOT install gitingest inside the open-webui container. The container is regenerated from its image on every update (`podman pull` + `systemctl --user restart open-webui`), so anything pip-installed inside it evaporates at the next update — the same class of mistake as an undeclared mount. Host-side via pipx is durable.

> [!note] Flag verification owed. The `-i` include filter is confirmed working (used successfully 2026-11-01). Other flags below are drawn from the tool's documented behaviour but **should be confirmed against `gitingest --help`** before being trusted as written. Treat this note's command examples as templates, not gospel.

## Recipe book — by situation

### 1. One subsystem (the common case)

When a session needs a coherent slice — the FTS lane, the eventlog, the fixtures:

```fish
gitingest ~/Projects/vault-overseer/vault-overseer-index -i src/fts/ -o /tmp/fts-digest.txt
wc -l /tmp/fts-digest.txt
```

Read the line count **before** pasting. Under ~2,000 lines, paste whole. Above that, split.

### 2. Documentation only

Handover material, doctrine, specs — no code:

```fish
gitingest ~/Projects/vault-overseer/vault-overseer-index -i docs/ -o /tmp/docs-digest.txt
```

### 3. Mixed slice (code plus the docs that constrain it)

```fish
gitingest ~/Projects/vault-overseer/vault-overseer-index \
  -i src/fts/ src/eventlog/ docs/event-log-schema.md docs/architecture-map.md \
  -o /tmp/slice.txt
```

### 4. Whole repo (rare — check size first)

```fish
gitingest ~/Projects/vault-overseer/vault-overseer-index -o /tmp/full-digest.txt
wc -l /tmp/full-digest.txt
```

Only viable for a fresh-context session that needs the entire picture, and only in chunks. Expect ~16,000 lines for the current tree.

### 5. From GitHub instead of disk

Useful when verifying that disk matches remote, or reading a specific commit:

```fish
gitingest https://github.com/iconoclast27/vault-overseer-index
```

Note: the web app equivalent works by swapping `github.com` for `gitingest.com` in any repo URL — no install needed, but it sends the request to a third-party service. For this project, prefer the local CLI.

### 6. Splitting a large digest for chunked pasting

```fish
split -l 2500 /tmp/full-digest.txt /tmp/chunk-
ls /tmp/chunk-*
```

Paste each chunk as "Part N of M" and Lumo stitches them. Slower and clumsier than slicing with `-i` — use only when the whole thing is genuinely needed.

## Size discipline

Before every paste, know the size. Cheap habits:

```fish
wc -l /tmp/digest.txt          # line count
wc -c /tmp/digest.txt          # byte count
head -40 /tmp/digest.txt       # confirm it's the slice you meant
```

Rules of thumb for this project:

- **Under 2,000 lines** — paste whole, one message.
- **2,000–6,000 lines** — consider narrowing with `-i` first; if unavoidable, two or three parts.
- **Over 6,000 lines** — almost certainly the wrong tool. Use Project Reader to read the specific files the session actually needs.

The 16,480-line incident is the cautionary tale: a complete digest is not a useful digest.

## Architecture options — ranked

### Option A — Host CLI (recommended, in use)

Gitingest on the host, invoked by hand or via a fish alias. Zero infrastructure, zero risk, immediate.

Suggested aliases for `~/.config/fish/config.fish`:

```fish
set -l VO ~/Projects/vault-overseer/vault-overseer-index
alias vo-all  "gitingest $VO -o /tmp/vo-full.txt; wc -l /tmp/vo-full.txt"
alias vo-src  "gitingest $VO -i src/ -o /tmp/vo-src.txt; wc -l /tmp/vo-src.txt"
alias vo-docs "gitingest $VO -i docs/ -o /tmp/vo-docs.txt; wc -l /tmp/vo-docs.txt"
alias vo-fts  "gitingest $VO -i src/fts/ -o /tmp/vo-fts.txt; wc -l /tmp/vo-fts.txt"
```

Each alias ends by printing the line count, so the size is always in view before pasting.

### Option B — Extend the Project Reader tool (surgical, no new services)

Add a `dump_project_digest(path, filters)` function to the existing tool that assembles gitingest-format output (tree + concatenated contents) in pure Python, reusing the tool's existing path-containment and read-only guarantees. Roughly twenty lines of addition; no write or exec primitives introduced.

**Trade-off:** the digest flows through the chat, so context cost scales with dump size. Excellent for `src/fts/`; painful for the whole repo. Gains: the model can decide what to ingest conversationally ("just the fts lane, skip fixtures").

### Option C — Gitingest as an OpenAPI tool server (heaviest)

A small FastAPI service on the host wrapping gitingest, registered via open-webui's native tool-server support (available in open-webui v0.6+). Exec happens on the host, outside the container; the model can only invoke what the server exposes.

**Cost:** a new service, a new quadlet, ongoing maintenance. **Benefit over B:** marginal, unless B's context cost proves painful in practice.

> [!tip] Recommendation Standing order: **A now, B if the model needs to choose its own slices, C only if B measurably hurts.** Do not build C speculatively.

## Decision table

| Situation | Reach for |
|---|---|
| Session needs 1–3 specific files | Project Reader — read each by path |
| Session needs a whole subsystem | Gitingest with `-i src/<module>/`, check line count |
| Session needs to search for a symbol | Project Reader — `search_project_text` |
| Fresh session needs the full picture | Gitingest whole repo, chunked, or a curated `-i` slice |
| Archiving a snapshot for the record | Gitingest whole repo to a dated file on disk |
| Verifying disk matches remote | `gitingest <github-url>` and compare |
| Feeding a reviewer agent | Project Reader (live) — not a static digest |
| Something in the repo changed mid-session | Project Reader — digests go stale, live reads don't |

## Traps and caveats

1. **Ghost files.** The retrieval layer sometimes presents old session content as though it were a fresh paste. A paste only counts when Dan says he pasted it. If a file arrives unexpectedly, challenge it before ingesting.
2. **Container installs evaporate.** Covered above, repeated because it will happen again: anything installed inside open-webui dies at the next image update.
3. **Digests go stale immediately.** This repo moves daily. A digest is a photograph; Project Reader is a window. For anything that must reflect current disk state, use the window.
4. **`node_modules` inflates everything.** Include filters should always be used on this repo — the dependency tree dwarfs the actual source.
5. **Line count is the budget.** Print it before pasting. Every time.
6. **Frontmatter timestamps are not evidence.** Per project doctrine, `modified:` in frontmatter never auto-updates for docs outside the vault. Revision dates live in the body (`rev. YYYY-MM-DD`).

## Relationship to the project doctrines

This playbook is an application of two standing rules:

- **Receipts or nothing.** A digest is a receipt of file contents at a moment in time. Cite it as such; do not treat it as current truth indefinitely.
- **Ask, don't guess.** When a session needs a file it hasn't seen, the correct move is a paste request — via Project Reader or gitingest — never a reconstruction from memory.

## Footer — revision log

- **rev. 2026-11-01** — Initial note. Records the two-channel model (gitingest bulk / Project Reader surgical), the host-only install rule, the recipe book, the three architecture options with a standing recommendation, and the size discipline learned from the 16,480-line digest incident. Flags owed: confirm non-`-i` CLI flags against `gitingest --help`.
