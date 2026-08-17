"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { LangPicker } from "@/components/LangPicker";
import { Pagination, usePageSlice } from "@/components/Pagination";
import {
  GALLERY,
  GALLERY_CATEGORIES,
  type GalleryItem,
} from "@/lib/gallery";
import { getLanguage, type LangId } from "@/lib/languages";
import { languagesForGallery, runnableLangIds } from "@/lib/starters";

const PAGE_SIZE = 6;

type GalleryModalProps = {
  open: boolean;
  onClose: () => void;
  onOpen: (item: GalleryItem, langId: LangId) => void;
};

export function GalleryModal({ open, onClose, onOpen }: GalleryModalProps) {
  const [category, setCategory] = useState<"all" | GalleryItem["category"]>(
    "all"
  );
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openLang, setOpenLang] = useState<LangId>("python");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allRunnable = useMemo(() => runnableLangIds(), []);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return GALLERY.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.langId.includes(query)
      );
    });
  }, [category, q]);

  useEffect(() => {
    setPage(1);
  }, [category, q]);

  useEffect(() => {
    if (open) {
      setPage(1);
      setSelectedId(null);
    }
  }, [open]);

  const { pageItems, totalPages, safePage } = usePageSlice(
    items,
    page,
    PAGE_SIZE
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const selected = selectedId
    ? (GALLERY.find((g) => g.id === selectedId) ?? null)
    : null;

  const langOptions = selected ? languagesForGallery(selected) : allRunnable;
  const effectiveLang = langOptions.includes(openLang)
    ? openLang
    : (langOptions[0] ?? "python");

  const openSelected = (lang: LangId = effectiveLang) => {
    if (!selected) return;
    const langs = languagesForGallery(selected);
    const chosen = langs.includes(lang) ? lang : selected.langId;
    onOpen(selected, chosen);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Public Gallery" wide>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Pick an example, choose any language, then open it in a new tab. You can
        also switch language later from the toolbar.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search examples…"
          className="min-w-[12rem] flex-1 rounded-md border border-[var(--border)] bg-[#1e1f22] px-3 py-1.5 text-xs text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex flex-wrap gap-1">
          <CatChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All"
          />
          {GALLERY_CATEGORIES.map((c) => (
            <CatChip
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
            />
          ))}
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-[var(--border)] bg-[#1e1f22] p-3">
        <LangPicker
          label="Open in language"
          value={effectiveLang}
          options={langOptions}
          onChange={setOpenLang}
          recommended={selected?.langId}
        />
        {selected ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--text)]">
              Selected:{" "}
              <span className="font-semibold text-[var(--text-bright)]">
                {selected.title}
              </span>
              {effectiveLang !== selected.langId && (
                <span className="text-[var(--text-dim)]">
                  {" "}
                  · original is {getLanguage(selected.langId).label}; you will
                  get a {getLanguage(effectiveLang).label} template
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => openSelected()}
              className="min-h-9 w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] sm:w-auto"
            >
              Open example
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--text-dim)]">
            Click an example below to select it, then open with your language.
            Double-click opens in the example&apos;s original language.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pageItems.map((item) => {
          const lang = getLanguage(item.langId);
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedId(item.id);
                setOpenLang(item.langId);
              }}
              onDoubleClick={() => {
                onOpen(item, item.langId);
                onClose();
              }}
              className={`rounded-lg border p-3 text-left transition active:scale-[0.99] ${
                active
                  ? "border-[var(--accent)] bg-[#252628] ring-1 ring-[var(--accent)]"
                  : "border-[var(--border)] bg-[#1e1f22] hover:border-[var(--accent)] hover:bg-[#252628]"
              }`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: lang.badgeColor }}
                />
                <span className="text-xs font-semibold text-[var(--text-bright)]">
                  {item.title}
                </span>
              </div>
              <p className="mb-2 text-[11px] leading-snug text-[var(--text-dim)]">
                {item.description}
              </p>
              <span className="rounded bg-[#3d3f43] px-1.5 py-0.5 text-[10px] text-[var(--text)]">
                {lang.label}
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full py-6 text-center text-xs text-[var(--text-dim)]">
            No examples match your search.
          </p>
        )}
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={items.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </Modal>
  );
}

function CatChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] ${
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-[#3d3f43] text-[var(--text)] hover:bg-[#45474c]"
      }`}
    >
      {label}
    </button>
  );
}
