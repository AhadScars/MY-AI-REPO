import type * as Monaco from 'monaco-editor';
import type { EditorDiagnostic } from '../../../packages/types/src/editor';

const OWNER = 'terminal-ide-run';

/**
 * Apply diagnostics as Monaco markers (red/yellow squiggles + hover tooltip).
 * Hovering the underline shows the error message from compiler/terminal output.
 */
export function applyRunMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  diagnostics: EditorDiagnostic[],
): void {
  const markers: Monaco.editor.IMarkerData[] = diagnostics.map((d) => {
    const line = Math.min(Math.max(1, d.line), model.getLineCount());
    const lineLen = model.getLineMaxColumn(line);
    const col = Math.min(Math.max(1, d.column), Math.max(1, lineLen - 1));

    // Prefer word under cursor; otherwise underline rest of the line so hover is easy
    let endCol = d.endColumn ?? lineLen;
    if (!d.endColumn) {
      const word = model.getWordAtPosition({ lineNumber: line, column: col });
      if (word && word.endColumn > col) {
        endCol = word.endColumn;
      } else if (col === 1) {
        endCol = lineLen;
      } else {
        endCol = Math.min(lineLen, col + 48);
      }
    }
    endCol = Math.max(col + 1, Math.min(endCol, lineLen));

    let severity = monaco.MarkerSeverity.Error;
    if (d.severity === 'warning') severity = monaco.MarkerSeverity.Warning;
    else if (d.severity === 'info' || d.severity === 'hint') severity = monaco.MarkerSeverity.Info;

    const sourceLabel =
      d.source === 'terminal' ? 'Terminal' : d.source === 'run' ? 'Run' : (d.source ?? 'Run');

    return {
      severity,
      // Shown in the hover popup when the user hovers the squiggle
      message: d.message,
      startLineNumber: line,
      startColumn: col,
      endLineNumber: d.endLine ?? line,
      endColumn: endCol,
      source: sourceLabel,
    };
  });

  monaco.editor.setModelMarkers(model, OWNER, markers);
}

export function clearRunMarkers(monaco: typeof Monaco, model: Monaco.editor.ITextModel): void {
  monaco.editor.setModelMarkers(model, OWNER, []);
}
