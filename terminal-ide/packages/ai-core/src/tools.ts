import type { PermissionLevel } from '../../types/src/ai';

export interface ToolResult {
  success: boolean;
  output?: string;
  data?: unknown;
  error?: string;
}

export interface ToolPermission {
  level: PermissionLevel;
  description: string;
}

/**
 * Tool interface for the AI agent.
 * Every tool goes through the permission system.
 */
export interface AITool {
  name: string;
  description: string;
  inputSchema: unknown;
  permission: ToolPermission;

  execute(input: unknown): Promise<ToolResult>;
}
