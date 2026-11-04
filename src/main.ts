// =============================================================================
// Muninn — Obsidian Plugin Entry Point
// src/main.ts
//
// Wires the SQLite WASM store, the intake lane, and the frozen API into an
// Obsidian Plugin. The build produces main.js; manifest.json and
// versions.json live alongside it in the plugin folder.
// =============================================================================

import { Plugin, normalizePath, TFile, TFolder, type Vault, type TAbstractFile } from 'obsidian';
import { openStore } from './store/store.ts';
import type { Store, EmbeddingRecord } from './store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from './intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient } from './api.ts';
import { renderEmbedInput, embedVh } from './chunker/render.ts';
import { CHUNKER_CP } from './chunker/chunker.ts';

const MODEL_TAG = 'ollama/nomic-embed-text:v1.5';
const DIM = 768;

export default class MuninnPlugin extends Plugin {
    private store: Store | null = null;
    private lane: IntakeLane | null = null;
    private api: MuninnApi | null = null;

    async onload(): Promise<void> {
        const cachePath = this.getCachePath();
        const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));
        try {
            await this.app.vault.adapter.mkdir(normalizePath(cacheDir));
        } catch {
            // Directory may already exist; ignore.
        }

        try {
            this.store = await openStore(cachePath);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[Muninn] failed to open store on disk, falling back to in-memory:', e);
            try {
                this.store = await openStore(':memory:');
            } catch (e2) {
                // eslint-disable-next-line no-console
                console.error('[Muninn] failed to open in-memory store:', e2);
                this.store = null;
                return;
            }
        }

        const embedClient = new OllamaEmbedClient();
        this.lane = this.createLane(this.app.vault, embedClient);
        this.api = createMuninnApi(
            this.store,
            embedClient,
            laneReindexer(this.lane),
        );

        // Register vault event handlers inside onLayoutReady so we skip the
        // initial create storm for every existing file.
        this.app.workspace.onLayoutReady(() => {
            if (!this.lane || !this.api) return;
            this.registerVaultHandlers(this.app.vault);
            // Initial background walk.
            this.lane.forceReindex().catch((e: unknown) => {
                // eslint-disable-next-line no-console
                console.error('[Muninn] initial reindex failed:', e);
            });
        });

        this.addCommand({
            id: 'force-reindex',
            name: 'Force reindex vault',
            callback: () => {
                this.api?.forceReindex().catch((e: unknown) => {
                    // eslint-disable-next-line no-console
                    console.error('[Muninn] force reindex command failed:', e);
                });
            },
        });
    }

    onunload(): void {
        this.lane?.stop();
        this.store?.close();
        this.lane = null;
        this.store = null;
        this.api = null;
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

    private createLane(vault: Vault, embedClient: EmbedClient): IntakeLane {
        return new IntakeLane({
            store: this.store!,
            source: new ObsidianFileSource(vault),
            embedClient,
            modelTag: MODEL_TAG,
            epoch: 1,
            chunkerCp: CHUNKER_CP,
        });
    }

    private registerVaultHandlers(vault: Vault): void {
        this.registerEvent(vault.on('create', (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') this.lane!.onCreate(file.path);
        }));
        this.registerEvent(vault.on('modify', (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') this.lane!.onModify(file.path);
        }));
        this.registerEvent(vault.on('delete', (file: TAbstractFile) => {
            if (file instanceof TFile && file.extension === 'md') this.lane!.onDelete(file.path);
        }));
        this.registerEvent(vault.on('rename', (file: TAbstractFile, oldPath: string) => {
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
    private endpoint = 'http://localhost:11434/api/embed';
    private timeoutMs = 30000;

    async embed(inputs: { vh: string; text: string }[]): Promise<EmbeddingRecord[] | null> {
        // Obsidian plugins run in a browser-like renderer; fetch is global.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'nomic-embed-text:v1.5',
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
                    model_tag: MODEL_TAG,
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
