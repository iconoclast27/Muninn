# Muninn — Plugin 2 Harness Skeleton

**Status:** skeleton implemented 2026-11-06
**Scope:** recipe loader, renderer, JSON-schema validator, diff gate, apply registry, LLM client abstraction, harness orchestrator. Builds against the frozen Plugin 1 API in `src/api.ts`.

This harness enforces the project doctrine: **the model judges; the harness acts**. No LLM receives a tool menu. Recipes are declarative Markdown forms with a strict JSON output contract; the harness validates the model's output against schema and (eventually) vault truth before any apply routine runs.

## Recipe format

A recipe is a Markdown note with YAML frontmatter for metadata and H1 sections for the remaining fields.

```markdown
---
name: tag-test-skill
version: 0.1.0
modelTier: fast
riskClass: read-only
---

# Trigger
One-line description of when to run this recipe.

# Inputs
- key: targetPath
  description: Path to the note to examine
  source: recipe-param
- key: candidateTags
  description: Available tag vocabulary
  source: constant

# Instructions
Given note {{targetPath}} and tags: {{candidateTags}}, choose the best tag.
Return JSON only.

# Output Contract
{
  "type": "object",
  "required": ["tag", "confidence"],
  "properties": {
    "tag": { "type": "string" },
    "confidence": { "type": "number" }
  }
}

# Apply Method
noop

# Validation
- path: /tag
  source: vault-file
  check: matches-frontmatter
```

### Field reference

| Section | Purpose |
|---------|---------|
| `metadata` | `name`, `version`, `modelTier` (`fast` \| `capable`), `riskClass` (`read-only` \| `suggest`) |
| `Trigger` | Human-readable dispatch condition |
| `Inputs` | List of `{ key, description, source }`. Source may be `query`, `path`, `vocabulary`, `constant`, or `recipe-param`. |
| `Instructions` | Prompt body with `{{key}}` placeholders substituted by the harness |
| `Output Contract` | JSON Schema object constraining the model's response |
| `Apply Method` | Name of a harness-registered apply routine. Skeleton ships with `noop`. |
| `Validation` | Ground-truth checks against vault state (currently stubbed; parser accepts `vault-file` rules) |

## Harness flow

1. **Load** — `loadRecipes(source)` discovers `.md` recipes and parses them. Malformed recipes are reported but do not stop the others.
2. **Gather** — `InputGatherer` assembles inputs before the model sees anything (e.g., tag vocabulary from `MuninnApi.tagVocabulary()`).
3. **Render** — `renderRecipe()` replaces `{{key}}` placeholders and appends the JSON output contract.
4. **Complete** — `LlmClient.complete(prompt)` returns raw text.
5. **Parse + schema validate** — output must be valid JSON and match the recipe's output schema. Violations are returned as typed `ValidationError`s.
6. **Diff** — `computeDiff(beforeState, afterState)` lists every change for human review.
7. **Approve** — `ApprovalGate` returns `true`, `false`, or `null`. Write-class recipes are deferred; the skeleton defaults to reject.
8. **Apply** — the routine named by `Apply Method` runs only after approval. The model cannot invoke routines directly.

## Source modules

| Module | Responsibility |
|--------|----------------|
| `src/recipes/types.ts` | Recipe shapes, JSON schema subset, run result types |
| `src/recipes/parser.ts` | Parse Markdown recipe into `Recipe` |
| `src/recipes/loader.ts` | Source-agnostic loader + `findRecipe` |
| `src/recipes/node-source.ts` | `RecipeSource` for Node fixtures |
| `src/recipes/obsidian-source.ts` | `RecipeSource` for Obsidian vault folders |
| `src/recipes/renderer.ts` | Substitute inputs into instructions and output schema |
| `src/harness/validator.ts` | Minimal JSON-schema validator |
| `src/harness/diff.ts` | Value diff gate + text render |
| `src/harness/apply.ts` | Apply-routine registry |
| `src/llm/client.ts` | `LlmClient` interface + fake/echo clients |
| `src/harness/harness.ts` | `MuninnHarness` orchestrator |
| `src/fixtures/f25.ts` | Fixture policing the skeleton end-to-end |

## Wiring into Muninn

The harness lives as a private `MuninnHarness` property on `MuninnPlugin` in `src/main.ts`. It is **not** part of the frozen `MuninnApi`. A skeleton command, **"Run Muninn test recipe"**, loads the first `.md` recipe from `Muninn/Recipes/` and logs the `RecipeRunResult` to the Obsidian console.

The skeleton uses a fake LLM client by default, but `OllamaChatClient` is implemented in `src/llm/client.ts` for real chat completions to `localhost:11434/api/chat`. The `suggest-tags` apply routine returns a structured suggestion without writing to the vault; write-class apply routines are deferred per the Unified Project Definition gate ruling.

## What is owed

- ✅ Real input gatherers that call `MuninnApi.searchText`, `searchSemantic`, `relatedChunks`, and `tagVocabulary` — `MuninnInputGatherer` in `src/harness/gather.ts`.
- Ground-truth validation against vault files and frontmatter.
- ✅ A real `LlmClient` adapter — `OllamaChatClient` in `src/llm/client.ts`.
- ✅ First skill end-to-end — tag assignment recipe + fixture F26.
- Obsidian command to run a chosen recipe by name with a user-supplied target path.
- Port of generic modules to Huginn once `~/Projects/Huginn` infrastructure is set up.
