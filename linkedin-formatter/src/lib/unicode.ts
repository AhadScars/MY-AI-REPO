/**
 * LinkedIn-compatible Unicode text styles.
 * LinkedIn posts don't support HTML/markdown, so we use
 * Mathematical Alphanumeric Symbols + combining underline.
 */

export type TextStyle = 'normal' | 'bold' | 'italic' | 'boldItalic';

const UNDERLINE = '\u0332'; // combining low line

// Ranges for Mathematical Alphanumeric Symbols
const RANGES: Record<
  Exclude<TextStyle, 'normal'>,
  { upper: number; lower: number; digit?: number }
> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  italic: { upper: 0x1d434, lower: 0x1d44e },
  boldItalic: { upper: 0x1d468, lower: 0x1d482 },
};

// Mathematical italic 'h' is missing from the block; use Planck constant
const ITALIC_H = '\u210e';

/** Map of styled unicode → plain ASCII (for stripping / re-styling) */
function buildReverseMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const style of Object.keys(RANGES) as Array<keyof typeof RANGES>) {
    const { upper, lower, digit } = RANGES[style];
    for (let i = 0; i < 26; i++) {
      let upperChar = String.fromCodePoint(upper + i);
      let lowerChar = String.fromCodePoint(lower + i);
      // italic h hole
      if (style === 'italic' && i === 7) {
        lowerChar = ITALIC_H;
      }
      map.set(upperChar, String.fromCharCode(65 + i));
      map.set(lowerChar, String.fromCharCode(97 + i));
    }
    if (digit !== undefined) {
      for (let i = 0; i < 10; i++) {
        map.set(String.fromCodePoint(digit + i), String.fromCharCode(48 + i));
      }
    }
  }
  return map;
}

const REVERSE = buildReverseMap();

/** Strip underline combining marks and styled letters → plain ASCII */
export function toPlain(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === UNDERLINE) continue;
    out += REVERSE.get(ch) ?? ch;
  }
  return out;
}

/** Apply a mathematical style to a single character (already plain) */
function styleChar(ch: string, style: TextStyle): string {
  if (style === 'normal') return ch;

  const code = ch.codePointAt(0)!;
  const { upper, lower, digit } = RANGES[style];

  if (code >= 65 && code <= 90) {
    return String.fromCodePoint(upper + (code - 65));
  }
  if (code >= 97 && code <= 122) {
    if (style === 'italic' && code === 104) return ITALIC_H; // h
    return String.fromCodePoint(lower + (code - 97));
  }
  if (digit !== undefined && code >= 48 && code <= 57) {
    return String.fromCodePoint(digit + (code - 48));
  }
  return ch;
}

/** Style text: optionally bold/italic + underline. Strips previous style first. */
export function applyStyle(
  text: string,
  style: TextStyle,
  underline = false
): string {
  const plain = toPlain(text);
  let result = '';
  for (const ch of plain) {
    const styled = styleChar(ch, style);
    result += underline && !/\s/.test(ch) ? styled + UNDERLINE : styled;
  }
  return result;
}

/** Toggle underline on text (preserves existing letter style) */
export function toggleUnderline(text: string): string {
  // If majority of non-space chars already have underline after them, strip
  const chars = [...text];
  let letterCount = 0;
  let underlinedCount = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === UNDERLINE) continue;
    if (/\s/.test(chars[i])) continue;
    letterCount++;
    if (chars[i + 1] === UNDERLINE) underlinedCount++;
  }
  const mostlyUnderlined = letterCount > 0 && underlinedCount / letterCount > 0.5;

  if (mostlyUnderlined) {
    return chars.filter((c) => c !== UNDERLINE).join('');
  }

  // Add underline after each non-space, non-underline char
  let out = '';
  for (const ch of chars) {
    if (ch === UNDERLINE) continue;
    out += ch;
    if (!/\s/.test(ch)) out += UNDERLINE;
  }
  return out;
}

export const BULLET_STYLES = [
  { id: 'dot', label: '• Dot', prefix: '• ' },
  { id: 'dash', label: '– Dash', prefix: '– ' },
  { id: 'arrow', label: '→ Arrow', prefix: '→ ' },
  { id: 'check', label: '✓ Check', prefix: '✓ ' },
  { id: 'star', label: '★ Star', prefix: '★ ' },
  { id: 'diamond', label: '◆ Diamond', prefix: '◆ ' },
  { id: 'circle', label: '○ Circle', prefix: '○ ' },
  { id: 'square', label: '▪ Square', prefix: '▪ ' },
  { id: 'number', label: '1. Number', prefix: null as string | null },
] as const;

export type BulletId = (typeof BULLET_STYLES)[number]['id'];

/** Convert selected lines into bulleted list */
export function formatAsBullets(text: string, bulletId: BulletId): string {
  const lines = text.split('\n');
  let n = 1;
  return lines
    .map((line) => {
      const trimmed = line.replace(/^\s*[•\-–→✓★◆○▪]\s+/, '').replace(/^\s*\d+\.\s+/, '');
      if (!trimmed.trim()) return line;
      if (bulletId === 'number') {
        return `${n++}. ${trimmed}`;
      }
      const style = BULLET_STYLES.find((b) => b.id === bulletId)!;
      return `${style.prefix}${trimmed}`;
    })
    .join('\n');
}

/** Detect if selection already looks styled as given style (rough) */
export function isMostlyStyle(text: string, style: TextStyle): boolean {
  if (style === 'normal') return false;
  const plain = toPlain(text);
  if (!plain.trim()) return false;
  const restyled = applyStyle(plain, style, false);
  // Compare without underlines
  const stripU = (s: string) => [...s].filter((c) => c !== UNDERLINE).join('');
  return stripU(text) === stripU(restyled);
}
