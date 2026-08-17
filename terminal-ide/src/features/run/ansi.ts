/**
 * ANSI / terminal text helpers for the Run Output panel.
 * Spring Boot, Maven, and most CLIs emit CSI color codes — render them as styles
 * and strip control junk that would hide text in plain HTML.
 */

export interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
  textDecoration?: 'underline' | 'none';
  opacity?: number;
}

export interface AnsiSegment {
  text: string;
  style: AnsiStyle;
}

/** VS Code Dark+–like palette (matches IDE terminal). */
const FG: Record<number, string> = {
  30: '#000000',
  31: '#cd3131',
  32: '#0dbc79',
  33: '#e5e510',
  34: '#2472c8',
  35: '#bc3fbc',
  36: '#11a8cd',
  37: '#e5e5e5',
  90: '#666666',
  91: '#f14c4c',
  92: '#23d18b',
  93: '#f5f543',
  94: '#3b8eea',
  95: '#d670d6',
  96: '#29b8db',
  97: '#e5e5e5',
};

const BG: Record<number, string> = {
  40: '#000000',
  41: '#cd3131',
  42: '#0dbc79',
  43: '#e5e510',
  44: '#2472c8',
  45: '#bc3fbc',
  46: '#11a8cd',
  47: '#e5e5e5',
  100: '#666666',
  101: '#f14c4c',
  102: '#23d18b',
  103: '#f5f543',
  104: '#3b8eea',
  105: '#d670d6',
  106: '#29b8db',
  107: '#e5e5e5',
};

/** 256-color cube / grayscale approximation. */
function color256(n: number): string {
  if (n < 0 || n > 255) return '#e5e5e5';
  if (n < 16) {
    const basic = [
      '#000000',
      '#cd3131',
      '#0dbc79',
      '#e5e510',
      '#2472c8',
      '#bc3fbc',
      '#11a8cd',
      '#e5e5e5',
      '#666666',
      '#f14c4c',
      '#23d18b',
      '#f5f543',
      '#3b8eea',
      '#d670d6',
      '#29b8db',
      '#e5e5e5',
    ];
    return basic[n] ?? '#e5e5e5';
  }
  if (n >= 232) {
    const v = 8 + (n - 232) * 10;
    return `rgb(${v},${v},${v})`;
  }
  const i = n - 16;
  const r = Math.floor(i / 36);
  const g = Math.floor((i % 36) / 6);
  const b = i % 6;
  const to = (c: number) => (c === 0 ? 0 : 55 + c * 40);
  return `rgb(${to(r)},${to(g)},${to(b)})`;
}

/**
 * Clean progress-bar overwrites and backspaces so text is not "missing".
 * Maven/Spring often rewrite the same line with `\r`.
 */
export function normalizeTerminalChunk(text: string): string {
  if (!text) return '';

  // Drop NULs (sometimes appear from Windows pipes)
  let s = text.replace(/\0/g, '');

  // OSC sequences (title, hyperlinks): ESC ] ... BEL or ESC ] ... ESC \
  s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');

  // Charset / private mode / other single-byte ESC (not CSI)
  s = s.replace(/\x1b[()][0-9A-Za-z]/g, '');
  s = s.replace(/\x1b[=>]/g, '');

  // Process line-by-line for \r and \b (keep CSI for color parsing later)
  const parts = s.split(/(\r?\n)/);
  const out: string[] = [];

  for (const part of parts) {
    if (part === '\n' || part === '\r\n') {
      out.push(part);
      continue;
    }

    // Backspace: erase previous visible char (ignore if previous is CSI — rare mid-seq)
    let line = '';
    for (let i = 0; i < part.length; i++) {
      const ch = part[i]!;
      if (ch === '\b' || ch === '\x08') {
        // Don't delete into escape sequences naively — strip last codepoint of plain text
        if (line.endsWith('m') && line.includes('\x1b[')) {
          // leave as-is if looks incomplete; still drop one char
        }
        line = line.slice(0, -1);
        continue;
      }
      line += ch;
    }

    // Carriage return: keep only the last "frame" of the line (progress bars)
    if (line.includes('\r')) {
      const frames = line.split('\r');
      line = frames[frames.length - 1] ?? '';
    }

    // Strip other C0 controls except TAB and ESC (for ANSI colors)
    line = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/g, '');

    out.push(line);
  }

  return out.join('');
}

/** Strip all ANSI / control sequences → plain text (diagnostics, search). */
export function stripAnsi(text: string): string {
  return normalizeTerminalChunk(text)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/\r/g, '');
}

function applySgr(codes: number[], style: AnsiStyle): AnsiStyle {
  const next: AnsiStyle = { ...style };
  let i = 0;
  while (i < codes.length) {
    const c = codes[i] ?? 0;
    if (c === 0) {
      return {};
    }
    if (c === 1) next.fontWeight = 'bold';
    else if (c === 2) next.opacity = 0.7;
    else if (c === 3) next.fontStyle = 'italic';
    else if (c === 4) next.textDecoration = 'underline';
    else if (c === 22) {
      next.fontWeight = 'normal';
      next.opacity = undefined;
    } else if (c === 23) next.fontStyle = 'normal';
    else if (c === 24) next.textDecoration = 'none';
    else if (c === 39) next.color = undefined;
    else if (c === 49) next.backgroundColor = undefined;
    else if (FG[c]) next.color = FG[c];
    else if (BG[c]) next.backgroundColor = BG[c];
    else if (c === 38 || c === 48) {
      const isFg = c === 38;
      const mode = codes[i + 1];
      if (mode === 5 && codes[i + 2] !== undefined) {
        const col = color256(codes[i + 2]!);
        if (isFg) next.color = col;
        else next.backgroundColor = col;
        i += 2;
      } else if (mode === 2 && codes[i + 4] !== undefined) {
        const col = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
        if (isFg) next.color = col;
        else next.backgroundColor = col;
        i += 4;
      }
    }
    i += 1;
  }
  return next;
}

/**
 * Parse ANSI CSI SGR sequences into styled text segments for React.
 */
export function parseAnsiToSegments(raw: string): AnsiSegment[] {
  const text = normalizeTerminalChunk(raw);
  if (!text) return [];

  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let buf = '';

  const flush = () => {
    if (!buf) return;
    segments.push({ text: buf, style: { ...style } });
    buf = '';
  };

  // Match CSI: ESC [ ... final-byte  (SGR ends with m; others discarded)
  const re = /\x1b\[([0-9;?]*)([@-~])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      buf += text.slice(last, m.index);
    }
    const params = m[1] ?? '';
    const final = m[2] ?? '';
    if (final === 'm') {
      flush();
      const codes =
        params === ''
          ? [0]
          : params.split(';').map((p) => {
              const n = Number(p);
              return Number.isFinite(n) ? n : 0;
            });
      style = applySgr(codes, style);
    }
    // Ignore cursor moves, erase, etc. — they would hide text in HTML
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    buf += text.slice(last);
  }
  flush();

  // Drop empty segments
  return segments.filter((s) => s.text.length > 0);
}

/** Inline style object for a segment (React-compatible). */
export function ansiStyleToCss(style: AnsiStyle): Record<string, string | number> {
  const css: Record<string, string | number> = {};
  if (style.color) css.color = style.color;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.fontWeight) css.fontWeight = style.fontWeight;
  if (style.fontStyle) css.fontStyle = style.fontStyle;
  if (style.textDecoration && style.textDecoration !== 'none') {
    css.textDecoration = style.textDecoration;
  }
  if (style.opacity !== undefined) css.opacity = style.opacity;
  return css;
}
