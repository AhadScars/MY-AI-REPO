import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  AIChatStartRequest,
  AIStreamChunkEvent,
} from '../../../packages/protocol/src/ai.js';
import type { ChatMessage } from '../../../packages/ai-core/src/provider.js';
import {
  formatContextForPrompt,
  type AIContext,
} from '../../../packages/ai-core/src/context.js';
import { PermissionManager } from '../../../packages/ai-core/src/permissions.js';
import type { AITool, ToolResult } from '../../../packages/ai-core/src/tools.js';
import {
  parseFileEditsFromMarkdown,
  buildInlineEditPrompt,
  buildAutocompletePrompt,
  stripCodeFences,
} from '../../../packages/ai-core/src/edit-parser.js';
import { getProvider } from './providers/registry.js';
import type { StreamChatParams } from './providers/types.js';
import type { CredentialStore } from './credential-store.js';
import type { AICredentialProviderId } from '../../../packages/protocol/src/ai.js';
import type { EditProposalStore } from './edit-proposal-store.js';
import fs from 'node:fs/promises';
import path from 'node:path';

interface ActiveStream {
  id: string;
  abort: AbortController;
  agentMode?: boolean;
  autoApplyEdits?: boolean;
  maxAgentSteps: number;
  workspaceRoot?: string;
  /** Active editor file — used when model returns a code fence without path */
  activeFilePath?: string;
  accumulated: string;
  /** True if any write/str_replace tool succeeded this run */
  didEdit: boolean;
}

const DEFAULT_MAX_AGENT_STEPS = 12;

/**
 * Coordinates provider streaming, context injection, agent edits, and tools.
 */
export class ChatOrchestrator {
  private streams = new Map<string, ActiveStream>();
  private permissions = new PermissionManager();
  private tools: AITool[] = [];
  private editStore: EditProposalStore | null = null;
  /** Latest agent auto-apply flag (tools read this during a run) */
  private autoApplyEdits = false;

  constructor(
    private credentials: CredentialStore,
    private getWindow: () => BrowserWindow | null,
  ) {}

  setTools(tools: AITool[]): void {
    this.tools = tools;
  }

  setEditStore(store: EditProposalStore): void {
    this.editStore = store;
  }

  /** Used by tools to decide propose vs write-to-disk */
  shouldAutoApply(): boolean {
    return this.autoApplyEdits;
  }

  getPermissionManager(): PermissionManager {
    return this.permissions;
  }

