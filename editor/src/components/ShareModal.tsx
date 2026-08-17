"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

type ShareModalProps = {
  open: boolean;
  url: string;
  onClose: () => void;
};

export function ShareModal({ open, url, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [tooLong, setTooLong] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    setTooLong(url.length > 8000);
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback select
      const el = document.getElementById(
        "share-url-input"
      ) as HTMLInputElement | null;
      el?.select();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share playground">
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Anyone with this link can open the same language and code in their
        browser.
      </p>
      {tooLong && (
        <p className="mb-2 rounded-md border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2 py-1.5 text-[11px] text-[var(--warning)]">
          This link is very long. Some browsers or messengers may truncate it.
          Prefer shorter snippets when sharing.
        </p>
      )}
      <div className="flex gap-2">
        <input
          id="share-url-input"
          type="text"
          readOnly
          value={url}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[#1e1f22] px-3 py-2 font-mono text-[11px] text-[var(--text-bright)] outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </Modal>
  );
}
