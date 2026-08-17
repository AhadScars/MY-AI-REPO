/**
 * AI IPC contracts — chat streaming, credentials, tools.
 */

export interface AIChatMessageDto {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIContextPayload {
  workspaceRoot?: string;
  workspaceName?: string;
  activeFile?: {
    path: string;
    language: string;
    content: string;
    /** Truncated flag */
    truncated?: boolean;
  };
  selection?: {
    path: string;
    text: string;
    startLine: number;
    endLine: number;
  };
  openFiles?: Array<{
    path: string;
    language: string;
    /** Optional preview of content */
    preview?: string;
  }>;
  gitBranch?: string;
  gitSummary?: string;
  diagnosticsSummary?: string;
}

export interface AIChatStartRequest {
  providerId: string;
  model: string;
  messages: AIChatMessageDto[];
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  context?: AIContextPayload;
  /** Enable agent tools + multi-step tool loop */
  agentMode?: boolean;
  /** When agentMode: write file edits to disk automatically (no review) */
  autoApplyEdits?: boolean;
  /** Max tool→model rounds (default 12) */
  maxAgentSteps?: number;
}

export interface AIChatStartResult {
  streamId: string;
}

export interface AIChatStopRequest {
  streamId: string;
}

export interface AIStreamChunkEvent {
  streamId: string;
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'usage';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  toolResult?: {
    id: string;
    name: string;
    output: string;
    success: boolean;
  };
  error?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export type AICredentialProviderId =
  | 'openai'
  | 'deepseek'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'openai-compatible';

export interface AISetCredentialRequest {
  providerId: AICredentialProviderId;
  apiKey: string;
}

export interface AIHasCredentialRequest {
  providerId: AICredentialProviderId;
}

export interface AIDeleteCredentialRequest {
  providerId: AICredentialProviderId;
}

export interface AICompleteRequest {
  providerId: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  stop?: string[];
}

export interface AICompleteResult {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIToolDescriptor {
  name: string;
  description: string;
  permissionLevel: 'safe' | 'confirm' | 'high-risk';
}

export interface AIPermissionDecisionRequest {
  toolName: string;
  decision: 'allow-once' | 'allow-session' | 'always-allow' | 'deny';
}

export interface AIListModelsRequest {
  providerId: string;
  baseUrl?: string;
}

export interface AIInlineEditRequest {
  providerId: string;
  model: string;
  instruction: string;
  code: string;
  language?: string;
  path?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

export interface AIInlineEditResult {
  code: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIAutocompleteRequest {
  providerId: string;
  model: string;
  prefix: string;
  suffix?: string;
  language?: string;
  path?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
}

export interface AIAutocompleteResult {
  suggestion: string;
}

/** Stream event when agent proposes file edits */
export interface AIEditProposalEvent {
  streamId?: string;
  proposals: Array<{
    id: string;
    path: string;
    description?: string;
  }>;
}
