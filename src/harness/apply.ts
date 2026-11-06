// =============================================================================
// Muninn — Apply Registry
// src/harness/apply.ts
//
// Registry of harness-owned apply routines. The model never applies changes;
// it only fills the recipe form. The harness selects the routine named by the
// recipe and runs it after schema validation and human approval. The skeleton
// ships with a no-op routine so the machinery is end-to-end testable without
// writing to the vault.
// =============================================================================

import type { LoadedRecipe, ApplyResult } from '../recipes/types.ts';

export interface ApplyRoutine {
    (recipe: LoadedRecipe, output: unknown): Promise<ApplyResult>;
}

export interface ApplyRegistry {
    register(name: string, routine: ApplyRoutine): void;
    get(name: string): ApplyRoutine | undefined;
}

export function createApplyRegistry(): ApplyRegistry {
    const map = new Map<string, ApplyRoutine>();

    function register(name: string, routine: ApplyRoutine): void {
        map.set(name, routine);
    }

    function get(name: string): ApplyRoutine | undefined {
        return map.get(name);
    }

    return { register, get };
}

export function createDefaultApplyRegistry(): ApplyRegistry {
    const registry = createApplyRegistry();
    registry.register('noop', async (recipe, output): Promise<ApplyResult> => {
        return {
            applied: false,
            message: `no-op apply for ${recipe.metadata.name}: ${JSON.stringify(output).slice(0, 200)}`,
        };
    });
    return registry;
}
