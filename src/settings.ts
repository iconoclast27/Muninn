// =============================================================================
// Muninn — Plugin Settings
// src/settings.ts
//
// Persisted configuration for the Obsidian plugin. These values are exposed
// through a SettingTab and passed to the embedder and intake lane.
// =============================================================================

export interface MuninnSettings {
    ollamaUrl: string;
    ollamaModel: string;
    ollamaChatModel: string;
    chatTimeoutMs: number;
    embedTimeoutMs: number;
    embedDim: number;
}

export const DEFAULT_SETTINGS: MuninnSettings = {
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'nomic-embed-text:v1.5',
    ollamaChatModel: 'qwen3.5:4b',
    chatTimeoutMs: 60000,
    embedTimeoutMs: 30000,
    embedDim: 768,
};

export function sanitizeSettings(raw: unknown): MuninnSettings {
    const out = { ...DEFAULT_SETTINGS };
    if (raw === null || typeof raw !== 'object') return out;
    const r = raw as Partial<MuninnSettings>;
    if (typeof r.ollamaUrl === 'string' && r.ollamaUrl.length > 0) {
        out.ollamaUrl = r.ollamaUrl.replace(/\/$/, '');
    }
    if (typeof r.ollamaModel === 'string' && r.ollamaModel.length > 0) {
        out.ollamaModel = r.ollamaModel;
    }
    if (typeof r.ollamaChatModel === 'string' && r.ollamaChatModel.length > 0) {
        out.ollamaChatModel = r.ollamaChatModel;
    }
    if (typeof r.chatTimeoutMs === 'number' && Number.isFinite(r.chatTimeoutMs) && r.chatTimeoutMs > 0) {
        out.chatTimeoutMs = r.chatTimeoutMs;
    }
    if (typeof r.embedTimeoutMs === 'number' && Number.isFinite(r.embedTimeoutMs) && r.embedTimeoutMs > 0) {
        out.embedTimeoutMs = r.embedTimeoutMs;
    }
    if (typeof r.embedDim === 'number' && Number.isFinite(r.embedDim) && r.embedDim > 0) {
        out.embedDim = r.embedDim;
    }
    return out;
}

export function modelTag(settings: MuninnSettings): string {
    return `ollama/${settings.ollamaModel}`;
}
