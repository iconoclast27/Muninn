// =============================================================================
// Muninn — Obsidian Recipe Source
// src/recipes/obsidian-source.ts
//
// Loads recipe Markdown files from an Obsidian vault folder. The recipes are
// part of the vault so users can edit them as plain notes. The loader filters
// to .md files under the configured recipe directory.
// =============================================================================

import { normalizePath, TFolder, TFile, type Vault } from 'obsidian';
import type { RecipeSource } from './loader.ts';

export class ObsidianRecipeSource implements RecipeSource {
    constructor(
        private vault: Vault,
        private dir: string,
    ) {}

    async listRecipes(): Promise<string[]> {
        const normalized = normalizePath(this.dir);
        const folder = this.vault.getAbstractFileByPath(normalized);
        if (folder === null || !(folder instanceof TFolder)) {
            return [];
        }
        return folder.children
            .filter((child): child is TFile => child instanceof TFile)
            .filter((child) => child.extension === 'md')
            .map((child) => child.path)
            .sort();
    }

    async readRecipe(path: string): Promise<string> {
        const normalized = normalizePath(path);
        const file = this.vault.getAbstractFileByPath(normalized);
        if (file === null) {
            throw new Error(`Recipe not found: ${path}`);
        }
        return this.vault.cachedRead(file as never);
    }
}
