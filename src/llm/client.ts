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

// ---------------------------------------------------------------------------
// Ollama chat completion client
// ---------------------------------------------------------------------------

export interface OllamaChatOptions {
    baseUrl: string;
    model: string;
    systemPrompt?: string;
    timeoutMs?: number;
}

export class OllamaChatClient implements LlmClient {
    constructor(private opts: OllamaChatOptions) {}

    async complete(prompt: string): Promise<string | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 60000);
        try {
            const res = await fetch(`${this.opts.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.opts.model,
                    messages: [
                        ...(this.opts.systemPrompt ? [{ role: 'system', content: this.opts.systemPrompt }] : []),
                        { role: 'user', content: prompt },
                    ],
                    stream: false,
                    format: 'json',
                }),
                signal: controller.signal,
            });
            if (!res.ok) {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama chat HTTP', res.status);
                return null;
            }
            const data = (await res.json()) as { message?: { content?: string } };
            return data.message?.content?.trim() ?? null;
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama chat timed out');
            } else {
                // eslint-disable-next-line no-console
                console.warn('[Muninn] Ollama chat failed:', (e as Error).message);
            }
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }
}
