"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export type TerminalLine = {
  id: string;
  kind:
    | "info"
    | "stdout"
    | "stderr"
    | "system"
    | "error"
    | "success"
    | "input";
  text: string;
};

type TerminalProps = {
  lines: TerminalLine[];
  isRunning: boolean;
  /** Program is blocked on stdin — show live input like a real IDE */
  waitingForInput?: boolean;
  onSubmitInput?: (line: string) => void;
  onCancelRun?: () => void;
  tabLabel?: string;
};

const KIND_CLASS: Record<TerminalLine["kind"], string> = {
  info: "text-[var(--text-dim)]",
  system: "text-[#7aa2f7]",
  stdout: "text-[#c0caf5]",
  stderr: "text-[var(--error)]",
  error: "text-[var(--error)]",
  success: "text-[var(--success)]",
  input: "text-[#e0af68]",
};

export function Terminal({
  lines,
  isRunning,
  waitingForInput = false,
  onSubmitInput,
  onCancelRun,
  tabLabel,
}: TerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, waitingForInput]);

  useEffect(() => {
    if (waitingForInput) {
      setDraft("");
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    setDraft("");
  }, [waitingForInput]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!waitingForInput || !onSubmitInput) return;
    onSubmitInput(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "c" && e.ctrlKey && onCancelRun) {
      e.preventDefault();
      onCancelRun();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-terminal)]">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--bg-tab)] px-2 sm:h-8 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-bright)] sm:gap-2">
          <TerminalIcon />
          <span className="shrink-0">Terminal</span>
          {tabLabel && (
            <span className="hidden truncate font-mono text-[10px] text-[var(--text-dim)] sm:inline">
              · {tabLabel}
            </span>
          )}
          {isRunning && !waitingForInput && (
            <span className="running-pulse shrink-0 rounded bg-[#3d3f43] px-1.5 py-0.5 text-[10px] text-[var(--warning)]">
              executing
            </span>
          )}
          {waitingForInput && (
            <span className="shrink-0 rounded bg-[#3d3f43] px-1.5 py-0.5 text-[10px] text-[#e0af68]">
              input
            </span>
          )}
        </div>
        <span className="hidden shrink-0 text-[10px] text-[var(--text-dim)] sm:inline">
          {waitingForInput
            ? "type a value · Enter to send · Ctrl+C cancel"
            : "stdout · stderr · compile"}
        </span>
      </div>

      <div className="terminal-output min-h-0 flex-1 overflow-auto px-2 py-2 font-mono text-[12.5px] leading-relaxed sm:px-3">
        {lines.length === 0 && !waitingForInput ? (
          <div className="text-[var(--text-dim)]">
            Ready. Press <kbd className="rounded bg-[#2a2a2a] px-1">Run</kbd>
            <span className="hidden sm:inline">
              {" "}
              or{" "}
              <kbd className="rounded bg-[#2a2a2a] px-1">Ctrl/Cmd+Enter</kbd>
            </span>
            .
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.id}
              className={`whitespace-pre-wrap break-words ${KIND_CLASS[line.kind]}`}
            >
              {line.kind === "input" ? (
                <>
                  <span className="text-[var(--text-dim)]">‹ </span>
                  {line.text}
                </>
              ) : (
                line.text
              )}
            </div>
          ))
        )}

        {waitingForInput && (
          <form
            onSubmit={submit}
            className="mt-1 flex items-center gap-2 font-mono text-[12.5px] sm:mt-0.5 sm:gap-1"
          >
            <span className="shrink-0 text-[#e0af68]">›</span>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="Program input"
              className="min-h-10 min-w-0 flex-1 rounded border border-[#3d3f43] bg-[#1a1a1a] px-2 text-base text-[#e0af68] outline-none focus:border-[var(--accent)] sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:text-[12.5px]"
              placeholder="type input here…"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white sm:hidden"
            >
              Send
            </button>
            <span className="hidden h-3.5 w-1.5 animate-pulse bg-[#e0af68] sm:inline-block" />
          </form>
        )}

        <div ref={bottomRef} />
      </div>

      {isRunning && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-soft)] bg-[#121212] px-2 py-2 sm:px-3 sm:py-1.5">
          <span className="text-[10px] text-[var(--text-dim)] sm:text-[10px]">
            {waitingForInput
              ? "Program is waiting for your input"
              : "Program running…"}
          </span>
          {onCancelRun && (
            <button
              type="button"
              onClick={onCancelRun}
              className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[#2a2a2a] sm:min-h-0 sm:px-2 sm:py-0.5 sm:text-[10px]"
            >
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TerminalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
