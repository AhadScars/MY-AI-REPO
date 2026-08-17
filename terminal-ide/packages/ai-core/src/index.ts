/**
 * AI Core package — provider abstractions, context, permissions, tools.
 */

export type {
  AIProvider,
  ChatRequest,
  ChatMessage,
  AIChunk,
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from './provider';

export type { AITool, ToolResult, ToolPermission } from './tools';

export {
  formatContextForPrompt,
  truncateContent,
  type AIContext,
  MAX_FILE_CHARS,
  MAX_SELECTION_CHARS,
  MAX_OPEN_PREVIEW,
} from './context';

export { PermissionManager, type PermissionPolicy } from './permissions';

export {
  parseFileEditsFromMarkdown,
  buildInlineEditPrompt,
  buildAutocompletePrompt,
  stripCodeFences,
  type ParsedFileEdit,
} from './edit-parser';
