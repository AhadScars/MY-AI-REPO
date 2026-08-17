"use client";

import type { LangId } from "@/lib/languages";
import { getLanguage } from "@/lib/languages";

type LangPickerProps = {
  label?: string;
  value: LangId;
  options: LangId[];
  onChange: (id: LangId) => void;
  /** Highlight the item's original/default language */
  recommended?: LangId;
};

export function LangPicker({
  label = "Language",
  value,
  options,
  onChange,
  recommended,
}: LangPickerProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[11px] text-[var(--text-dim)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <span className="shrink-0 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LangId)}
        className="min-h-10 min-w-0 w-full flex-1 rounded-md border border-[var(--border)] bg-[#1e1f22] px-2 py-1.5 text-xs text-[var(--text-bright)] outline-none focus:border-[var(--accent)] sm:min-h-0 sm:min-w-[8rem] sm:w-auto"
      >
        {options.map((id) => {
          const lang = getLanguage(id);
          const rec = recommended === id ? " ★" : "";
          return (
            <option key={id} value={id}>
              {lang.label}
              {rec}
            </option>
          );
        })}
      </select>
      {recommended && value !== recommended && (
        <span className="text-[10px] text-[var(--warning)]">
          Original: {getLanguage(recommended).label}
        </span>
      )}
    </label>
  );
}
