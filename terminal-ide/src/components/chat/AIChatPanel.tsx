import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Send,
  Square,
  Trash2,
  X,
  Zap,
  FileCode,
  Paperclip,
  ChevronDown,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useAIStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useEditorStore } from '../../stores/editorStore';
import { sendChatMessage, stopChatGeneration } from '../../features/ai/chatService';
import { getApi } from '../../services/platform';
import { basename } from '../../../packages/shared/src/path';
import { cn } from '../../utils/cn';

/** Custom MIME for explorer → Sephora drags */
const PATH_MIME = 'application/x-terminal-ide-path';

/** Normalize path for equality (slashes + case). */
function normPath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
}

function samePath(a: string, b: string): boolean {
  return normPath(a) === normPath(b);
}

function looksLikePath(value: string): boolean {
  const s = value.trim();
  if (!s || s.includes('\n') || s.length > 1024) return false;
  return (
    /^[a-zA-Z]:[\\/]/.test(s) ||
    s.startsWith('/') ||
    s.startsWith('\\\\') ||
    /[\\/]/.test(s) ||
    /\.[a-zA-Z0-9]{1,12}$/.test(s)
  );
}

function pathsFromDataTransfer(dt: DataTransfer): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const p = raw.trim().replace(/^["']|["']$/g, '');
    if (!p || p.startsWith('untitled:')) return;
    if (out.some((x) => samePath(x, p))) return;
    out.push(p);
  };

  // Prefer single source so one drop never yields two path variants.
  const custom = dt.getData(PATH_MIME)?.trim();
  if (custom) {
    for (const line of custom.split(/\r?\n/)) {
      if (line.trim()) push(line);
    }
    return out;
  }

  const plain = dt.getData('text/plain')?.trim();
  if (plain && looksLikePath(plain) && !plain.includes('\n')) {
    push(plain);
    return out;
  }

  if (plain) {
    for (const line of plain.split(/\r?\n/)) {
      if (looksLikePath(line)) push(line);
    }
    if (out.length) return out;
  }

  const uriList = dt.getData('text/uri-list');
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      try {
        if (line.startsWith('file:')) {
          const u = new URL(line);
          let p = decodeURIComponent(u.pathname);
          if (/^\/[a-zA-Z]:\//.test(p)) p = p.slice(1);
          push(p);
        }
      } catch {
        /* ignore */
      }
    }
    if (out.length) return out;
  }

  const api = getApi();
  if (dt.files?.length) {
    for (const file of Array.from(dt.files)) {
      let p = '';
      try {
        p = api?.getPathForFile?.(file) ?? '';
      } catch {
        p = '';
      }
      if (!p) {
        p = (file as File & { path?: string }).path ?? '';
      }
      if (p) push(p);
    }
  }

  return out;
}

/**
 * Sephora — minimal AI chat panel.
 */
