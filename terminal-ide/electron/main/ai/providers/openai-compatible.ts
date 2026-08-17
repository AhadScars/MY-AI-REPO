import type { AIChunk, ChatMessage, CompletionResponse } from '../../../../packages/ai-core/src/provider.js';
import type { InternalAIProvider, StreamChatParams } from './types.js';

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  // Avoid double /v1/v1
  if (b.endsWith('/v1') && p.startsWith('/v1')) return b + p.slice(3);
  return b + p;
}

/**
 * Parse OpenAI SSE. Tool-call argument deltas are aggregated until the
 * finish_reason / stream end so the orchestrator receives complete JSON args.
 */
async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<AIChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolBuf = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();
  let finished = false;
  let usage: AIChunk['usage'] | undefined;

  const flushTools = function* (): Generator<AIChunk> {
    if (toolBuf.size === 0) return;
    const ordered = [...toolBuf.entries()].sort((a, b) => a[0] - b[0]);
    for (const [, tc] of ordered) {
      if (!tc.name) continue;
      yield {
        type: 'tool_call',
        toolCall: {
          id: tc.id || `call_${Math.random().toString(36).slice(2, 10)}`,
          name: tc.name,
          arguments: tc.arguments || '{}',
        },
      };
    }
    toolBuf.clear();
  };

  try {
    while (true) {
      if (signal?.aborted) {
        yield { type: 'error', error: 'Aborted' };
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          yield* flushTools();
          yield { type: 'done', usage };
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{
              delta?: {
                content?: string | null;
                tool_calls?: Array<{
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }>;
              };
              finish_reason?: string | null;
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            error?: { message?: string };
          };
          if (json.error?.message) {
            yield { type: 'error', error: json.error.message };
            return;
          }
          if (json.usage) {
            usage = {
              inputTokens: json.usage.prompt_tokens,
              outputTokens: json.usage.completion_tokens,
            };
          }
          const choice = json.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const cur = toolBuf.get(idx) ?? { id: '', name: '', arguments: '' };
              if (tc.id) cur.id = tc.id;
              if (tc.function?.name) cur.name += tc.function.name;
              if (tc.function?.arguments) cur.arguments += tc.function.arguments;
              toolBuf.set(idx, cur);
            }
          }
          const reason = choice?.finish_reason;
          if (reason === 'tool_calls' || reason === 'stop' || reason === 'length') {
            yield* flushTools();
            if (reason !== 'tool_calls') {
              finished = true;
              yield { type: 'done', usage };
              return;
            }
            // tool_calls: emit done so the agent loop can continue after tools
            finished = true;
            yield { type: 'done', usage };
            return;
          }
        } catch {
          // ignore partial JSON
        }
      }
    }
    if (!finished) {
      yield* flushTools();
      yield { type: 'done', usage };
    }
  } finally {
    reader.releaseLock();
  }
}

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant' as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments || '{}',
          },
        })),
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'tool' as const,
        content: m.content,
        tool_call_id: m.toolCallId,
        ...(m.name ? { name: m.name } : {}),
      };
    }
    return {
      role: m.role,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    };
  });
}

export function createOpenAICompatibleProvider(opts: {
  id: string;
  name: string;
  defaultBaseUrl: string;
  isLocal?: boolean;
}): InternalAIProvider {
  return {
    id: opts.id,
    name: opts.name,
    isLocal: opts.isLocal ?? false,

    async *streamChat(params: StreamChatParams): AsyncIterable<AIChunk> {
      const baseUrl = params.baseUrl || opts.defaultBaseUrl;
      const url = joinUrl(baseUrl, '/chat/completions');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (params.apiKey) {
        headers.Authorization = `Bearer ${params.apiKey}`;
      }

      const body: Record<string, unknown> = {
        model: params.model,
        messages: toOpenAIMessages(params.messages),
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens,
        stream: true,
      };
      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        }));
        body.tool_choice = 'auto';
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          signal: params.signal,
          body: JSON.stringify(body),
        });
      } catch (err) {
        yield {
          type: 'error',
          error: err instanceof Error ? err.message : 'Network error',
        };
        return;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        yield {
          type: 'error',
          error: `${opts.name} HTTP ${response.status}: ${text.slice(0, 400)}`,
        };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      yield* parseSseStream(response.body, params.signal);
    },

    async complete(request): Promise<CompletionResponse> {
      const baseUrl = request.baseUrl || opts.defaultBaseUrl;
      const url = joinUrl(baseUrl, '/chat/completions');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (request.apiKey) headers.Authorization = `Bearer ${request.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: request.signal,
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 1024,
          stop: request.stop,
          stream: false,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`${opts.name} HTTP ${response.status}: ${text.slice(0, 400)}`);
      }
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: json.choices?.[0]?.message?.content ?? '',
        finishReason: json.choices?.[0]?.finish_reason,
        usage: {
          inputTokens: json.usage?.prompt_tokens,
          outputTokens: json.usage?.completion_tokens,
        },
      };
    },

    async listModels(apiKey, baseUrl) {
      const base = baseUrl || opts.defaultBaseUrl;
      const url = joinUrl(base, '/models');
      const headers: Record<string, string> = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) return [];
        const json = (await res.json()) as { data?: Array<{ id: string }> };
        return (json.data ?? []).map((m) => m.id).slice(0, 50);
      } catch {
        return [];
      }
    },
  };
}
