/**
 * Multi-file AI edit proposals — review before apply.
 */

export interface FileEditProposal {
  id: string;
  path: string;
  /** Content hash/version when proposal was created */
  originalContent: string;
  proposedContent: string;
  /** Optional description from the agent */
  description?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'conflict' | 'applied';
  source: 'agent' | 'inline' | 'chat';
  createdAt: number;
}

export interface ProposeEditsRequest {
  edits: Array<{
    path: string;
    originalContent?: string;
    proposedContent: string;
    description?: string;
  }>;
  source?: 'agent' | 'inline' | 'chat';
}

export interface ProposeEditsResult {
  proposals: FileEditProposal[];
}

export interface ApplyEditRequest {
  id: string;
  /** If true, apply even if disk content differs slightly */
  force?: boolean;
}

export interface ApplyEditResult {
  ok: boolean;
  error?: string;
  conflict?: boolean;
}

export interface ApplyAllEditsRequest {
  ids?: string[];
  force?: boolean;
}

export interface RejectEditRequest {
  id: string;
}

export interface ListPendingEditsResult {
  proposals: FileEditProposal[];
}