export function AIChatPanel() {
  const [input, setInput] = useState('');
  const [extraAttached, setExtraAttached] = useState<string[]>([]);
  const [hideActiveChip, setHideActiveChip] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showModelRow, setShowModelRow] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const newConversation = useChatStore((s) => s.newConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const getActiveConversation = useChatStore((s) => s.getActiveConversation);

  const providers = useAIStore((s) => s.providers);
  const activeProviderId = useAIStore((s) => s.activeProviderId);
  const activeModel = useAIStore((s) => s.activeModel);
  const setProvider = useAIStore((s) => s.setProvider);
  const setModel = useAIStore((s) => s.setModel);
  const lastError = useAIStore((s) => s.lastError);

  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const aiSettings = useSettingsStore((s) => s.settings.ai);
  const closeAiPanel = useLayoutStore((s) => s.closeAiPanel);

  const activeTab = useEditorStore((s) => s.getActiveTab());
  const tabs = useEditorStore((s) => s.tabs);
  const activePath =
    activeTab && !activeTab.path.startsWith('untitled:') ? activeTab.path : null;

  useEffect(() => {
    setHideActiveChip(false);
  }, [activePath]);

  useEffect(() => {
    if (!showAddMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!addMenuRef.current?.contains(e.target as Node)) setShowAddMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showAddMenu]);

  const contextChips = useMemo(() => {
    const chips: Array<{ path: string; kind: 'active' | 'attached' }> = [];
    const seen = new Set<string>();
    if (activePath && !hideActiveChip) {
      chips.push({ path: activePath, kind: 'active' });
      seen.add(normPath(activePath));
    }
    for (const p of extraAttached) {
      const key = normPath(p);
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push({ path: p, kind: 'attached' });
    }
    return chips;
  }, [activePath, hideActiveChip, extraAttached]);

  const attachableTabs = useMemo(
    () =>
      tabs.filter(
        (t) =>
          !t.path.startsWith('untitled:') &&
          !contextChips.some((c) => samePath(c.path, t.path)),
      ),
    [tabs, contextChips],
  );

  const conversation = getActiveConversation();
  const provider = providers.find((p) => p.id === activeProviderId);
  const messageCount = conversation?.messages.length ?? 0;
  const lastMessageContent =
    conversation?.messages[messageCount - 1]?.content ?? '';
  const agentOn = Boolean(aiSettings.agentMode);
  const autoApply = aiSettings.autoApplyEdits !== false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount, lastMessageContent]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    setShowAddMenu(false);
    void sendChatMessage(text, {
      attachedPaths: contextChips.map((c) => c.path),
      agentMode: agentOn,
    });
  };

  const removeChip = (path: string, kind: 'active' | 'attached') => {
    if (kind === 'active') setHideActiveChip(true);
    setExtraAttached((prev) => prev.filter((p) => !samePath(p, path)));
  };

  const addChip = useCallback((path: string) => {
    setExtraAttached((prev) =>
      prev.some((p) => samePath(p, path)) ? prev : [...prev, path],
    );
    setShowAddMenu(false);
  }, []);

  const addChips = useCallback((paths: string[]) => {
    if (!paths.length) return;
    // Unique by normalized path — keep first form only
    const unique: string[] = [];
    for (const path of paths) {
      if (!unique.some((p) => samePath(p, path))) unique.push(path);
    }
    setExtraAttached((prev) => {
      const next = [...prev];
      for (const path of unique) {
        if (!next.some((p) => samePath(p, path))) next.push(path);
      }
      return next;
    });
    setShowAddMenu(false);
  }, []);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    const types = Array.from(e.dataTransfer.types ?? []);
    if (
      types.includes(PATH_MIME) ||
      types.includes('Files') ||
      types.includes('text/plain') ||
      types.includes('text/uri-list')
    ) {
      setDragOver(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    const paths = pathsFromDataTransfer(e.dataTransfer);
    addChips(paths);
  };

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-ide-sidebar"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-ide-bg/70">
          <div className="rounded border border-dashed border-ide-accent px-4 py-3 text-[12px] text-ide-accent">
            Drop file to attach
          </div>
        </div>
      )}
      {/* Header — matches Explorer chrome */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-ide-border/60 px-2 pl-3">
        <span className="ide-section-label">Sephora</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] transition-colors',
              agentOn
                ? 'bg-ide-accent/15 text-ide-accent'
                : 'text-ide-muted hover:bg-ide-elevated hover:text-ide-text',
            )}
            title={agentOn ? 'Agent on — can edit files' : 'Agent off — chat only'}
            onClick={() => void updateSetting('ai', { agentMode: !agentOn })}
          >
            <Zap size={12} />
            <span>Agent</span>
          </button>
          {agentOn && (
            <button
              type="button"
              className={cn(
                'h-6 rounded px-1.5 text-[10px] transition-colors',
                autoApply
                  ? 'text-ide-success hover:bg-ide-elevated'
                  : 'text-ide-muted hover:bg-ide-elevated hover:text-ide-text',
              )}
              title="Auto-apply file edits"
              onClick={() => void updateSetting('ai', { autoApplyEdits: !autoApply })}
            >
              {autoApply ? 'Auto' : 'Review'}
            </button>
          )}
          <IconBtn label="New chat" onClick={() => newConversation()}>
            <Plus size={14} />
          </IconBtn>
          {activeConversationId && (
            <IconBtn
              label="Delete chat"
              onClick={() => deleteConversation(activeConversationId)}
            >
              <Trash2 size={13} />
            </IconBtn>
          )}
          <IconBtn label="Close (Ctrl+L)" onClick={closeAiPanel}>
            <X size={14} />
          </IconBtn>
        </div>
      </div>

      {/* Model — compact */}
      <div className="flex shrink-0 items-center border-b border-ide-border/40 px-2 py-0.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
          title={`${provider?.name ?? ''} · ${activeModel}`}
          onClick={() => setShowModelRow((v) => !v)}
        >
          <span className="truncate">{activeModel}</span>
          <ChevronDown
            size={11}
            className={cn('shrink-0 opacity-50', showModelRow && 'rotate-180')}
          />
        </button>
      </div>

      {showModelRow && (
        <div className="flex shrink-0 flex-col gap-1 border-b border-ide-border/40 px-2 py-1.5">
          <select
            className="w-full rounded border border-ide-border bg-ide-bg px-1.5 py-1 text-[11px] text-ide-text outline-none"
            value={activeProviderId}
            onChange={(e) => {
              const id = e.target.value;
              setProvider(id);
              const patch: { provider: string; model?: string; baseUrl?: string } = {
                provider: id,
              };
              if (id === 'deepseek') {
                patch.model = 'deepseek-chat';
                patch.baseUrl = 'https://api.deepseek.com/v1';
                setModel('deepseek-chat');
              }
              void updateSetting('ai', patch);
            }}
            aria-label="Provider"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded border border-ide-border bg-ide-bg px-1.5 py-1 text-[11px] text-ide-text outline-none"
            value={activeModel}
            onChange={(e) => {
              setModel(e.target.value);
              void updateSetting('ai', { model: e.target.value });
            }}
            aria-label="Model"
          >
            {(provider?.models ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {conversations.length > 1 && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-ide-border/40 px-1.5 py-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveConversation(c.id)}
              className={cn(
                'max-w-[6.5rem] shrink-0 truncate rounded px-2 py-0.5 text-[11px]',
                c.id === activeConversationId
                  ? 'bg-ide-selection text-ide-text'
                  : 'text-ide-muted hover:bg-ide-elevated hover:text-ide-text',
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {lastError && (
        <div className="shrink-0 break-words border-b border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-300 [overflow-wrap:anywhere]">
          {lastError}
        </div>
      )}

      {/* Messages */}
      <div
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-2"
        data-selectable="true"
      >
        {!conversation || conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <p className="text-[12px] text-ide-muted">
              {agentOn
                ? 'Describe a change to edit files.'
                : 'Ask about your code, or enable Agent.'}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {conversation.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className="min-w-0">
                  <div
                    className={cn(
                      'mb-0.5 text-[10px] font-medium uppercase tracking-wide',
                      isUser ? 'text-ide-muted' : 'text-ide-accent',
                    )}
                  >
                    {isUser ? 'You' : 'Sephora'}
                    {msg.isStreaming && (
                      <span className="ml-1.5 inline-block h-1 w-1 animate-pulse rounded-full bg-ide-accent align-middle" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'selectable whitespace-pre-wrap break-words text-[12px] leading-relaxed [overflow-wrap:anywhere] [word-break:break-word]',
                      isUser ? 'text-ide-text' : 'text-ide-text/90',
                    )}
                  >
                    {msg.content || (msg.isStreaming ? '…' : '')}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="min-w-0 shrink-0 border-t border-ide-border/60 p-2">
        <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1">
          {contextChips.map((chip) => (
            <span
              key={chip.path}
              className={cn(
                'inline-flex max-w-[9rem] items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]',
                chip.kind === 'active'
                  ? 'bg-ide-accent/10 text-ide-accent'
                  : 'bg-ide-elevated text-ide-muted',
              )}
              title={chip.path}
            >
              <FileCode size={10} className="shrink-0" />
              <span className="min-w-0 truncate">{basename(chip.path)}</span>
              <button
                type="button"
                className="shrink-0 opacity-50 hover:opacity-100"
                title="Remove"
                onClick={() => removeChip(chip.path, chip.kind)}
              >
                <X size={9} />
              </button>
            </span>
          ))}
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
              title="Attach open file or drop from Explorer"
              onClick={() => setShowAddMenu((v) => !v)}
            >
              <Paperclip size={11} />
            </button>
            {showAddMenu && (
              <div className="absolute bottom-full left-0 z-20 mb-1 max-h-32 w-44 overflow-auto rounded border border-ide-border bg-ide-surface py-0.5 shadow-lg">
                {attachableTabs.length === 0 ? (
                  <p className="px-2 py-1.5 text-[11px] text-ide-muted">
                    No other open files — drag from Explorer
                  </p>
                ) : (
                  attachableTabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1 text-left text-[11px] text-ide-text hover:bg-ide-elevated"
                      onClick={() => addChip(t.path)}
                      title={t.path}
                    >
                      <FileCode size={11} className="shrink-0 text-ide-muted" />
                      <span className="min-w-0 truncate">{basename(t.path)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-end gap-1 rounded border border-ide-border bg-ide-bg">
          <textarea
            ref={textareaRef}
            className="selectable max-h-[100px] min-h-[36px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[12px] text-ide-text outline-none ring-0 focus:outline-none focus-visible:outline-none placeholder:text-ide-muted/50 [overflow-wrap:anywhere]"
            placeholder={agentOn ? 'Describe a change…' : 'Message…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-selectable="true"
            disabled={isStreaming}
            rows={1}
          />
          {isStreaming ? (
            <button
              type="button"
              className="mb-1 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-ide-danger hover:bg-ide-elevated"
              title="Stop"
              onClick={() => void stopChatGeneration()}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                'mb-1 mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors',
                input.trim()
                  ? 'text-ide-accent hover:bg-ide-elevated'
                  : 'text-ide-muted/30',
              )}
              title="Send"
              disabled={!input.trim()}
              onClick={handleSend}
            >
              <Send size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-ide-muted transition-colors hover:bg-ide-elevated hover:text-ide-text"
    >
      {children}
    </button>
  );
}
