// Prototype: one native-tool-calling turn (agent loop) against local Ollama.
// Measures the latency floor claim: rounds, per-round wall time, prefill reuse
// (prompt_eval_count per round), token counts. Mock vault behind the tools.
// Usage: node prototype-tool-loop.mjs [model...]
const OLLAMA = 'http://127.0.0.1:11434/api/chat';

// ---- mock vault (the real build would map these to Obsidian API calls) ----
const VAULT = {
    'Projects/Phoenix.md': '# Phoenix\n\nStatus: the Phoenix project is migrating from REST calls to in-process tool calls; current blocker is the approval modal redesign.\n',
    'Projects/Harbor.md': '# Harbor\n\nStatus: paused.\n',
    'Phoenix.md': '# Phoenix (disambiguation)\n\nSee [[Phoenix project|Projects/Phoenix]].\n',
    'Daily/2026-11-24.md': 'worked on Phoenix migration all afternoon\n',
};
function listFolder(folder) {
    return Object.keys(VAULT).filter(p => p.startsWith(folder));
}
function searchVault(query) {
    const q = query.toLowerCase();
    return Object.entries(VAULT).filter(([, c]) => c.toLowerCase().includes(q))
        .map(([path, c]) => ({ path, occurrences: c.toLowerCase().split(q).length - 1 }));
}
function notesLike(query) {
    // mock semantic answer: ranked, scored, honest label (the door contract)
    return { label: 'semantic match, not lexical, not freshness', results: [
        { path: 'Projects/Phoenix.md', score: 0.82 }, { path: 'Phoenix.md', score: 0.61 }] };
}
function readNote(path) {
    return VAULT[path] ?? (() => { throw new Error(`NOT_FOUND: ${path}`); })();
}
const TOOLS = [
    { type: 'function', function: { name: 'listFolder', description: 'List vault paths under a folder', parameters: { type: 'object', required: ['folder'], properties: { folder: { type: 'string', description: 'vault folder, e.g. "Projects"' } } } } },
    { type: 'function', function: { name: 'searchVault', description: 'Exact lexical search of vault text; returns paths with occurrence counts', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'literal text to search' } } } } },
    { type: 'function', function: { name: 'notesLike', description: 'Semantic search: notes like the query or like an existing note path; returns a RANKED list with similarity scores. These are semantic matches, not exact matches.', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'free text or a note path' } } } } },
    { type: 'function', function: { name: 'readNote', description: 'Read the text of one vault note by exact path', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string', description: 'exact vault path, e.g. "Projects/Phoenix.md"' } } } } },
];
const exec = { listFolder, searchVault, notesLike, readNote };

async function run(model) {
    const messages = [{ role: 'user', content: 'Somewhere in this vault is a note about the Phoenix project. Find it, read it, and summarize its current status in one short sentence.' }];
    const rounds = [];
    for (let i = 0; i < 6; i++) {
        const t0 = Date.now();
        const res = await fetch(OLLAMA, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages, tools: TOOLS, stream: false, options: { temperature: 0, num_ctx: 8192, num_gpu: 0 } }) });
        const j = await res.json();
        if (!j.message) { rounds.push({ i, error: j.error ?? 'no message', ms: Date.now() - t0 }); break; }
        const calls = j.message.tool_calls ?? [];
        rounds.push({ i, ms: Date.now() - t0, content: j.message.content ?? '', calls: calls.map((c) => ({ name: c.function.name, args: c.function.arguments })), prompt_eval: j.prompt_eval_count, eval: j.eval_count, load: Math.round((j.load_duration ?? 0) / 1e6) });
        messages.push({ role: 'assistant', content: j.message.content, ...(calls.length ? { tool_calls: calls } : {}) });
        if (!calls.length) break;
        for (const c of calls) {
            let out;
            try {
                const args = typeof c.function.arguments === 'string' ? JSON.parse(c.function.arguments) : c.function.arguments;
                const fn = exec[c.function.name];
                out = fn ? JSON.stringify(fn(...Object.values(args))) : `ERROR: unknown tool ${c.function.name}`;
            } catch (e) { out = `ERROR: ${e.message} — call the tool again with well-formed arguments`; }
            messages.push({ role: 'tool', tool_name: c.function.name, content: out });
        }
    }
    return rounds;
}

const models = (process.argv.slice(2).length ? process.argv.slice(2) : ['llama3.2:3b', 'qwen3.5:4b', 'qwen2.5-coder:3b']);
const out = {};
for (const m of models) {
    try { out[m] = await run(m); } catch (e) { out[m] = [{ error: String(e) }]; }
    const total = out[m].reduce((s, r) => s + (r.ms ?? 0), 0);
    console.log(`=== ${m} rounds=${out[m].length} total_ms=${total}`);
    out[m].forEach((r) => console.log(`  round ${r.i}: ${r.ms}ms prompt_eval=${r.prompt_eval ?? '-'} eval=${r.eval ?? '-'} calls=${(r.calls ?? []).map((c) => c.name + JSON.stringify(c.args)).join(' | ')} err=${r.error ?? ''}`));
}
import { appendFileSync } from 'node:fs';
appendFileSync(new URL('../raw/prototype-runs.json', import.meta.url).pathname, JSON.stringify({ ran: new Date().toISOString(), models: out }) + '\n');
