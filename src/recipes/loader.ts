// =============================================================================
// Muninn — Recipe Loader (source-agnostic)
// src/recipes/loader.ts
//
// Loads Markdown recipe files from a RecipeSource. Implementations for Node and
// Obsidian live in their own modules so the bundle only pulls what it needs.
// =============================================================================

import type { LoadedRecipe, Recipe } from './types.ts';
import { parseRecipe } from './parser.ts';

export interface RecipeSource {
    /** List recipe file paths the loader should consider. */
    listRecipes(): Promise<string[]>;
    /** Read the UTF-8 content of one recipe file. */
    readRecipe(path: string): Promise<string>;
}

export interface LoadResult {
    ok: boolean;
    recipes: LoadedRecipe[];
    errors: string[];
}

export async function loadRecipes(source: RecipeSource): Promise<LoadResult> {
    const paths = await source.listRecipes();
    const recipes: LoadedRecipe[] = [];
    const errors: string[] = [];

    for (const path of paths) {
        if (!path.endsWith('.md')) continue;
        try {
            const content = await source.readRecipe(path);
            const parsed = parseRecipe(content, path);
            if (!parsed.ok) {
                errors.push(`Recipe ${path}: ${parsed.errors.join('; ')}`);
                continue;
            }
            recipes.push({ ...parsed.recipe as Recipe, sourcePath: path });
        } catch (e) {
            errors.push(`Recipe ${path}: read failed — ${(e as Error).message}`);
        }
    }

    return { ok: errors.length === 0, recipes, errors };
}

export function findRecipe(recipes: LoadedRecipe[], name: string): LoadedRecipe | undefined {
    return recipes.find((r) => r.metadata.name === name);
}
