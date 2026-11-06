// =============================================================================
// Muninn — Node Recipe Source (fixtures / CLI)
// src/recipes/node-source.ts
//
// Loads recipe Markdown files from a local directory. Only used outside
// Obsidian; the plugin bundle does not import this module.
// =============================================================================

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { RecipeSource } from './loader.ts';

export class NodeRecipeSource implements RecipeSource {
    constructor(private dir: string) {}

    async listRecipes(): Promise<string[]> {
        const entries = await readdir(this.dir, { withFileTypes: true });
        return entries
            .filter((e) => e.isFile() && e.name.endsWith('.md'))
            .map((e) => join(this.dir, e.name));
    }

    async readRecipe(path: string): Promise<string> {
        return readFile(path, 'utf-8');
    }
}
