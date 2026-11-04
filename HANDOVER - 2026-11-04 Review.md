# Handover — Muninn v0.2.0-test.2, Paused for Independent Review

**Date:** 2026-11-04  
**Repo:** `/home/danf/Projects/Muninn`  
**Head:** `c22c040` on `main`  
**Test tag:** `0.2.0-test.2` (pushed; GitHub release with `main.js`, `manifest.json`, `versions.json`)  
**Status:** Work paused. User requested independent code review before continuing.

---

## What is on `main`

- `3b0519c` — `fix(bundle): use browser platform and externalize Node built-ins`
- `1751b11` — `fix(renderer): replace Node Buffer with TextEncoder/TextDecoder`
- `118d58d` — `fix(plugin): fall back to in-memory SQLite when disk open fails in renderer`
- `f746ef8` / `c22c040` — doc updates to `TESTING1.md` and `HANDOVER - 2026-11-04.md`

## Why we are paused

The user halted further implementation because they believe the work has drifted from the project's objectives. The current state is intentionally a set of workarounds, not a complete persistence solution.

Specifically:
- The `:memory:` SQLite fallback in `src/main.ts` lets the plugin load in Obsidian's renderer, but it is **not vault-persistent**.
- The real persistence strategy mandated by `docs/Unified Project Definition v0.2.md` is **import-from-bytes / export-to-bytes** using Obsidian's `Vault.adapter`, but this has not been implemented or proven.
- The user wants the existing code reviewed independently before any more changes are made.

## What the reviewer should know

1. **The project definition is authoritative.** `docs/Unified Project Definition v0.2.md` states the index store must use SQLite WASM with whole-DB serialize/deserialize round-trip persistence. The current in-memory fallback is a smoke-test workaround only.
2. **The open technical question is real persistence in Obsidian.** The browser build of `@sqlite.org/sqlite-wasm` cannot open arbitrary OS paths in the Electron renderer (`SQLITE_CANTOPEN`). The correct path is `sqlite3_serialize` / `sqlite3_deserialize` (or equivalent high-level API) plus `Vault.adapter.readBinary` / `writeBinary`.
3. **No further code changes should happen without the user's go-ahead.** The next step is review, then a decision on the persistence strategy.

## Current build health

- `npm run typecheck` ✅
- `npm run build` ✅
- F01–F11 all `VERDICT: GREEN` ✅

## Untracked files at repo root (do not touch unless asked)

- `REPORT.md`
- `STATE.md`
- `Standing Qwen prompt.txt`

## Open items (not to be closed by workaround)

- Vault-persistent SQLite storage via serialize/deserialize + `Vault.adapter`.
- Live Obsidian smoke-test receipt for Plugin 1 functionality.
- Settings UI, sidebar UI, Plugin 2 harness.

---

**Next action:** Await independent review and the user's ruling on how to proceed.
