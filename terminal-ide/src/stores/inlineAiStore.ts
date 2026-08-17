import { create } from 'zustand';
import { requireApi } from '../services/platform';
import { useAIStore } from './aiStore';
import { useSettingsStore } from './settingsStore';
import { useEditorStore } from './editorStore';

interface InlineAiState {
  open: boolean;
  instruction: string;
  originalCode: string;
  proposedCode: string;
  path: string | null;
  language: string | null;
  selection: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null;
  isLoading: boolean;
  error: string | null;

  openWithSelection: (opts: {
    code: string;
    path: string;
    language: string;
    selection: InlineAiState['selection'];
  }) => void;
  setInstruction: (v: string) => void;
  run: () => Promise<void>;
  accept: () => void;
  reject: () => void;
  close: () => void;
}

export const useInlineAiStore = create<InlineAiState>((set, get) => ({
  open: false,
  instruction: '',
  originalCode: '',
  proposedCode: '',
  path: null,
  language: null,
  selection: null,
  isLoading: false,
  error: null,

  openWithSelection: (opts) => {
    set({
      open: true,
      originalCode: opts.code,
      proposedCode: '',
      path: opts.path,
      language: opts.language,
      selection: opts.selection,
      instruction: '',
      error: null,
    });
  },

  setInstruction: (v) => set({ instruction: v }),

  run: async () => {
    const state = get();
    if (!state.instruction.trim() || !state.originalCode) return;
    set({ isLoading: true, error: null, proposedCode: '' });
    try {
      const ai = useAIStore.getState();
      const settings = useSettingsStore.getState().settings.ai;
      const result = await requireApi().aiInlineEdit({
        providerId: ai.activeProviderId,
        model: ai.activeModel,
        instruction: state.instruction,
        code: state.originalCode,
        language: state.language ?? undefined,
        path: state.path ?? undefined,
        temperature: 0.1,
        maxTokens: settings.maxTokens,
        baseUrl: settings.baseUrl,
      });
      set({ proposedCode: result.code, isLoading: false });
      if (result.usage) {
        useAIStore
          .getState()
          .addTokenUsage(result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0);
      }
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Inline edit failed',
      });
    }
  },

  accept: () => {
    const { proposedCode, path, originalCode } = get();
    if (!proposedCode || !path) {
      set({ open: false });
      return;
    }
    const editor = useEditorStore.getState();
    const tab = editor.tabs.find((t) => t.path === path);
    if (tab) {
      // Replace selection region if we can find original code as substring
      const content = tab.content;
      const idx = content.indexOf(originalCode);
      if (idx >= 0) {
        const next =
          content.slice(0, idx) + proposedCode + content.slice(idx + originalCode.length);
        editor.updateContent(tab.id, next);
      } else {
        editor.updateContent(tab.id, proposedCode);
      }
    }
    set({ open: false, proposedCode: '', instruction: '', error: null });
  },

  reject: () => {
    set({ open: false, proposedCode: '', instruction: '', error: null });
  },

  close: () => set({ open: false, error: null }),
}));
