/**
 * Structured AI context — do not dump the entire repository.
 */

export interface AIContext {
  workspace?: {
    rootPath: string;
    name: string;
  };
  files?: Array<{
    path: string;
    language: string;
    content?: string;
    startLine?: number;
    endLine?: number;
  }>;
  selection?: {
    path: string;
    text: string;
    startLine: number;
    endLine: number;
  };
  diagnostics?: Array<{
    path: string;
    message: string;
    severity: string;
    line: number;
  }>;
  terminalOutput?: string;
  gitDiff?: string;
  gitBranch?: string;
  gitSummary?: string;
}

const MAX_FILE_CHARS = 24_000;
const MAX_SELECTION_CHARS = 8_000;
const MAX_OPEN_PREVIEW = 2_000;

/** Truncate long content with a clear marker. */
export function truncateContent(content: string, max = MAX_FILE_CHARS): { text: string; truncated: boolean } {
  if (content.length <= max) return { text: content, truncated: false };
  return {
    text: content.slice(0, max) + `\n\n/* … truncated ${content.length - max} chars … */\n`,
    truncated: true,
  };
}

/**
 * Build a system-prompt context block from structured context.
 * Keeps payloads bounded and readable.
 */
export function formatContextForPrompt(ctx: AIContext): string {
  const parts: string[] = [];
  parts.push('You are Terminal - IDE, an expert coding assistant embedded in a desktop IDE.');
  parts.push('Be concise, accurate, and cite file paths when referring to code.');
  parts.push('Prefer targeted edits over rewriting entire files.');
  parts.push('');

  if (ctx.workspace) {
    parts.push(`## Workspace`);
    parts.push(`- Name: ${ctx.workspace.name}`);
    parts.push(`- Root: ${ctx.workspace.rootPath}`);
    parts.push('');
  }

  if (ctx.gitBranch || ctx.gitSummary) {
    parts.push(`## Git`);
    if (ctx.gitBranch) parts.push(`- Branch: ${ctx.gitBranch}`);
    if (ctx.gitSummary) parts.push(ctx.gitSummary);
    parts.push('');
  }

  if (ctx.selection?.text) {
    const { text, truncated } = truncateContent(ctx.selection.text, MAX_SELECTION_CHARS);
    parts.push(`## Current selection (${ctx.selection.path}:${ctx.selection.startLine}-${ctx.selection.endLine})${truncated ? ' [truncated]' : ''}`);
    parts.push('```');
    parts.push(text);
    parts.push('```');
    parts.push('');
  }

  if (ctx.files?.length) {
    for (const file of ctx.files.slice(0, 5)) {
      if (!file.content) continue;
      const { text, truncated } = truncateContent(file.content, MAX_FILE_CHARS);
      parts.push(`## File: ${file.path} (${file.language})${truncated ? ' [truncated]' : ''}`);
      parts.push('```' + (file.language === 'plaintext' ? '' : file.language));
      parts.push(text);
      parts.push('```');
      parts.push('');
    }
  }

  if (ctx.diagnostics?.length) {
    parts.push(`## Diagnostics`);
    for (const d of ctx.diagnostics.slice(0, 20)) {
      parts.push(`- [${d.severity}] ${d.path}:${d.line} ${d.message}`);
    }
    parts.push('');
  }

  if (ctx.gitDiff) {
    const { text, truncated } = truncateContent(ctx.gitDiff, 12_000);
    parts.push(`## Git diff${truncated ? ' [truncated]' : ''}`);
    parts.push('```diff');
    parts.push(text);
    parts.push('```');
    parts.push('');
  }

  if (ctx.terminalOutput) {
    const { text, truncated } = truncateContent(ctx.terminalOutput, 4_000);
    parts.push(`## Terminal output${truncated ? ' [truncated]' : ''}`);
    parts.push('```');
    parts.push(text);
    parts.push('```');
  }

  return parts.join('\n');
}

export { MAX_FILE_CHARS, MAX_SELECTION_CHARS, MAX_OPEN_PREVIEW };
