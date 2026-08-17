import { createOpenAICompatibleProvider } from './openai-compatible.js';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import type { InternalAIProvider } from './types.js';

const providers = new Map<string, InternalAIProvider>();

function register(p: InternalAIProvider): void {
  providers.set(p.id, p);
}

register(
  createOpenAICompatibleProvider({
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
  }),
);
register(
  createOpenAICompatibleProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
  }),
);
register(createAnthropicProvider());
register(createGeminiProvider());
register(
  createOpenAICompatibleProvider({
    id: 'ollama',
    name: 'Ollama (Local)',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    isLocal: true,
  }),
);
register(
  createOpenAICompatibleProvider({
    id: 'openai-compatible',
    name: 'OpenAI-Compatible',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
  }),
);

export function getProvider(id: string): InternalAIProvider | undefined {
  return providers.get(id);
}

export function listProviders(): InternalAIProvider[] {
  return [...providers.values()];
}
