import { create } from 'zustand';
import type { IndexingProgress, SearchResult } from '../../packages/indexing/src/index';
import { requireApi } from '../services/platform';

interface IndexingState {
  isIndexing: boolean;
  progress: IndexingProgress | null;
  chunkCount: number;
  lastIndexedAt: number | null;
  error: string | null;
  searchResults: SearchResult[];
  searchQuery: string;
  isSearching: boolean;

  startIndexing: (workspacePath: string) => Promise<void>;
  stopIndexing: () => void;
  subscribe: () => () => void;
  search: (query: string, semantic?: boolean, caseSensitive?: boolean) => Promise<void>;
  clearSearch: () => void;
  reset: () => void;
  refreshStatus: () => Promise<void>;
}

export const useIndexingStore = create<IndexingState>((set, get) => ({
  isIndexing: false,
  progress: null,
  chunkCount: 0,
  lastIndexedAt: null,
  error: null,
  searchResults: [],
  searchQuery: '',
  isSearching: false,

  startIndexing: async (workspacePath) => {
    set({ isIndexing: true, error: null });
    try {
      await requireApi().indexStart({ rootPath: workspacePath });
    } catch (err) {
      set({
        isIndexing: false,
        error: err instanceof Error ? err.message : 'Failed to start indexing',
      });
    }
  },

  stopIndexing: () => {
    void requireApi().indexStop();
    set({ isIndexing: false });
  },

  subscribe: () => {
    return requireApi().onIndexProgress((progress) => {
      set({
        progress,
        isIndexing: progress.phase !== 'done' && progress.phase !== 'error',
        chunkCount:
          progress.phase === 'done'
            ? // status refresh below
              useIndexingStore.getState().chunkCount
            : useIndexingStore.getState().chunkCount,
        lastIndexedAt: progress.phase === 'done' ? Date.now() : useIndexingStore.getState().lastIndexedAt,
        error: progress.phase === 'error' ? progress.message ?? 'Index error' : null,
      });
      if (progress.phase === 'done') {
        void useIndexingStore.getState().refreshStatus();
      }
    });
  },

  refreshStatus: async () => {
    try {
      const status = await requireApi().indexStatus();
      set({
        chunkCount: status.chunkCount,
        isIndexing: status.running,
        progress: status.progress,
      });
    } catch {
      // ignore
    }
  },

  search: async (query, semantic = false, caseSensitive = false) => {
    const q = query.trim();
    set({ searchQuery: q, isSearching: true, error: null });
    if (!q) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    try {
      const api = requireApi();
      const root =
        (await import('./workspaceStore')).useWorkspaceStore.getState().rootPath ?? undefined;
      // Background index helps semantic mode; text search uses live grep
      const status = await api.indexStatus();
      if (semantic && status.chunkCount === 0 && root && !status.running) {
        void get().startIndexing(root);
      }

      const results = semantic
        ? await api.indexSearchSemantic({
            query: q,
            limit: 80,
            rootPath: root,
            caseSensitive,
          })
        : await api.indexSearch({
            query: q,
            limit: 200,
            rootPath: root,
            caseSensitive,
          });

      // Drop any result whose preview line does not actually contain the query
      const qCheck = caseSensitive ? q : q.toLowerCase();
      const filtered = results.filter((r) => {
        if (r.matchType === 'semantic') return true;
        const line = caseSensitive ? r.chunk.content : r.chunk.content.toLowerCase();
        return line.includes(qCheck);
      });

      set({
        searchResults: filtered,
        isSearching: false,
        chunkCount: status.chunkCount,
      });
    } catch (err) {
      set({
        isSearching: false,
        error: err instanceof Error ? err.message : 'Search failed',
        searchResults: [],
      });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [] }),

  reset: () =>
    set({
      isIndexing: false,
      progress: null,
      chunkCount: 0,
      lastIndexedAt: null,
      error: null,
      searchResults: [],
      searchQuery: '',
    }),
}));
