"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const pages = pageNumbers(page, totalPages);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
      <span className="text-[11px] text-[var(--text-dim)]">
        Showing {from}–{to} of {totalItems}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <NavBtn
          label="Prev"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`e-${i}`}
              className="px-1 text-[11px] text-[var(--text-dim)]"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-h-9 min-w-9 rounded-md px-2 py-1 text-[11px] font-medium sm:min-h-0 sm:min-w-7 ${
                p === page
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[#3d3f43] text-[var(--text)] hover:bg-[#45474c]"
              }`}
            >
              {p}
            </button>
          )
        )}
        <NavBtn
          label="Next"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

function NavBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text)] hover:bg-[#3d3f43] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:px-2"
    >
      {label}
    </button>
  );
}

/** Compact page list with ellipsis, e.g. 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }

  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("…");
    out.push(n);
  }
  return out;
}

export function usePageSlice<T>(
  items: T[],
  page: number,
  pageSize: number
): { pageItems: T[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}
