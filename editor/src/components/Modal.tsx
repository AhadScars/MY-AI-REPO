"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider modal for galleries / problems */
  wide?: boolean;
};

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Prevent background scroll / rubber-band while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/55 p-0 sm:items-start sm:p-4 sm:pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-[var(--border)] bg-[#2b2d30] shadow-2xl sm:max-h-[85vh] sm:rounded-xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
        style={{
          paddingBottom: "var(--safe-bottom)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle affordance */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-[#555]" />
        </div>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3 sm:px-4">
          <h2 className="pr-2 text-sm font-semibold text-[var(--text-bright)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-[var(--text-dim)] hover:bg-[#3d3f43] hover:text-[var(--text-bright)] sm:h-8 sm:w-8 sm:text-lg"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
