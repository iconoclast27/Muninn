// =============================================================================
// Muninn — F25: Plugin 2 Harness Skeleton
// src/fixtures/f25.ts
//
// CONTRACT TEXT (Plugin 2 harness machinery):
//   PASS requires:
//     H1  A Markdown recipe can be parsed from disk.
//     H2  The loader discovers recipe files and rejects malformed recipes.
//     H3  The renderer substitutes gathered inputs into the recipe.
//     H4  A fake LLM response is parsed and validated against the output schema.
//     H5  Schema violations are reported as typed validation errors.
//     H6  The diff gate computes changes between before-state and model output.
//     H7  The apply registry only runs after approval; no-op routine is testable.
//     H8  The full harness run returns a RecipeRunResult with all fields set.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f25.ts
// =============================================================================

import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadRecipes, findRecipe } from '../recipes/loader.ts';
import { NodeRecipeSource } from '../recipes/node-source.ts';
import { MuninnHarness, ManualInputGatherer, StaticApprovalGate } from '../harness/harness.ts';
import { FakeLlmClient } from '../llm/client.ts';
import { createDefaultApplyRegistry } from '../harness/apply.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

const RECIPE_MD = `---
name: tag-test-skill
version: 0.1.0
modelTier: fast
riskClass: read-only
---

# Trigger
Test recipe for the harness skeleton.

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
`;

async function main(): Promise<void> {
    console.log('[F25] Plugin 2 harness skeleton');

    const recipesDir = join(tmpdir(), `muninn-f25-${Date.now()}`);
    mkdirSync(recipesDir, { recursive: true });

    try {
        writeFileSync(join(recipesDir, 'tag-test.md'), RECIPE_MD, 'utf-8');
        writeFileSync(join(recipesDir, 'broken.md'), '---\nname: no-version\n---\n', 'utf-8');

        const source = new NodeRecipeSource(recipesDir);
        const result = await loadRecipes(source);

        check('H1/H2 parses valid recipe and rejects broken recipe',
            !result.ok && result.errors.some((e) => e.includes('broken.md')) && result.recipes.length === 1,
            result.errors.join('; '));
        check('H2 valid recipe name', result.recipes[0]?.metadata.name === 'tag-test-skill');

        const recipe = findRecipe(result.recipes, 'tag-test-skill');
        check('H2 findRecipe returns recipe', recipe !== undefined);
        if (!recipe) {
            console.log('[F25] VERDICT: RED — fixture precondition failed');
            process.exit(1);
            return;
        }

        const values = new Map<string, unknown>([
            ['targetPath', 'notes/alpha.md'],
            ['candidateTags', JSON.stringify(['ml', 'ops'])],
        ]);
        const inputs = new ManualInputGatherer(values);
        const gathered = await inputs.gather(recipe);
        check('H3 inputs gathered', gathered.length === 2 && gathered.some((i) => i.key === 'targetPath' && i.value === 'notes/alpha.md'));

        const goodJson = JSON.stringify({ tag: 'ml', confidence: 0.9 });
        const harness = new MuninnHarness({
            llmClient: new FakeLlmClient(goodJson),
            inputGatherer: inputs,
            approvalGate: new StaticApprovalGate(true),
            applyRegistry: createDefaultApplyRegistry(),
        });
        const run = await harness.run(recipe, {}, {});

        check('H3 prompt contains substituted inputs',
            run.renderedPrompt.includes('notes/alpha.md') && run.renderedPrompt.includes('ml'));
        check('H4 valid JSON parsed', run.parsedOutput.json !== undefined);
        check('H4 schema validates', run.schemaValid, run.schemaErrors.map((e) => e.message).join('; '));
        check('H6 diff computed', run.diff.changes.length > 0, JSON.stringify(run.diff.changes));
        check('H7 approved applies',
            run.approved === true && run.applyResult !== null && run.applyResult.applied === false,
            JSON.stringify(run.applyResult));
        check('H8 result has recipeName', run.recipeName === 'tag-test-skill');
        check('H8 result has groundTruthValid default', run.groundTruthValid === true);

        const badHarness = new MuninnHarness({
            llmClient: new FakeLlmClient(JSON.stringify({ tag: 'ml' })), // missing confidence
            inputGatherer: inputs,
            approvalGate: new StaticApprovalGate(true),
            applyRegistry: createDefaultApplyRegistry(),
        });
        const badRun = await badHarness.run(recipe, {}, {});
        check('H5 schema violation reported', !badRun.schemaValid, badRun.schemaErrors.map((e) => e.message).join('; '));
        check('H5 apply skipped on schema failure', badRun.applyResult === null);

        const rejectedHarness = new MuninnHarness({
            llmClient: new FakeLlmClient(goodJson),
            inputGatherer: inputs,
            approvalGate: new StaticApprovalGate(false),
            applyRegistry: createDefaultApplyRegistry(),
        });
        const rejectedRun = await rejectedHarness.run(recipe, {}, {});
        check('H7 rejection skips apply',
            rejectedRun.approved === false && rejectedRun.applyResult?.applied === false,
            JSON.stringify(rejectedRun.applyResult));

        const nullHarness = new MuninnHarness({
            llmClient: new FakeLlmClient(null),
            inputGatherer: inputs,
            approvalGate: new StaticApprovalGate(true),
            applyRegistry: createDefaultApplyRegistry(),
        });
        const nullRun = await nullHarness.run(recipe, {}, {});
        check('H4 null LLM output reported', !nullRun.schemaValid, nullRun.schemaErrors.map((e) => e.message).join('; '));

        console.log(failures === 0
            ? '[F25] VERDICT: GREEN'
            : `[F25] VERDICT: RED — ${failures} failure(s)`);
        process.exit(failures === 0 ? 0 : 1);
    } finally {
        try { rmSync(recipesDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
}

main();
