"use client";

import type { EditorTab } from "@/lib/tabs";
import { tabDisplayName } from "@/lib/tabs";
import type { LangId } from "@/lib/languages";
import { LANGUAGES, getLanguage } from "@/lib/languages";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

type EditorTabsProps = {
  tabs: EditorTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: (langId: LangId) => void;
};

export function EditorTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNewTab,
}: EditorTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const width = 220;
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8)
    );
    setMenuPos({
      top: rect.bottom + 4,
      left,
    });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
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
  }, [menuOpen]);

  const openMenu = (e: ReactMouseEvent | ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const pickLang = (langId: LangId) => {
    onNewTab(langId);
    setMenuOpen(false);
  };

  return (
    <div
      id="editor-tab-bar"
      className="relative z-[200] flex h-11 min-h-11 w-full shrink-0 items-center border-b border-[#3c3f41] bg-[#1a1b1e] sm:h-10 sm:min-h-10"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const name = tabDisplayName(tab, tabs);
          const lang = getLanguage(tab.langId);
          return (
            <div
              key={tab.id}
              className={`group flex h-full max-w-[10rem] shrink-0 items-center gap-1.5 border-r border-[#3c3f41] px-2 text-xs font-mono sm:max-w-[12.5rem] sm:gap-2 sm:px-3 ${
                active
                  ? "border-t-2 border-t-[#3574f0] bg-[#2b2d30] text-white"
                  : "border-t-2 border-t-transparent text-[#9aa0a6] hover:bg-[#252628] hover:text-[#ddd]"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left sm:min-h-0"
                title={`${lang.label}: ${name}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: lang.badgeColor }}
                />
                <span className="truncate">{name}</span>
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  title="Close tab"
                  aria-label={`Close ${name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded text-base leading-none text-white/70 hover:bg-white/10 hover:text-white sm:h-auto sm:w-auto sm:px-1"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <div className="flex h-full shrink-0 items-center px-1.5">
          <button
            ref={btnRef}
            type="button"
            id="new-tab-plus-btn"
            title="New tab"
            aria-label="New tab"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={openMenu}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/40 text-white hover:border-white hover:bg-white/10 active:bg-white/20 sm:h-8 sm:w-8"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ pointerEvents: "none" }}
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {mounted &&
        menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            id="new-tab-menu"
            role="menu"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 99999,
              minWidth: 200,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "min(60vh, 360px)",
              overflowY: "auto",
              background: "#2b2d30",
              border: "1px solid #555",
              borderRadius: 8,
              boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
              padding: "4px 0",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                padding: "8px 14px",
                fontSize: 11,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              New tab
            </div>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                type="button"
                role="menuitem"
                onClick={() => pickLang(lang.id)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#3d3f43";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: lang.badgeColor,
                    flexShrink: 0,
                  }}
                />
                {lang.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
