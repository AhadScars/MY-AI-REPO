export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  /** Assistant message that requested tool calls (OpenAI-compatible) */
  toolCalls?: ChatToolCall[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  signal?: AbortSignal;
}

export interface AIChunk {
  type: 'text' | 'tool_call' | 'error' | 'done';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  error?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface CompletionRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  signal?: AbortSignal;
}

export interface CompletionResponse {
  text: string;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    inputTokens?: number;
  };
}

/**
 * Provider abstraction — never hard-code a single AI backend.
 * Implementations: OpenAI, Anthropic, Gemini, Ollama, OpenAI-compatible.
 */
export interface AIProvider {
  id: string;
  name: string;

  chat(request: ChatRequest): AsyncIterable<AIChunk>;

  complete(request: CompletionRequest): Promise<CompletionResponse>;

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}
