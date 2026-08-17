import { create } from 'zustand';
import type { FileEditProposal } from '../../packages/protocol/src/edits';
import { requireApi } from '../services/platform';
import { useEditorStore } from './editorStore';

interface EditReviewState {
  proposals: FileEditProposal[];
  selectedId: string | null;
  panelOpen: boolean;
  isApplying: boolean;
  error: string | null;

  load: () => Promise<void>;
  subscribe: () => () => void;
  select: (id: string | null) => void;
  openPanel: () => void;
  closePanel: () => void;
  apply: (id: string, force?: boolean) => Promise<void>;
  applyAll: (force?: boolean) => Promise<void>;
  reject: (id: string) => Promise<void>;
  rejectAll: () => Promise<void>;
  pendingCount: () => number;
}

export const useEditStore = create<EditReviewState>((set, get) => ({
  proposals: [],
  selectedId: null,
  panelOpen: false,
  isApplying: false,
  error: null,

  load: async () => {
    try {
      const { proposals } = await requireApi().editsList();
      set({ proposals, error: null });
      if (proposals.some((p) => p.status === 'pending' || p.status === 'conflict')) {
        set({ panelOpen: true });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load edits' });
    }
  },

  subscribe: () => {
    return requireApi().onEditsChanged(({ proposals }) => {
      const prev = get().proposals;
      set({ proposals });
      const pending = proposals.some(
        (p) => p.status === 'pending' || p.status === 'conflict',
      );
      // Only open review when there is something to accept (not auto-applied)
      if (pending) {
        set({ panelOpen: true });
      } else if (get().panelOpen && proposals.every((p) => p.status === 'applied' || p.status === 'rejected')) {
        // Auto-applied batch — close empty review
        const hadPendingBefore = prev.some(
          (p) => p.status === 'pending' || p.status === 'conflict',
        );
        if (!hadPendingBefore) set({ panelOpen: false });
      }
      // Sync open tabs when status flips to applied (agent auto-apply or Accept)
      const editor = useEditorStore.getState();
      for (const p of proposals) {
        if (p.status !== 'applied') continue;
        const was = prev.find((x) => x.id === p.id);
        if (was && was.status === 'applied') continue;
        const tab = editor.tabs.find((t) => t.path === p.path);
        if (tab) {
          editor.updateContent(tab.id, p.proposedContent);
          useEditorStore.getState().markSaved(tab.id, p.proposedContent);
        }
      }
    });
  },

  select: (id) => set({ selectedId: id }),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),

  apply: async (id, force = false) => {
    set({ isApplying: true, error: null });
    try {
      const result = await requireApi().editsApply({ id, force });
      if (!result.ok) {
        set({ error: result.error ?? 'Apply failed', isApplying: false });
        await get().load();
        return;
      }
      const proposal = get().proposals.find((p) => p.id === id);
      if (proposal) {
        // Refresh open editor tab if matching
        const editor = useEditorStore.getState();
        const tab = editor.tabs.find((t) => t.path === proposal.path);
        if (tab) {
          editor.markSaved(tab.id, proposal.proposedContent);
          editor.updateContent(tab.id, proposal.proposedContent);
          // markSaved after update to clear dirty for applied content
          useEditorStore.getState().markSaved(tab.id, proposal.proposedContent);
        } else {
          void editor.openFile(proposal.path, false);
        }
      }
      await get().load();
      set({ isApplying: false });
    } catch (err) {
      set({
        isApplying: false,
        error: err instanceof Error ? err.message : 'Apply failed',
      });
    }
  },

  applyAll: async (force = false) => {
    set({ isApplying: true, error: null });
    try {
      const before = get().proposals.filter(
        (p) => p.status === 'pending' || p.status === 'conflict',
      );
      await requireApi().editsApplyAll({ force });
      // Refresh any open editor tabs that were applied
      const editor = useEditorStore.getState();
      for (const proposal of before) {
        const tab = editor.tabs.find((t) => t.path === proposal.path);
        if (tab) {
          editor.updateContent(tab.id, proposal.proposedContent);
          useEditorStore.getState().markSaved(tab.id, proposal.proposedContent);
        }
      }
      await get().load();
      set({ isApplying: false, panelOpen: get().pendingCount() > 0 });
    } catch (err) {
      set({
        isApplying: false,
        error: err instanceof Error ? err.message : 'Apply all failed',
      });
    }
  },

  reject: async (id) => {
    await requireApi().editsReject({ id });
    await get().load();
  },

  rejectAll: async () => {
    await requireApi().editsRejectAll();
    await get().load();
  },

  pendingCount: () =>
    get().proposals.filter((p) => p.status === 'pending' || p.status === 'conflict').length,
}));
