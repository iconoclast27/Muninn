// =============================================================================
// Muninn — Obsidian Plugin Entry Point
// src/main.ts
//
// Wires the SQLite WASM store, the intake lane, and the frozen API into an
// Obsidian Plugin. The build produces main.js; manifest.json and
// versions.json live alongside it in the plugin folder.
// =============================================================================

import { Plugin, normalizePath, TFile, TFolder, Setting, PluginSettingTab, WorkspaceLeaf, type Vault, type TAbstractFile } from 'obsidian';
import { openStore } from './store/store.ts';
import type { Store, EmbeddingRecord } from './store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from './intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient, type ReindexResult, type ReindexProgress } from './api.ts';
import { CHUNKER_CP } from './chunker/chunker.ts';
import { DEFAULT_SETTINGS, sanitizeSettings, modelTag, type MuninnSettings } from './settings.ts';
import { MuninnSearchView, MUNINN_VIEW_TYPE } from './ui/search-view.ts';
import { createSearchHost, type FileOpener } from './ui/search-controller.ts';
import { emptySearchState, type MuninnSearchState } from './ui/search-state.ts';

const FLUSH_DEBOUNCE_MS = 2000;

export default class MuninnPlugin extends Plugin {
    private store: Store | null = null;
    private lane: IntakeLane | null = null;
    private api: MuninnApi | null = null;
    private cachePath: string | null = null;
    private flushTimer: number | null = null;
    private flushInProgress: Promise<void> | null = null;
    private reindexInProgress: Promise<ReindexResult | null> | null = null;
    private shuttingDown = false;
    private lastSearchState: MuninnSearchState = emptySearchState();
    settings: MuninnSettings = { ...DEFAULT_SETTINGS };

    async onload(): Promise<void> {
        try {
            const saved = await this.loadData();
            this.settings = sanitizeSettings(saved);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Muninn] failed to load settings, using defaults:', e);
            this.settings = { ...DEFAULT_SETTINGS };
        }

