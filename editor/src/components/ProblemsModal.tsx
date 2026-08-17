"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { LangPicker } from "@/components/LangPicker";
import { Pagination, usePageSlice } from "@/components/Pagination";
import { PROBLEMS, type Problem } from "@/lib/problems";
import { getLanguage, type LangId } from "@/lib/languages";
import { languagesForProblem, runnableLangIds } from "@/lib/starters";

const PAGE_SIZE = 5;

type ProblemsModalProps = {
  open: boolean;
  onClose: () => void;
  onOpen: (problem: Problem, langId: LangId) => void;
};

const DIFF_COLOR: Record<Problem["difficulty"], string> = {
  easy: "#6aab73",
  medium: "#d5b778",
  hard: "#f75464",
};

export function ProblemsModal({ open, onClose, onOpen }: ProblemsModalProps) {
  const [diff, setDiff] = useState<"all" | Problem["difficulty"]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openLang, setOpenLang] = useState<LangId>("python");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fallbackLangs = useMemo(() => runnableLangIds(), []);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (diff !== "all" && p.difficulty !== diff) return false;
      if (!query) return true;
      return (
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.langId.includes(query)
      );
    });
  }, [diff, q]);

  useEffect(() => {
    setPage(1);
  }, [diff, q]);

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
    ? (PROBLEMS.find((p) => p.id === selectedId) ?? null)
    : null;

  const langOptions = selected
    ? languagesForProblem(selected)
    : fallbackLangs;
  const effectiveLang = langOptions.includes(openLang)
    ? openLang
    : (langOptions[0] ?? "python");

  const openSelected = () => {
    if (!selected) return;
    const langs = languagesForProblem(selected);
    const lang = langs.includes(effectiveLang)
      ? effectiveLang
      : selected.langId;
    onOpen(selected, lang);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Teacher Problem Pack" wide>
      <p className="mb-3 text-xs text-[var(--text-dim)]">
        Choose a problem and solve it in{" "}
        <span className="text-[var(--text)]">any language</span> you like. Tests
        check stdin/stdout, not the language.{" "}
        <span className="text-[var(--text)]">{PROBLEMS.length} problems</span>{" "}
        available.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems…"
          className="min-w-[12rem] flex-1 rounded-md border border-[var(--border)] bg-[#1e1f22] px-3 py-1.5 text-xs text-[var(--text-bright)] outline-none focus:border-[var(--accent)]"
        />
        {(["all", "easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDiff(d)}
            className={`rounded-full px-2.5 py-1 text-[11px] capitalize ${
              diff === d
                ? "bg-[var(--accent)] text-white"
                : "bg-[#3d3f43] text-[var(--text)] hover:bg-[#45474c]"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-[var(--border)] bg-[#1e1f22] p-3">
        <LangPicker
          label="Solve in language"
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
                  · starter for {getLanguage(effectiveLang).label} (default was{" "}
                  {getLanguage(selected.langId).label})
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={openSelected}
              className="min-h-9 w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] sm:w-auto"
            >
              Open problem
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--text-dim)]">
            Click a problem to select it, pick a language, then open. Double-click
            opens with the recommended language.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {pageItems.map((p) => {
          const lang = getLanguage(p.langId);
          const visibleTests = p.tests.filter((t) => !t.hidden).length;
          const hiddenTests = p.tests.filter((t) => t.hidden).length;
          const active = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedId(p.id);
                setOpenLang(p.langId);
              }}
              onDoubleClick={() => {
                onOpen(p, p.langId);
                onClose();
              }}
              className={`rounded-lg border p-3 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[#252628] ring-1 ring-[var(--accent)]"
                  : "border-[var(--border)] bg-[#1e1f22] hover:border-[var(--accent)] hover:bg-[#252628]"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-bright)]">
                  {p.title}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{
                    color: DIFF_COLOR[p.difficulty],
                    background: `${DIFF_COLOR[p.difficulty]}22`,
                  }}
                >
                  {p.difficulty}
                </span>
                <span className="rounded bg-[#3d3f43] px-1.5 py-0.5 text-[10px] text-[var(--text)]">
                  default: {lang.label}
                </span>
              </div>
              <p className="mb-1 text-[11px] leading-snug text-[var(--text-dim)]">
                {p.description}
              </p>
              <span className="text-[10px] text-[var(--text-dim)]">
                {visibleTests} sample test
                {visibleTests === 1 ? "" : "s"}
                {hiddenTests > 0 ? ` · ${hiddenTests} hidden` : ""}
              </span>
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-[var(--text-dim)]">
            No problems match your filters.
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
