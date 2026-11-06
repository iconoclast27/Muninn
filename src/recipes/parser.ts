// =============================================================================
// Muninn — Recipe Parser
// src/recipes/parser.ts
//
// Parses a Markdown recipe into the Recipe shape. Recipes have YAML frontmatter
// for metadata and H1 sections for the remaining fields. The parser is
// intentionally degenerate: malformed recipes fail loudly, never silently drift.
// =============================================================================

import type {
    Recipe,
    RecipeMetadata,
    RecipeTrigger,
    RecipeInput,
    RecipeOutputSchema,
    RecipeValidationRule,
    JsonSchema,
    JsonSchemaType,
    JsonSchemaBase,
    JsonArraySchema,
    JsonObjectSchema,
} from './types.ts';

export interface ParsedRecipe {
    ok: boolean;
    recipe?: Recipe;
    errors: string[];
}

export function parseRecipe(source: string, sourcePath: string): ParsedRecipe {
    const errors: string[] = [];

    const frontmatter = extractFrontmatter(source);
    if (frontmatter === undefined) {
        errors.push('Missing YAML frontmatter block');
        return { ok: false, errors };
    }

    const metadata = parseMetadata(frontmatter, errors);
    const sections = extractSections(source);

    const trigger = parseTriggerSection(sections.get('trigger'), errors);
    const inputs = parseInputsSection(sections.get('inputs'), errors);
    const instructions = parseSingleTextSection(sections.get('instructions'), 'Instructions', errors);
    const outputSchema = parseOutputSection(sections.get('output contract'), errors);
    const applyMethod = parseSingleTextSection(sections.get('apply method'), 'Apply Method', errors);
    const validation = parseValidationSection(sections.get('validation'), errors);

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    const recipe: Recipe = {
        metadata: metadata!,
        trigger: trigger!,
        inputs,
        instructions: instructions!,
        outputSchema: outputSchema!,
        applyMethod: applyMethod!,
        validation,
    };

    return { ok: true, recipe, errors };
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function extractFrontmatter(source: string): string | undefined {
    const trimmed = source.trim();
    if (!trimmed.startsWith('---')) return undefined;
    const end = trimmed.indexOf('---', 3);
    if (end === -1) return undefined;
    return trimmed.slice(3, end).trim();
}

function parseMetadata(block: string, errors: string[]): RecipeMetadata | undefined {
    const lines = block.split('\n').map((l) => l.replace(/\r$/, ''));
    const meta: Partial<RecipeMetadata> = {};
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();
        if (key === 'name') meta.name = value;
        else if (key === 'version') meta.version = value;
        else if (key === 'modelTier') meta.modelTier = value as RecipeMetadata['modelTier'];
        else if (key === 'riskClass') meta.riskClass = value as RecipeMetadata['riskClass'];
    }

    if (!meta.name || meta.name.length === 0) errors.push('Metadata missing name');
    if (!meta.version || meta.version.length === 0) errors.push('Metadata missing version');
    if (!meta.modelTier || !['fast', 'capable'].includes(meta.modelTier)) {
        errors.push('Metadata missing or invalid modelTier (fast | capable)');
    }
    if (!meta.riskClass || !['read-only', 'suggest'].includes(meta.riskClass)) {
        errors.push('Metadata missing or invalid riskClass (read-only | suggest)');
    }

    if (errors.length > 0) return undefined;
    return meta as RecipeMetadata;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function extractSections(source: string): Map<string, string> {
    const sections = new Map<string, string>();
    const body = source.replace(/^---[\s\S]*?---\n?/, '');
    const headingRe = /^#\s+(.+)$/m;
    let currentTitle: string | null = null;
    const currentLines: string[] = [];

    function flush(): void {
        if (currentTitle !== null) {
            sections.set(currentTitle.toLowerCase().trim(), currentLines.join('\n').trim());
            currentLines.length = 0;
        }
    }

    for (const rawLine of body.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        const m = headingRe.exec(line);
        if (m) {
            flush();
            currentTitle = m[1].trim();
            continue;
        }
        if (currentTitle !== null) {
            currentLines.push(line);
        }
    }
    flush();

    return sections;
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function parseTriggerSection(text: string | undefined, errors: string[]): RecipeTrigger | undefined {
    if (!text || text.length === 0) {
        errors.push('Missing # Trigger section');
        return undefined;
    }
    return { description: text };
}

function parseInputsSection(text: string | undefined, errors: string[]): RecipeInput[] {
    if (!text || text.length === 0) return [];
    const inputs: RecipeInput[] = [];
    const entries = splitYamlList(text);
    for (const entry of entries) {
        const key = extractYamlField(entry, 'key');
        const description = extractYamlField(entry, 'description');
        const source = extractYamlField(entry, 'source') as RecipeInput['source'] | undefined;
        if (!key || !description) {
            errors.push(`Invalid input entry (missing key or description): ${entry.slice(0, 40)}`);
            continue;
        }
        if (!source || !['query', 'path', 'vocabulary', 'constant', 'recipe-param'].includes(source)) {
            errors.push(`Invalid input source for ${key}: ${source}`);
            continue;
        }
        inputs.push({ key, description, source });
    }
    return inputs;
}

function parseSingleTextSection(text: string | undefined, label: string, errors: string[]): string | undefined {
    if (!text || text.trim().length === 0) {
        errors.push(`Missing or empty # ${label} section`);
        return undefined;
    }
    return text.trim();
}

function parseOutputSection(text: string | undefined, errors: string[]): RecipeOutputSchema | undefined {
    if (!text || text.length === 0) {
        errors.push('Missing # Output Contract section');
        return undefined;
    }
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch (e) {
        errors.push(`Output Contract is not valid JSON: ${(e as Error).message}`);
        return undefined;
    }
    const schema = parseJsonSchema(json, 'outputSchema', errors);
    if (!schema || schema.type !== 'object') {
        errors.push('Output Contract root must be an object schema');
        return undefined;
    }
    return schema as RecipeOutputSchema;
}

function parseValidationSection(text: string | undefined, errors: string[]): RecipeValidationRule[] {
    if (!text || text.length === 0) return [];
    const rules: RecipeValidationRule[] = [];
    const entries = splitYamlList(text);
    for (const entry of entries) {
        const path = extractYamlField(entry, 'path');
        const source = extractYamlField(entry, 'source') as RecipeValidationRule['source'] | undefined;
        const check = extractYamlField(entry, 'check') as RecipeValidationRule['check'] | undefined;
        if (!path || !source || !check) {
            errors.push(`Invalid validation entry: ${entry.slice(0, 40)}`);
            continue;
        }
        if (source !== 'vault-file') {
            errors.push(`Unsupported validation source '${source}' for ${path}`);
            continue;
        }
        if (!['exists', 'not-exists', 'matches-frontmatter'].includes(check)) {
            errors.push(`Unsupported validation check '${check}' for ${path}`);
            continue;
        }
        rules.push({ path, source, check, params: {} });
    }
    return rules;
}

// ---------------------------------------------------------------------------
// JSON schema parser (minimal subset)
// ---------------------------------------------------------------------------

function parseJsonSchema(value: unknown, path: string, errors: string[]): JsonSchema | undefined {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`Schema at ${path} must be an object`);
        return undefined;
    }
    const obj = value as Record<string, unknown>;
    const type = obj.type;
    if (typeof type !== 'string' || !isJsonSchemaType(type)) {
        errors.push(`Schema at ${path} missing or invalid type`);
        return undefined;
    }

    const base: JsonSchemaBase = {
        type,
        description: typeof obj.description === 'string' ? obj.description : undefined,
        enum: Array.isArray(obj.enum) ? obj.enum : undefined,
    };

    switch (type) {
        case 'string':
            return base as JsonSchema;
        case 'number':
            return base as JsonSchema;
        case 'boolean':
            return base as JsonSchema;
        case 'array': {
            if (!obj.items || typeof obj.items !== 'object' || Array.isArray(obj.items)) {
                errors.push(`Schema at ${path} array missing items`);
                return undefined;
            }
            const items = parseJsonSchema(obj.items, `${path}.items`, errors);
            if (!items) return undefined;
            return { ...base, items } as JsonArraySchema;
        }
        case 'object': {
            const props: Record<string, JsonSchema> = {};
            if (obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
                const propsRaw = obj.properties as Record<string, unknown>;
                for (const [k, v] of Object.entries(propsRaw)) {
                    const child = parseJsonSchema(v, `${path}.${k}`, errors);
                    if (!child) return undefined;
                    props[k] = child;
                }
            }
            const required = Array.isArray(obj.required) ? obj.required.filter((r): r is string => typeof r === 'string') : undefined;
            return { ...base, properties: props, required } as JsonObjectSchema;
        }
    }
}

