import type { AIChunk, CompletionResponse } from '../../../../packages/ai-core/src/provider.js';
import type { InternalAIProvider, StreamChatParams } from './types.js';

const DEFAULT_BASE = 'https://api.anthropic.com';

export function createAnthropicProvider(): InternalAIProvider {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    isLocal: false,

    async *streamChat(params: StreamChatParams): AsyncIterable<AIChunk> {
      if (!params.apiKey) {
        yield { type: 'error', error: 'Anthropic API key not configured. Add it in Settings → AI.' };
        return;
      }

      const baseUrl = (params.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
      const systemParts = params.messages.filter((m) => m.role === 'system').map((m) => m.content);
      const messages = params.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': params.apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: params.signal,
          body: JSON.stringify({
            model: params.model,
            max_tokens: params.maxTokens ?? 4096,
            temperature: params.temperature ?? 0.2,
            system: systemParts.join('\n\n') || undefined,
            messages,
            stream: true,
          }),
        });
      } catch (err) {
        yield { type: 'error', error: err instanceof Error ? err.message : 'Network error' };
        return;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        yield { type: 'error', error: `Anthropic HTTP ${response.status}: ${text.slice(0, 400)}` };
        return;
      }
      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

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
                type?: string;
                delta?: { type?: string; text?: string };
                usage?: { input_tokens?: number; output_tokens?: number };
                message?: { usage?: { input_tokens?: number; output_tokens?: number } };
                error?: { message?: string };
              };
              if (json.type === 'error') {
                yield { type: 'error', error: json.error?.message ?? 'Anthropic error' };
                return;
              }
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield { type: 'text', content: json.delta.text };
              }
              if (json.type === 'message_start' && json.message?.usage) {
                inputTokens = json.message.usage.input_tokens;
              }
              if (json.type === 'message_delta' && json.usage) {
                outputTokens = json.usage.output_tokens;
              }
              if (json.type === 'message_stop') {
                yield {
                  type: 'done',
                  usage: { inputTokens, outputTokens },
                };
                return;
              }
            } catch {
              // partial
            }
          }
        }
        yield { type: 'done', usage: { inputTokens, outputTokens } };
      } finally {
        reader.releaseLock();
      }
    },

    async complete(request): Promise<CompletionResponse> {
      let text = '';
      let usage: CompletionResponse['usage'];
      for await (const chunk of this.streamChat({
        messages: [{ role: 'user', content: request.prompt }],
        model: request.model ?? 'claude-sonnet-4-20250514',
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        apiKey: request.apiKey,
        baseUrl: request.baseUrl,
        signal: request.signal,
      })) {
        if (chunk.type === 'text' && chunk.content) text += chunk.content;
        if (chunk.type === 'error') throw new Error(chunk.error);
        if (chunk.type === 'done') usage = chunk.usage;
      }
      return { text, usage };
    },
  };
}
