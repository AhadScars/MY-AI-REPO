export type AIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  timestamp: number;
  model?: string;
  toolCalls?: AIToolCall[];
  isStreaming?: boolean;
  error?: string;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: unknown;
  status: 'pending' | 'running' | 'success' | 'error' | 'denied';
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  provider?: string;
}

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
}

export interface AIProviderInfo {
  id: string;
  name: string;
  models: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsEmbeddings: boolean;
  isLocal: boolean;
}

export type PermissionLevel = 'safe' | 'confirm' | 'high-risk';

export type PermissionDecision = 'allow-once' | 'allow-session' | 'always-allow' | 'deny';
