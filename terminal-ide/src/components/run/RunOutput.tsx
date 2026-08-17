import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Trash2, Square, CornerDownLeft, RotateCw } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { IconButton } from '../common/IconButton';
import { cn } from '../../utils/cn';
import { ansiStyleToCss, parseAnsiToSegments, stripAnsi } from '../../features/run/ansi';
import { classifyProblemLine, problemLineStyle } from '../../features/run/problemHighlight';

export function RunOutput() {
  const output = useRunStore((s) => s.output);
  const isRunning = useRunStore((s) => s.isRunning);
  const error = useRunStore((s) => s.error);
  const lastCommand = useRunStore((s) => s.lastCommand);
  const lastFilePath = useRunStore((s) => s.lastFilePath);
  const clearOutput = useRunStore((s) => s.clearOutput);
  const stop = useRunStore((s) => s.stop);
  const rerun = useRunStore((s) => s.rerun);
  const sendInput = useRunStore((s) => s.sendInput);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const canRerun = Boolean(lastFilePath || lastCommand || isRunning);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output.length]);

  // Focus the input when a program starts so the user can type immediately
  useEffect(() => {
    if (isRunning) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [isRunning]);

  const submitInput = (e?: FormEvent) => {
    e?.preventDefault();
    if (!isRunning) return;
    const line = input;
    setInput('');
    void sendInput(line);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      <div className="flex h-8 items-center justify-between border-b border-ide-border px-2.5">
        <span className="text-ide-sm text-ide-muted">
          {isRunning
            ? 'Running… type below to send input'
            : lastCommand
              ? 'Output'
              : 'Program output'}
        </span>
        <div className="flex items-center gap-0.5">
          {canRerun && (
            <IconButton
              label="Rerun (Ctrl+F5)"
              size="sm"
              onClick={() => void rerun()}
            >
              <RotateCw size={13} />
            </IconButton>
          )}
          <button
            type="button"
            onClick={() => void stop()}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-ide-xs',
              isRunning
                ? 'bg-ide-danger/15 text-ide-danger hover:bg-ide-danger/25'
                : 'text-ide-muted hover:bg-ide-elevated hover:text-ide-danger',
            )}
            title="Stop process — kill server and free ports (Shift+F5)"
            aria-label="Stop process"
          >
            <Square size={11} fill="currentColor" strokeWidth={0} />
            <span>Stop</span>
          </button>
          <IconButton label="Clear" size="sm" onClick={clearOutput}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
      {error && (
        <div className="border-b border-ide-border bg-ide-danger/15 px-2.5 py-1.5 text-ide-sm text-ide-danger">
          {error}
        </div>
      )}
      <div
        className="selectable min-h-0 flex-1 overflow-auto p-3 font-mono text-ide-base leading-6 tracking-[0.01em]"
        data-selectable="true"
        onClick={() => {
          if (isRunning) inputRef.current?.focus();
        }}
      >
        {output.length === 0 && !error && (
          <p className="text-ide-base leading-6 text-ide-muted">
            Click <strong className="font-medium text-ide-text">Run</strong> (or press F5) to run
            the current file. When the program asks for input, type in the box below and press
            Enter.
          </p>
        )}
        {output.map((line) => (
          <AnsiLine
            key={line.id}
            stream={line.stream}
            text={line.stream === 'stdin' ? `❯ ${line.text}` : line.text}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Interactive stdin — works for Java Scanner menus, Python input(), etc. */}
      <form
        onSubmit={submitInput}
        className="flex shrink-0 items-center gap-1.5 border-t border-ide-border bg-[#181818] px-2.5 py-2"
      >
        <span
          className={cn(
            'font-mono text-ide-base',
            isRunning ? 'text-ide-success' : 'text-ide-muted',
          )}
        >
          ❯
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!isRunning}
          placeholder={
            isRunning
              ? 'Type your response and press Enter…'
              : 'Run a program (F5) to type input here'
          }
          className="min-w-0 flex-1 bg-transparent font-mono text-ide-base text-ide-text outline-none placeholder:text-ide-muted disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
          spellCheck={false}
          aria-label="Program input"
        />
        <button
          type="submit"
          disabled={!isRunning}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-ide-sm text-ide-muted hover:bg-ide-elevated hover:text-ide-text disabled:opacity-40"
          title="Send input (Enter)"
        >
          <CornerDownLeft size={13} />
          Send
        </button>
      </form>
    </div>
  );
}

/** Renders one log line with ANSI colors + problem highlighting. */
function AnsiLine({
  stream,
  text,
}: {
  stream: 'stdout' | 'stderr' | 'system' | 'stdin';
  text: string;
}) {
  const plain = useMemo(() => stripAnsi(text), [text]);
  const problem = useMemo(() => classifyProblemLine(plain), [plain]);
  const problemStyle = problem ? problemLineStyle(problem) : null;
  const segments = useMemo(() => parseAnsiToSegments(text), [text]);
  const hasAnsiColor = segments.some((s) => s.style.color || s.style.backgroundColor);

  const fallbackClass = cn(
    'whitespace-pre-wrap break-words',
    stream === 'stderr' && !hasAnsiColor && !problem && 'text-ide-danger',
    stream === 'system' && !problem && 'text-ide-warning',
    stream === 'stdout' && !hasAnsiColor && !problem && 'text-[#cccccc]',
    stream === 'stdin' && 'text-ide-success',
  );

  // Highlight port-in-use / APPLICATION FAILED / build errors
  if (problem && (problem === 'port' || problem === 'fatal' || problem === 'build' || problem === 'error')) {
    return (
      <span
        className={cn('whitespace-pre-wrap break-words', problemStyle?.className)}
        style={problemStyle?.style}
        title={
          problem === 'port'
            ? 'Port already in use — press Stop to free the port, then Run again'
            : problem === 'fatal'
              ? 'Application failed to start — see details below'
              : 'Error'
        }
      >
        {problem === 'port' ? '⚠ ' : problem === 'fatal' ? '✖ ' : '● '}
        {plain}
      </span>
    );
  }

  // System / stdin lines use fixed theme colors
  if (stream === 'system' || stream === 'stdin') {
    return (
      <span className={fallbackClass} style={problemStyle?.style}>
        {plain}
      </span>
    );
  }

  if (segments.length === 0) {
    return <span className={fallbackClass} />;
  }

  return (
    <span
      className={cn('whitespace-pre-wrap break-words', problemStyle?.className)}
      style={problem === 'warn' ? problemStyle?.style : undefined}
    >
      {segments.map((seg, i) => {
        const style = ansiStyleToCss(seg.style);
        // Default stream color when segment has no FG
        if (!style.color) {
          if (stream === 'stderr') style.color = 'var(--ide-danger, #f14c4c)';
          else style.color = '#cccccc';
        }
        return (
          <span key={i} style={style}>
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}
