import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useUi } from '../../store/uiStore';

export function Button({
  variant = 'default',
  size,
  block,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'lg';
  block?: boolean;
}) {
  const v = variant === 'default' ? '' : `btn-${variant}`;
  const s = size ? `btn-${size}` : '';
  return <button className={`btn ${v} ${s} ${block ? 'btn-block' : ''} ${className}`} {...props} />;
}

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'live' | 'soon' | 'ok';
  children: ReactNode;
}) {
  return <span className={`badge ${tone !== 'default' ? `badge-${tone}` : ''}`}>{children}</span>;
}

export function Tabs({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`tab ${value === item.id ? 'on' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="label">
      {label}
      {children}
      {hint && !error ? <span className="faint">{hint}</span> : null}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={wide ? { width: 'min(860px, 100%)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between" style={{ marginBottom: 14 }}>
          <h3 id="modal-title">{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty card">
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        {body}
      </p>
      {action}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skel" style={{ height: h, width: w }} />;
}

export function ToastStack() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return createPortal(
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.kind}`} type="button" onClick={() => dismiss(t.id)}>
          <strong>{t.title}</strong>
          {t.body ? <div className="muted">{t.body}</div> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function SectionHead({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h2 style={{ marginTop: 6 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function PillNav({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="hscroll">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sport-chip ${value === item.id ? 'on' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <b>{value}</b>
      {hint ? (
        <span className="faint" style={{ fontSize: 12 }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return createPortal(
    <div className="drawer-back" onClick={onClose} role="presentation">
      <div className="slip-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <strong>{title}</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div style={{ overflow: 'auto' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}
