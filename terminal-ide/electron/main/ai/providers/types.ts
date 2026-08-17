import type {
  AIChunk,
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from '../../../../packages/ai-core/src/provider.js';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface StreamChatParams {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  /** OpenAI-compatible function tools (agent mode) */
  tools?: StreamToolDefinition[];
}

export interface InternalAIProvider {
  id: string;
  name: string;
  isLocal: boolean;

  streamChat(params: StreamChatParams): AsyncIterable<AIChunk>;

  complete(request: CompletionRequest & { apiKey?: string; baseUrl?: string }): Promise<CompletionResponse>;

  embed?(request: EmbeddingRequest & { apiKey?: string; baseUrl?: string }): Promise<EmbeddingResponse>;

  listModels?(apiKey?: string, baseUrl?: string): Promise<string[]>;
}
