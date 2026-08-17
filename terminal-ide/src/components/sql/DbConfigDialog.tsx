import { useEffect, useRef, useState } from 'react';
import { Database, X, Loader2 } from 'lucide-react';
import type { MysqlConnectionConfig } from '../../../packages/protocol/src/sql';
import { XAMPP_MYSQL_DEFAULTS } from '../../../packages/protocol/src/sql';
import { cn } from '../../utils/cn';

interface DbConfigDialogProps {
  open: boolean;
  initial?: Partial<MysqlConnectionConfig> | null;
  availableDatabases?: string[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConnect: (config: MysqlConnectionConfig, options: { save: boolean }) => void;
}

/**
 * Clean modal for XAMPP / MySQL connection.
 * Seed form only when the dialog opens (avoids flicker from parent re-renders).
 */
export function DbConfigDialog({
  open,
  initial,
  availableDatabases = [],
  busy = false,
  error = null,
  onClose,
  onConnect,
}: DbConfigDialogProps) {
  const [host, setHost] = useState(XAMPP_MYSQL_DEFAULTS.host);
  const [port, setPort] = useState(String(XAMPP_MYSQL_DEFAULTS.port));
  const [user, setUser] = useState(XAMPP_MYSQL_DEFAULTS.user);
  const [password, setPassword] = useState(XAMPP_MYSQL_DEFAULTS.password);
  const [database, setDatabase] = useState(XAMPP_MYSQL_DEFAULTS.database ?? '');
  const [name, setName] = useState(XAMPP_MYSQL_DEFAULTS.name ?? 'XAMPP Local');
  const [save, setSave] = useState(true);
  const wasOpen = useRef(false);

  useEffect(() => {
    // Only seed fields on open transition — not on every `initial` identity change
    if (open && !wasOpen.current) {
      setHost(initial?.host ?? XAMPP_MYSQL_DEFAULTS.host);
      setPort(String(initial?.port ?? XAMPP_MYSQL_DEFAULTS.port));
      setUser(initial?.user ?? XAMPP_MYSQL_DEFAULTS.user);
      setPassword(initial?.password ?? XAMPP_MYSQL_DEFAULTS.password);
      setDatabase(initial?.database ?? '');
      setName(initial?.name ?? XAMPP_MYSQL_DEFAULTS.name ?? 'XAMPP Local');
      setSave(true);
    }
    wasOpen.current = open;
  }, [open, initial]);

  if (!open) return null;

  const config = (): MysqlConnectionConfig => ({
    id: initial?.id ?? 'xampp',
    name: name.trim() || 'XAMPP Local',
    host: host.trim() || 'localhost',
    port: Number(port) || 3306,
    user: user.trim() || 'root',
    password,
    database: database.trim(),
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        // Click outside dialog to close (backdrop only)
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-ide-border bg-ide-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="db-config-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ide-border/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ide-accent/15">
              <Database size={14} className="text-ide-accent" />
            </div>
            <div>
              <h2 id="db-config-title" className="text-ide-sm font-medium text-ide-text">
                Connect to MySQL
              </h2>
              <p className="text-[11px] text-ide-muted">XAMPP · localhost defaults</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Host" className="col-span-2">
              <input
                className={inputCls}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
              />
            </Field>
            <Field label="Port">
              <input
                className={inputCls}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="3306"
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="User">
              <input
                className={inputCls}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="root"
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="optional"
                autoComplete="current-password"
              />
            </Field>
          </div>

          <Field label="Database">
            {availableDatabases.length > 0 ? (
              <select
                className={inputCls}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              >
                <option value="">All schemas</option>
                {availableDatabases.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="optional (e.g. myapp)"
              />
            )}
          </Field>

          <Field label="Name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="XAMPP Local"
            />
          </Field>

          <label className="flex items-center gap-2 text-ide-xs text-ide-muted">
            <input
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
              className="rounded border-ide-border"
            />
            Remember in this project
          </label>

          {error && (
            <p className="rounded-md border border-ide-danger/30 bg-ide-danger/10 px-2.5 py-1.5 text-ide-xs text-ide-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-ide-border/60 px-4 py-3">
          <button
            type="button"
            className="h-8 rounded-md px-3 text-ide-xs text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ide-accent px-3.5 text-ide-xs font-medium text-white hover:bg-ide-accent-hover disabled:opacity-40"
            onClick={() => onConnect(config(), { save })}
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-[11px] font-medium text-ide-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'h-8 w-full rounded-md border border-ide-border bg-ide-bg px-2.5 text-ide-sm text-ide-text outline-none transition-colors placeholder:text-ide-muted/50 focus:border-ide-accent';
