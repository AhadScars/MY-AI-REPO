import type { AIChunk, CompletionResponse } from '../../../../packages/ai-core/src/provider.js';
import type { InternalAIProvider, StreamChatParams } from './types.js';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function createGeminiProvider(): InternalAIProvider {
  return {
    id: 'gemini',
    name: 'Google Gemini',
    isLocal: false,

    async *streamChat(params: StreamChatParams): AsyncIterable<AIChunk> {
      if (!params.apiKey) {
        yield { type: 'error', error: 'Gemini API key not configured. Add it in Settings → AI.' };
        return;
      }

      const base = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
      const model = params.model || 'gemini-2.0-flash';
      const url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(params.apiKey)}`;

      const system = params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const contents = params.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: params.signal,
          body: JSON.stringify({
            contents,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
            generationConfig: {
              temperature: params.temperature ?? 0.2,
              maxOutputTokens: params.maxTokens ?? 4096,
            },
          }),
        });
      } catch (err) {
        yield { type: 'error', error: err instanceof Error ? err.message : 'Network error' };
        return;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        yield { type: 'error', error: `Gemini HTTP ${response.status}: ${text.slice(0, 400)}` };
        return;
      }
      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          if (params.signal?.aborted) {
            yield { type: 'error', error: 'Aborted' };
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            try {
              const json = JSON.parse(data) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                error?: { message?: string };
              };
              if (json.error?.message) {
                yield { type: 'error', error: json.error.message };
                return;
              }
              const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
              if (text) yield { type: 'text', content: text };
            } catch {
              // ignore
            }
          }
        }
        yield { type: 'done' };
      } finally {
        reader.releaseLock();
      }
    },

    async complete(request): Promise<CompletionResponse> {
      let text = '';
      for await (const chunk of this.streamChat({
        messages: [{ role: 'user', content: request.prompt }],
        model: request.model ?? 'gemini-2.0-flash',
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        signal: request.signal,
      })) {
        if (chunk.type === 'text' && chunk.content) text += chunk.content;
        if (chunk.type === 'error') throw new Error(chunk.error);
      }
      return { text };
    },
  };
}
