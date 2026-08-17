import { create } from 'zustand';
import type { AIConversation, AIMessage } from '../../packages/types/src/ai';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ChatState {
  conversations: AIConversation[];
  activeConversationId: string | null;
  isStreaming: boolean;

  newConversation: () => string;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => string;
  appendToMessage: (conversationId: string, messageId: string, chunk: string) => void;
  setMessageStreaming: (conversationId: string, messageId: string, streaming: boolean) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
  getActiveConversation: () => AIConversation | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,

  newConversation: () => {
    const id = uid();
    const conversation: AIConversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set({
      conversations: [conversation, ...get().conversations],
      activeConversationId: id,
    });
    return id;
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    const id = uid();
    const full: AIMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    };
    set({
      conversations: get().conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const title =
          c.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 48) + (message.content.length > 48 ? '…' : '')
            : c.title;
        return {
          ...c,
          title,
          messages: [...c.messages, full],
          updatedAt: Date.now(),
        };
      }),
    });
    return id;
  },

  appendToMessage: (conversationId, messageId, chunk) => {
    set({
      conversations: get().conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + chunk } : m,
          ),
          updatedAt: Date.now(),
        };
      }),
    });
  },

  setMessageStreaming: (conversationId, messageId, streaming) => {
    set({
      isStreaming: streaming,
      conversations: get().conversations.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, isStreaming: streaming } : m,
          ),
        };
      }),
    });
  },

  deleteConversation: (id) => {
    const conversations = get().conversations.filter((c) => c.id !== id);
    let activeConversationId = get().activeConversationId;
    if (activeConversationId === id) {
      activeConversationId = conversations[0]?.id ?? null;
    }
    set({ conversations, activeConversationId });
  },

  clearAll: () => set({ conversations: [], activeConversationId: null }),

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },
}));
