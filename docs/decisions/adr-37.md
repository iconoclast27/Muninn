# ADR-37: `listNotes` — the sixth door (Proposed; ruling owed before implementation)

**Status:** **Proposed — Dan's ruling owed.** Not accepted; nothing is implemented. Written 2026-11-16.
**Prepared under:** ADR-33 (API for code ergonomics), ADR-34 (Plugin 2 never touches the vault
directly), ADR-36 (deviation requires a ruling).

## Context

Huginn's serial contextual operations include a `list` op (metadata: which notes exist, where, tagged
how). Dan's ruling (2026-11-15): **`list` in Huginn must go through Muninn; vault enumeration in
Huginn (`app.vault.getMarkdownFiles()`) is forbidden** — a second source of truth. The frozen surface
(ADR-36) has no enumeration door, so the op cannot exist until Muninn grants the door. `tagVocabulary()`
returns **counts, not paths** (`api.ts:41-45`, `store.ts:569+`), so a tag→path filter is inexpressible
through the frozen surface today [R].

## Proposed contract (the shape agreed 2026-11-15, written here as the contract text ADR-10 requires)

```ts
listNotes(filter: {
    folder?: string;   // path prefix, e.g. 'Agents/Huginn'
    tag?: string;      // exact tag
    query?: string;    // substring, scan-mode semantics
    limit?: number;
}): {
    notes: Array<{ path: string; title: string; mtime: number; tags: string[] }>;
    total: number;
} | null;
```

- **Additive, not a version event:** a new door added to the frozen surface; no existing shape changes.
- **Dark-safe:** `null` + console reason on every failure path, `fail()` reused (`api.ts:77-83`) [R].
- **No schema change.** Every field is available from the tables as they exist:
  `files(path, size, mtime, content_hash)` (`store.ts:138-143` [R]) supplies path/mtime for **every
  walked file**, including notes with zero chunks (the watermark is recorded inside
  `replaceChunksForPath` even when `records.length === 0`, `intake/lane.ts:431-435` [R]);
  `chunks.title` is the heading chain, `c.chain.join(' > ')` (`intake/lane.ts:423` [R]), so
  `title` is taken from the chunk with `ord = 0` and a heading-less note yields `title: ''`;
  `tags` is reachable only through the `chunks.vh` → `tags.vh` join (`store.ts:171-175` [R]).
  `folder` filters by `path LIKE` prefix; `query` reuses the existing scan semantics
  (`store.ts:675` `WHERE text LIKE ? ESCAPE '\\'`) and must disclose `mode` in the same family as
  `searchText`'s `mode` field.
- **Ordering must be stated** (ADR-22: global `ts` is never trusted; ADR-27 determinism: no
  iteration-order luck). Proposal: **`ORDER BY path ASC`**, with `limit` applied after the filter, and
  `total` = count of matching rows **before** `limit` (so a capped result self-discloses that it is
  partial, per "partial indexes never served as complete").
- **Limit is a parameter, not a default** (ADR-33): absent `limit` means no cap, not "all rows
  silently truncated"; the cap must not sit in the main thread (ADR-35) — the semantic lane's
  `SEMANTIC_SEARCH_HARD_CAP = 10000` (`api.ts:228, 249` [R]) is the precedent for stating a cap
  explicitly.

## Growth obligations when the ruling is taken

1. `src/api.ts`: interface member + dark-safe implementation (store doors composed, no SQL in the
   door — ADR-28).
2. `src/fixtures/f24.ts` P1: `keys.length === 5` → `=== 6` with `listNotes` in the enumeration
   (`f24.ts:84-90`); plus shape checks (P3) for the new return object.
3. Full-shape fakes grow: `f22.ts:41` and `f24.ts:56` [R] — `npm run typecheck` fails at both until
   both grow (ADR-11).
4. New Muninn fixture **f27** (next number; Muninn has `f01.ts`–`f26.ts` [R]), authored from this
   contract text, not from observed behavior (ADR-10), exercising the public API only (ADR-7), with
   **earned red**: f27 is written against the frozen five first, so P1's `=== 6` is a real interface
   behaving wrongly, not a type error.
5. Huginn mirrors the door in `src/muninn-api.ts`; Huginn's `list` op is then wired through the
   mirror. Muninn leads, Huginn follows (binding sequencing, Dan 2026-11-15).

## Consequences

The enumeration door becomes part of the frozen surface forever, and the sixth door is the first
expansion of the frozen set — the precedent for every future door is: contract text, ruling,
implementation, fixture from the contract, fakes grown, one release. If Dan declines the door, the
`list` op dies with it and Huginn cannot substitute a vault read.

## Sources

`Huginn/docs/Serial Contextual Operations Design (Ruled).md` (the shape, `list` through Muninn,
enumeration forbidden) [R]; as-built `src/api.ts`, `src/store/store.ts`, `src/intake/lane.ts`,
`src/fixtures/f24.ts`, `src/fixtures/f22.ts` [R]; ADR-10, ADR-22, ADR-27, ADR-28, ADR-33, ADR-34,
ADR-35, ADR-36.
