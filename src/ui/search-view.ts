// =============================================================================
// Muninn — Sidebar Search View
// src/ui/search-view.ts
//
// Registers a leaf view for text and semantic search. The view is mostly
// DOM-based so it runs in Obsidian's renderer with minimal dependencies.
// It consumes the frozen MuninnApi from the plugin instance.
// =============================================================================

import { ItemView, type WorkspaceLeaf, type TFile } from 'obsidian';
import type { Hit, TextSearchResult, SemanticSearchResult, ReindexProgress, ReindexResult } from '../api.ts';

export const MUNINN_VIEW_TYPE = 'muninn-search';

export interface MuninnSearchHost {
    searchText(query: string): TextSearchResult | null;
    searchSemantic(text: string): Promise<SemanticSearchResult | null>;
    forceReindex(onProgress?: (p: ReindexProgress) => void): Promise<ReindexResult | null>;
    openFile(path: string): Promise<void>;
}

interface SearchState {
    query: string;
    mode: 'text' | 'semantic';
    running: boolean;
    reindexing: boolean;
    error: string | null;
    hits: Hit[];
}

export class MuninnSearchView extends ItemView {
    private host: MuninnSearchHost;
    private state: SearchState;
    private container: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private modeTextBtn: HTMLButtonElement | null = null;
    private modeSemanticBtn: HTMLButtonElement | null = null;
    private reindexBtn: HTMLButtonElement | null = null;
    private statusEl: HTMLElement | null = null;
    private resultsEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, host: MuninnSearchHost) {
        super(leaf);
        this.host = host;
        this.state = {
            query: '',
            mode: 'text',
            running: false,
            reindexing: false,
            error: null,
            hits: [],
        };
    }

    getViewType(): string {
        return MUNINN_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Muninn Search';
    }

    async onOpen(): Promise<void> {
        this.container = this.contentEl.createDiv({ cls: 'muninn-search-view' });
        this.render();
    }

    async onClose(): Promise<void> {
        this.container?.empty();
    }

    private render(): void {
        if (!this.container) return;
        this.container.empty();

        const header = this.container.createEl('div', { cls: 'muninn-search-header' });
        const modeRow = header.createEl('div', { cls: 'muninn-search-mode-row' });

        this.modeTextBtn = modeRow.createEl('button', {
            cls: 'muninn-mode-button',
            text: 'Text',
        });
        this.modeTextBtn.addEventListener('click', () => this.setMode('text'));

        this.modeSemanticBtn = modeRow.createEl('button', {
            cls: 'muninn-mode-button',
            text: 'Semantic',
        });
        this.modeSemanticBtn.addEventListener('click', () => this.setMode('semantic'));

        this.reindexBtn = modeRow.createEl('button', {
            cls: 'muninn-reindex-button',
            text: 'Reindex',
        });
        this.reindexBtn.addEventListener('click', () => this.runReindex());

        const inputRow = header.createEl('div', { cls: 'muninn-search-input-row' });
        this.inputEl = inputRow.createEl('input', {
            cls: 'muninn-search-input',
            type: 'text',
            placeholder: 'Search vault...',
        });
        this.inputEl.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter') {
                void this.runSearch();
            }
        });

        this.statusEl = this.container.createEl('div', { cls: 'muninn-search-status' });
        this.resultsEl = this.container.createEl('div', { cls: 'muninn-search-results' });

        this.updateModeButtons();
        this.updateStatus();
        this.renderResults();
    }

    private setMode(mode: 'text' | 'semantic'): void {
        this.state.mode = mode;
        this.state.error = null;
        this.updateModeButtons();
        this.updateStatus();
    }

    private updateModeButtons(): void {
        if (!this.modeTextBtn || !this.modeSemanticBtn) return;
        const activeCls = 'muninn-mode-active';
        this.modeTextBtn.toggleClass(activeCls, this.state.mode === 'text');
        this.modeSemanticBtn.toggleClass(activeCls, this.state.mode === 'semantic');
    }

    private updateStatus(): void {
        if (!this.statusEl) return;
        this.statusEl.empty();
        if (this.state.error) {
            this.statusEl.createEl('div', {
                cls: 'muninn-status-error',
                text: this.state.error,
            });
        } else if (this.state.reindexing) {
            this.statusEl.createEl('div', {
                cls: 'muninn-status-info',
                text: 'Reindexing vault...',
            });
        } else if (this.state.running) {
            this.statusEl.createEl('div', {
                cls: 'muninn-status-info',
                text: 'Searching...',
            });
        } else if (this.state.query) {
            this.statusEl.createEl('div', {
                cls: 'muninn-status-info',
                text: `${this.state.hits.length} hit${this.state.hits.length === 1 ? '' : 's'}`,
            });
        }
    }

    private async runSearch(): Promise<void> {
        if (!this.inputEl) return;
        const query = this.inputEl.value.trim();
        if (query.length === 0) return;
        this.state.query = query;
        this.state.running = true;
        this.state.error = null;
        this.state.hits = [];
        this.updateStatus();
        this.renderResults();

        try {
            if (this.state.mode === 'text') {
                const result = this.host.searchText(query);
                if (result === null) {
                    this.state.error = 'Text search failed (check console for reason).';
                    this.state.hits = [];
                } else {
                    this.state.hits = result.hits.slice(0, 50);
                }
            } else {
                const result = await this.host.searchSemantic(query);
                if (result === null) {
                    this.state.error = 'Semantic search failed (check console for reason).';
                    this.state.hits = [];
                } else {
                    this.state.hits = result.hits.slice(0, 50);
                }
            }
        } catch (e) {
            this.state.error = String(e);
            this.state.hits = [];
        } finally {
            this.state.running = false;
            this.updateStatus();
            this.renderResults();
        }
    }

    private async runReindex(): Promise<void> {
        if (this.state.reindexing) return;
        this.state.reindexing = true;
        this.state.error = null;
        this.updateStatus();
        try {
            await this.host.forceReindex((p) => {
                if (!this.statusEl) return;
                this.statusEl.empty();
                this.statusEl.createEl('div', {
                    cls: 'muninn-status-info',
                    text: `Reindexing... ${p.phase} ${p.done}/${p.total}`,
                });
            });
        } catch (e) {
            this.state.error = String(e);
        } finally {
            this.state.reindexing = false;
            this.updateStatus();
        }
    }

    private renderResults(): void {
        if (!this.resultsEl) return;
        this.resultsEl.empty();
        if (this.state.hits.length === 0) {
            if (!this.state.running && this.state.query) {
                this.resultsEl.createEl('div', {
                    cls: 'muninn-no-results',
                    text: 'No results.',
                });
            }
            return;
        }

        for (const hit of this.state.hits) {
            const card = this.resultsEl.createEl('div', { cls: 'muninn-hit-card' });
            const title = hit.title && hit.title.length > 0 ? hit.title : hit.path;
            const titleEl = card.createEl('div', { cls: 'muninn-hit-title' });
            titleEl.createEl('a', {
                cls: 'muninn-hit-link',
                text: title,
                href: '#',
            }).addEventListener('click', (evt) => {
                evt.preventDefault();
                void this.host.openFile(hit.path);
            });
            const metaEl = card.createEl('div', { cls: 'muninn-hit-meta' });
            metaEl.setText(`${hit.path} • chunk ${hit.ord}`);
            const textEl = card.createEl('div', { cls: 'muninn-hit-text' });
            textEl.setText(hit.text.length > 240 ? hit.text.slice(0, 240) + '…' : hit.text);
        }
    }
}
