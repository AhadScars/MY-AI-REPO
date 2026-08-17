import type * as Monaco from 'monaco-editor';
import { diagnosticMatchesPath } from '../run/parseDiagnostics';
import type { SearchActiveMatch } from '../../stores/searchHighlightStore';

/**
 * Highlight all occurrences of `query` in the model.
 * The active match (clicked search result) gets a stronger style.
 */
export function applySearchHighlights(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor,
  model: Monaco.editor.ITextModel,
  query: string,
  caseSensitive: boolean,
  activeMatch: SearchActiveMatch | null,
  editorPath: string,
  collection: Monaco.editor.IEditorDecorationsCollection | null,
): Monaco.editor.IEditorDecorationsCollection {
  const coll = collection ?? editor.createDecorationsCollection();
  const q = query.trim();
  if (!q) {
    coll.clear();
    return coll;
  }

  // Literal search (not regex) — workspace search is plain text
  let matches: Monaco.editor.FindMatch[] = [];
  try {
    matches = model.findMatches(
      q,
      true, // searchOnlyEditableRange
      false, // isRegex
      caseSensitive,
      null, // wordSeparators
      true, // captureMatches
      5000, // limit
    );
  } catch {
    coll.clear();
    return coll;
  }

  const activeOnThisFile =
    activeMatch && diagnosticMatchesPath(activeMatch.path, editorPath)
      ? activeMatch
      : null;

  const decorations: Monaco.editor.IModelDeltaDecoration[] = matches.map((m) => {
    const isCurrent =
      !!activeOnThisFile &&
      m.range.startLineNumber === activeOnThisFile.line &&
      // column may be 1 from search panel — still prefer line match; refine if column known
      (activeOnThisFile.column <= 1 ||
        (m.range.startColumn <= activeOnThisFile.column &&
          m.range.endColumn >= activeOnThisFile.column));

    // If multiple on same line and column is 1, mark first match on that line as current
    const isLineCurrent =
      !!activeOnThisFile && m.range.startLineNumber === activeOnThisFile.line;

    const current = isCurrent || (activeOnThisFile?.column === 1 && isLineCurrent);

    return {
      range: m.range,
      options: {
        className: current ? 'search-highlight-current' : 'search-highlight',
        inlineClassName: current ? 'search-highlight-current-inline' : 'search-highlight-inline',
        overviewRuler: {
          color: current ? '#f5d70a' : '#eadc5a',
          position: monaco.editor.OverviewRulerLane.Center,
        },
        minimap: {
          color: current ? '#f5d70a' : '#eadc5a',
          position: monaco.editor.MinimapPosition.Inline,
        },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        zIndex: current ? 20 : 10,
      },
    };
  });

  // Ensure only one "current" if multiple line matches and column is 1
  if (activeOnThisFile && activeOnThisFile.column <= 1) {
    let seen = false;
    for (const d of decorations) {
      if (
        d.range.startLineNumber === activeOnThisFile.line &&
        d.options.className === 'search-highlight-current'
      ) {
        if (seen) {
          d.options.className = 'search-highlight';
          d.options.inlineClassName = 'search-highlight-inline';
          d.options.zIndex = 10;
        } else {
          seen = true;
        }
      }
    }
  }

  coll.set(decorations);
  return coll;
}