  listTools() {
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      permissionLevel: t.permission.level,
    }));
  }

  stop(streamId: string): void {
    const s = this.streams.get(streamId);
    if (s) {
      s.abort.abort();
      this.streams.delete(streamId);
    }
  }

  stopAll(): void {
    for (const id of [...this.streams.keys()]) this.stop(id);
  }

  private emit(event: AIStreamChunkEvent): void {
    this.getWindow()?.webContents.send(IpcChannels.EVENT_AI_STREAM, event);
  }

  private resolveApiKey(providerId: string): string | undefined {
    return this.credentials.get(providerId as AICredentialProviderId) ?? undefined;
  }

  private buildMessages(request: AIChatStartRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];

    const ctx: AIContext = {};
    if (request.context?.workspaceRoot) {
      ctx.workspace = {
        rootPath: request.context.workspaceRoot,
        name: request.context.workspaceName ?? 'workspace',
      };
    }
    if (request.context?.activeFile) {
      ctx.files = [
        {
          path: request.context.activeFile.path,
          language: request.context.activeFile.language,
          content: request.context.activeFile.content,
        },
      ];
    }
    if (request.context?.selection) {
      ctx.selection = request.context.selection;
    }
    if (request.context?.gitBranch) ctx.gitBranch = request.context.gitBranch;
    if (request.context?.gitSummary) ctx.gitSummary = request.context.gitSummary;
    if (request.context?.diagnosticsSummary) {
      ctx.diagnostics = [
        {
          path: '',
          message: request.context.diagnosticsSummary,
          severity: 'info',
          line: 0,
        },
      ];
    }
    if (request.context?.openFiles?.length) {
      const previews = request.context.openFiles
        .filter((f) => f.preview)
        .map((f) => ({
          path: f.path,
          language: f.language,
          content: f.preview,
        }));
      ctx.files = [...(ctx.files ?? []), ...previews];
    }

    let system = formatContextForPrompt(ctx);
    if (request.agentMode) {
      const auto = request.autoApplyEdits !== false;
      const activeHint = request.context?.activeFile?.path
        ? `\nThe user has this file open (PRIMARY TARGET): ${request.context.activeFile.path}`
        : '';
      system += `

## Agent mode (you MUST edit files with tools)
You are Cursor-like coding agent in Terminal-IDE. The user wants code CHANGED, not just explained.
${activeHint}

### Tools (use them — do not only talk)
- **str_replace** (PREFERRED): change part of a file. old_string must match exactly (unique).
- **read_file**: read before editing if you are unsure of exact text.
- **write_file**: only for new files or full rewrites.
- **list_directory**, **search_files**, **semantic_search**: explore.

### Required workflow for "change / fix / add / update / rename" requests
1. Identify the target file (open/attached file first).
2. Call **str_replace** or **write_file** immediately — do not stop at a plan.
3. If str_replace fails, read_file then retry with exact text.
4. Short summary after edits.

${auto
  ? 'Edits apply to disk automatically when tools succeed.'
  : 'Edits go to the Diff Review panel — still call tools.'}

Fallback if tools unavailable: full-file fences:
\`\`\`typescript path=relative/or/absolute/file.ext
// complete new file content
\`\`\`

Never invent secrets. Stay in the workspace. Prefer str_replace over rewriting whole files.`;
    }
    messages.push({ role: 'system', content: system });

    for (const m of request.messages) {
      if (m.role === 'system') {
        // merge extra system notes
        messages[0] = {
          role: 'system',
          content: (messages[0]?.content ?? '') + '\n\n' + m.content,
        };
      } else {
        messages.push({
          role: m.role,
          content: m.content,
          name: m.name,
          toolCallId: m.toolCallId,
        });
      }
    }

    return messages;
  }

  async start(request: AIChatStartRequest): Promise<string> {
    const provider = getProvider(request.providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${request.providerId}`);
    }

    const streamId = randomUUID();
    const abort = new AbortController();
    const agentMode = Boolean(request.agentMode);
    const autoApplyEdits = agentMode && request.autoApplyEdits !== false;
    this.autoApplyEdits = autoApplyEdits;
    this.streams.set(streamId, {
      id: streamId,
      abort,
      agentMode,
      autoApplyEdits,
      maxAgentSteps: Math.max(1, Math.min(request.maxAgentSteps ?? DEFAULT_MAX_AGENT_STEPS, 24)),
      workspaceRoot: request.context?.workspaceRoot,
      activeFilePath: request.context?.activeFile?.path,
      accumulated: '',
      didEdit: false,
    });

    if (agentMode) {
      // Allow edit tools for this session in agent mode
      this.permissions.applyDecision('write_file', 'allow-session');
      this.permissions.applyDecision('propose_edit', 'allow-session');
      this.permissions.applyDecision('str_replace', 'allow-session');
    }

    const apiKey = this.resolveApiKey(request.providerId);
    if (!provider.isLocal && !apiKey && request.providerId !== 'ollama') {
      this.emit({
        streamId,
        type: 'error',
        error: `No API key for ${provider.name}. Add it in Settings → AI.`,
      });
      this.streams.delete(streamId);
      return streamId;
    }

    const messages = this.buildMessages(request);

    void this.runStream(streamId, provider.id, {
      messages,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      apiKey,
      baseUrl: request.baseUrl,
      signal: abort.signal,
    });

    return streamId;
  }

  private toolDefsForAgent(): StreamChatParams['tools'] {
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  /**
   * Stream one (or many, in agent mode) provider turns.
   * Agent mode: tool_calls → execute tools → feed results back → repeat.
   */
  private async runStream(
    streamId: string,
    providerId: string,
    params: StreamChatParams,
  ): Promise<void> {
    const provider = getProvider(providerId);
    if (!provider) return;
    const active = this.streams.get(streamId);
    if (!active) return;

    const agentMode = Boolean(active.agentMode);
    const maxSteps = agentMode ? active.maxAgentSteps : 1;
    let messages: ChatMessage[] = [...params.messages];
    let lastUsage: AIStreamChunkEvent['usage'] | undefined;

    try {
      for (let step = 0; step < maxSteps; step++) {
        if (!this.streams.has(streamId)) return;

        const pendingToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
        let stepText = '';
        let hadError = false;

        const streamParams: StreamChatParams = {
          ...params,
          messages,
          tools: agentMode && this.tools.length > 0 ? this.toolDefsForAgent() : undefined,
        };

        for await (const chunk of provider.streamChat(streamParams)) {
          if (!this.streams.has(streamId)) return;

          if (chunk.type === 'text' && chunk.content) {
            stepText += chunk.content;
            active.accumulated += chunk.content;
            this.emit({ streamId, type: 'text', content: chunk.content });
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            pendingToolCalls.push(chunk.toolCall);
            this.emit({
              streamId,
              type: 'tool_call',
              toolCall: chunk.toolCall,
            });
          } else if (chunk.type === 'error') {
            this.emit({
              streamId,
              type: 'error',
              error: chunk.error ?? 'Unknown error',
            });
            hadError = true;
            break;
          } else if (chunk.type === 'done') {
            if (chunk.usage) {
              lastUsage = chunk.usage;
              this.emit({ streamId, type: 'usage', usage: chunk.usage });
            }
            break;
          }
        }

        if (hadError) return;

        // No tools → final answer (or markdown-fence fallback for agents)
        if (pendingToolCalls.length === 0) {
          if (agentMode && active.accumulated && this.editStore) {
            const n = await this.harvestEditsFromText(
              active.accumulated,
              active.workspaceRoot,
              active.activeFilePath,
              active.autoApplyEdits,
            );
            if (n > 0) active.didEdit = true;
            if (active.autoApplyEdits && n > 0) {
              // harvest may already have applied; clear any leftovers
              await this.autoApplyPendingEdits();
            }
            if (!active.didEdit && n === 0) {
              this.emit({
                streamId,
                type: 'text',
                content:
                  '\n\nNo files changed. With Agent on, ask for a specific edit in the open file.\n',
              });
            } else if (active.didEdit || n > 0) {
              this.emit({
                streamId,
                type: 'text',
                content: '\n\nFiles updated.\n',
              });
            }
          }
          this.emit({ streamId, type: 'done', usage: lastUsage });
          return;
        }

        // Execute tools and continue the agent loop
        const toolResults: Array<{
          id: string;
          name: string;
          output: string;
          success: boolean;
        }> = [];

        for (const tc of pendingToolCalls) {
          if (!this.streams.has(streamId)) return;
          const result = await this.executeTool(streamId, tc, active.autoApplyEdits);
          toolResults.push(result);
          if (
            result.success &&
            (result.name === 'str_replace' ||
              result.name === 'write_file' ||
              result.name === 'propose_edit')
          ) {
            active.didEdit = true;
          }
        }

        messages = [
          ...messages,
          {
            role: 'assistant',
            content: stepText || '',
            toolCalls: pendingToolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          },
          ...toolResults.map((r) => ({
            role: 'tool' as const,
            content: r.output,
            toolCallId: r.id,
            name: r.name,
          })),
        ];

        // Last step still had tools — stop gracefully
        if (step === maxSteps - 1) {
          this.emit({
            streamId,
            type: 'text',
            content:
              '\n\n_(Agent stopped: max tool steps reached. Ask again to continue.)_\n',
          });
          if (agentMode && this.editStore && active.autoApplyEdits) {
            await this.autoApplyPendingEdits();
          }
          this.emit({ streamId, type: 'done', usage: lastUsage });
          return;
        }
      }

      this.emit({ streamId, type: 'done', usage: lastUsage });
    } catch (err) {
      this.emit({
        streamId,
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.streams.delete(streamId);
    }
  }

  private async autoApplyPendingEdits(): Promise<void> {
    if (!this.editStore) return;
    const pending = this.editStore.listPending();
    if (pending.length === 0) return;
    await this.editStore.applyAll(
      pending.map((p) => p.id),
      true,
    );
  }

  /**
   * Extract file edits from markdown fences. If none have paths but we have
   * an active file and exactly one substantial fence, apply that fence to it.
   * @returns number of proposals created
   */
  private async harvestEditsFromText(
    text: string,
    workspaceRoot?: string,
    activeFilePath?: string,
    autoApply?: boolean,
  ): Promise<number> {
    if (!this.editStore) return 0;
    let parsed = parseFileEditsFromMarkdown(text);

    // Fallback: single code fence → open/active file (Cursor-like)
    if (parsed.length === 0 && activeFilePath) {
      const fences = [...text.matchAll(/```[^\n`]*\n([\s\S]*?)```/g)]
        .map((m) => (m[1] ?? '').replace(/\n$/, ''))
        .filter((body) => body.trim().length > 20 && !/^(bash|sh|shell|text|json)\s*$/i.test(body.slice(0, 20)));
      if (fences.length === 1) {
        parsed = [{ path: activeFilePath, content: fences[0]! }];
      } else if (fences.length > 1) {
        // Prefer the longest fence as the full-file rewrite
        const longest = fences.reduce((a, b) => (a.length >= b.length ? a : b));
        if (longest.length > 40) {
          parsed = [{ path: activeFilePath, content: longest }];
        }
      }
    }

    if (parsed.length === 0) return 0;

    const batch: Array<{
      path: string;
      originalContent?: string;
      proposedContent: string;
      description?: string;
    }> = [];

    for (const edit of parsed) {
      let abs = edit.path;
      if (!path.isAbsolute(abs) && workspaceRoot) {
        abs = path.join(workspaceRoot, edit.path);
      }
      abs = path.resolve(abs);
      let original = '';
      try {
        original = await fs.readFile(abs, 'utf-8');
      } catch {
        original = '';
      }
      if (original === edit.content) continue;
      batch.push({
        path: abs,
        originalContent: original,
        proposedContent: edit.content,
        description: 'From AI agent response',
      });
    }

    if (batch.length === 0) return 0;

    if (autoApply) {
      await this.editStore.proposeAndApply(batch, 'chat');
    } else {
      this.editStore.propose(batch, 'chat');
    }
    return batch.length;
  }

  private async executeTool(
    streamId: string,
    toolCall: { id: string; name: string; arguments: string },
    autoApply?: boolean,
  ): Promise<{ id: string; name: string; output: string; success: boolean }> {
    const tool = this.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      const output = `Unknown tool: ${toolCall.name}`;
      this.emit({
        streamId,
        type: 'tool_result',
        toolResult: { id: toolCall.id, name: toolCall.name, output, success: false },
      });
      return { id: toolCall.id, name: toolCall.name, output, success: false };
    }

    const allowed = this.permissions.evaluate(tool.name, tool.permission.level);
    if (allowed === false) {
      const output = 'Permission denied';
      this.emit({
        streamId,
        type: 'tool_result',
        toolResult: { id: toolCall.id, name: tool.name, output, success: false },
      });
      return { id: toolCall.id, name: tool.name, output, success: false };
    }
    if (allowed === null) {
      const output = `Tool "${tool.name}" requires confirmation. Enable Agent mode in the AI panel.`;
      this.emit({
        streamId,
        type: 'tool_result',
        toolResult: { id: toolCall.id, name: tool.name, output, success: false },
      });
      return { id: toolCall.id, name: tool.name, output, success: false };
    }

    let input: unknown = {};
    try {
      input = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
    } catch {
      input = { raw: toolCall.arguments };
    }

    let result: ToolResult = await tool.execute(input);

    // Auto-apply file proposals when agent is allowed to write disk
    if (
      autoApply &&
      this.editStore &&
      result.success &&
      (tool.name === 'write_file' ||
        tool.name === 'propose_edit' ||
        tool.name === 'str_replace')
    ) {
      const data = result.data as
        | { proposalId?: string; path?: string; applied?: boolean }
        | undefined;
      if (data?.applied) {
        // already written by tool (proposeAndApply)
      } else if (data?.proposalId) {
        const applied = await this.editStore.apply(data.proposalId, true);
        if (applied.ok) {
          result = {
            success: true,
            output: `Applied edit to ${data.path ?? 'file'} (written to disk).`,
            data: { ...data, applied: true },
          };
        } else {
          result = {
            success: false,
            error: applied.error ?? 'Failed to apply edit',
            output: applied.error ?? 'Failed to apply edit',
          };
        }
      }
    }

    const output = result.output ?? result.error ?? '';
    this.emit({
      streamId,
      type: 'tool_result',
      toolResult: {
        id: toolCall.id,
        name: tool.name,
        output,
        success: result.success,
      },
    });
    return { id: toolCall.id, name: tool.name, output, success: result.success };
  }

  async complete(request: {
    providerId: string;
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
  }) {
    const provider = getProvider(request.providerId);
    if (!provider) throw new Error(`Unknown provider: ${request.providerId}`);
    const apiKey = this.resolveApiKey(request.providerId);
    return provider.complete({
      prompt: request.prompt,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      apiKey,
      baseUrl: request.baseUrl,
    });
  }

  async inlineEdit(request: {
    providerId: string;
    model: string;
    instruction: string;
    code: string;
    language?: string;
    path?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
  }) {
    const prompt = buildInlineEditPrompt({
      instruction: request.instruction,
      code: request.code,
      language: request.language,
      path: request.path,
    });
    const result = await this.complete({
      providerId: request.providerId,
      model: request.model,
      prompt,
      temperature: request.temperature ?? 0.1,
      maxTokens: request.maxTokens ?? 4096,
      baseUrl: request.baseUrl,
    });
    return {
      code: stripCodeFences(result.text),
      usage: result.usage,
    };
  }

  async autocomplete(request: {
    providerId: string;
    model: string;
    prefix: string;
    suffix?: string;
    language?: string;
    path?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
  }) {
    const prompt = buildAutocompletePrompt({
      prefix: request.prefix,
      suffix: request.suffix,
      language: request.language,
      path: request.path,
    });
    const result = await this.complete({
      providerId: request.providerId,
      model: request.model,
      prompt,
      temperature: request.temperature ?? 0,
      maxTokens: request.maxTokens ?? 128,
      baseUrl: request.baseUrl,
    });
    let suggestion = stripCodeFences(result.text);
    // Avoid echoing the whole prefix
    if (suggestion.startsWith(request.prefix.slice(-40))) {
      suggestion = suggestion.slice(request.prefix.slice(-40).length);
    }
    return { suggestion };
  }

  async testConnection(providerId: string, baseUrl?: string): Promise<{ ok: boolean; message: string }> {
    const provider = getProvider(providerId);
    if (!provider) return { ok: false, message: 'Unknown provider' };
    const apiKey = this.resolveApiKey(providerId);
    try {
      if (provider.listModels) {
        const models = await provider.listModels(apiKey, baseUrl);
        if (models.length > 0) {
          return { ok: true, message: `Connected — ${models.length} models visible` };
        }
      }
      // Fallback: tiny completion
      const result = await provider.complete({
        prompt: 'Reply with OK',
        model:
          providerId === 'anthropic'
            ? 'claude-haiku-4-20250514'
            : providerId === 'gemini'
              ? 'gemini-2.0-flash'
              : providerId === 'ollama'
                ? 'llama3.2'
                : 'gpt-4o-mini',
        maxTokens: 8,
        temperature: 0,
        apiKey,
        baseUrl,
      });
      return {
        ok: Boolean(result.text),
        message: result.text ? 'Connected' : 'Empty response',
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