        const cachePath = this.getCachePath();
        this.cachePath = cachePath;
        const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));
        try {
            await this.app.vault.adapter.mkdir(normalizePath(cacheDir));
        } catch {
            // Directory may already exist; ignore.
        }

        let loadBytes: Uint8Array | undefined;
        let cacheExists = false;
        try {
            const raw = await this.app.vault.adapter.readBinary(normalizePath(cachePath));
            loadBytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
            cacheExists = true;
            // eslint-disable-next-line no-console
            console.log(`[Muninn] cache file found at ${cachePath}: ${loadBytes.length} bytes`);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log('[Muninn] no existing cache to load:', (e as Error).message);
        }

        try {
            this.store = await openStore(':memory:', loadBytes !== undefined && loadBytes.length > 0 ? { load: loadBytes } : {});
            if (cacheExists) {
                const files = this.store.countFiles();
                const chunks = this.store.countChunks();
                // eslint-disable-next-line no-console
                console.log(`[Muninn] loaded cache: ${files} files, ${chunks} chunks`);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[Muninn] failed to open in-memory store:', e);
            this.store = null;
            return;
        }

        const embedClient = new OllamaEmbedClient(this.settings);
        this.lane = this.createLane(this.app.vault, embedClient);
        this.api = createMuninnApi(
            this.store,
            embedClient,
            laneReindexer(this.lane),
        );

        // Plugin 2 skill harness has moved to Huginn. Muninn exposes the
        // frozen API door via getMuninnApi() for Huginn to consume.

        // Register vault event handlers inside onLayoutReady so we skip the
        // initial create storm for every existing file.
        this.app.workspace.onLayoutReady(() => {
            if (!this.lane || !this.api) return;
            this.registerVaultHandlers(this.app.vault);
            // Initial background walk.
            this.reindexInProgress = this.lane.forceReindex()
                .then(async (result) => {
                    // eslint-disable-next-line no-console
                    console.log('[Muninn] initial walk complete:', result);
                    try {
                        await this.flushCache();
                    } catch (flushErr: unknown) {
                        // eslint-disable-next-line no-console
                        console.error('[Muninn] initial reindex flush failed:', flushErr);
                    }
                    return result;
                })
                .catch((e: unknown) => {
                    if (this.shuttingDown) {
                        // Expected when the plugin is disabled/reloaded while
                        // the initial reindex is still running.
                        return null;
                    }
                    // eslint-disable-next-line no-console
                    console.error('[Muninn] initial reindex failed:', e);
                    return null;
                })
                .finally(() => {
                    this.reindexInProgress = null;
                });
        });

        this.addCommand({
            id: 'force-reindex',
            name: 'Force reindex vault',
            callback: () => {
                void this.forceReindexWithFlush();
            },
        });

        this.addCommand({
            id: 'open-search-view',
            name: 'Open search view',
            callback: () => {
                void this.openSearchView();
            },
        });

        this.registerView(
            MUNINN_VIEW_TYPE,
            (leaf) => new MuninnSearchView(
                leaf,
                createSearchHost(this.api!, this.createFileOpener()),
                (state) => { this.lastSearchState = state; },
            ),
        );

        this.addRibbonIcon('search', 'Muninn search', () => {
            void this.openSearchView();
        });

        this.addSettingTab(new MuninnSettingTab(this.app, this));
    }

    onunload(): void {
        this.shuttingDown = true;
        this.lane?.stop();
        if (this.flushTimer !== null) {
            window.clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        // Obsidian's onunload() is synchronous, but the initial reindex or
        // a pending cache flush may still be async. Closing the store while
        // those are running produced SQLite3Error: DB has been closed.
        // Start a best-effort async cleanup that awaits them before closing.
        const cleanup = async (): Promise<void> => {
            if (this.reindexInProgress !== null) {
                try { await this.reindexInProgress; } catch { /* shutdown path */ }
            }
            if (this.flushInProgress !== null) {
                try { await this.flushInProgress; } catch { /* logged elsewhere */ }
            }
            // One final flush before the database goes away.
            if (this.store !== null && this.cachePath !== null) {
                try { await this.flushCache(); } catch { /* unload-time flush is best-effort */ }
            }
            this.store?.close();
            this.store = null;
            this.cachePath = null;
        };
        cleanup();

        // Drop references so the API can't start new work while cleanup runs.
        this.lane = null;
        this.api = null;
    }

    isReindexing(): boolean {
        return this.reindexInProgress !== null;
    }

    /** Public API door for Huginn and other Plugin 2 consumers. Frozen shape. */
    getMuninnApi(): MuninnApi | null {
        return this.api;
    }

    async forceReindexWithFlush(
        onProgress?: (p: ReindexProgress) => void,
        onDone?: (result: ReindexResult | null) => void,
    ): Promise<ReindexResult | null> {
        if (this.reindexInProgress !== null) {
            this.reindexInProgress
                .then((result) => { onDone?.(result); })
                .catch(() => { onDone?.(null); });
            return this.reindexInProgress;
        }

        const p = this.api?.forceReindex(onProgress);
        if (!p) {
            onDone?.(null);
            return null;
        }

        this.reindexInProgress = p
            .then(async (result) => {
                // eslint-disable-next-line no-console
                console.log('[Muninn] force reindex complete:', result);
                try {
                    await this.flushCache();
                } catch (flushErr: unknown) {
                    // eslint-disable-next-line no-console
                    console.error('[Muninn] force reindex flush failed:', flushErr);
                }
                onDone?.(result);
                return result;
            })
            .catch((e: unknown) => {
                if (this.shuttingDown) {
                    onDone?.(null);
                    return null;
                }
                // eslint-disable-next-line no-console
                console.error('[Muninn] force reindex failed:', e);
                onDone?.(null);
                return null;
            })
            .finally(() => {
                this.reindexInProgress = null;
            });
        return this.reindexInProgress;
    }

    private getCachePath(): string {
        // manifest.dir is the plugin folder under .obsidian/plugins/muninn.
        const dir = this.manifest.dir ?? '';
        if (dir.length > 0) {
            return `${dir}/cache/index.db`;
        }
        // Fallback for environments that do not populate manifest.dir.
        return `${this.app.vault.configDir}/plugins/${this.manifest.id}/cache/index.db`;
    }

    private createFileOpener(): FileOpener {
        return {
            openFile: async (file: TFile): Promise<void> => {
                await this.app.workspace.getLeaf().openFile(file);
            },
            getAbstractFileByPath: (path: string): TAbstractFile | null => {
                return this.app.vault.getAbstractFileByPath(path);
            },
        };
    }

    private async openSearchView(): Promise<void> {
        let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(MUNINN_VIEW_TYPE)[0] ?? null;
        if (leaf !== null && leaf.view?.getViewType() === MUNINN_VIEW_TYPE) {
            this.app.workspace.revealLeaf(leaf);
            return;
        }
        if (leaf === null) {
            leaf = this.app.workspace.getRightLeaf(false);
        }
        if (leaf === null) return;
        await leaf.setViewState({ type: MUNINN_VIEW_TYPE, active: true, state: this.lastSearchState });
        this.app.workspace.revealLeaf(leaf);
    }

    private createLane(vault: Vault, embedClient: EmbedClient): IntakeLane {
        const lane = new IntakeLane({
            store: this.store!,
            source: new ObsidianFileSource(vault),
            embedClient,
            modelTag: modelTag(this.settings),
            epoch: 1,
            chunkerCp: CHUNKER_CP,
        });
        // Any store mutation through the lane may change the cache; debounce
        // a flush to disk.
        lane.onMutation = () => this.scheduleCacheFlush();
        return lane;
    }

    private scheduleCacheFlush(): void {
        if (this.flushTimer !== null) {
            window.clearTimeout(this.flushTimer);
        }
        this.flushTimer = window.setTimeout(() => {
            this.flushTimer = null;
            this.flushInProgress = this.flushCache()
                .catch((e: unknown) => {
                    // eslint-disable-next-line no-console
                    console.error('[Muninn] cache flush failed:', e);
                })
                .finally(() => {
                    this.flushInProgress = null;
                });
        }, FLUSH_DEBOUNCE_MS);
    }

    private async flushCache(): Promise<void> {
        if (this.store === null || this.cachePath === null) return;
        const bytes = this.store.serialize();
        // serialize() returns a Uint8Array view into the WASM heap. Copy the
        // exact serialized bytes into a clean ArrayBuffer before handing it
        // to Vault.adapter, otherwise we write the whole heap.
        const buffer = new ArrayBuffer(bytes.length);
        new Uint8Array(buffer).set(bytes);
        await this.app.vault.adapter.writeBinary(normalizePath(this.cachePath), buffer);
    }

    private registerVaultHandlers(vault: Vault): void {
        this.registerEvent(vault.on('create', (file: TAbstractFile) => {
            // eslint-disable-next-line no-console
            console.log('[Muninn] vault event: create', file.path, file instanceof TFile, (file as TFile).extension);
            if (file instanceof TFile && file.extension === 'md') this.lane!.onCreate(file.path);
        }));
        this.registerEvent(vault.on('modify', (file: TAbstractFile) => {
            // eslint-disable-next-line no-console
            console.log('[Muninn] vault event: modify', file.path);
            if (file instanceof TFile && file.extension === 'md') this.lane!.onModify(file.path);
        }));
        this.registerEvent(vault.on('delete', (file: TAbstractFile) => {
            // eslint-disable-next-line no-console
            console.log('[Muninn] vault event: delete', file.path);
            if (file instanceof TFile && file.extension === 'md') this.lane!.onDelete(file.path);
        }));
        this.registerEvent(vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            // eslint-disable-next-line no-console
            console.log('[Muninn] vault event: rename', oldPath, '->', file.path);
            if (file instanceof TFile && file.extension === 'md') {
                this.lane!.onRename(oldPath, file.path);
            } else if (file instanceof TFolder) {
                // Belt-and-suspenders: Obsidian usually emits per-child
                // rename events, but if it ever does not, the prefix rename
                // keeps every child path from going stale until the next walk.
                this.lane!.onRenamePrefix(oldPath, file.path);
            }
        }));
    }
}

