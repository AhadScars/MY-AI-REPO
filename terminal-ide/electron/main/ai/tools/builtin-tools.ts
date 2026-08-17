import fs from 'node:fs/promises';
import path from 'node:path';
import type { AITool, ToolResult } from '../../../../packages/ai-core/src/tools.js';
import type { EditProposalStore } from '../edit-proposal-store.js';
import type { IndexService } from '../../indexing/index-service.js';

function resolveUnderRoot(root: string | undefined, target: string): string {
  const resolved = path.resolve(target);
  if (!root) return resolved;
  const rootResolved = path.resolve(root);
  const rel = path.relative(rootResolved, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path is outside the workspace');
  }
  return resolved;
}

export function createBuiltinTools(
  getWorkspaceRoot: () => string | undefined,
  editStore?: EditProposalStore,
  indexService?: IndexService,
  getAutoApply?: () => boolean,
): AITool[] {
  const read_file: AITool = {
    name: 'read_file',
    description: 'Read a text file from the workspace by absolute or workspace-relative path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        maxChars: { type: 'number' },
      },
      required: ['path'],
    },
    permission: { level: 'safe', description: 'Read file contents' },
    async execute(input: unknown): Promise<ToolResult> {
      try {
        const { path: filePath, maxChars = 40_000 } = input as { path: string; maxChars?: number };
        const root = getWorkspaceRoot();
        const abs = path.isAbsolute(filePath)
          ? resolveUnderRoot(root, filePath)
          : resolveUnderRoot(root, path.join(root ?? process.cwd(), filePath));
        const content = await fs.readFile(abs, 'utf-8');
        const truncated = content.length > maxChars;
        return {
          success: true,
          output: truncated ? content.slice(0, maxChars) + '\n/* truncated */' : content,
          data: { path: abs, truncated },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const list_directory: AITool = {
    name: 'list_directory',
    description: 'List files and folders in a directory under the workspace.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
    permission: { level: 'safe', description: 'List directory' },
    async execute(input: unknown): Promise<ToolResult> {
      try {
        const { path: dirPath } = input as { path: string };
        const root = getWorkspaceRoot();
        const abs = path.isAbsolute(dirPath)
          ? resolveUnderRoot(root, dirPath)
          : resolveUnderRoot(root, path.join(root ?? process.cwd(), dirPath));
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const lines = entries
          .filter((e) => !e.name.startsWith('.'))
          .slice(0, 200)
          .map((e) => `${e.isDirectory() ? 'dir' : 'file'}\t${e.name}`);
        return { success: true, output: lines.join('\n'), data: { path: abs, count: lines.length } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const write_file: AITool = {
    name: 'write_file',
    description:
      'Write or update a full text file in the workspace. Pass complete file content. Prefer this to implement code changes.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    permission: { level: 'confirm', description: 'Propose file write' },
    async execute(input: unknown): Promise<ToolResult> {
      try {
        const { path: filePath, content, description } = input as {
          path: string;
          content: string;
          description?: string;
        };
        const root = getWorkspaceRoot();
        if (!root) return { success: false, error: 'No workspace open' };
        const abs = path.isAbsolute(filePath)
          ? resolveUnderRoot(root, filePath)
          : resolveUnderRoot(root, path.join(root, filePath));
        let original = '';
        try {
          original = await fs.readFile(abs, 'utf-8');
        } catch {
          original = '';
        }
        if (editStore) {
          if (getAutoApply?.()) {
            const r = await editStore.proposeAndApply(
              [{ path: abs, originalContent: original, proposedContent: content, description }],
              'agent',
            );
            if (r.applied > 0) {
              return {
                success: true,
                output: `Wrote ${abs} to disk.`,
                data: { path: abs, applied: true },
              };
            }
            return { success: false, error: 'Failed to write file' };
          }
          const proposals = editStore.propose(
            [{ path: abs, originalContent: original, proposedContent: content, description }],
            'agent',
          );
          return {
            success: true,
            output: `Queued file write for ${abs} (id=${proposals[0]?.id}).`,
            data: { path: abs, proposalId: proposals[0]?.id },
          };
        }
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, 'utf-8');
        return { success: true, output: `Wrote ${abs}`, data: { path: abs } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const propose_edit: AITool = {
    name: 'propose_edit',
    description:
      'Create or update a file with full content. Same as write_file; use for multi-step edits.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    permission: { level: 'safe', description: 'Stage edit proposal (no disk write)' },
    async execute(input: unknown): Promise<ToolResult> {
      if (!editStore) return { success: false, error: 'Edit store unavailable' };
      try {
        const { path: filePath, content, description } = input as {
          path: string;
          content: string;
          description?: string;
        };
        const root = getWorkspaceRoot();
        if (!root) return { success: false, error: 'No workspace open' };
        const abs = path.isAbsolute(filePath)
          ? resolveUnderRoot(root, filePath)
          : resolveUnderRoot(root, path.join(root, filePath));
        let original = '';
        try {
          original = await fs.readFile(abs, 'utf-8');
        } catch {
          original = '';
        }
        if (getAutoApply?.()) {
          const r = await editStore.proposeAndApply(
            [{ path: abs, originalContent: original, proposedContent: content, description }],
            'agent',
          );
          if (r.applied > 0) {
            return {
              success: true,
              output: `Wrote ${abs} to disk.`,
              data: { path: abs, applied: true },
            };
          }
          return { success: false, error: 'Failed to write file' };
        }
        const proposals = editStore.propose(
          [{ path: abs, originalContent: original, proposedContent: content, description }],
          'agent',
        );
        return {
          success: true,
          output: `Queued proposal ${proposals[0]?.id} for ${abs}`,
          data: { proposalId: proposals[0]?.id, path: abs },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  /**
   * Cursor-style partial edit: replace a unique string in a file.
   * Models prefer this over rewriting entire files.
   */
  const str_replace: AITool = {
    name: 'str_replace',
    description:
      'Edit a file by replacing an exact string with new text. Prefer this for most changes. old_string must match uniquely in the file (include enough context).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative or absolute file path' },
        old_string: { type: 'string', description: 'Exact text to find (must be unique)' },
        new_string: { type: 'string', description: 'Replacement text' },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace every occurrence (default false)',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    permission: { level: 'confirm', description: 'Edit file via search-replace' },
    async execute(input: unknown): Promise<ToolResult> {
      try {
        const {
          path: filePath,
          old_string: oldString,
          new_string: newString,
          replace_all: replaceAll,
        } = input as {
          path: string;
          old_string: string;
          new_string: string;
          replace_all?: boolean;
        };
        if (!oldString && oldString !== '') {
          return { success: false, error: 'old_string is required' };
        }
        if (oldString === newString) {
          return { success: false, error: 'old_string and new_string are identical' };
        }
        const root = getWorkspaceRoot();
        if (!root) return { success: false, error: 'No workspace open' };
        const abs = path.isAbsolute(filePath)
          ? resolveUnderRoot(root, filePath)
          : resolveUnderRoot(root, path.join(root, filePath));
        let original = '';
        try {
          original = await fs.readFile(abs, 'utf-8');
        } catch {
          return { success: false, error: `File not found: ${abs}` };
        }
        const count = original.split(oldString).length - 1;
        if (count === 0) {
          return {
            success: false,
            error:
              'old_string not found in file. Re-read the file with read_file and use exact text.',
          };
        }
        if (count > 1 && !replaceAll) {
          return {
            success: false,
            error: `old_string matches ${count} times — include more context so it is unique, or set replace_all=true.`,
          };
        }
        const next = replaceAll
          ? original.split(oldString).join(newString)
          : original.replace(oldString, newString);

        if (editStore && getAutoApply?.()) {
          const r = await editStore.proposeAndApply(
            [
              {
                path: abs,
                originalContent: original,
                proposedContent: next,
                description: 'str_replace',
              },
            ],
            'agent',
          );
          if (r.applied > 0) {
            return {
              success: true,
              output: `Updated ${abs} (${replaceAll ? count : 1} replacement(s)).`,
              data: { path: abs, applied: true },
            };
          }
          return { success: false, error: 'Failed to write file' };
        }
        if (editStore) {
          const proposals = editStore.propose(
            [
              {
                path: abs,
                originalContent: original,
                proposedContent: next,
                description: 'str_replace',
              },
            ],
            'agent',
          );
          return {
            success: true,
            output: `Queued edit for ${abs} (id=${proposals[0]?.id}).`,
            data: { path: abs, proposalId: proposals[0]?.id },
          };
        }
        await fs.writeFile(abs, next, 'utf-8');
        return { success: true, output: `Updated ${abs}`, data: { path: abs } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const semantic_search: AITool = {
    name: 'semantic_search',
    description: 'Search the workspace index for code related to a natural-language query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    permission: { level: 'safe', description: 'Search indexed code' },
    async execute(input: unknown): Promise<ToolResult> {
      if (!indexService) return { success: false, error: 'Index not available' };
      const { query, limit = 10 } = input as { query: string; limit?: number };
      const results = indexService.search(query, limit);
      if (results.length === 0) {
        return { success: true, output: 'No results. Index may be empty — open a folder and run indexing.' };
      }
      const lines = results.map(
        (r, i) =>
          `${i + 1}. [${r.matchType} ${r.score.toFixed(1)}] ${r.chunk.path}:${r.chunk.startLine}-${r.chunk.endLine}\n${r.chunk.content.slice(0, 300)}`,
      );
      return { success: true, output: lines.join('\n\n') };
    },
  };

  const search_files: AITool = {
    name: 'search_files',
    description: 'Lexical search over the codebase index (filename + content).',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
    permission: { level: 'safe', description: 'Lexical code search' },
    async execute(input: unknown): Promise<ToolResult> {
      if (!indexService) return { success: false, error: 'Index not available' };
      const { query, limit = 15 } = input as { query: string; limit?: number };
      const results = indexService.searchLexical(query, limit);
      const lines = results.map(
        (r) => `${r.chunk.path}:${r.chunk.startLine} (${r.score.toFixed(0)})`,
      );
      return { success: true, output: lines.join('\n') || 'No matches' };
    },
  };

  return [
    read_file,
    list_directory,
    str_replace,
    write_file,
    propose_edit,
    semantic_search,
    search_files,
  ];
}
