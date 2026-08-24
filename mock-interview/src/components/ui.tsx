import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-primary text-white hover:bg-[#1d4ed8] shadow-sm",
    secondary: "bg-navy text-white hover:bg-[#1e293b]",
    ghost: "bg-transparent text-navy hover:bg-slate-100",
    danger: "bg-danger text-white hover:bg-[#b91c1c]",
    outline: "border border-border bg-white text-navy hover:bg-slate-50",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  className,
  variant = "primary",
  size = "md",
  children,
}: {
  href: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}) {
  const variants = {
    primary: "bg-primary text-white hover:bg-[#1d4ed8] shadow-sm",
    secondary: "bg-navy text-white hover:bg-[#1e293b]",
    ghost: "bg-transparent text-navy hover:bg-slate-100",
    outline: "border border-border bg-white text-navy hover:bg-slate-50",
  };
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-card", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-navy">{label}</span>
      {children}
      {hint && !error ? <span className="block text-xs text-muted">{hint}</span> : null}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy placeholder:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-navy",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[140px] w-full resize-y rounded-xl border border-border bg-white px-3 py-3 text-sm leading-6 text-navy placeholder:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      {label ? (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{Math.round(safe)}%</span>
        </div>
      ) : null}
      <div className="progress-bar" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-8 py-14 text-center">
      <h2 className="font-serif text-2xl text-navy">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Alert({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "error" | "success" | "warning";
}) {
  const tones = {
    info: "bg-blue-50 text-blue-900 border-blue-100",
    error: "bg-red-50 text-red-800 border-red-100",
    success: "bg-emerald-50 text-emerald-800 border-emerald-100",
    warning: "bg-amber-50 text-amber-900 border-amber-100",
  };
  return <div className={cn("rounded-xl border px-3 py-2.5 text-sm", tones[tone])}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/80", className)} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-semibold text-navy", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-sm text-white">P</span>
      Prepwise
    </Link>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 80 ? "text-emerald-700 bg-emerald-50" : score >= 65 ? "text-blue-700 bg-blue-50" : "text-amber-800 bg-amber-50";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{score}/100</span>;
}
