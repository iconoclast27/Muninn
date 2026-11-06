// =============================================================================
// Muninn — Recipe Renderer
// src/recipes/renderer.ts
//
// Renders the LLM prompt by replacing {{key}} placeholders in the recipe's
// instructions and output contract with gathered inputs. Keeps the prompt as a
// single string so the model has no tool menu to call — it must return JSON.
// =============================================================================

import type { LoadedRecipe, GatheredInput, RecipeRenderContext } from './types.ts';

export function createRenderContext(recipe: LoadedRecipe, inputs: GatheredInput[]): RecipeRenderContext {
    return { recipe, inputs };
}

export interface RenderedRecipe {
    prompt: string;
    outputSchemaText: string;
}

export function renderRecipe(context: RecipeRenderContext): RenderedRecipe {
    const { recipe, inputs } = context;
    const values = new Map<string, string>();
    for (const input of inputs) {
        values.set(input.key, serializeInputValue(input.value));
    }

    return {
        prompt: substitute(recipe.instructions, values),
        outputSchemaText: substitute(JSON.stringify(recipe.outputSchema, null, 2), values),
    };
}

function serializeInputValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
}

function substitute(template: string, values: Map<string, string>): string {
    let out = template;
    for (const [key, val] of values) {
        // Replace {{key}} with the serialized value. Do not escape regex chars
        // in the key because keys are constrained to simple identifiers.
        out = out.split(`{{${key}}}`).join(val);
    }
    return out;
}
