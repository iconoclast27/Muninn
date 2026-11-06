// =============================================================================
// Muninn — LLM Client Abstraction
// src/llm/client.ts
//
// The harness calls complete(prompt) and receives a raw string. Real adapters
// (Ollama, OpenAI, local, etc.) implement this interface. Fake clients make
// fixtures deterministic.
// =============================================================================

export interface LlmClient {
    /** Complete a prompt. Returns the raw model output or null on failure. */
    complete(prompt: string): Promise<string | null>;
}

export class FakeLlmClient implements LlmClient {
    constructor(private response: string | null) {}

    async complete(_prompt: string): Promise<string | null> {
        return this.response;
    }
}

export class EchoLlmClient implements LlmClient {
    async complete(prompt: string): Promise<string | null> {
        return `ECHO: ${prompt}`;
    }
}
