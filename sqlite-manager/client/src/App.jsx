import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserDatabase, loadSqlJs } from './db';
import './index.css';

function IconTable() {
  return (
    <svg className="table-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 4v16" />
    </svg>
  );
}

function formatCell(value) {
  if (value === null || value === undefined) return { text: 'NULL', isNull: true };
  if (typeof value === 'object') return { text: JSON.stringify(value), isNull: false };
  return { text: String(value), isNull: false };
}

export default function App() {
  const dbRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState({ open: false, database: null, tables: [] });
  const [selectedTable, setSelectedTable] = useState(null);
  const [rowsData, setRowsData] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState({ col: '', dir: 'asc' });
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    loadSqlJs()
      .then(() => setReady(true))
      .catch((err) => showToast(err.message || 'Failed to load SQLite engine', 'error'));
  }, [showToast]);

  const loadRows = useCallback(
    (table, opts = {}) => {
      const db = dbRef.current;
      if (!db || !table) return;
      setLoading(true);
      try {
        const data = db.getRows(table, {
          page: opts.page ?? page,
          limit,
          search: opts.search ?? search,
          sort: opts.sort ?? sort.col,
          dir: opts.dir ?? sort.dir,
        });
        setRowsData(data);
        setSelected(new Set());
      } catch (err) {
        showToast(err.message, 'error');
        setRowsData(null);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search, sort, showToast]
  );

  useEffect(() => {
    if (selectedTable && status.open) {
      loadRows(selectedTable);
    }
  }, [selectedTable, page, search, sort, status.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const attachDb = (db) => {
    if (dbRef.current) {
      try {
        dbRef.current.close();
      } catch {
        /* ignore */
      }
    }
    dbRef.current = db;
    const tables = db.getTables();
    setStatus({ open: true, database: db.fileName, tables });
    const first = tables.find((t) => t.type === 'table') || tables[0];
    setSelectedTable(first?.name || null);
    setPage(1);
    setSearch('');
    setSearchInput('');
    setSort({ col: '', dir: 'asc' });
    setRowsData(null);
    setDirty(false);
    setSelected(new Set());
  };

  const onFile = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      await loadSqlJs();
      const db = await BrowserDatabase.fromFile(file);
      attachDb(db);
      showToast(`Opened ${file.name}`);
    } catch (err) {
      showToast(err.message || 'Failed to open database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openSample = async () => {
    setLoading(true);
    try {
      await loadSqlJs();
      const db = await BrowserDatabase.fromUrl('/demo.db', 'demo.db (sample)');
      attachDb(db);
      showToast('Opened sample database');
    } catch (err) {
      showToast(err.message || 'Failed to open sample database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeDb = () => {
    if (dbRef.current) {
      try {
        dbRef.current.close();
      } catch {
        /* ignore */
      }
      dbRef.current = null;
    }
    setStatus({ open: false, database: null, tables: [] });
    setSelectedTable(null);
    setRowsData(null);
    setSelected(new Set());
    setDirty(false);
    showToast('Database closed');
  };

  const downloadDb = () => {
    if (!dbRef.current) return;
    try {
      dbRef.current.download();
      setDirty(false);
      showToast('Download started — save your edited .db file');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const onSearchChange = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      setSearch(value.trim());
    }, 300);
  };

  const toggleSort = (col) => {
    setPage(1);
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return { col: '', dir: 'asc' };
    });
  };

  const allRowIds = useMemo(() => (rowsData?.rows || []).map((r) => r.__rowid__), [rowsData]);
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allRowIds));
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (row) => {
    const values = {};
    for (const col of rowsData.columns) {
      values[col.name] =
        row[col.name] === null || row[col.name] === undefined ? '' : String(row[col.name]);
    }
    setEditModal({ mode: 'edit', rowid: row.__rowid__, values });
  };

  const openInsert = () => {
    const values = {};
    for (const col of rowsData?.columns || []) values[col.name] = '';
    setEditModal({ mode: 'insert', values });
  };

  const openDeleteSelected = () => {
    if (!selected.size) return;
    setEditModal({ mode: 'delete', rowids: [...selected] });
  };

  const openDeleteOne = (rowid) => setEditModal({ mode: 'delete', rowids: [rowid] });

  const saveEdit = () => {
    const db = dbRef.current;
    if (!editModal || !selectedTable || !db) return;
    setLoading(true);
    try {
      if (editModal.mode === 'edit') {
        db.updateRow(selectedTable, editModal.rowid, editModal.values);
        showToast('Row updated — download to keep changes');
      } else if (editModal.mode === 'insert') {
        db.insertRow(selectedTable, editModal.values);
        showToast('Row inserted — download to keep changes');
      } else if (editModal.mode === 'delete') {
        db.deleteRows(selectedTable, editModal.rowids);
        showToast(`Deleted ${editModal.rowids.length} row(s) — download to keep changes`);
      }
      setDirty(true);
      setEditModal(null);
      loadRows(selectedTable);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const columns = rowsData?.columns || [];
  const rows = rowsData?.rows || [];

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">DB</div>
          <div>
            <h1>SQLite Manager</h1>
            <span>Browse · Edit · Delete · Download</span>
          </div>
        </div>

        <div className="header-actions">
          {status.open && (
            <div className="db-pill" title={status.database}>
              <span className="dot" />
              <strong>{status.database}</strong>
              {dirty && <span style={{ color: '#fbbf24', fontSize: 12 }}>• unsaved</span>}
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={!ready}
            onClick={() => fileRef.current?.click()}
          >
            Open file
          </button>
          <input
            ref={fileRef}
            className="file-input-hidden"
            type="file"
            accept=".db,.sqlite,.sqlite3,.db3,application/x-sqlite3,application/octet-stream"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onFile(f);
            }}
          />
          {status.open && (
            <>
              <button className="btn btn-primary btn-sm" type="button" onClick={downloadDb}>
                Download .db
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={closeDb}>
                Close
              </button>
            </>
          )}
        </div>
      </header>

      {loading && <div className="loading-bar" />}

      {!status.open ? (
        <div className="welcome">
          <div className="welcome-card">
            <h2>Open a SQLite database</h2>
            <p>
              Runs fully in your browser — safe to host on Vercel. Edit rows here, then download the
              updated .db file to keep changes.
            </p>
            {!ready && (
              <p style={{ color: 'var(--warning)', marginBottom: 16 }}>Loading SQLite engine…</p>
            )}
            <div className="welcome-actions">
              <div
                className={`dropzone ${dragOver ? 'dragover' : ''}`}
                onClick={() => ready && fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFile(f);
                }}
              >
                <strong>Drop a .db / .sqlite file here</strong>
                <span>or click to browse your computer</span>
              </div>
              <div className="or-divider">or</div>
              <button className="btn btn-primary" type="button" disabled={!ready} onClick={openSample}>
                Open sample database
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="main">
          <aside className="sidebar">
            <div className="sidebar-head">
              <h2>Tables</h2>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {status.tables?.length || 0}
              </span>
            </div>
            <ul className="table-list">
              {(status.tables || []).map((t) => (
                <li key={t.name}>
                  <button
                    type="button"
                    className={`table-item ${selectedTable === t.name ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTable(t.name);
                      setPage(1);
                      setSearch('');
                      setSearchInput('');
                      setSort({ col: '', dir: 'asc' });
                    }}
                  >
                    <IconTable />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    <span className="table-type">{t.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="content">
            {!selectedTable ? (
              <div className="empty-table">Select a table from the sidebar</div>
            ) : (
              <>
                <div className="toolbar">
                  <h2>{selectedTable}</h2>
                  <span className="row-count">
                    {rowsData
                      ? `${rowsData.total.toLocaleString()} row${rowsData.total === 1 ? '' : 's'}`
                      : '…'}
                  </span>
                  <div className="toolbar-spacer" />
                  <div className="search-box">
                    <span className="search-icon">⌕</span>
                    <input
                      type="search"
                      placeholder="Search all columns…"
                      value={searchInput}
                      onChange={(e) => onSearchChange(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={openInsert}>
                    + Insert row
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    disabled={!selected.size}
                    onClick={openDeleteSelected}
                  >
                    Delete{selected.size ? ` (${selected.size})` : ''}
                  </button>
                </div>

                <div className="table-wrap">
                  {!rows.length && !loading ? (
                    <div className="empty-table">
                      {search ? 'No rows match your search.' : 'This table is empty.'}
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="sticky-col cell-check">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={toggleAll}
                              title="Select all"
                            />
                          </th>
                          {columns.map((col) => (
                            <th
                              key={col.name}
                              className="sortable"
                              onClick={() => toggleSort(col.name)}
                              title={`Sort by ${col.name}`}
                            >
                              <span className="th-inner">
                                {col.name}
                                {col.pk > 0 ? ' 🔑' : ''}
                                {sort.col === col.name ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                              </span>
                              <span className="col-type">
                                {col.type || 'ANY'}
                                {col.notnull ? ' · NOT NULL' : ''}
                              </span>
                            </th>
                          ))}
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const id = row.__rowid__;
                          const isSel = selected.has(id);
                          return (
                            <tr key={String(id)} className={isSel ? 'selected' : ''}>
                              <td className="sticky-col cell-check">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleRow(id)}
                                />
                              </td>
                              {columns.map((col) => {
                                const { text, isNull } = formatCell(row[col.name]);
                                return (
                                  <td key={col.name}>
                                    <span className={`cell ${isNull ? 'null' : ''}`} title={text}>
                                      {text}
                                    </span>
                                  </td>
                                );
                              })}
                              <td>
                                <div className="cell-actions">
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => openEdit(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    type="button"
                                    onClick={() => openDeleteOne(id)}
                                  >
                                    Del
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {rowsData && rowsData.totalPages > 1 && (
                  <div className="pager">
                    <span className="pager-info">
                      Page {rowsData.page} of {rowsData.totalPages}
                      {' · '}
                      showing {rows.length} of {rowsData.total.toLocaleString()}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={page >= rowsData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {editModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setEditModal(null)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>
                {editModal.mode === 'edit' && 'Edit row'}
                {editModal.mode === 'insert' && 'Insert row'}
                {editModal.mode === 'delete' && 'Confirm delete'}
              </h3>
              <button className="btn btn-ghost btn-icon" type="button" onClick={() => setEditModal(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {editModal.mode === 'delete' ? (
                <p className="confirm-text">
                  Delete <strong>{editModal.rowids.length}</strong> row
                  {editModal.rowids.length === 1 ? '' : 's'} from <strong>{selectedTable}</strong>?
                  Download the .db afterward to keep this change.
                </p>
              ) : (
                columns.map((col) => (
                  <div className="field" key={col.name}>
                    <label>
                      {col.name}
                      <span className="type">
                        {col.type || 'ANY'}
                        {col.pk > 0 ? ' · PK' : ''}
                        {col.notnull ? ' · required' : ''}
                      </span>
                    </label>
                    {String(editModal.values[col.name] || '').length > 80 ? (
                      <textarea
                        value={editModal.values[col.name] ?? ''}
                        onChange={(e) =>
                          setEditModal((m) => ({
                            ...m,
                            values: { ...m.values, [col.name]: e.target.value },
                          }))
                        }
                        placeholder={col.notnull ? '' : 'NULL if empty'}
                      />
                    ) : (
                      <input
                        value={editModal.values[col.name] ?? ''}
                        onChange={(e) =>
                          setEditModal((m) => ({
                            ...m,
                            values: { ...m.values, [col.name]: e.target.value },
                          }))
                        }
                        placeholder={col.notnull ? '' : 'NULL if empty'}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" type="button" onClick={() => setEditModal(null)}>
                Cancel
              </button>
              <button
                className={`btn ${editModal.mode === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                type="button"
                onClick={saveEdit}
              >
                {editModal.mode === 'delete' ? 'Delete' : editModal.mode === 'insert' ? 'Insert' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
