import type { AIContextPayload } from '../../../packages/protocol/src/ai';
import { truncateContent, MAX_FILE_CHARS, MAX_OPEN_PREVIEW } from '../../../packages/ai-core/src/context';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useEditorStore } from '../../stores/editorStore';
import { useGitStore } from '../../stores/gitStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { requireApi } from '../../services/platform';

export interface BuildContextOptions {
  /** Explicit file paths attached as chips in chat (full content preferred) */
  attachedPaths?: string[];
  /** When true, do not auto-include the active editor file */
  omitActiveFile?: boolean;
}

/**
 * Build bounded AI context from current IDE state (renderer side).
 * Never sends the entire repository.
 */
export function buildAIContext(opts?: BuildContextOptions): AIContextPayload {
  const privacy = useSettingsStore.getState().settings.privacy;
  if (!privacy.shareCodeWithAI) {
    const root = useWorkspaceStore.getState().rootPath;
    return {
      workspaceRoot: root ?? undefined,
      workspaceName: useWorkspaceStore.getState().name ?? undefined,
      gitBranch: useGitStore.getState().branch ?? undefined,
    };
  }

  const root = useWorkspaceStore.getState().rootPath;
  const name = useWorkspaceStore.getState().name;
  const active = useEditorStore.getState().getActiveTab();
  const tabs = useEditorStore.getState().tabs;
  const git = useGitStore.getState();

  const ctx: AIContextPayload = {
    workspaceRoot: root ?? undefined,
    workspaceName: name ?? undefined,
    gitBranch: git.branch ?? undefined,
  };

  if (git.isRepo) {
    const parts: string[] = [];
    if (git.staged.length) parts.push(`Staged: ${git.staged.length}`);
    if (git.unstaged.length) parts.push(`Unstaged: ${git.unstaged.length}`);
    if (git.conflicted.length) parts.push(`Conflicts: ${git.conflicted.length}`);
    if (git.ahead || git.behind) parts.push(`Ahead ${git.ahead} / Behind ${git.behind}`);
    if (parts.length) ctx.gitSummary = parts.join(' · ');
  }

  const includeActive =
    !opts?.omitActiveFile && active && !active.path.startsWith('untitled:');
  if (includeActive && active) {
    const { text, truncated } = truncateContent(active.content, MAX_FILE_CHARS);
    ctx.activeFile = {
      path: active.path,
      language: active.language,
      content: text,
      truncated,
    };
  }

  // Attached chips + other open tabs (previews)
  const attached = (opts?.attachedPaths ?? []).filter(
    (p) => p && !p.startsWith('untitled:'),
  );
  const attachedSet = new Set(attached.map((p) => p.toLowerCase()));

  const openFromTabs = tabs
    .filter((t) => !t.path.startsWith('untitled:'))
    .filter((t) => t.id !== active?.id || !includeActive)
    .filter((t) => !attachedSet.has(t.path.toLowerCase()))
    .slice(0, 6)
    .map((t) => ({
      path: t.path,
      language: t.language,
      preview: truncateContent(t.content, MAX_OPEN_PREVIEW).text,
    }));

  // Attached files get larger previews (user explicitly added them)
  const attachedEntries = attached.map((filePath) => {
    const tab = tabs.find((t) => t.path.toLowerCase() === filePath.toLowerCase());
    if (tab) {
      return {
        path: tab.path,
        language: tab.language,
        preview: truncateContent(tab.content, MAX_FILE_CHARS).text,
      };
    }
    return {
      path: filePath,
      language: 'plaintext',
      preview: undefined as string | undefined,
    };
  });

  ctx.openFiles = [...attachedEntries, ...openFromTabs].slice(0, 10);

  return ctx;
}

/**
 * Async context build that loads attached files from disk if not open in editor.
 */
export async function buildAIContextAsync(
  opts?: BuildContextOptions,
): Promise<AIContextPayload> {
  const ctx = buildAIContext(opts);
  if (!opts?.attachedPaths?.length) return ctx;

  const tabs = useEditorStore.getState().tabs;
  const openFiles = [...(ctx.openFiles ?? [])];
  const api = requireApi();

  for (let i = 0; i < openFiles.length; i++) {
    const f = openFiles[i]!;
    if (f.preview) continue;
    const open = tabs.some((t) => t.path.toLowerCase() === f.path.toLowerCase());
    if (open) continue;
    try {
      const result = await api.readFile({ path: f.path });
      const content = result?.content ?? '';
      if (content) {
        openFiles[i] = {
          ...f,
          preview: truncateContent(content, MAX_FILE_CHARS).text,
        };
      }
    } catch {
      // leave without preview
    }
  }

  ctx.openFiles = openFiles;
  return ctx;
}
