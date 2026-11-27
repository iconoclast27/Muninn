# Design Report — the reborn Huginn + Muninn (authored 2026-11-26 under D-16)

This is the design, not the ledger. Rulings are numbered D-n in `Restart Ledger.md` (one ruling, one
document; this report carries design, and pointers to the acts). Grounding receipts live in
`research/` (`obsidian-verb-surface.md`, `ollama-tool-calling.md`, `external-command-surfaces.md`,
`prototype-findings.md`, `README.md` is the index). Where this design depends on a fact about the
platform, it cites the receipt, not memory.

## 1. The turn anatomy (what one user message costs)

One user message = one conversation in the client loop:

```
system (skill texts) + tools (manifest schemas) + history
  → Ollama /api/chat (native tools, stream)      round 1
  → assistant tool_calls → execute → role:"tool" results (is_error on rejects)
  → … repeat until a message with no tool_calls = the turn's answer
```

No per-step authored prompts, no op dialect, no bespoke envelope — the old loop's ~8 serial authored
calls (~4 min measured, the design's own model) collapse to N model rounds. Doctrine prices **round
count and prompt growth**, never prefill reuse: reuse is model/quantization-dependent, observed yes on
`llama3.2:3b`, no on `qwen3.5:4b` (`prototype-findings.md` §2). The teach layer's real job is fewer,
smaller rounds. Latency floor claim is honest only against tool-capable models; the plugin reads
`capabilities:["tools"]` from `/api/tags`, not a name table (`ollama-tool-calling.md`).

## 2. Three layers: TEACH / VALIDATE / GATE

**TEACH is the SKILL layer (D-10).** The chain: `AGENTS.md` steering → the vocabulary of the tool
recipes → successful payload design. A recipe is payload-shaping text: which verb family a question
class maps to, what a well-formed call looks like, which families must not be confused (lexical vs
semantic, `searchVault`-class vs `notesLike`-class). It rides two channels: skill text in the system
position, and the tool **descriptions** themselves — the schemas' description fields are where the
teach layer attaches (`ollama-tool-calling.md` §3.2). Recipes are rewritten against the real verb
surface; old recipes do not survive (D-8).

**VALIDATE is the choke point.** Every tool call the model makes is parsed and validated before
execution: unknown tool, unknown-shaped args, path escapes (vault-rooting), malformed payload →
a machine-readable error returned **as the role:"tool" content** (`is_error: true`, the
ecosystem shape from `external-command-surfaces.md` §2 — Lumo's envelope; our prototype already
round-trips it, `prototype-findings.md` §5). "The model doesn't get through without a well-formed
call" (survives from the predecessor plan): the validator gates every execution; self-correction is
the model retrying against the error, at the client's round budget.

**GATE is the approval modal.** All vault mutations gated (D-4); the diff shown before apply; the
settings enum NEVER / ASK / AUTOAPPROVE(unless external reading) / YOLO is law (detector per D-13,
rename diff per D-14). Read families are never gated; mutation families always route through the
gate. A gate rejection is not an exception — it is a validator-class `is_error` tool result, so a
model mid-plan can apologize, change plan, or stop, all visible to the user through the modal.

## 3. Authority (D-1): who answers which question

Obsidian answers, directly through its own API: paths/folders, structure (tags, frontmatter, links,
headings), lexical search, palette commands. Muninn answers exactly one question class: "notes like
X" — semantic. The door is one verb family among many, not the only interface (D-2). Huginn never
enumerates the vault except through Obsidian's own objects in-process; no second source of truth.

## 4. The manifest — verb families mapped to the measured API

Mapping receipts cite `obsidian-verb-surface.md` (official `obsidian.d.ts`) and the core-typings
correction (`raw/typings-1.15.1`). Verb naming follows the `connector__tool` precedent: families are
namespaced (e.g. `vault__readNote`, `muninn__notesLike`) so the two plugins' verbs cannot collide.

| Family (model-facing verb) | Underlying API | Receipt |
|---|---|---|
| `listFolder` | Vault folder objects (`getFolderByPath` + children) | verb-surface §1 |
| `readNote` | `vault.read(file)` | verb-surface §1 |
| `create` / `write`(modify) / `append` / `delete` / `rename` / `createFolder` | the measured Vault write surface — exactly the set D-4's gate law covers | verb-surface §1 |
| `tags` / `properties` / `links` / `headings` answers | `metadataCache.getFileCache` → `CachedMetadata{links,embeds,tags,headings,frontmatter,blocks,…}` | verb-surface §2 |
| `searchVault` (lexical) | core's search (`this.search.query`) — **NOT in the official published typings**: runtime-verify at first green, with a written justification | verb-surface §3 |
| palette-command verbs | `app.commands.executeCommandById(id): boolean`, `findCommand`, `getCommands` — typed in the core typings; ids are `namespace:name` (`daily-notes:show-today`) | verb-surface §3 (D-9) + Dan's example act 2026-11-26 |
| `notesLike` (semantic) | the Muninn door — the ONLY family with no native verb (second-source criterion's one survivor) | verb-surface §4 |

Registered `addCommand` entries stay user-facing palette items, AND may also be exposed model-facing
(D-9): same object, two faces. The manifest must NOT re-implement what a family already reaches.

## 5. The door (Muninn, narrowed)

Status: **Draft — awaits Dan's ruling act** (this is the narrowed-contract text; the
T15 lane: implementation is gated on the contract act). See [`decisions/adr-01.md`](decisions/adr-01.md).
One verb: `notesLike` — ranked, scored, honest-labeled. The honest label ("semantic match, not
lexical, not freshness") rides the tool description and the per-result self-description (D-5's
per-result disclosure, "approved, but we'll see if it works": the empirical test is a smoke-task
leg, not yet run). Freshness flag for free: `MetadataCache` `changed`/`deleted` events
(verb-surface §2) mark door results stale without re-embedding. Door implementation sequencing:
Muninn contract first, then the mirror, then the op in the loop (T15 precedent, binding). Expansion
(OQ-G) stays deferred — separate contract acts. Cost finding (ANN >10k) stays open (D-15).

## 6. Memory (D-7 + D-12)

Two kinds shipped: **user memory** ("Remember…" commands → append-only entries) and **chat memory**
(summaries of past turns), stored as the append-only Markdown store at `Agents/Huginn/MEMORY`
(salvaged per the ledger's memory arc: `store.ts`, `obsidian-storage.ts`, `commands.ts`, `ranker.ts`
pure helpers, `kinds.ts` shrunk). Injection anchor: the new client's conversation start — the skill/
system position or a leading role:"user" context block, decided at the wiring seam; the saved-memory
principle survives, its old anchor does not. Budgets/weights ride the two kinds (D-7). Corrections
memory is DEMOLISH (D-12): no failure-taxonomy journal in the new build.

## 7. Model tiers (D-11) — deliberately thin

No nudge policy, no loop-guard ratified: "when it should have [called a tool]" is undefined, and a
tool-less answer is sometimes correct ("summarise this note"). What IS law: the client counts rounds,
caps the loop, and treats a no-tool-call message as the turn's answer. The floor is the user's model
choice; capability (`tools`) is read from `/api/tags`. Tier degradation, if ever designed, is a
future act, not here.

## 8. Fixtures and red-first (re-anchoring plan)

Both chains re-anchor at the new seams after the ground state (red-first at each): manifest →
validator (vault-rooting red here) → gate/modal/diff legs re-verified → client wiring → recipes
rewritten against real commands. The old op-loop arcs (H-f31–H-f36 semantics) and the memory-arc
fixtures (H-f37–H-f41) re-anchor or retire per the ratified ledger rows at the baseline commit —
fixture numbers carry their H-/M- prefixes as ever (T13 convention). Door arcs M-f31–M-f33 ride the
narrowed contract. No first-green guard without written justification; red is earned against
committed code at the intended seam.

## 9. What this design does NOT decide (open, on the record)

- Tool-skip policy (D-11 open); disclosure self-description efficacy (empirical test owed);
  ANN cost (D-15); door expansion (OQ-G); runtime verification of `search.query` (owed at first
  green); mobile/desktop measurement; GPU-class timings; `stream:true` accumulation details
  (research README's owed-gaps list).

## 10. Procedure pointer

The restart sequence, demolition ordering, history-surgery authorization, and smoke/release ritual
are in `Restart Ledger.md` §9 — this report does not restate them.
