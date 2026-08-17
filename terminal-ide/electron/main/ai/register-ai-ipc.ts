import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  AIAutocompleteRequest,
  AIChatStartRequest,
  AIChatStopRequest,
  AICompleteRequest,
  AICredentialProviderId,
  AIDeleteCredentialRequest,
  AIHasCredentialRequest,
  AIInlineEditRequest,
  AIListModelsRequest,
  AIPermissionDecisionRequest,
  AISetCredentialRequest,
} from '../../../packages/protocol/src/ai.js';
import type {
  ApplyAllEditsRequest,
  ApplyEditRequest,
  ProposeEditsRequest,
  RejectEditRequest,
} from '../../../packages/protocol/src/edits.js';
import { CredentialStore } from './credential-store.js';
import { ChatOrchestrator } from './chat-orchestrator.js';
import { EditProposalStore } from './edit-proposal-store.js';
import { createBuiltinTools } from './tools/builtin-tools.js';
import { getProvider, listProviders } from './providers/registry.js';
import { IndexService } from '../indexing/index-service.js';

export interface AiIpcHandles {
  credentials: CredentialStore;
  orchestrator: ChatOrchestrator;
  editStore: EditProposalStore;
  indexService: IndexService;
}

export async function registerAiIpc(
  getWindow: () => BrowserWindow | null,
  getWorkspaceRoot: () => string | undefined,
): Promise<AiIpcHandles> {
  const credentials = new CredentialStore();
  await credentials.init();

  const editStore = new EditProposalStore(getWindow);
  const indexService = new IndexService(getWindow);
  const orchestrator = new ChatOrchestrator(credentials, getWindow);
  orchestrator.setEditStore(editStore);
  orchestrator.setTools(
    createBuiltinTools(getWorkspaceRoot, editStore, indexService, () =>
      orchestrator.shouldAutoApply(),
    ),
  );

  // ─── Chat / providers ─────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.AI_CHAT_START, async (_e, request: AIChatStartRequest) => {
    const streamId = await orchestrator.start(request);
    return { streamId };
  });

  ipcMain.handle(IpcChannels.AI_CHAT_STOP, (_e, request: AIChatStopRequest) => {
    orchestrator.stop(request.streamId);
  });

  ipcMain.handle(IpcChannels.AI_COMPLETE, async (_e, request: AICompleteRequest) => {
    return orchestrator.complete(request);
  });

  ipcMain.handle(IpcChannels.AI_INLINE_EDIT, async (_e, request: AIInlineEditRequest) => {
    return orchestrator.inlineEdit(request);
  });

  ipcMain.handle(IpcChannels.AI_AUTOCOMPLETE, async (_e, request: AIAutocompleteRequest) => {
    return orchestrator.autocomplete(request);
  });

  ipcMain.handle(IpcChannels.AI_SET_CREDENTIAL, async (_e, request: AISetCredentialRequest) => {
    await credentials.set(request.providerId, request.apiKey);
  });

  ipcMain.handle(IpcChannels.AI_HAS_CREDENTIAL, (_e, request: AIHasCredentialRequest) => {
    return credentials.has(request.providerId);
  });

  ipcMain.handle(IpcChannels.AI_DELETE_CREDENTIAL, async (_e, request: AIDeleteCredentialRequest) => {
    await credentials.delete(request.providerId);
  });

  ipcMain.handle(IpcChannels.AI_LIST_TOOLS, () => orchestrator.listTools());

  ipcMain.handle(IpcChannels.AI_SET_PERMISSION, (_e, request: AIPermissionDecisionRequest) => {
    orchestrator.getPermissionManager().applyDecision(request.toolName, request.decision);
  });

  ipcMain.handle(IpcChannels.AI_LIST_MODELS, async (_e, request: AIListModelsRequest) => {
    const provider = getProvider(request.providerId);
    if (!provider?.listModels) {
      return listProviders().find((p) => p.id === request.providerId) ? [] : [];
    }
    const key = credentials.get(request.providerId as AICredentialProviderId) ?? undefined;
    return provider.listModels(key, request.baseUrl);
  });

  ipcMain.handle(
    IpcChannels.AI_TEST_CONNECTION,
    async (_e, request: { providerId: string; baseUrl?: string }) => {
      return orchestrator.testConnection(request.providerId, request.baseUrl);
    },
  );

  // ─── Edit proposals ───────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.EDITS_LIST, () => ({ proposals: editStore.list() }));

  ipcMain.handle(IpcChannels.EDITS_PROPOSE, async (_e, request: ProposeEditsRequest) => {
    const proposals = editStore.propose(request.edits, request.source ?? 'agent');
    return { proposals };
  });

  ipcMain.handle(IpcChannels.EDITS_APPLY, async (_e, request: ApplyEditRequest) => {
    return editStore.apply(request.id, request.force);
  });

  ipcMain.handle(IpcChannels.EDITS_APPLY_ALL, async (_e, request?: ApplyAllEditsRequest) => {
    return editStore.applyAll(request?.ids, request?.force);
  });

  ipcMain.handle(IpcChannels.EDITS_REJECT, (_e, request: RejectEditRequest) => {
    editStore.reject(request.id);
  });

  ipcMain.handle(IpcChannels.EDITS_REJECT_ALL, () => {
    editStore.rejectAll();
  });

  ipcMain.handle(IpcChannels.EDITS_CLEAR, () => {
    editStore.clear();
  });

  // ─── Indexing ─────────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.INDEX_START, async (_e, request: { rootPath: string }) => {
    void indexService.start(request.rootPath);
    return { started: true };
  });

  ipcMain.handle(IpcChannels.INDEX_STOP, () => {
    indexService.stop();
  });

  ipcMain.handle(IpcChannels.INDEX_STATUS, () => indexService.getStatus());

  ipcMain.handle(
    IpcChannels.INDEX_SEARCH,
    async (
      _e,
      request: {
        query: string;
        limit?: number;
        rootPath?: string;
        caseSensitive?: boolean;
      },
    ) => {
      // Strict line-level content search only (live grep) — no false positives
      return indexService.searchAsync(request.query, request.limit ?? 200, request.rootPath, {
        semantic: false,
        caseSensitive: request.caseSensitive ?? false,
      });
    },
  );

  ipcMain.handle(
    IpcChannels.INDEX_SEARCH_SEMANTIC,
    async (
      _e,
      request: {
        query: string;
        limit?: number;
        rootPath?: string;
        caseSensitive?: boolean;
      },
    ) => {
      return indexService.searchAsync(request.query, request.limit ?? 40, request.rootPath, {
        semantic: true,
        caseSensitive: request.caseSensitive ?? false,
      });
    },
  );

  return { credentials, orchestrator, editStore, indexService };
}
