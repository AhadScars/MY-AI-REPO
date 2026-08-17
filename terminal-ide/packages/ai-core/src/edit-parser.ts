/**
 * Parse multi-file edit proposals from AI assistant text.
 * Supports fenced blocks: ```lang path=relative/or/absolute.ext
 * or ```path/to/file.ext
 */

export interface ParsedFileEdit {
  path: string;
  content: string;
  language?: string;
}

const FENCE_RE =
  /```([^\n`]*)\n([\s\S]*?)```/g;

export function parseFileEditsFromMarkdown(text: string): ParsedFileEdit[] {
  const edits: ParsedFileEdit[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FENCE_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    const header = (match[1] ?? '').trim();
    const content = match[2] ?? '';
    if (!header) continue;

    // path=foo/bar.ts  OR  typescript path=foo  OR  foo/bar.ts
    let filePath: string | undefined;
    let language: string | undefined;

    const pathEq = header.match(/path\s*=\s*([^\s]+)/i);
    if (pathEq) {
      filePath = pathEq[1];
      language = header.split(/\s+/)[0];
      if (language?.startsWith('path')) language = undefined;
    } else if (header.includes('/') || header.includes('\\') || /\.\w+$/.test(header)) {
      // header looks like a path
      const parts = header.split(/\s+/);
      const maybePath = parts.find((p) => p.includes('/') || p.includes('\\') || /\.\w+$/.test(p));
      if (maybePath) {
        filePath = maybePath;
        language = parts[0] !== maybePath ? parts[0] : undefined;
      }
    }

    // Also accept: // file: path
    if (!filePath) {
      const firstLine = content.split(/\r?\n/)[0] ?? '';
      const fileComment = firstLine.match(/^(?:\/\/|#)\s*file:\s*(.+)$/i);
      if (fileComment) {
        filePath = fileComment[1]!.trim();
      }
    }

    if (!filePath) continue;
    // Strip file: comment line from content if present
    let body = content;
    if (/^(?:\/\/|#)\s*file:/i.test(body.split(/\r?\n/)[0] ?? '')) {
      body = body.split(/\r?\n/).slice(1).join('\n');
    }

    edits.push({
      path: filePath.replace(/^["']|["']$/g, ''),
      content: body.replace(/\n$/, ''),
      language,
    });
  }

  return edits;
}

/**
 * Build an inline-edit system prompt.
 */
export function buildInlineEditPrompt(opts: {
  instruction: string;
  code: string;
  language?: string;
  path?: string;
}): string {
  return [
    'You are a precise code editor. Apply the user instruction to the given code.',
    'Return ONLY the full updated code — no markdown fences, no explanation.',
    opts.path ? `File: ${opts.path}` : '',
    opts.language ? `Language: ${opts.language}` : '',
    '',
    'Instruction:',
    opts.instruction,
    '',
    'Code:',
    opts.code,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Build autocomplete prompt (fill-in-the-middle style).
 */
export function buildAutocompletePrompt(opts: {
  prefix: string;
  suffix?: string;
  language?: string;
  path?: string;
}): string {
  return [
    'Complete the next few lines of code at the cursor. Return ONLY the completion text to insert (no fences, no explanation). Keep it short (1-8 lines).',
    opts.path ? `File: ${opts.path}` : '',
    opts.language ? `Language: ${opts.language}` : '',
    '',
    '<<<PREFIX>>>',
    opts.prefix.slice(-4000),
    '<<<CURSOR>>>',
    opts.suffix?.slice(0, 1000) ?? '',
    '<<<END>>>',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Strip markdown fences if the model ignored instructions. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:\w+)?\n?([\s\S]*?)```$/);
  if (m) return (m[1] ?? '').replace(/\n$/, '');
  return trimmed;
}
