/**
 * Detect error / problem lines in program output so the Output panel
 * can highlight them (port in use, Spring Boot failures, build errors).
 */

export type ProblemKind = 'port' | 'fatal' | 'error' | 'warn' | 'build';

export interface ProblemMatch {
  kind: ProblemKind;
  /** Whole line should be emphasized */
  line: boolean;
}

const LINE_RULES: Array<{ kind: ProblemKind; re: RegExp }> = [
  // Port conflicts — the issue users hit after incomplete Stop
  {
    kind: 'port',
    re: /port\s+\d+\s+was\s+already\s+in\s+use|address\s+already\s+in\s+use|bind.*already\s+in\s+use|failed\s+to\s+bind.*port|port\s+\d+\s+.*already|EADDRINUSE/i,
  },
  {
    kind: 'fatal',
    re: /APPLICATION FAILED TO START|Web server failed to start|APPLICATION FAILED|Failed to start component|Error starting ApplicationContext/i,
  },
  {
    kind: 'build',
    re: /BUILD FAILURE|COMPILATION ERROR|Failed to execute goal|\[ERROR\]|npm ERR!/i,
  },
  {
    kind: 'error',
    re: /\b(ERROR|FATAL|Exception|Error:|Caused by:|SEVERE|FAILED)\b|Exception in thread|Traceback \(most recent/i,
  },
  {
    kind: 'warn',
    re: /\b(WARN|WARNING)\b/i,
  },
];

/** Classify a log line for highlighting (after ANSI strip for matching). */
export function classifyProblemLine(plainText: string): ProblemKind | null {
  const t = plainText.trim();
  if (!t) return null;
  for (const rule of LINE_RULES) {
    if (rule.re.test(t)) return rule.kind;
  }
  return null;
}

/** CSS classes / inline styles for problem emphasis. */
export function problemLineStyle(kind: ProblemKind): {
  className: string;
  style?: Record<string, string>;
} {
  switch (kind) {
    case 'port':
      return {
        className: 'ansi-problem-port',
        style: {
          backgroundColor: 'rgba(241, 76, 76, 0.28)',
          color: '#ffb4b4',
          fontWeight: '700',
          borderLeft: '3px solid #f14c4c',
          paddingLeft: '6px',
          display: 'block',
          margin: '2px 0',
        },
      };
    case 'fatal':
      return {
        className: 'ansi-problem-fatal',
        style: {
          backgroundColor: 'rgba(241, 76, 76, 0.22)',
          color: '#ff8a8a',
          fontWeight: '700',
          borderLeft: '3px solid #f14c4c',
          paddingLeft: '6px',
          display: 'block',
          margin: '2px 0',
        },
      };
    case 'build':
    case 'error':
      return {
        className: 'ansi-problem-error',
        style: {
          backgroundColor: 'rgba(241, 76, 76, 0.14)',
          color: '#f48771',
          fontWeight: '600',
          display: 'block',
        },
      };
    case 'warn':
      return {
        className: 'ansi-problem-warn',
        style: {
          backgroundColor: 'rgba(229, 229, 16, 0.08)',
          color: '#e5e510',
          display: 'block',
        },
      };
    default:
      return { className: '' };
  }
}
