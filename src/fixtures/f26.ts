// =============================================================================
// Muninn — F26: Skill #1 (Tag Assignment) End-to-End
// src/fixtures/f26.ts
//
// CONTRACT TEXT (first Plugin 2 skill):
//   PASS requires:
//     S1  The tag-assignment recipe loads and parses from disk.
//     S2  MuninnInputGatherer resolves vocabulary from MuninnApi.tagVocabulary().
//     S3  MuninnInputGatherer resolves relatedChunks from MuninnApi.relatedChunks().
//     S4  MuninnInputGatherer resolves text hits from MuninnApi.searchText().
//     S5  The harness renders all inputs into the prompt.
//     S6  A valid model output passes schema validation and suggest-tags apply.
//     S7  An invalid model output (missing confidence) fails schema validation.
//     S8  The recipe uses the 'suggest-tags' apply method and remains read-only.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f26.ts
// =============================================================================

import { chunkNote } from '../chunker/chunker.ts';
import { openStore } from '../store/store.ts';
import { IntakeLane } from '../intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient } from '../api.ts';
import { CHUNKER_CP } from '../chunker/chunker.ts';
import { parseRecipe } from '../recipes/parser.ts';
import { MuninnHarness, StaticApprovalGate } from '../harness/harness.ts';
import { MuninnInputGatherer } from '../harness/gather.ts';
import { FakeLlmClient } from '../llm/client.ts';
import { createDefaultApplyRegistry } from '../harness/apply.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

const enc = new TextEncoder();

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function noteBytes(title: string, body: string, tags?: string[]): Uint8Array {
    const fm = tags ? `---\ntags: [${tags.map((t) => `'${t}'`).join(', ')}]\n---\n` : '---\n---\n';
    return enc.encode(`${fm}# ${title}\n\n${body}\n`);
}

class FakeEmbedClient implements EmbedClient {
    async embed(inputs: { vh: string; text: string }[]): Promise<{ vh: string; vector: Uint8Array; dim: number; model_tag: string; epoch: number }[] | null> {
        return inputs.map((i) => {
            const dim = 768;
            const floats = new Float32Array(dim);
            // Deterministic but distinct vector per input text length so relatedChunks has signal.
            floats[0] = i.text.length / 1000;
            return {
                vh: i.vh,
                vector: new Uint8Array(floats.buffer),
                dim,
                model_tag: 'fake/model',
                epoch: 1,
            };
        });
    }
}

class FakeFileSource {
    constructor(private files: Map<string, Uint8Array>) {}

    async listFiles(): Promise<string[]> {
        return [...this.files.keys()];
    }

    async readFile(path: string): Promise<{ path: string; bytes: Uint8Array; mtime: number } | null> {
        const bytes = this.files.get(path);
        if (!bytes) return null;
        return { path, bytes, mtime: 1 };
    }
}

async function main(): Promise<void> {
    console.log('[F26] Skill #1 — tag assignment end-to-end');

    const files = new Map<string, Uint8Array>([
        ['notes/alpha.md', noteBytes('Alpha', 'Machine learning is fun.', ['ml'])],
        ['notes/beta.md', noteBytes('Beta', 'Operations dashboards.', ['ops'])],
        ['notes/gamma.md', noteBytes('Gamma', 'A note about neural networks.', [])],
    ]);

    const store = await openStore(':memory:');
    const source = new FakeFileSource(files);
    const lane = new IntakeLane({
        store,
        source: source as never,
        embedClient: new FakeEmbedClient(),
        modelTag: 'fake/model',
        epoch: 1,
        chunkerCp: CHUNKER_CP,
    });

    const reindexResult = await lane.forceReindex();
    check('S0 reindex completes', reindexResult !== null && reindexResult.files === 3, JSON.stringify(reindexResult));

    const api: MuninnApi = createMuninnApi(store, null, laneReindexer(lane));

    const recipePath = join(import.meta.dirname ?? '.', '../recipes/tag-assignment.md');
    const recipeSource = readFileSync(recipePath, 'utf-8');
    const parsed = parseRecipe(recipeSource, recipePath);
    check('S1 tag-assignment recipe parses', parsed.ok && parsed.recipe?.metadata.name === 'tag-assignment', parsed.errors.join('; '));

    if (!parsed.ok || !parsed.recipe) {
        console.log('[F26] VERDICT: RED — recipe precondition failed');
        process.exit(1);
        return;
    }

    const recipe = { ...parsed.recipe, sourcePath: recipePath };

    const gatherer = new MuninnInputGatherer({ api, defaultTargetPath: 'notes/gamma.md' });
    const inputs = await gatherer.gather(recipe, { targetPath: 'notes/gamma.md', titleQuery: 'neural networks' });
    check('S2 vocabulary resolved', inputs.some((i) => i.key === 'vocabulary' && Array.isArray((i.value as { tags?: unknown[] }).tags)));
    check('S3 relatedChunks resolved', inputs.some((i) => i.key === 'relatedChunks' && Array.isArray((i.value as { neighbors?: unknown[] }).neighbors)));
    check('S4 relatedTextHits resolved', inputs.some((i) => i.key === 'relatedTextHits' && i.value !== null && Array.isArray((i.value as { hits?: unknown[] }).hits)));

    const validJson = JSON.stringify({ tag: 'ml', reason: 'The note is about neural networks, matching the ml corpus.', confidence: 0.85 });
    const harness = new MuninnHarness({
        llmClient: new FakeLlmClient(validJson),
        inputGatherer: gatherer,
        approvalGate: new StaticApprovalGate(true),
        applyRegistry: createDefaultApplyRegistry(),
    });
    const run = await harness.run(recipe, { targetPath: 'notes/gamma.md' }, {});

    check('S5 prompt contains target path', run.renderedPrompt.includes('notes/gamma.md'));
    check('S5 prompt contains vocabulary', run.renderedPrompt.includes('"tags"'));
    check('S6 schema validates', run.schemaValid, run.schemaErrors.map((e) => e.message).join('; '));
    check('S6 suggest-tags apply runs', run.applyResult?.applied === false && run.applyResult?.message.includes('ml'), JSON.stringify(run.applyResult));
    check('S8 recipe uses suggest-tags', run.applyResult !== null && run.applyResult.message.includes('suggest-tags'));

    const invalidHarness = new MuninnHarness({
        llmClient: new FakeLlmClient(JSON.stringify({ tag: 'ml', reason: 'missing confidence' })),
        inputGatherer: gatherer,
        approvalGate: new StaticApprovalGate(true),
        applyRegistry: createDefaultApplyRegistry(),
    });
    const invalidRun = await invalidHarness.run(recipe, { targetPath: 'notes/gamma.md' }, {});
    check('S7 invalid output fails schema', !invalidRun.schemaValid, invalidRun.schemaErrors.map((e) => e.message).join('; '));
    check('S7 apply skipped on invalid output', invalidRun.applyResult === null);

    console.log(failures === 0
        ? '[F26] VERDICT: GREEN'
        : `[F26] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
