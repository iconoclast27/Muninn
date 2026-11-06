// =============================================================================
// Muninn — Plugin 2 Recipe Types
// src/recipes/types.ts
//
// A recipe is a declarative form the model fills. The harness owns every side
// effect. Each recipe is one bounded task, a strict output contract, and an
// apply method that runs only after schema and ground-truth validation.
// =============================================================================

export type RecipeRiskClass = 'read-only' | 'suggest';

export interface RecipeMetadata {
    name: string;
    version: string;
    modelTier: 'fast' | 'capable';
    riskClass: RecipeRiskClass;
}

export interface RecipeTrigger {
    /** Human-readable trigger condition; harness may later dispatch by regex. */
    description: string;
}

export interface RecipeInput {
    /** Stable key used in the recipe template. */
    key: string;
    /** Description shown to the model; not a prompt. */
    description: string;
    /** Source of truth the harness gathers before rendering. */
    source: 'query' | 'path' | 'vocabulary' | 'constant' | 'recipe-param';
    /** For source 'query', the input key whose value is the search string. */
    queryKey?: string;
}

export interface RecipeOutputSchema {
    /** Top-level JSON schema describing the model's response. */
    type: 'object';
    required?: string[];
    properties: Record<string, JsonSchema>;
}

export type JsonSchemaType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface JsonSchemaBase {
    type: JsonSchemaType;
    description?: string;
    enum?: unknown[];
}

export interface JsonStringSchema extends JsonSchemaBase {
    type: 'string';
}

export interface JsonNumberSchema extends JsonSchemaBase {
    type: 'number';
}

export interface JsonBooleanSchema extends JsonSchemaBase {
    type: 'boolean';
}

export interface JsonArraySchema extends JsonSchemaBase {
    type: 'array';
    items: JsonSchema;
}

export interface JsonObjectSchema extends JsonSchemaBase {
    type: 'object';
    properties?: Record<string, JsonSchema>;
    required?: string[];
}

export type JsonSchema =
    | JsonStringSchema
    | JsonNumberSchema
    | JsonBooleanSchema
    | JsonArraySchema
    | JsonObjectSchema;

export interface RecipeValidationRule {
    /** JSON pointer path inside the output object to check. */
    path: string;
    /** Ground-truth source. Currently only 'vault-file' is supported. */
    source: 'vault-file';
    /** What to check against disk. */
    check: 'exists' | 'not-exists' | 'matches-frontmatter';
    /** Optional parameters for the check. */
    params?: Record<string, unknown>;
}

export interface Recipe {
    metadata: RecipeMetadata;
    trigger: RecipeTrigger;
    inputs: RecipeInput[];
    instructions: string;
    outputSchema: RecipeOutputSchema;
    applyMethod: string;
    validation: RecipeValidationRule[];
}

export interface LoadedRecipe extends Recipe {
    /** Absolute or vault-relative path, depending on loader. */
    sourcePath: string;
}

export interface GatheredInput {
    key: string;
    value: unknown;
}

export interface RecipeRenderContext {
    recipe: LoadedRecipe;
    inputs: GatheredInput[];
}

export interface ParsedModelOutput {
    /** Raw output as returned by the LLM. */
    raw: string;
    /** Parsed JSON, if syntactically valid. */
    json: unknown | undefined;
}

export interface ValidationError {
    path: string;
    message: string;
}

export interface ValidationResult {
    ok: boolean;
    errors: ValidationError[];
}

export interface DiffEntry {
    path: string;
    oldValue: unknown;
    newValue: unknown;
}

export interface DiffResult {
    changes: DiffEntry[];
}

export interface ApplyResult {
    applied: boolean;
    message: string;
}

export interface RecipeRunResult {
    recipeName: string;
    renderedPrompt: string;
    parsedOutput: ParsedModelOutput;
    schemaValid: boolean;
    schemaErrors: ValidationError[];
    groundTruthValid: boolean;
    groundTruthErrors: ValidationError[];
    diff: DiffResult;
    approved: boolean | null;
    applyResult: ApplyResult | null;
}
