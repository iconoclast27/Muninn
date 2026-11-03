// ==========================================================================
// spike-plugin.js — SQLite WASM in-Obsidian packaging spike
// Bundled by esbuild-spike.mjs into the spike plugin's main.js.
// Engine already proven in Node (spike-node.mjs, 2026-11-02); this file
// proves only the PACKAGING: esbuild bundle + embedded wasm + Obsidian.
// ==========================================================================

import { Plugin } from 'obsidian';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// esbuild's base64 loader turns the wasm file into a base64 STRING here.
import wasmB64 from '@sqlite.org/sqlite-wasm/sqlite3.wasm';

function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export default class SpikePlugin extends Plugin {
    async onload() {
        console.log('[SPIKE-B] Starting...');
        try {
            const wasmBytes = b64ToBytes(wasmB64);
            console.log('[SPIKE-B] Embedded wasm bytes:', wasmBytes.length);

            // HYPOTHESIS under test: init accepts injected wasm bytes via
            // `wasmBinary` (Emscripten-standard option). Node's entry never
            // exercised this path. If init rejects/hangs here, that's the
            // receipt — we grep the wrapper for the real option name.
            const sqlite3 = await sqlite3InitModule({
                wasmBinary: wasmBytes,
                // findWasmBinary() crashes on import.meta.url in CJS bundles; this
                // supported option short-circuits it (index.mjs:137) before the
                // fatal new URL() — return value is only a filename for the
                // byte-comparison at line 141, which our injected bytes satisfy.
                locateFile: () => 'sqlite3.wasm',
            });
            console.log('[SPIKE-B] Version:', sqlite3.version.libVersion);

            // 'c' only — the 't' flag is the SQL-trace spam we found in source.
            const db = new sqlite3.oo1.DB(':memory:', 'c');

            const s0 = db.prepare('PRAGMA compile_options');
            const opts = [];
            while (s0.step()) opts.push(s0.get([])[0]);
            s0.finalize();
            const fts5 = opts.some((o) => o.includes('FTS5'));
            console.log('[SPIKE-B] FTS5 compiled in:', fts5);

            db.exec("CREATE VIRTUAL TABLE t USING fts5(body, tokenize='trigram')");
            db.exec(
                "INSERT INTO t(body) VALUES ('time blocking is great'), " +
                "('database engines matter'), ('the block party was cancelled')",
            );

            const s = db.prepare('SELECT rowid, body FROM t WHERE t MATCH ? ORDER BY rank');
            s.bind(['block']);
            const rows = [];
            while (s.step()) rows.push(s.get([]));
            s.finalize();
            console.log('[SPIKE-B] Trigram hits:', JSON.stringify(rows));

            const bytes = sqlite3.capi.sqlite3_js_db_export(db);
            console.log('[SPIKE-B] Exported bytes:', bytes.byteLength);

            db.close();

            console.log(
                '[SPIKE-B] ===== VERDICT:',
                fts5 && rows.length === 2 && bytes.byteLength > 0
                ? 'SUCCESS — WASM SQLite viable inside Obsidian'
                : 'FAILURE — see flags above',
            );
        } catch (err) {
            console.error('[SPIKE-B] ERROR:', err.name, err.message);
            console.error('[SPIKE-B] STACK:', err.stack);
        }
    }
}
