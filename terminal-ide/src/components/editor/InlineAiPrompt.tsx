import { useEffect, useRef } from 'react';
import { Sparkles, Check, X, RotateCcw } from 'lucide-react';
import { useInlineAiStore } from '../../stores/inlineAiStore';

export function InlineAiPrompt() {
  const open = useInlineAiStore((s) => s.open);
  const instruction = useInlineAiStore((s) => s.instruction);
  const setInstruction = useInlineAiStore((s) => s.setInstruction);
  const proposedCode = useInlineAiStore((s) => s.proposedCode);
  const originalCode = useInlineAiStore((s) => s.originalCode);
  const isLoading = useInlineAiStore((s) => s.isLoading);
  const error = useInlineAiStore((s) => s.error);
  const run = useInlineAiStore((s) => s.run);
  const accept = useInlineAiStore((s) => s.accept);
  const reject = useInlineAiStore((s) => s.reject);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute left-1/2 top-16 z-40 w-full max-w-xl -translate-x-1/2 rounded-md border border-ide-border bg-ide-surface shadow-2xl">
      <div className="flex items-center gap-2 border-b border-ide-border px-3 py-2">
        <Sparkles size={16} className="text-ide-accent" />
        <span className="text-ide-sm font-medium text-ide-text">AI Edit Selection</span>
        <span className="text-ide-xs text-ide-muted">Ctrl+K</span>
      </div>
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          className="mb-2 w-full rounded-sm border border-ide-border bg-ide-bg px-2 py-1.5 text-ide-sm text-ide-text outline-none focus:border-ide-accent"
          placeholder="Add error handling and types…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (proposedCode) accept();
              else void run();
            }
            if (e.key === 'Escape') reject();
          }}
          disabled={isLoading}
        />
        {error && <p className="mb-2 text-ide-xs text-ide-danger">{error}</p>}
        {isLoading && <p className="mb-2 text-ide-xs text-ide-muted">Generating…</p>}
        {proposedCode && (
          <div className="mb-2 max-h-48 overflow-auto rounded-sm border border-ide-border bg-ide-bg p-2 font-mono text-ide-xs">
            <div className="mb-1 text-ide-muted">Proposed ({proposedCode.length} chars)</div>
            <pre className="whitespace-pre-wrap text-ide-success">
              {proposedCode.slice(0, 2000)}
              {proposedCode.length > 2000 ? '\n…' : ''}
            </pre>
            {originalCode && (
              <details className="mt-2">
                <summary className="cursor-pointer text-ide-muted">Original</summary>
                <pre className="mt-1 whitespace-pre-wrap text-ide-danger">
                  {originalCode.slice(0, 1000)}
                </pre>
              </details>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-sm border border-ide-border px-2 py-1 text-ide-xs hover:bg-ide-elevated"
            onClick={reject}
          >
            <span className="inline-flex items-center gap-1">
              <X size={12} /> Cancel
            </span>
          </button>
          {proposedCode ? (
            <>
              <button
                type="button"
                className="rounded-sm border border-ide-border px-2 py-1 text-ide-xs hover:bg-ide-elevated"
                onClick={() => void run()}
                disabled={isLoading}
              >
                <span className="inline-flex items-center gap-1">
                  <RotateCcw size={12} /> Retry
                </span>
              </button>
              <button
                type="button"
                className="rounded-sm bg-ide-accent px-2 py-1 text-ide-xs text-white hover:bg-ide-accent-hover"
                onClick={accept}
              >
                <span className="inline-flex items-center gap-1">
                  <Check size={12} /> Accept
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-sm bg-ide-accent px-2 py-1 text-ide-xs text-white hover:bg-ide-accent-hover disabled:opacity-40"
              onClick={() => void run()}
              disabled={isLoading || !instruction.trim()}
            >
              Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
