// =============================================================================
// Muninn — Search Controller
// src/ui/search-controller.ts
//
// Connects the sidebar view to the plugin without the view importing the full
// Plugin subclass. This keeps the view testable in Node and avoids a circular
// dependency.
// =============================================================================

import type { TFile, TAbstractFile } from 'obsidian';
import type { MuninnApi, TextSearchResult, SemanticSearchResult } from '../api.ts';
import type { MuninnSearchHost } from './search-view.ts';

export interface FileOpener {
    openFile(file: TFile): Promise<void>;
    getAbstractFileByPath(path: string): TAbstractFile | null;
}

export function createSearchHost(api: MuninnApi, opener: FileOpener): MuninnSearchHost {
    return {
        searchText(query: string): TextSearchResult | null {
            return api.searchText(query);
        },
        async searchSemantic(text: string): Promise<SemanticSearchResult | null> {
            return api.searchSemantic(text);
        },
        async openFile(path: string): Promise<void> {
            const f = opener.getAbstractFileByPath(path);
            if (f && (f as TFile).extension !== undefined) {
                await opener.openFile(f as TFile);
            }
        },
    };
}
