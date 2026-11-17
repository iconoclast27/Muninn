# ADR-14: Mobile read lane, Option A, fixture-proven — and the `isDesktopOnly` supersession

**Status:** Accepted, with one superseded clause (recorded 2026-11-16); the mobile **live** receipt
remains owed.
**Ruled:** Option A ruled 2026-10-31 (fixture-proven F15 M1–M3); the `isDesktopOnly` clause
superseded by Dan, 2026-11-16.

## Context

Mobile was a nice-to-have requirement (never a Dan requirement of the spine era). The mobile lane was
designed with zero native imports, proven as M1–M3 fixtures, and the archive then framed
`isDesktopOnly` as a flag to be flipped "pending mobile live receipts". The archived text was born of
the architect's misunderstanding of the flag.

## Decision

- **Option A (ruled 2026-10-31):** a mobile read lane with **zero native imports** — no
  better-sqlite3, no `node:crypto`, no `Buffer` (native modules crash the mobile runtime; "burned us
  hard"). **Feature parity is explicitly not promised.**
- **Live-set only serving:** tombstones, renamed-away, and absent files are never served.
- **Superseded clause (Dan, 2026-11-16):** `isDesktopOnly` **only blocks activation on a mobile
  device, and it is not necessary when a mobile read-lane fallback exists.** It is "an unnecessary
  restriction until some point when we actually test the mobile index… a parked question, not a bug."
  `isDesktopOnly: false` in Muninn `manifest.json:10` (false since the plugin entry-point commit
  `5516c44`) is **correct**; `manifest.json` in Huginn is also `false` [R]. **No code change.**
  The archived doctrine promising a flip is the stale artifact; the text is superseded here.
- **The mobile live-receipt gap is unchanged by the supersession**: mobile is fixture-proven only.
  "Platform claims require receipts": four fabricated claims about Obsidian mobile runtime were
  contradicted by docs.obsidian.md — "training data is not a receipt for vendor behavior."
- The mobile linear-scan fallback (11-01 text) is superseded: as-built runs FTS5 via SQLite/WASM on
  both devices, plus brute-force kNN.

## Consequences

The mobile question is parked until a live mobile index test happens. If it turns out the flag is
necessary, Dan deals with it then. No doc may promise a flag flip again.

## Sources

`docs/archive/project-definition-file.md` (Option A ruling 2026-10-31, M1–M3, parity not promised,
the `isDesktopOnly` clarification with Dan's date); `docs/archive/Session Note — 2026-10-31.md`
(platform-receipt rule, mobile proof set); `docs/archive/Session Handover Note 2026-11-02.md` L195
("Held for mobile live receipts" — stale); `docs/archive/HANDOVER - 2026-11-05.md` (the
"`isDesktopOnly` remains `false` by policy, no live receipt" framing); as-built
`Muninn/manifest.json:10`, `Huginn/manifest.json` [R].
