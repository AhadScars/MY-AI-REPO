import type * as Monaco from 'monaco-editor';
import { requireApi } from '../../services/platform';
import { useAIStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';

let disposable: Monaco.IDisposable | null = null;
let seq = 0;

/**
 * Register Monaco inline completions powered by the AI complete endpoint.
 * Debounce + cancellation via sequence numbers.
 */
export function registerAiInlineCompletions(monaco: typeof Monaco): void {
  disposable?.dispose();

  disposable = monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
    provideInlineCompletions: async (model, position, _context, token) => {
      const settings = useSettingsStore.getState().settings.ai;
      if (!settings.enableAutocomplete) {
        return { items: [] };
      }

      const mySeq = ++seq;
      const debounce = settings.autocompleteDebounceMs ?? 300;
      await new Promise((r) => setTimeout(r, debounce));
      if (token.isCancellationRequested || mySeq !== seq) {
        return { items: [] };
      }

      const offset = model.getOffsetAt(position);
      const full = model.getValue();
      const prefix = full.slice(Math.max(0, offset - 2500), offset);
      const suffix = full.slice(offset, offset + 800);

      // Don't fire on empty / tiny prefixes
      if (prefix.trim().length < 8) return { items: [] };

      try {
        const ai = useAIStore.getState();
        const result = await requireApi().aiAutocomplete({
          providerId: ai.activeProviderId,
          model: ai.activeModel,
          prefix,
          suffix,
          language: model.getLanguageId(),
          path: model.uri.path,
          temperature: 0,
          maxTokens: 96,
          baseUrl: settings.baseUrl,
        });

        if (token.isCancellationRequested || mySeq !== seq) {
          return { items: [] };
        }

        const suggestion = result.suggestion?.trim();
        if (!suggestion) return { items: [] };

        return {
          items: [
            {
              insertText: suggestion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
            },
          ],
        };
      } catch {
        return { items: [] };
      }
    },
    disposeInlineCompletions: () => {
      /* no-op */
    },
  });
}

export function disposeAiInlineCompletions(): void {
  disposable?.dispose();
  disposable = null;
}
