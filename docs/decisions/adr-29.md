# ADR-29: Persistence seam — import/export bytes via `Vault.adapter`; the `:memory:` fallback is ruled out, not a solution

**Status:** Accepted (retrospective; recorded 2026-11-16); proven live 2026-11-04.
**Ruled:** 2026-11-04 (the mandated strategy, the work-pause ruling), closed by the seam, live receipt
the same day.

## Context

The economy-killer finding: browser-entry WASM cannot open OS paths, so the plugin fell back to
`:memory:` SQLite, and **every plugin reload re-embedded the entire vault** — the watermark economy
"fully built and fully void at the only place it matters". BRAT reloads the plugin twice in one
session. The user halted implementation: "the work has drifted from the project's objectives. The
current state is intentionally a set of workarounds, not a complete persistence solution."

## Decision

- **The persistence strategy is import/export bytes via `Vault.adapter`**: `sqlite3_js_db_export` →
  bytes → write; read bytes → import. The `:memory:` fallback is a named workaround, **not** a
  persistence solution, and **open items are not to be closed by workaround**.
- **No further code changes without the user's go-ahead** (the authorization rule of record).
- The three-phase seam: round-trip fixture → load/save seam → renderer receipt. **Amend the test doc
  in the same commit as the seam.**
- **Live proof at `0.2.0-test.4`**: restart loaded `[Muninn] loaded cache: 510 files, 3779 chunks`;
  post-reload walk a no-op (9 embeddings refreshed, not a full re-embed); cache at
  `.obsidian/plugins/muninn/cache/index.db` (~38 MB).
- **The silent cache-write defect (gotcha):** `flushCache()` passed the entire WASM heap buffer to
  `adapter.writeBinary` because `serialize()` returns a `Uint8Array` **view**; fix = copy into a
  right-sized `ArrayBuffer`. **A `Uint8Array` view over a heap buffer is not the buffer.**
- `onunload` cache flush is best-effort/async; durability is not guaranteed on forced quit (named
  debt).
- **Renderer reality, durable** (ADR-19): platform `'browser'` + externalized Node built-ins;
  `TextEncoder`/`TextDecoder` in place of Node `Buffer`.

## Consequences

Zone 2 disposability and persistence coexist: the cache is rebuildable, and rebuild cost is measured
in embeddings, not in a full re-embed. The three-phase seam method (fixture → seam → renderer
receipt) is the template for any future renderer-boundary work.

## Sources

`docs/Independent Review 2026-11-04.md` (C1 economy-killer, three-phase seam, amend-test-doc rule,
unenforced furniture); `docs/HANDOVER - 2026-11-04 Review.md` (the pause ruling, mandated strategy,
"open items not to be closed by workaround"); `docs/HANDOVER - 2026-11-04.md` (renderer facts, the
21 findings); `docs/HANDOVER - 2026-11-04 Evening.md` (live proof, heap-buffer fix, `countFiles()`).
