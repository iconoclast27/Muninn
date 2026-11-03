# LLM Coordination Protocol v1.0

## Context

This project involves two AI models with distinct failure modes coordinating over a shared GitHub repository. There is no continuous memory between sessions except what's written to disk.

* **Cloud model (Lumo)**: Strong reasoning, weak ground truth. Retrieval layer can surface stale session ghosts that appear indistinguishable from user input. Failure mode: confident hallucination.
* **Local model (qwen3.5:9b)**: Disk access, mechanical execution. Limited capacity for judgment. Failure mode: silent corruption by applying wrong fixes.

Neither model is the author of record for facts. Terminal output is the only fact source.

***

## Core Convention: Receipts or Nothing

Any terminal-related claim (file existence, command output, package version, test result) must arrive with provenance markers:

```
=== RECEIPT START ===
COMMAND: <command run>
OUTPUT: <raw terminal output>
SOURCE: local terminal
TIMESTAMP: <optional, if terminal displays it>
=== RECEIPT END ===
```

Claims without receipt markers are **unverified hypotheses**, not facts. Neither model acts on them as facts.

Retrieved context (session memory, cached notes, search results) must be labeled:

```
[RETRIEVED CONTEXT — VERIFICATION REQUIRED]
Content from HANDOVER.md cached 2026-11-01...
```

Retrieved claims inherit unverified status until terminal receipts confirm them.

***

## Labor Division

**Cloud model responsibilities:**

* Architecture decisions
* Interface design
* Test/fixture specification
* Diff review
* Writing handover notes

**Local model responsibilities:**

* Running commands
* Applying patches verbatim (no interpretation)
* Capturing raw terminal output
* Reporting pass/fail on fixtures

**Human (Dan) responsibilities:**

* Adjudication when models disagree
* Receipt authenticity verification
* Final approval on merges/handovers

Neither model assigns tasks to the other without human approval. The human is the routing layer.

***

## Fixture-First Protocol

All changes follow this sequence:

1. Human or cloud model writes failing fixture. Fixture must be executable and define expected behavior.
2. Fixture runs locally. Output pasted as receipt. Red state recorded with failure message.
3. Local model implements change.
4. Fixture reruns. Output pasted as receipt. Green state required before proceeding.
5. If green state cannot be achieved, abort. Human adjudicates.

A fixture passing without a pasted receipt run is treated as unverified.

***

## Staleness Detection

Every handover note begins with:

```
CURRENT HASH: <git rev-parse HEAD output>
NOTE HASH: <hash embedded in note when written>
MATCH: YES/NO
```

If MATCH is NO, the handover note is stale. Discard it. Request fresh tree dump from local model.

When cloud model receives repo information (via retrieval or uploaded docs), it must request immediate hash verification before acting. Discrepancy triggers explicit "handover mismatch" declaration.

***

## Handover Schema

Handover notes use this structure. Deviation indicates potential corruption:

```markdown
# HANDOVER [date]

## CURRENT STATE
- Commit: <hash>
- Working tree: dirty/clean
- Active branch: <branch>

## WHAT WAS VERIFIED (WITH RECEIPTS)
- Claim 1 → receipt reference
- Claim 2 → receipt reference

## WHAT IS CLAIMED-BUT-UNVERIFIED
- Claim 3 → needs <specific verification command>
- Claim 4 → needs <specific verification command>

## OPEN QUESTIONS
- Single bullet list. No speculation beyond scope.

## NEXT SINGLE ACTION
- One instruction only. Not a prioritized list.
- Example: "Run fixture X and paste receipt"
- Local model executes this only, then stops and waits.
```

Multiple next actions cause local model to pick wrong one or execute all poorly. Single action only.

***

## Cloud Model Anti-Haunting Discipline

Before acting on any claim from earlier in session:

1. Check for receipt marker. Absent → treat as unverified.
2. Check if retrieval-labeled. If yes → treat as hypothesis.
3. State source attribution aloud: "From retrieval..." or "From user receipt..."
4. Before committing to architecture change, request hash verification.

If cloud model detects discrepancy between its context and live state:

* Declare immediately: "The doc I have doesn't match the repo."
* Request fresh tree dump.
* Do not proceed until alignment confirmed.

Corroboration requests batched at natural checkpoints (end of proposal, end of session) to minimize human interruption burden.

***

## Compounding-Error Cascade Prevention

Dangerous scenario: cloud proposes fix based on hallucinated file → local applies it → tests pass for wrong reason → handover records success.

Mitigation sequence:

1. Every cloud claim touching filesystem gets verification step written by cloud, executed by local, reported back. Cloud specifies how to prove itself wrong.
2. Local model never paraphrases terminal output. Raw output only. Summarized tracebacks are untrusted.
3. Periodic cold reads: local dumps actual file contents periodically without task attached. Next handover reflects reality, not assumption.

***

## Conflict Resolution

When models disagree on facts:

1. Both halt.
2. Local model runs verification command.
3. Output pasted as receipt.
4. Receipt determines winner. No debate.

When human adjudicates:

1. Disagreement gets logged rather than silently resolved.
2. Logging format: "DISAGREEMENT: \<claim>. REASON: \<why models diverged>. RESOLUTION: \<human decision>"

***

## Notes on Conventional Enforcement

This protocol is enforced by culture, not tooling. Humans accept burden of checksum duties. Stale retrieval ghosts are the primary adversary.

Signature elements (receipt markers, hash checks, single-action handovers) are designed to be recognizable and fingerprintable when authentic versus corrupted.

***

## Version History

v1.0 — Initial protocol. Written 2026-11-03 for the vault-overseer-index project coordination redesign review.
