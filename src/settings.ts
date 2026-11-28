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
    embedTimeoutMs: number;
    embedDim: number;
    // T58 A3 (2026-11-26): the semantic band — a fixed ABSOLUTE cosine margin
    // (Dan's ruling: absolute, not relative) whose DEFAULT is Dan's ruling
    // 0.5, pinned between the measured classes on the smoke's cone (junk
    // cross-folder tops 0.466; related legs sit 0.5896+). It is a Settings
    // knob, so a post-epoch revisit is a settings edit, not a code act.
    // null = band OFF (user opt-out), not a missing value.
    semanticBand: number | null;
    // ADR-02 (2026-11-27): the verbose lane trace — discrete checkpoint lines on
    // this plugin's own console log ([Muninn lanes] family), off by default.
    // Observational only (adr-02.md is the law).
    traceVerbosity: boolean;
}

export const DEFAULT_SETTINGS: MuninnSettings = {
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'nomic-embed-text:v1.5',
    embedTimeoutMs: 30000,
    embedDim: 768,
    semanticBand: 0.5, // Dan's ruling 2026-11-26: absolute floor, default 0.5 between the classes
    traceVerbosity: false, // ADR-02: verbose lane trace OFF (settings knob, Dan's to flip)
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
    if (typeof r.embedTimeoutMs === 'number' && Number.isFinite(r.embedTimeoutMs) && r.embedTimeoutMs > 0) {
        out.embedTimeoutMs = r.embedTimeoutMs;
    }
    if (typeof r.embedDim === 'number' && Number.isFinite(r.embedDim) && r.embedDim > 0) {
        out.embedDim = r.embedDim;
    }
    // T58 A3: the band rides only as a finite margin in the cosine range;
    // anything else stays null = band DISABLED (user opt-out).
    if (typeof r.semanticBand === 'number' && Number.isFinite(r.semanticBand)
        && r.semanticBand >= -1 && r.semanticBand <= 1) {
        out.semanticBand = r.semanticBand;
    }
    // ADR-02: the trace flag rides only as a real boolean; anything else stays false.
    if (typeof r.traceVerbosity === 'boolean') {
        out.traceVerbosity = r.traceVerbosity;
    }
    return out;
}

export function modelTag(settings: MuninnSettings): string {
    return `ollama/${settings.ollamaModel}`;
}
