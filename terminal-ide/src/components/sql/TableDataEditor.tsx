import {
  Save,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Loader2,
  KeyRound,
  Table2,
} from 'lucide-react';
import { useSqlStore } from '../../stores/sqlStore';
import { cn } from '../../utils/cn';

/**
 * phpMyAdmin-style visual table editor — click cells to edit, no SQL required.
 */
export function TableDataEditor() {
  const editor = useSqlStore((s) => s.tableEditor);
  const isRunning = useSqlStore((s) => s.isRunning);
  const lastError = useSqlStore((s) => s.lastError);
  const lastMessage = useSqlStore((s) => s.lastMessage);
  const closeTableEditor = useSqlStore((s) => s.closeTableEditor);
  const reloadTableEditor = useSqlStore((s) => s.reloadTableEditor);
  const setEditorCell = useSqlStore((s) => s.setEditorCell);
  const toggleEditorNull = useSqlStore((s) => s.toggleEditorNull);
  const toggleEditorRowSelected = useSqlStore((s) => s.toggleEditorRowSelected);
  const toggleSelectAllEditorRows = useSqlStore((s) => s.toggleSelectAllEditorRows);
  const addEditorRow = useSqlStore((s) => s.addEditorRow);
  const deleteSelectedEditorRows = useSqlStore((s) => s.deleteSelectedEditorRows);
  const saveTableEditor = useSqlStore((s) => s.saveTableEditor);

  if (!editor) return null;

  const allSelected =
    editor.rows.length > 0 &&
    editor.rows.filter((r) => !r.deleted).every((r) => editor.selected.has(r.id));
  let dirtyCount = 0;
  for (const r of editor.rows) {
    if (r.isNew || r.deleted) {
      dirtyCount += 1;
      continue;
    }
    if (r.cells.some((c, i) => c !== r.original[i])) dirtyCount += 1;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ide-panel">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-ide-border/60 px-3">
        <Table2 size={14} className="shrink-0 text-ide-accent" />
        <span
          className="min-w-0 max-w-[40%] truncate text-ide-sm font-medium text-ide-text"
          title={`${editor.schemaKey}.${editor.table}`}
        >
          {editor.schemaKey === 'sqlite' ? editor.table : `${editor.schemaKey} · ${editor.table}`}
        </span>
        {dirtyCount > 0 && (
          <span className="shrink-0 rounded-full bg-ide-warning/15 px-2 py-0.5 text-[10px] font-medium text-ide-warning">
            {dirtyCount} unsaved
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <ToolBtn
            label="Save"
            onClick={() => void saveTableEditor()}
            disabled={isRunning || dirtyCount === 0}
            primary
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span className="hidden sm:inline">Save</span>
          </ToolBtn>
          <ToolBtn label="Insert row" onClick={addEditorRow} disabled={isRunning}>
            <Plus size={13} />
            <span className="hidden sm:inline">Insert</span>
          </ToolBtn>
          <ToolBtn
            label="Delete selected"
            onClick={() => void deleteSelectedEditorRows()}
            disabled={isRunning || editor.selected.size === 0}
            danger
          >
            <Trash2 size={13} />
          </ToolBtn>
          <ToolBtn label="Reload" onClick={() => void reloadTableEditor()} disabled={isRunning}>
            <RefreshCw size={13} />
          </ToolBtn>
          <div className="mx-0.5 h-4 w-px bg-ide-border" />
          <ToolBtn label="Close" onClick={closeTableEditor}>
            <X size={13} />
          </ToolBtn>
        </div>
      </div>

      {lastError && (
        <div className="shrink-0 border-b border-ide-danger/25 bg-ide-danger/10 px-3 py-1.5 text-ide-xs text-ide-danger">
          {lastError}
        </div>
      )}
      {!lastError && lastMessage && (
        <div className="shrink-0 border-b border-ide-border/40 px-3 py-1 text-ide-xs text-ide-muted">
          {lastMessage}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max border-collapse text-left text-ide-xs">
          <thead className="sticky top-0 z-10 bg-ide-elevated">
            <tr>
              <th className="w-8 border-b border-ide-border px-1 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAllEditorRows}
                  title="Select all"
                  className="rounded border-ide-border"
                />
              </th>
              <th className="w-8 border-b border-ide-border px-1 py-1.5 text-ide-muted">#</th>
              {editor.columns.map((c) => (
                <th
                  key={c.name}
                  className="border-b border-ide-border px-2 py-1.5 font-medium text-ide-text"
                >
                  <span className="inline-flex items-center gap-1">
                    {c.pk && <KeyRound size={10} className="text-ide-accent" />}
                    {c.name}
                  </span>
                  <div className="font-normal text-[10px] text-ide-muted">
                    {c.type || '—'}
                    {c.notnull ? ' · NOT NULL' : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {editor.rows
              .filter((r) => !r.deleted)
              .map((row, visibleIdx) => {
                const dirty =
                  row.isNew ||
                  row.cells.some((c, i) => c !== row.original[i]);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'hover:bg-ide-elevated/50',
                      row.isNew && 'bg-ide-success/5',
                      dirty && !row.isNew && 'bg-ide-warning/5',
                      editor.selected.has(row.id) && 'bg-ide-selection/40',
                    )}
                  >
                    <td className="border-b border-ide-border/40 px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={editor.selected.has(row.id)}
                        onChange={() => toggleEditorRowSelected(row.id)}
                        className="rounded border-ide-border"
                      />
                    </td>
                    <td className="border-b border-ide-border/40 px-1 py-0.5 text-ide-muted">
                      {visibleIdx + 1}
                    </td>
                    {editor.columns.map((col, ci) => {
                      const val = row.cells[ci] ?? null;
                      const isNull = val === null;
                      return (
                        <td
                          key={col.name}
                          className="min-w-[7rem] max-w-[18rem] border-b border-ide-border/40 p-0"
                        >
                          <div className="flex items-stretch">
                            <input
                              className={cn(
                                'min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-ide-xs text-ide-text outline-none focus:bg-ide-bg focus:ring-1 focus:ring-ide-accent',
                                isNull && 'italic text-ide-muted',
                              )}
                              value={isNull ? '' : val}
                              placeholder={isNull ? 'NULL' : ''}
                              disabled={isRunning}
                              onChange={(e) =>
                                setEditorCell(row.id, ci, e.target.value === '' && isNull ? null : e.target.value)
                              }
                              onFocus={(e) => {
                                if (isNull) {
                                  // start typing replaces NULL
                                  setEditorCell(row.id, ci, '');
                                  requestAnimationFrame(() => e.target.select());
                                }
                              }}
                            />
                            {!col.notnull && (
                              <button
                                type="button"
                                title={isNull ? 'Clear NULL' : 'Set NULL'}
                                className={cn(
                                  'shrink-0 px-1 text-[9px] font-semibold',
                                  isNull
                                    ? 'text-ide-accent'
                                    : 'text-ide-muted/50 hover:text-ide-muted',
                                )}
                                onClick={() => toggleEditorNull(row.id, ci)}
                                disabled={isRunning}
                              >
                                N
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            {editor.rows.filter((r) => !r.deleted).length === 0 && (
              <tr>
                <td
                  colSpan={editor.columns.length + 2}
                  className="px-3 py-6 text-center text-ide-sm text-ide-muted"
                >
                  No rows. Click <strong className="text-ide-text">Insert</strong> to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex h-6 shrink-0 items-center gap-2 border-t border-ide-border/50 px-3 text-[10px] text-ide-muted">
        <span>
          {editor.rows.filter((r) => !r.deleted).length}
          {editor.truncated ? '+' : ''} rows
        </span>
        <span className="text-ide-border">·</span>
        <span>Click cell to edit · N = NULL</span>
        {!editor.columns.some((c) => c.pk) && (
          <>
            <span className="text-ide-border">·</span>
            <span className="text-ide-warning">No primary key</span>
          </>
        )}
      </div>
    </div>
  );
}

function ToolBtn({
  label,
  onClick,
  disabled,
  primary,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md px-2 text-ide-xs transition-colors',
        primary && !disabled && 'bg-ide-accent font-medium text-white hover:bg-ide-accent-hover',
        danger && !disabled && 'text-ide-danger hover:bg-ide-danger/10',
        !primary &&
          !danger &&
          !disabled &&
          'text-ide-muted hover:bg-ide-elevated hover:text-ide-text',
        disabled && 'cursor-not-allowed opacity-35',
      )}
    >
      {children}
    </button>
  );
}
