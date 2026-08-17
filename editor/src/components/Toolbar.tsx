"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { LangId, LanguageConfig } from "@/lib/languages";
import { LANGUAGES } from "@/lib/languages";

type ToolbarProps = {
  language: LanguageConfig;
  fileName: string;
  isRunning: boolean;
  onLanguageChange: (id: LangId) => void;
  onRun: () => void;
  onClearCode: () => void;
  onClearTerminal: () => void;
  onResetCode: () => void;
  onExportCode: () => void;
  onImportFile: (file: File) => void;
  onShare: () => void;
  onOpenGallery: () => void;
  onOpenProblems: () => void;
};

type MenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  hiddenOn?: "sm" | "md" | "lg";
};

export function Toolbar({
  language,
  fileName,
  isRunning,
  onLanguageChange,
  onRun,
  onClearCode,
  onClearTerminal,
  onResetCode,
  onExportCode,
  onImportFile,
  onShare,
  onOpenGallery,
  onOpenProblems,
}: ToolbarProps) {
  const runLabel = language.outputMode === "preview" ? "Preview" : "Run";
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [morePos, setMorePos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(
      rect.left,
      window.innerWidth - 160 - 8
    );
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, [open]);

  useLayoutEffect(() => {
    if (!moreOpen || !moreBtnRef.current) return;
    const rect = moreBtnRef.current.getBoundingClientRect();
    setMorePos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [moreOpen]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKey);
    }, 0);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!moreOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (moreBtnRef.current?.contains(t)) return;
      if (moreMenuRef.current?.contains(t)) return;
      setMoreOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };

    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKey);
    }, 0);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const pick = (id: LangId) => {
    if (isRunning) return;
    onLanguageChange(id);
    setOpen(false);
  };

  const toggle = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRunning) return;
    setMoreOpen(false);
    setOpen((v) => !v);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onImportFile(file);
  };

  const accept = LANGUAGES.flatMap((l) => l.extensions).join(",");

  const moreItems: MenuItem[] = [
    { id: "gallery", label: "Gallery", onClick: onOpenGallery },
    { id: "problems", label: "Problems", onClick: onOpenProblems },
    {
      id: "import",
      label: "Import file",
      onClick: () => fileInputRef.current?.click(),
    },
    { id: "share", label: "Share link", onClick: onShare },
    { id: "export", label: "Export", onClick: onExportCode },
    { id: "reset", label: "Reset sample", onClick: onResetCode },
    { id: "clear", label: "Clear code", onClick: onClearCode },
    { id: "clear-out", label: "Clear output", onClick: onClearTerminal },
  ];

  const runMore = (item: MenuItem) => {
    if (isRunning) return;
    item.onClick();
    setMoreOpen(false);
  };

  return (
    <header className="relative z-[210] flex h-12 shrink-0 items-center justify-between gap-1.5 border-b border-[var(--border)] bg-[var(--bg-toolbar)] px-2 sm:h-11 sm:gap-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white shadow-sm sm:h-7 sm:w-7">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-semibold text-[var(--text-bright)]">
              Terminal
            </div>
            <div className="truncate text-[10px] leading-none text-[var(--text-dim)]">
              Online Code Editor
            </div>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-[var(--border)] sm:block" />

        <div className="flex min-w-0 items-center gap-2">
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              id="lang-select"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label="Language"
              disabled={isRunning}
              onClick={toggle}
              className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:rounded sm:px-2 sm:py-1 ${
                open
                  ? "border-[var(--border)] bg-[#3d3f43] text-[var(--text-bright)]"
                  : "border-[var(--border)] bg-[#3d3f43] text-[var(--text)] hover:bg-[#45474c]"
              }`}
            >
              <span className="max-w-[5.5rem] truncate sm:max-w-none">
                {language.label}
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={`shrink-0 text-[var(--text-dim)] transition-transform ${open ? "rotate-180" : ""}`}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {mounted &&
              open &&
              createPortal(
                <div
                  ref={menuRef}
                  id="lang-dropdown-menu"
                  role="listbox"
                  aria-labelledby="lang-select"
                  style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                    zIndex: 99999,
                    minWidth: 150,
                    maxHeight: "min(60vh, 360px)",
                    overflowY: "auto",
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[#2b2d30] py-1 shadow-lg"
                >
                  {LANGUAGES.map((lang) => {
                    const active = lang.id === language.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => pick(lang.id)}
                        className={`block w-full px-3 py-2.5 text-left text-sm sm:py-1.5 sm:text-xs ${
                          active
                            ? "bg-[#3d3f43] text-[var(--text-bright)]"
                            : "text-[var(--text)] hover:bg-[#35373b]"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}
          </div>

          <span className="hidden truncate font-mono text-xs text-[var(--text-dim)] lg:inline">
            {fileName}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onFileChange}
        />

        {/* Desktop / tablet inline actions */}
        <button
          type="button"
          onClick={onOpenGallery}
          disabled={isRunning}
          title="Public gallery of examples"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 md:inline"
        >
          Gallery
        </button>
        <button
          type="button"
          onClick={onOpenProblems}
          disabled={isRunning}
          title="Teacher problem pack"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 md:inline"
        >
          Problems
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRunning}
          title="Import a source file"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 sm:inline"
        >
          Import
        </button>
        <button
          type="button"
          onClick={onShare}
          disabled={isRunning}
          title="Copy shareable playground link"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 sm:inline"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onClearCode}
          disabled={isRunning}
          title="Clear all code in the editor"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 lg:inline"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onResetCode}
          disabled={isRunning}
          title="Restore sample code"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 lg:inline"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClearTerminal}
          disabled={isRunning}
          title="Clear terminal output"
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 xl:inline"
        >
          Clear output
        </button>
        <button
          type="button"
          onClick={onExportCode}
          disabled={isRunning}
          title={`Download ${fileName}`}
          className="hidden min-h-8 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 md:inline"
        >
          Export
        </button>

        {/* More menu — always available, essential on mobile */}
        <button
          ref={moreBtnRef}
          type="button"
          disabled={isRunning}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          aria-label="More actions"
          title="More actions"
          onClick={() => {
            setOpen(false);
            setMoreOpen((v) => !v);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text)] transition hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>

        {mounted &&
          moreOpen &&
          createPortal(
            <div
              ref={moreMenuRef}
              id="toolbar-more-menu"
              role="menu"
              style={{
                position: "fixed",
                top: morePos.top,
                right: morePos.right,
                zIndex: 99999,
                minWidth: 180,
              }}
              className="rounded-lg border border-[var(--border)] bg-[#2b2d30] py-1 shadow-xl"
            >
              <div className="border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Actions
              </div>
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => runMore(item)}
                  className="block w-full px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[#3d3f43] sm:py-2 sm:text-xs"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )}

        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-0 ${
            isRunning
              ? "running-pulse bg-[var(--run-green)]"
              : "bg-[var(--run-green)] hover:bg-[var(--run-green-hover)]"
          }`}
          title={`${runLabel} (Ctrl/Cmd + Enter)`}
        >
          {isRunning ? "Running…" : `▶ ${runLabel}`}
        </button>
      </div>
    </header>
  );
}