function isJsonSchemaType(t: string): t is JsonSchemaType {
    return ['string', 'number', 'boolean', 'array', 'object'].includes(t);
}

// ---------------------------------------------------------------------------
// YAML-ish helpers
// ---------------------------------------------------------------------------

function splitYamlList(text: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
    let current: string[] = [];
    for (const line of lines) {
        if (line.startsWith('- ')) {
            if (current.length > 0) items.push(current.join('\n').trim());
            current = [line.slice(2).trim()];
        } else if (line.trim().length === 0) {
            continue;
        } else if (current.length > 0) {
            current.push(line);
        }
    }
    if (current.length > 0) items.push(current.join('\n').trim());
    return items;
}

function extractYamlField(entry: string, field: string): string | undefined {
    const lines = entry.split('\n').map((l) => l.replace(/\r$/, ''));
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim();
        if (key !== field) continue;
        const value = line.slice(colon + 1).trim();
        if (value.startsWith('|')) {
            // Multi-line literal; collect indented continuation lines.
            const out: string[] = [];
            let j = i + 1;
            while (j < lines.length && (lines[j].startsWith('  ') || lines[j].startsWith('\t'))) {
                out.push(lines[j].replace(/^[ \t]+/, ''));
                j++;
            }
            return out.join('\n').trim();
        }
        return value;
    }
    return undefined;
}
