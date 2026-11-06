// =============================================================================
// Muninn — Diff Gate
// src/harness/diff.ts
//
// Computes a flat list of changes between an old and new JSON-serializable
// value. Used by the diff gate so a human can see every edit before apply.
// =============================================================================

import type { DiffEntry, DiffResult } from '../recipes/types.ts';

export function computeDiff(oldValue: unknown, newValue: unknown): DiffResult {
    const changes: DiffEntry[] = [];
    diffRecursive('', oldValue, newValue, changes);
    return { changes };
}

function diffRecursive(path: string, oldValue: unknown, newValue: unknown, changes: DiffEntry[]): void {
    if (deepEqual(oldValue, newValue)) return;

    const oldType = typeName(oldValue);
    const newType = typeName(newValue);

    if (oldType !== newType || oldType !== 'object') {
        changes.push({ path: path || '.', oldValue, newValue });
        return;
    }

    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of keys) {
        const childPath = path ? `${path}.${key}` : key;
        if (!(key in oldObj)) {
            changes.push({ path: childPath, oldValue: undefined, newValue: newObj[key] });
        } else if (!(key in newObj)) {
            changes.push({ path: childPath, oldValue: oldObj[key], newValue: undefined });
        } else {
            diffRecursive(childPath, oldObj[key], newObj[key], changes);
        }
    }
}

function typeName(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
        const aa = a as unknown[];
        const bb = b as unknown[];
        if (aa.length !== bb.length) return false;
        for (let i = 0; i < aa.length; i++) {
            if (!deepEqual(aa[i], bb[i])) return false;
        }
        return true;
    }

    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keysA = Object.keys(ao);
    const keysB = Object.keys(bo);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(bo, key)) return false;
        if (!deepEqual(ao[key], bo[key])) return false;
    }
    return true;
}

export function renderDiff(diff: DiffResult): string {
    if (diff.changes.length === 0) return 'No changes.';
    const lines: string[] = [];
    for (const c of diff.changes) {
        lines.push(`--- ${c.path}`);
        lines.push(`old: ${JSON.stringify(c.oldValue)}`);
        lines.push(`new: ${JSON.stringify(c.newValue)}`);
    }
    return lines.join('\n');
}
