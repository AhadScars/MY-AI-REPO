import { create } from 'zustand';
import type { AIProviderInfo, PermissionDecision } from '../../packages/types/src/ai';

interface AIState {
  providers: AIProviderInfo[];
  activeProviderId: string;
  activeModel: string;
  /** Tool permission decisions: toolName -> decision */
  permissions: Record<string, PermissionDecision>;
  lastError: string | null;
  tokenUsage: { input: number; output: number };

  setProvider: (providerId: string, model?: string) => void;
  setModel: (model: string) => void;
  setPermission: (toolName: string, decision: PermissionDecision) => void;
  clearSessionPermissions: () => void;
  setError: (error: string | null) => void;
  addTokenUsage: (input: number, output: number) => void;
  resetTokenUsage: () => void;
}

/** Placeholder provider list — wired to real backends in AI phase */
const BUILTIN_PROVIDERS: AIProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    supportsStreaming: true,
    supportsTools: true,
    supportsEmbeddings: true,
    isLocal: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    supportsStreaming: true,
    supportsTools: true,
    supportsEmbeddings: false,
    isLocal: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
    supportsStreaming: true,
    supportsTools: true,
    supportsEmbeddings: false,
    isLocal: false,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    supportsStreaming: true,
    supportsTools: true,
    supportsEmbeddings: true,
    isLocal: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    models: ['llama3.2', 'codellama', 'qwen2.5-coder'],
    supportsStreaming: true,
    supportsTools: false,
    supportsEmbeddings: true,
    isLocal: true,
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI-Compatible',
    models: ['default'],
    supportsStreaming: true,
    supportsTools: true,
    supportsEmbeddings: true,
    isLocal: false,
  },
];

export const useAIStore = create<AIState>((set, get) => ({
  providers: BUILTIN_PROVIDERS,
  activeProviderId: 'openai',
  activeModel: 'gpt-4o',
  permissions: {},
  lastError: null,
  tokenUsage: { input: 0, output: 0 },

  setProvider: (providerId, model) => {
    const provider = get().providers.find((p) => p.id === providerId);
    if (!provider) return;
    set({
      activeProviderId: providerId,
      activeModel: model ?? provider.models[0] ?? 'default',
    });
  },

  setModel: (model) => set({ activeModel: model }),

  setPermission: (toolName, decision) =>
    set({ permissions: { ...get().permissions, [toolName]: decision } }),

  clearSessionPermissions: () => {
    const next = { ...get().permissions };
    for (const [k, v] of Object.entries(next)) {
      if (v === 'allow-once' || v === 'allow-session') {
        delete next[k];
      }
    }
    set({ permissions: next });
  },

  setError: (error) => set({ lastError: error }),

  addTokenUsage: (input, output) =>
    set({
      tokenUsage: {
        input: get().tokenUsage.input + input,
        output: get().tokenUsage.output + output,
      },
    }),

  resetTokenUsage: () => set({ tokenUsage: { input: 0, output: 0 } }),
}));
