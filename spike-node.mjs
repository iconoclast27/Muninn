// spike-node.mjs — engine viability, no trace spam
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const sqlite3 = await sqlite3InitModule();
console.log('libVersion:', sqlite3.version.libVersion);

// NOTE: 'c' flag only, NOT 'ct'. The 't' flag enables SQL trace.
const db = new sqlite3.oo1.DB(':memory:', 'c');

const opts = [];
{
    const s = db.prepare('PRAGMA compile_options');
    while (s.step()) opts.push(s.get([])[0]);
    s.finalize();
}
console.log('FTS5 compiled in:', opts.some(o => o.includes('FTS5')));
console.log('JSON1 compiled in:', opts.some(o => o.includes('JSON1')));

db.exec("CREATE VIRTUAL TABLE t USING fts5(body, tokenize='trigram')");
db.exec("INSERT INTO t(body) VALUES ('time blocking is great'), ('database engines matter'), ('the block party was cancelled')");

{
    const s = db.prepare('SELECT rowid, body FROM t WHERE t MATCH ? ORDER BY rank');
    s.bind(['block']);
    const rows = [];
    while (s.step()) rows.push(s.get([]));
    s.finalize();
    console.log('trigram hits for "block":', JSON.stringify(rows));
}

{
    const s = db.prepare('SELECT rowid FROM t WHERE t MATCH ?');
    try {
        s.bind(['bl']);
        let n = 0;
        while (s.step()) n++;
        console.log('2-char query "bl" hits:', n);
    } catch (e) {
        console.log('2-char query threw:', e.message);
    }
    s.finalize();
}

try {
    const bytes = sqlite3.capi.sqlite3_js_db_export(db);
    console.log('exported bytes:', bytes.byteLength);
} catch (e) {
    console.log('export attempt failed:', e.message);
}

db.close();
