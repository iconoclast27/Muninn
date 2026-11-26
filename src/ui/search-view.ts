// =============================================================================
// Muninn — Sidebar Search View
// src/ui/search-view.ts
//
// Registers a leaf view for text and semantic search. The view is mostly
// DOM-based so it runs in Obsidian's renderer with minimal dependencies.
// It consumes the frozen MuninnApi from the plugin instance.
// =============================================================================

import { ItemView, type WorkspaceLeaf, type ViewStateResult, type TFile } from 'obsidian';
import type { Hit, TextSearchResult, SemanticSearchResult } from '../api.ts';
import { emptySearchState, sanitizeSearchState, type MuninnSearchState } from './search-state.ts';

export const MUNINN_VIEW_TYPE = 'muninn-search';

export interface MuninnSearchHost {
    searchText(query: string): TextSearchResult | null;
    searchSemantic(text: string): Promise<SemanticSearchResult | null>;
    openFile(path: string): Promise<void>;
}

interface ViewSearchState {
    query: string;
    mode: 'text' | 'semantic';
    running: boolean;
    error: string | null;
    hits: Hit[];
}

export class MuninnSearchView extends ItemView {
    private host: MuninnSearchHost;
    private state: ViewSearchState;
    private container: HTMLElement | null = null;
    private inputEl: HTMLInputElement | null = null;
    private modeTextBtn: HTMLButtonElement | null = null;
    private modeSemanticBtn: HTMLButtonElement | null = null;
    private statusEl: HTMLElement | null = null;
    private resultsEl: HTMLElement | null = null;
    private onStateChange?: (state: MuninnSearchState) => void;

    constructor(leaf: WorkspaceLeaf, host: MuninnSearchHost, onStateChange?: (state: MuninnSearchState) => void) {
        super(leaf);
        this.host = host;
        this.onStateChange = onStateChange;
        this.state = {
            query: '',
            mode: 'text',
            running: false,
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

    getIcon(): string {
        return 'search';
    }

    async onOpen(): Promise<void> {
        this.container = this.contentEl.createDiv({ cls: 'muninn-search-view' });
        this.render();
    }

    async onClose(): Promise<void> {
        this.container?.empty();
    }

    getState(): MuninnSearchState {
        return {
            query: this.state.query,
            mode: this.state.mode,
            hits: this.state.hits,
        };
    }

    async setState(state: unknown, _result: ViewStateResult): Promise<void> {
        const sanitized = sanitizeSearchState(state);
        if (sanitized === null) return;
        this.state.query = sanitized.query;
        this.state.mode = sanitized.mode;
        this.state.hits = sanitized.hits;
        this.state.error = null;
        this.state.running = false;
        this.applyStateToDom();
        this.notifyStateChange();
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

        this.applyStateToDom();
    }

    private applyStateToDom(): void {
        if (this.inputEl) {
            this.inputEl.value = this.state.query;
        }
        this.updateModeButtons();
        this.updateStatus();
        this.renderResults();
    }

    private setMode(mode: 'text' | 'semantic'): void {
        this.state.mode = mode;
        this.state.error = null;
        this.updateModeButtons();
        this.updateStatus();
        this.notifyStateChange();
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
            this.notifyStateChange();
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

    private notifyStateChange(): void {
        this.onStateChange?.(this.getState());
    }
}
