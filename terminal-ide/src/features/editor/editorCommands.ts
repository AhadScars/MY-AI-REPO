/**
 * Lightweight bus so menus/shortcuts can trigger actions on the active Monaco editor.
 */

export type EditorUiCommand =
  | 'find'
  | 'replace'
  | 'findNext'
  | 'findPrevious'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'addNextOccurrence'
  | 'selectAllOccurrences'
  | 'insertCursorAbove'
  | 'insertCursorBelow'
  | 'cursorsAtLineEnds'
  | 'collapseToEnd'
  | 'collapseToStart';

type Listener = (cmd: EditorUiCommand) => void;

const listeners = new Set<Listener>();

export function emitEditorCommand(cmd: EditorUiCommand): void {
  for (const listener of listeners) {
    try {
      listener(cmd);
    } catch (err) {
      console.error('Editor command failed', cmd, err);
    }
  }
}

export function onEditorCommand(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
