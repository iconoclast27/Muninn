// =============================================================================
// Muninn — Obsidian Plugin Entry Point
// src/main.ts
//
// Wires the SQLite WASM store, the intake lane, and the frozen API into an
// Obsidian Plugin. The build produces main.js; manifest.json and
// versions.json live alongside it in the plugin folder.
// =============================================================================

import { Plugin, type Vault, type TAbstractFile, type TFile } from 'obsidian';
import { openStore } from './store/store.ts';
import type { Store, EmbeddingRecord } from './store/store.ts';
import { IntakeLane, type FileSource, type FileEntry } from './intake/lane.ts';
import { createMuninnApi, laneReindexer, type MuninnApi, type EmbedClient } from './api.ts';
import { renderEmbedInput, embedVh } from './chunker/render.ts';

const MODEL_TAG = 'ollama/nomic-embed-text:v1.5';
const DIM = 768;

export default class MuninnPlugin extends Plugin {
    private store: Store | null = null;
    private lane: IntakeLane | null = null;
    private api: MuninnApi | null = null;

    async onload(): Promise<void> {
        const cachePath = this.getCachePath();
        this.store = await openStore(cachePath);
        this.lane = this.createLane(this.app.vault);
        this.api = createMuninnApi(
            this.store,
            new OllamaEmbedClient(),
            laneReindexer(this.lane),
        );

        // Register vault event handlers inside onLayoutReady so we skip the
        // initial create storm for every existing file.
        this.app.workspace.onLayoutReady(() => {
            this.registerVaultHandlers(this.app.vault);
            // Initial background walk.
            this.lane!.forceReindex().catch(() => { /* dark-safe */ });
        });

        this.addCommand({
            id: 'force-reindex',
            name: 'Force reindex vault',
            callback: () => {
                this.api?.forceReindex().catch(() => { /* dark-safe */ });
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

    private createLane(vault: Vault): IntakeLane {
        return new IntakeLane({
            store: this.store!,
            source: new ObsidianFileSource(vault),
            embedClient: new OllamaEmbedClient(),
            modelTag: MODEL_TAG,
            epoch: 1,
            chunkerCp: Number(this.store!.getMeta('chunker_epoch') ?? '2'),
        });
    }

    private registerVaultHandlers(vault: Vault): void {
        this.registerEvent(vault.on('create', (file: TAbstractFile) => {
            if (isMarkdownFile(file)) this.lane!.onCreate(file.path);
        }));
        this.registerEvent(vault.on('modify', (file: TAbstractFile) => {
            if (isMarkdownFile(file)) this.lane!.onModify(file.path);
        }));
        this.registerEvent(vault.on('delete', (file: TAbstractFile) => {
            if (isMarkdownFile(file)) this.lane!.onDelete(file.path);
        }));
        this.registerEvent(vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            if (isMarkdownFile(file)) this.lane!.onRename(oldPath, file.path);
        }));
    }
}

// TFile is the concrete Obsidian file class. We cannot import it directly,
// but TAbstractFile has no extension property. Use a runtime guard via
// Object.prototype and cast to TFile only after checking the property.
function isMarkdownFile(file: TAbstractFile): file is TFile {
    return 'extension' in file && (file as TFile).extension === 'md';
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
        if (file === null || !isMarkdownFile(file)) return null;
        const bytes = new Uint8Array(await this.vault.readBinary(file));
        // Use stat mtime when available; otherwise fall back to current time.
        const mtime = Number(file.stat?.mtime ?? Date.now());
        return { path, bytes, mtime };
    }
}

// ---------------------------------------------------------------------------
// Ollama embed client (dark-safe)
// ---------------------------------------------------------------------------

class OllamaEmbedClient implements EmbedClient {
    private endpoint = 'http://localhost:11434/api/embed';

    async embed(inputs: string[]): Promise<EmbeddingRecord[] | null> {
        // Obsidian plugins run in a browser-like renderer; fetch is global.
        try {
            const res = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'nomic-embed-text:v1.5',
                    input: inputs,
                    keep_alive: '-1m',
                }),
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
                    vh: '', // populated below after render
                    vector: new Uint8Array(floats.buffer),
                    dim: floats.length,
                    model_tag: MODEL_TAG,
                    epoch: 1,
                };
            });
            // Derive vh for each input from the render contract.
            for (let i = 0; i < inputs.length; i++) {
                vectors[i].vh = embedVh(renderEmbedInput('search_document:', [], null, inputs[i]));
            }
            return vectors;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Muninn] Ollama embed failed:', (e as Error).message);
            return null;
        }
    }
}
