import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { requireApi } from '../../services/platform';
import { useSettingsStore } from '../../stores/settingsStore';
import { useDiagnosticsStore } from '../../stores/diagnosticsStore';

interface XtermViewProps {
  sessionId: string;
  active: boolean;
  onExit?: (exitCode: number) => void;
}

/**
 * Real xterm.js view bound to a main-process PTY session over IPC.
 */
export function XtermView({ sessionId, active, onExit }: XtermViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const fontFamily = useSettingsStore((s) => s.settings.terminal.fontFamily);
  const fontSize = useSettingsStore((s) => s.settings.terminal.fontSize);
  const scrollback = useSettingsStore((s) => s.settings.terminal.scrollback);
  const cursorStyle = useSettingsStore((s) => s.settings.terminal.cursorStyle);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const api = requireApi();
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: cursorStyle === 'underline' ? 'underline' : cursorStyle === 'bar' ? 'bar' : 'block',
      fontFamily,
      fontSize,
      scrollback,
      convertEol: true,
      allowProposedApi: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon((event, uri) => {
      event.preventDefault();
      void api.openExternal({ url: uri });
    });

    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(el);
    termRef.current = term;
    fitRef.current = fit;

    // Initial fit + notify PTY of size
    requestAnimationFrame(() => {
      try {
        fit.fit();
        void api.resizeTerminal({
          id: sessionIdRef.current,
          cols: term.cols,
          rows: term.rows,
        });
      } catch {
        // container may be hidden
      }
    });

    const unsubData = api.onTerminalData(({ id, data }) => {
      if (id === sessionIdRef.current) {
        term.write(data);
        // Parse compiler/runtime errors from shell output → editor underlines + hover
        useDiagnosticsStore.getState().ingestTerminalData(id, data);
      }
    });

    const unsubExit = api.onTerminalExit(({ id, exitCode }) => {
      if (id === sessionIdRef.current) {
        term.writeln('');
        term.writeln(`\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
        onExit?.(exitCode);
      }
    });

    const dataDisp = term.onData((data) => {
      void api.writeTerminal({ id: sessionIdRef.current, data });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!fitRef.current || !termRef.current) return;
      try {
        fitRef.current.fit();
        void api.resizeTerminal({
          id: sessionIdRef.current,
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        });
      } catch {
        // ignore fit errors when not visible
      }
    });
    resizeObserver.observe(el);

    return () => {
      unsubData();
      unsubExit();
      dataDisp.dispose();
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // Mount once per sessionId — settings updates applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Focus when becoming active
  useEffect(() => {
    if (active && termRef.current) {
      termRef.current.focus();
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          if (termRef.current) {
            void requireApi().resizeTerminal({
              id: sessionId,
              cols: termRef.current.cols,
              rows: termRef.current.rows,
            });
          }
        } catch {
          // ignore
        }
      });
    }
  }, [active, sessionId]);

  // Live font/size updates
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontFamily = fontFamily;
    term.options.fontSize = fontSize;
    term.options.scrollback = scrollback;
    try {
      fitRef.current?.fit();
    } catch {
      // ignore
    }
  }, [fontFamily, fontSize, scrollback]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden p-1"
      style={{ display: active ? 'block' : 'none' }}
      data-terminal-id={sessionId}
    />
  );
}
