// =============================================================================
// Muninn — Sidebar Search State
// src/ui/search-state.ts
//
// Serializable state for the Muninn search view. Kept free of Obsidian
// dependencies so it can be unit-tested in Node fixtures.
// =============================================================================

import type { Hit } from '../api.ts';

export interface MuninnSearchState extends Record<string, unknown> {
    query: string;
    mode: 'text' | 'semantic';
    hits: Hit[];
}

export function emptySearchState(): MuninnSearchState {
    return { query: '', mode: 'text', hits: [] };
}

function isHit(v: unknown): v is Hit {
    if (v === null || typeof v !== 'object') return false;
    const h = v as Record<string, unknown>;
    return typeof h.path === 'string' && typeof h.ord === 'number';
}

export function sanitizeSearchState(raw: unknown): MuninnSearchState | null {
    if (raw === null || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const out = emptySearchState();

    if (typeof r.query === 'string') {
        out.query = r.query;
    }

    if (r.mode === 'text' || r.mode === 'semantic') {
        out.mode = r.mode;
    }

    if (Array.isArray(r.hits)) {
        out.hits = r.hits.filter(isHit);
    }

    return out;
}
