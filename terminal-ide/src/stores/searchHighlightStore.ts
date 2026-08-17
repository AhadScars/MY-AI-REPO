import { create } from 'zustand';

export interface SearchActiveMatch {
  path: string;
  line: number;
  column: number;
}

interface SearchHighlightState {
  /** Current workspace/file search string to highlight in editors. */
  query: string;
  caseSensitive: boolean;
  /** Match the user clicked (emphasized decoration). */
  activeMatch: SearchActiveMatch | null;
  /** Bumped to force re-apply decorations. */
  token: number;

  setQuery: (query: string, caseSensitive?: boolean) => void;
  setActiveMatch: (match: SearchActiveMatch | null) => void;
  /**
   * Set query + optional jump target (used when opening a search result).
   */
  highlightAndFocus: (opts: {
    query: string;
    caseSensitive?: boolean;
    path: string;
    line: number;
    column?: number;
  }) => void;
  clear: () => void;
}

export const useSearchHighlightStore = create<SearchHighlightState>((set) => ({
  query: '',
  caseSensitive: false,
  activeMatch: null,
  token: 0,

  setQuery: (query, caseSensitive) =>
    set((s) => ({
      query,
      caseSensitive: caseSensitive ?? s.caseSensitive,
      token: s.token + 1,
      // Keep active match only if query still non-empty
      activeMatch: query.trim() ? s.activeMatch : null,
    })),

  setActiveMatch: (match) =>
    set((s) => ({
      activeMatch: match,
      token: s.token + 1,
    })),

  highlightAndFocus: ({ query, caseSensitive, path, line, column = 1 }) =>
    set((s) => ({
      query,
      caseSensitive: caseSensitive ?? s.caseSensitive,
      activeMatch: { path, line, column },
      token: s.token + 1,
    })),

  clear: () =>
    set((s) => ({
      query: '',
      activeMatch: null,
      token: s.token + 1,
    })),
}));
