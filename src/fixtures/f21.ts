// =============================================================================
// Muninn — F21: Settings Defaults and Sanitization
// fixtures/f21-settings.ts
//
// CONTRACT TEXT (settings UI):
//   PASS requires:
//     S1  sanitizeSettings returns defaults for null/undefined/non-object input.
//     S2  sanitizeSettings strips a trailing slash from the Ollama URL.
//     S3  sanitizeSettings preserves valid user values.
//     S4  sanitizeSettings rejects invalid numbers and falls back to defaults.
//     S5  modelTag builds the expected content-addressed model tag.
//
// RUNNER: plain Node via tsx.
//   npx tsx src/fixtures/f21.ts
// =============================================================================

import { DEFAULT_SETTINGS, sanitizeSettings, modelTag } from '../settings.ts';

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function main(): void {
    console.log('[F21] settings defaults and sanitization');

    check('S1 defaults for null', JSON.stringify(sanitizeSettings(null)) === JSON.stringify(DEFAULT_SETTINGS));
    check('S1 defaults for undefined', JSON.stringify(sanitizeSettings(undefined)) === JSON.stringify(DEFAULT_SETTINGS));
    check('S1 defaults for string', JSON.stringify(sanitizeSettings('bad')) === JSON.stringify(DEFAULT_SETTINGS));

    check('S2 strips trailing slash',
        sanitizeSettings({ ollamaUrl: 'http://example.com:11434/' }).ollamaUrl === 'http://example.com:11434',
        sanitizeSettings({ ollamaUrl: 'http://example.com:11434/' }).ollamaUrl);

    check('S3 preserves valid URL',
        sanitizeSettings({ ollamaUrl: 'http://192.168.1.10:11434' }).ollamaUrl === 'http://192.168.1.10:11434');
    check('S3 preserves valid model',
        sanitizeSettings({ ollamaModel: 'mxbai-embed-large' }).ollamaModel === 'mxbai-embed-large');
    check('S3 preserves valid chat model',
        sanitizeSettings({ ollamaChatModel: 'qwen3.5:4b' }).ollamaChatModel === 'qwen3.5:4b');
    check('S3 preserves valid chat timeout',
        sanitizeSettings({ chatTimeoutMs: 120000 }).chatTimeoutMs === 120000);
    check('S3 preserves valid timeout',
        sanitizeSettings({ embedTimeoutMs: 60000 }).embedTimeoutMs === 60000);
    check('S3 preserves valid dim',
        sanitizeSettings({ embedDim: 1024 }).embedDim === 1024);

    check('S4 rejects negative chat timeout', sanitizeSettings({ chatTimeoutMs: -1 }).chatTimeoutMs === DEFAULT_SETTINGS.chatTimeoutMs);
    check('S4 rejects NaN chat timeout', sanitizeSettings({ chatTimeoutMs: NaN }).chatTimeoutMs === DEFAULT_SETTINGS.chatTimeoutMs);
    check('S4 rejects negative timeout', sanitizeSettings({ embedTimeoutMs: -1 }).embedTimeoutMs === DEFAULT_SETTINGS.embedTimeoutMs);
    check('S4 rejects NaN timeout', sanitizeSettings({ embedTimeoutMs: NaN }).embedTimeoutMs === DEFAULT_SETTINGS.embedTimeoutMs);
    check('S4 rejects zero dim', sanitizeSettings({ embedDim: 0 }).embedDim === DEFAULT_SETTINGS.embedDim);
    check('S4 rejects string timeout', sanitizeSettings({ embedTimeoutMs: '1000' as unknown as number }).embedTimeoutMs === DEFAULT_SETTINGS.embedTimeoutMs);
    check('S4 rejects empty model', sanitizeSettings({ ollamaModel: '' }).ollamaModel === DEFAULT_SETTINGS.ollamaModel);
    check('S4 rejects empty chat model', sanitizeSettings({ ollamaChatModel: '' }).ollamaChatModel === DEFAULT_SETTINGS.ollamaChatModel);
    check('S4 rejects empty URL', sanitizeSettings({ ollamaUrl: '' }).ollamaUrl === DEFAULT_SETTINGS.ollamaUrl);

    check('S5 modelTag matches ollama/model format',
        modelTag({ ...DEFAULT_SETTINGS, ollamaModel: 'test-model' }) === 'ollama/test-model');

    console.log(failures === 0
        ? '[F21] VERDICT: GREEN'
        : `[F21] VERDICT: RED — ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
