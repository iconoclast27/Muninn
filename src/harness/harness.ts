// =============================================================================
// Muninn — Plugin 2 Harness
// src/harness/harness.ts
//
// Orchestrator: load a recipe, gather inputs, render the prompt, call the LLM,
// validate output against the recipe schema, compute the diff, then run the
// apply routine only after approval. The model never sees a tool menu; it fills
// a form and the harness acts.
// =============================================================================

import type {
    LoadedRecipe,
    GatheredInput,
    RecipeRunResult,
    ApplyResult,
    ValidationError,
} from '../recipes/types.ts';
import { createRenderContext, renderRecipe } from '../recipes/renderer.ts';
import { validateJson } from './validator.ts';
import { computeDiff } from './diff.ts';
import type { ApplyRegistry } from './apply.ts';
import type { LlmClient } from '../llm/client.ts';

export interface InputGatherer {
    gather(recipe: LoadedRecipe, params?: Record<string, unknown>): Promise<GatheredInput[]>;
}

export interface ApprovalGate {
    /** Return true to allow apply, false to reject, null to leave unapproved (tests). */
    approve(diffText: string, output: unknown): Promise<boolean | null>;
}

export interface HarnessOptions {
    llmClient: LlmClient;
    inputGatherer: InputGatherer;
    approvalGate: ApprovalGate;
    applyRegistry: ApplyRegistry;
}

export class MuninnHarness {
    constructor(private opts: HarnessOptions) {}

    async run(
        recipe: LoadedRecipe,
        params?: Record<string, unknown>,
        beforeState?: unknown,
    ): Promise<RecipeRunResult> {
        const inputs = await this.opts.inputGatherer.gather(recipe, params);
        const rendered = renderRecipe(createRenderContext(recipe, inputs));

        const raw = await this.opts.llmClient.complete(rendered.prompt);
        const parsedOutput: { raw: string; json: unknown | undefined } = {
            raw: raw ?? '',
            json: undefined,
        };

        let schemaValid = false;
        const schemaErrors: ValidationError[] = [];
        let groundTruthValid = true;
        const groundTruthErrors: ValidationError[] = [];

        if (raw === null) {
            schemaErrors.push({ path: '', message: 'LLM client returned null' });
        } else {
            try {
                parsedOutput.json = JSON.parse(raw);
            } catch (e) {
                schemaErrors.push({
                    path: '',
                    message: `Output is not valid JSON: ${(e as Error).message}`,
                });
            }

            if (parsedOutput.json !== undefined) {
                const schemaResult = validateJson(parsedOutput.json, recipe.outputSchema);
                schemaValid = schemaResult.ok;
                schemaErrors.push(...schemaResult.errors);
            }
        }

        const afterState = parsedOutput.json;
        const diff = computeDiff(beforeState ?? {}, afterState ?? {});

        let approved: boolean | null = null;
        let applyResult: ApplyResult | null = null;

        if (schemaValid && groundTruthValid) {
            approved = await this.opts.approvalGate.approve(JSON.stringify(diff.changes), afterState ?? {});
            if (approved === true) {
                const routine = this.opts.applyRegistry.get(recipe.applyMethod);
                if (!routine) {
                    applyResult = { applied: false, message: `Unknown apply method: ${recipe.applyMethod}` };
                } else {
                    applyResult = await routine(recipe, afterState ?? {});
                }
            } else if (approved === false) {
                applyResult = { applied: false, message: 'Rejected by approval gate.' };
            }
        }

        return {
            recipeName: recipe.metadata.name,
            renderedPrompt: rendered.prompt,
            parsedOutput,
            schemaValid,
            schemaErrors,
            groundTruthValid,
            groundTruthErrors,
            diff,
            approved,
            applyResult,
        };
    }
}

// ---------------------------------------------------------------------------
// Helpers for fixtures
// ---------------------------------------------------------------------------

export class ManualInputGatherer implements InputGatherer {
    constructor(private values: Map<string, unknown>) {}

    async gather(recipe: LoadedRecipe): Promise<GatheredInput[]> {
        return recipe.inputs.map((input) => ({
            key: input.key,
            value: this.values.get(input.key) ?? null,
        }));
    }
}

export class StaticApprovalGate implements ApprovalGate {
    constructor(private decision: boolean | null) {}

    async approve(): Promise<boolean | null> {
        return this.decision;
    }
}
