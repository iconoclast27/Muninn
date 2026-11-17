# ADR-22: The spine demolition — the event-log architecture dies entire

**Status:** Accepted (retrospective; recorded 2026-11-16). Supersedes the spine-era architecture.
**Ruled:** 2026-11-03, Dan: "The demolition list looks right to me."

## Context

The spine (append-only per-origin shard event log, sync-exposed, merge-scan, seq/checkpoint, heal,
projection, Tier-2 buffer, `_vault-index/events/`, `origin.txt`, foreign-origin guard) was built for
a "derived-from-events" index. A consumer census interrogated it against the project's **actual**
requirements: its only production consumer read data re-derivable from disk; its irreplaceable cargo
(dwell, actor attribution) had no consumer. Sync-exposure was never a Dan requirement — "I was talked
into it."

## Decision

The spine dies. Demolished: shard files, sync-exposure, the origin ladder, merge-scan,
seq/checkpoint machinery, the foreign-origin guard, projection, heal, Tier-2 buffer, `shard_probe`,
`_vault-index/events/`, `origin.txt`. **Dwell dies entire; actor attribution dies; no timer for a
dead spine.** Legacy fixtures wired to deleted modules were quarantined, never repaired.

Replacement architecture: **the plugin owns one durable artifact — the index — and rents everything
else.** WASM SQLite in Zone 2, boot walk + Obsidian-event intake lane (events as triggers, not as
data), disk-as-truth: content derives from present-day bytes.

Demolition protocol as durable method: inventory → dead-leaf harvest → rewire addressing to the walk
→ the entry-point spineectomy → supporting organs + build-config externals removed → corpus sweep →
version bump + annotation pass; **one incision per commit, receipts pasted between steps,
stop-and-diagnose on surprises, no two cuts between commits**; the whole file pasted before
prescribing cuts; commit the dirty tree before cutting.

**Requirements-interrogation rule (durable):** a subsystem is interrogated against the project's
stated requirements; vendor- or assistant-proposed features with no Dan requirement and no consumer
die.

## Consequences

Every spine-era word in the corpus is now archive vocabulary. The durable generalizations mined out
before sealing: "facts survive, derivatives heal" (durability is classified, not uniform); one writer
per artifact; **global `ts` is never trusted for ordering** (no clock, no clock skew, ordering
explicit); `adapter.append()` is O(line) while `vault.modify()` rewrites the whole file (the 28 MiB
vector-search exhibit — governs every vault write, including Huginn's `write` op); content_sha =
SHA-256 truncated to 16 hex; forward-only, idempotent, version-keyed migrations with downgrade
guard; the judgment-vs-exposure criterion (Dan, 2026-07-23: editing is judgment, opening is exposure),
parked with the dead heat model. The spine's death is why `listNotes` must go through Muninn: the
store is the single source of vault enumeration.

## Sources

`docs/archive/Session Note -- 2026-11-03 Morning.md` L13 (the demolition list, Dan's approval, the
rationale), L7, L13 (sync-exposure not a Dan requirement), L31 (protocol);
`docs/archive/event-log-schema.md` (v0.2, 2026-10-24, durable generalizations);
`docs/archive/architecture-map.md` (origin ladder, Rung 3 lesson: "never claim a side effect you did
not perform"); `docs/archive/REPORT.md` (quarantined legacy fixtures, "Dwell dies entire");
`docs/Session Handover 2026-11-03 Evening.md` (the ten rulings folded into spec v3).
