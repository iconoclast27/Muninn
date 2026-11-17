# ADR-12: The subscriber-seam doctrine — tail, not poll; notification latency equals persistence latency; never amplify your own failure

**Status:** Accepted (retrospective; recorded 2026-11-16); generalized to any async lane.
**Ruled:** 2026-10-29 (the hazard ruling), generalized in the architecture map, rev. 2026-11-01.

## Context

The spine's subscriber fanout was measured, and the hazards found were general, not spine-specific:
a subsystem that reacts to its own integrity events self-amplifies; a polling consumer invents
latency; a subscriber error that propagates to the producer kills the producer.

## Decision

For any notification seam:

- **Tail, not poll** — the consumer reads at the tail, never by polling.
- **Notification latency == persistence latency** — a consumer that sees events later than the disk
  has them is mis-designed; the seam's ordering is the persistence ordering.
- **FIFO subscribers.**
- **Subscriber errors are logged with attribution and never propagated to the producer.**
- **Integrity events never re-enter fanout: a subsystem must never amplify its own failure.**
- Every failure path closes what it opened, leaves fields null, and discloses.
- Unload ordering (ruled): **lane disposed before store close, synchronous, no awaits; in-flight work
  finishes its current unit.** Loss bounded to one boot.

## Consequences

The rules bind Muninn's intake lane and Huginn's op-loop dispatch (a loop that reacts to its own
declines, its own drops, or its own notices self-amplifies). The spine half of the seam is dead
(ADR-22); the rules survive.

## Sources

`docs/archive/architecture-map.md` (subscriber-seam doctrine, generalized);
`docs/archive/Session Note — 2026-10-29.md` (hazard ruling, self-sustaining loop);
`docs/archive/Session Handover Note 2026-11-02.md` L23 (unload ordering A), L38 (failure paths close
what they opened); as-built `src/intake/lane.ts` [R].
