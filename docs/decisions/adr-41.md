# ADR-41: Model roster closures bind the coding/production side, not the user side

**Status:** Accepted — Dan's ruling 2026-11-17. Recorded 2026-11-17.
**Ruled:** Dan, 2026-11-17, verbatim: **"T33 -- misunderstanding. The closed models are closed on the
coding/production side, not the user side. The vault plugin is going to rely on small models, and
qwen3.5:4b is a popular default for users."**
**Related:** ADR-21 (staffing, the model roster, the executor contract); closes docket **T33**.

## Context

`DEFAULT_SETTINGS` ships `chatModel = qwen3.5:4b` (`Huginn/src/settings.ts:20-27` [R]) while the roster
records qwen as closed (`Handover 2026-11-13.md:52, 55, 126`; `HANDOVER - 2026-11-08.md:40-41`). Read as one
rule, the two statements looked like a contradiction, and T33 asked for the default to name the known-good
`kimi` path.

The finding rested on a conflation. The roster closures were earned as judgements about **which model does
the work of building and running the product** — agent staffing, harness runs, paid calls, the ~$120 cap,
auditions paused. The plugin's chat default is a **user-side** choice made inside a vault, on local Ollama,
with small models: the plugin is built to rely on them, and `qwen3.5:4b` is a popular default. Neither side
is a policy over the other.

## Decision

Roster closures bind the **coding/production side only**. They do not prohibit a model for the user side,
and they do not change a shipped default. `qwen3.5:4b` stays as Huginn's `chatModel` default; **no code
change, no default change, no release act**. `SECURITY.md` in both projects is conformed to this scope, and
the docket row T33 is closed.

Consequences:
- A future "the default names a closed model" finding is read against this ruling, not raised as a defect.
- The staffing facts (which model runs the harness, the `kimi` paid path, the declared cap) remain
  coding-side facts under ADR-21 and are not user-facing recommendations.
- The permission ruling about reading model chats (Qwen3.5:12b permitted, Gemma4:12b out of bounds) is a
  coding-side rule about evidence, unchanged by this ruling.
