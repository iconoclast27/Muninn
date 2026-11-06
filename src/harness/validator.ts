// =============================================================================
// Muninn — Schema Validator
// src/harness/validator.ts
//
// Minimal JSON Schema validator for recipe output contracts. Returns typed
// errors instead of throwing. Supports object, array, string, number,
// boolean, required, enum, and nested properties/items.
// =============================================================================

import type { JsonSchema, ValidationError, ValidationResult } from '../recipes/types.ts';

export function validateJson(data: unknown, schema: JsonSchema, path = ''): ValidationResult {
    const errors: ValidationError[] = [];
    validateValue(data, schema, path, errors);
    return { ok: errors.length === 0, errors };
}

function validateValue(value: unknown, schema: JsonSchema, path: string, errors: ValidationError[]): void {
    if (schema.enum !== undefined && !schema.enum.some((e) => e === value)) {
        errors.push({ path, message: `value not in enum ${JSON.stringify(schema.enum)}` });
        return;
    }

    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') {
                errors.push({ path, message: `expected string, got ${typeof value}` });
            }
            break;
        case 'number':
            if (typeof value !== 'number' || Number.isNaN(value)) {
                errors.push({ path, message: `expected number, got ${typeof value}` });
            }
            break;
        case 'boolean':
            if (typeof value !== 'boolean') {
                errors.push({ path, message: `expected boolean, got ${typeof value}` });
            }
            break;
        case 'array':
            if (!Array.isArray(value)) {
                errors.push({ path, message: `expected array, got ${typeof value}` });
                return;
            }
            for (let i = 0; i < value.length; i++) {
                validateValue(value[i], schema.items, `${path}[${i}]`, errors);
            }
            break;
        case 'object':
            if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                errors.push({ path, message: `expected object, got ${value === null ? 'null' : typeof value}` });
                return;
            }
            validateObject(value as Record<string, unknown>, schema, path, errors);
            break;
    }
}

function validateObject(
    value: Record<string, unknown>,
    schema: JsonSchema,
    path: string,
    errors: ValidationError[],
): void {
    if (schema.type !== 'object') return;

    const required = schema.required ?? [];
    for (const key of required) {
        if (!(key in value)) {
            errors.push({ path: `${path}.${key}`, message: 'missing required property' });
        }
    }

    if (!schema.properties) return;
    for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in value) {
            validateValue(value[key], propSchema, path ? `${path}.${key}` : key, errors);
        }
    }
}
