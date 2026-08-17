"use client";

type PreviewProps = {
  html: string;
  label?: string;
  tabLabel?: string;
};

export function Preview({
  html,
  label = "Preview",
  tabLabel,
}: PreviewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--bg-tab)] px-2 sm:h-8 sm:px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-bright)]">
          <PreviewIcon />
          <span>{label}</span>
          {tabLabel && (
            <span className="hidden truncate font-mono text-[10px] text-[var(--text-dim)] sm:inline">
              · {tabLabel}
            </span>
          )}
        </div>
        <span className="hidden shrink-0 text-[10px] text-[var(--text-dim)] sm:inline">
          sandboxed iframe
        </span>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        {html ? (
          <iframe
            title="Code preview"
            srcDoc={html}
            sandbox="allow-scripts allow-modals allow-forms allow-popups"
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--bg-terminal)] text-sm text-[var(--text-dim)]">
            Press{" "}
            <kbd className="mx-1 rounded bg-[#2a2a2a] px-1.5 py-0.5">Run</kbd>{" "}
            to preview
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

export default Preview;