// ---------------------------------------------------------------------------
// Obsidian file source
// ---------------------------------------------------------------------------

class ObsidianFileSource implements FileSource {
    constructor(private vault: Vault) {}

    async listFiles(): Promise<string[]> {
        return this.vault.getFiles()
            .filter((f) => f.extension === 'md')
            .map((f) => f.path);
    }

    async readFile(path: string): Promise<FileEntry | null> {
        const file = this.vault.getAbstractFileByPath(path);
        if (file === null || !(file instanceof TFile) || file.extension !== 'md') return null;
        const bytes = new Uint8Array(await this.vault.readBinary(file));
        // Use stat mtime when available; otherwise fall back to 0 so the
        // stable content_hash drives change detection.
        const mtime = Number(file.stat?.mtime ?? 0);
        return { path, bytes, mtime };
    }
}

// ---------------------------------------------------------------------------
// Ollama embed client (dark-safe)
// ---------------------------------------------------------------------------

class OllamaEmbedClient implements EmbedClient {
    private settings: MuninnSettings;

    constructor(settings: MuninnSettings) {
        this.settings = settings;
    }

    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        // Obsidian plugins run in a browser-like renderer; fetch is global.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.settings.embedTimeoutMs);
        try {
            const res = await fetch(`${this.settings.ollamaUrl}/api/embed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.settings.ollamaModel,
                    input: inputs.map((i) => i.text),
                    keep_alive: '-1m',
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama embed HTTP', res.status);
                return null;
            }
            const data = (await res.json()) as {
                embeddings: number[][];
                model: string;
            };
            const vectors = data.embeddings.map((arr, i) => {
                const floats = Float32Array.from(arr);
                return {
                    vh: inputs[i]?.vh ?? '',
                    vector: new Uint8Array(floats.buffer),
                    dim: floats.length,
                    model_tag: modelTag(this.settings),
                    epoch: 1,
                };
            });
            return vectors;
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama embed timed out');
            } else {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama embed failed:', (e as Error).message);
            }
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class MuninnSettingTab extends PluginSettingTab {
    private plugin: MuninnPlugin;

    constructor(app: unknown, plugin: MuninnPlugin) {
        super(app as never, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Muninn Settings' });

        new Setting(containerEl)
            .setName('Ollama base URL')
            .setDesc('Base URL for the Ollama API, without trailing slash.')
            .addText((text) => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.ollamaUrl)
                .onChange(async (value) => {
                    this.plugin.settings.ollamaUrl = value.replace(/\/$/, '');
                    await this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName('Embedding model')
            .setDesc('Ollama model used for semantic search embeddings.')
            .addText((text) => text
                .setPlaceholder('nomic-embed-text:v1.5')
                .setValue(this.plugin.settings.ollamaModel)
                .onChange(async (value) => {
                    this.plugin.settings.ollamaModel = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));

        new Setting(containerEl)
            .setName('Embedding timeout (ms)')
            .setDesc('Abort embedding requests after this many milliseconds.')
            .addText((text) => text
                .setPlaceholder('30000')
                .setValue(String(this.plugin.settings.embedTimeoutMs))
                .onChange(async (value) => {
                    const n = Number(value);
                    if (Number.isFinite(n) && n > 0) {
                        this.plugin.settings.embedTimeoutMs = n;
                        await this.plugin.saveData(this.plugin.settings);
                    }
                }));

        new Setting(containerEl)
            .setName('Embedding dimensions')
            .setDesc('Vector dimension of the chosen embedding model.')
            .addText((text) => text
                .setPlaceholder('768')
                .setValue(String(this.plugin.settings.embedDim))
                .onChange(async (value) => {
                    const n = Number(value);
                    if (Number.isFinite(n) && n > 0) {
                        this.plugin.settings.embedDim = n;
                        await this.plugin.saveData(this.plugin.settings);
                    }
                }));

        const reindexSetting = new Setting(containerEl)
            .setName('Force reindex vault')
            .setDesc('Rebuild the vault index from scratch. This may take a while for large vaults.');

        reindexSetting.addButton((button) => {
            button.setButtonText('Force reindex');
            if (this.plugin.isReindexing()) {
                button.setDisabled(true).setButtonText('Reindexing...');
            }

            let statusEl: HTMLSpanElement | null = null;

            button.onClick(async () => {
                button.setDisabled(true).setButtonText('Reindexing...');
                statusEl = reindexSetting.descEl.createEl('span', {
                    cls: 'muninn-reindex-status',
                    text: ' Reindexing...',
                });

                await this.plugin.forceReindexWithFlush(
                    (p) => {
                        if (statusEl?.isConnected) {
                            statusEl.setText(` Reindexing... ${p.phase} ${p.done}/${p.total}`);
                        }
                    },
                    () => {
                        button.setDisabled(false).setButtonText('Force reindex');
                        if (statusEl?.isConnected) {
                            statusEl.remove();
                        }
                        statusEl = null;
                    }
                );
            });
        });
    }
}
