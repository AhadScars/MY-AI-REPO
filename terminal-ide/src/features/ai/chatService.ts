import { requireApi } from '../../services/platform';
import type { AIStreamChunkEvent } from '../../../packages/protocol/src/ai';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEditorStore } from '../../stores/editorStore';
import { buildAIContextAsync } from './buildContext';
let activeStreamId: string | null = null;
let unsubStream: (() => void) | null = null;

export interface SendChatOptions {
  /** File paths shown as chips (includes open/active files user kept) */
  attachedPaths?: string[];
  /** Force agent mode for this message */
  agentMode?: boolean;
}

/**
 * Send a user message and stream the assistant reply through main-process providers.
 */
export async function sendChatMessage(
  userText: string,
  opts?: SendChatOptions,
): Promise<void> {
  const chat = useChatStore.getState();
  const ai = useAIStore.getState();
  const settings = useSettingsStore.getState().settings.ai;

  let convId = chat.activeConversationId;
  if (!convId) {
    convId = chat.newConversation();
  }

  const agentMode = opts?.agentMode ?? settings.agentMode;
  const attached = opts?.attachedPaths ?? [];

  // Show @file chips in the user bubble for clarity
  chat.addMessage(convId, {
    role: 'user',
    content: userText,
  });

  const assistantId = chat.addMessage(convId, {
    role: 'assistant',
    content: '',
    isStreaming: true,
    model: ai.activeModel,
  });
  chat.setMessageStreaming(convId, assistantId, true);
  ai.setError(null);

  // Collect history for the provider (exclude streaming empty assistant)
  const conversation = useChatStore
    .getState()
    .conversations.find((c) => c.id === convId);
  const history = (conversation?.messages ?? [])
    .filter((m) => m.id !== assistantId)
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

  const api = requireApi();

  // Accept events for this stream as soon as we know the id
  let boundStreamId: string | null = null;

  // Single shared subscription for stream events
  unsubStream?.();
  unsubStream = api.onAiStream((event: AIStreamChunkEvent) => {
    if (boundStreamId && event.streamId !== boundStreamId) return;
    if (activeStreamId && event.streamId !== activeStreamId) return;

    if (event.type === 'text' && event.content) {
      useChatStore.getState().appendToMessage(convId!, assistantId, event.content);
    } else if (event.type === 'tool_call' && event.toolCall) {
      useChatStore
        .getState()
        .appendToMessage(convId!, assistantId, `\n› ${event.toolCall.name}\n`);
    } else if (event.type === 'tool_result' && event.toolResult) {
      const ok = event.toolResult.success;
      const preview = event.toolResult.output.slice(0, 160).replace(/\s+/g, ' ');
      useChatStore
        .getState()
        .appendToMessage(
          convId!,
          assistantId,
          `${ok ? '  ✓' : '  ✗'} ${preview}${
            event.toolResult.output.length > 160 ? '…' : ''
          }\n`,
        );
      // Refresh open editor tabs after successful file writes
      if (
        ok &&
        (event.toolResult.name === 'str_replace' ||
          event.toolResult.name === 'write_file' ||
          event.toolResult.name === 'propose_edit')
      ) {
        void reloadOpenTabsAfterEdit();
      }
    } else if (event.type === 'usage' && event.usage) {
      useAIStore
        .getState()
        .addTokenUsage(event.usage.inputTokens ?? 0, event.usage.outputTokens ?? 0);
    } else if (event.type === 'error') {
      useChatStore.getState().setMessageStreaming(convId!, assistantId, false);
      useAIStore.getState().setError(event.error ?? 'AI error');
      const current = useChatStore
        .getState()
        .conversations.find((c) => c.id === convId)
        ?.messages.find((m) => m.id === assistantId);
      if (!current?.content?.trim()) {
        useChatStore
          .getState()
          .appendToMessage(convId!, assistantId, `Error: ${event.error ?? 'Unknown error'}`);
      }
      activeStreamId = null;
      boundStreamId = null;
    } else if (event.type === 'done') {
      if (event.usage) {
        useAIStore
          .getState()
          .addTokenUsage(event.usage.inputTokens ?? 0, event.usage.outputTokens ?? 0);
      }
      useChatStore.getState().setMessageStreaming(convId!, assistantId, false);
      activeStreamId = null;
      boundStreamId = null;
      void reloadOpenTabsAfterEdit();
    }
  });

  try {
    const context = await buildAIContextAsync({
      attachedPaths: attached,
    });

    // Prefer full content of primary attached / open file as activeFile
    if (!context.activeFile && attached[0]) {
      const first = context.openFiles?.find(
        (f) => f.path.toLowerCase() === attached[0]!.toLowerCase(),
      );
      if (first?.preview) {
        context.activeFile = {
          path: first.path,
          language: first.language,
          content: first.preview,
        };
      }
    }

    const result = await api.aiChatStart({
      providerId: ai.activeProviderId,
      model: ai.activeModel,
      messages: history,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      baseUrl: settings.baseUrl,
      context,
      agentMode,
      autoApplyEdits: agentMode ? settings.autoApplyEdits !== false : false,
    });
    boundStreamId = result.streamId;
    activeStreamId = result.streamId;
  } catch (err) {
    useChatStore.getState().setMessageStreaming(convId, assistantId, false);
    const message = err instanceof Error ? err.message : String(err);
    useAIStore.getState().setError(message);
    useChatStore.getState().appendToMessage(convId, assistantId, `Error: ${message}`);
    activeStreamId = null;
    boundStreamId = null;
  }
}

/** Reload disk content into open editor tabs after agent writes */
async function reloadOpenTabsAfterEdit(): Promise<void> {
  const editor = useEditorStore.getState();
  const api = requireApi();
  for (const tab of editor.tabs) {
    if (tab.path.startsWith('untitled:') || tab.isDirty) continue;
    try {
      const result = await api.readFile({ path: tab.path });
      const content = result?.content;
      if (typeof content === 'string' && content !== tab.content) {
        editor.updateContent(tab.id, content);
        useEditorStore.getState().markSaved(tab.id, content);
      }
    } catch {
      // ignore
    }
  }
}

export async function stopChatGeneration(): Promise<void> {
  if (!activeStreamId) {
    useChatStore.setState({ isStreaming: false });
    return;
  }
  try {
    await requireApi().aiChatStop({ streamId: activeStreamId });
  } catch {
    // ignore
  }
  activeStreamId = null;
  // Mark any streaming messages as finished
  const chat = useChatStore.getState();
  const conv = chat.getActiveConversation();
  if (conv) {
    for (const m of conv.messages) {
      if (m.isStreaming) {
        chat.setMessageStreaming(conv.id, m.id, false);
      }
    }
  }
  useChatStore.setState({ isStreaming: false });
}
