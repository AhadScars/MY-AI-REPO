"use client";

import { useState } from "react";
import type { LangId } from "@/lib/languages";
import { getLanguage } from "@/lib/languages";
import type { Problem, TestRunResult } from "@/lib/problems";

type ProblemPanelProps = {
  problem: Problem;
  /** Language the student is currently using */
  langId: LangId;
  isRunning: boolean;
  results: TestRunResult[] | null;
  onRunTests: () => void;
  onClear: () => void;
};

export function ProblemPanel({
  problem,
  langId,
  isRunning,
  results,
  onRunTests,
  onClear,
}: ProblemPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const passed = results?.filter((r) => r.passed).length ?? 0;
  const total = results?.length ?? 0;
  const allPassed = results != null && total > 0 && passed === total;
  const lang = getLanguage(langId);

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[#252628]">
      <div className="flex flex-wrap items-start justify-between gap-2 px-2 py-2 sm:px-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold text-[var(--text-bright)]">
              {problem.title}
            </span>
            <span className="rounded bg-[#3d3f43] px-1.5 py-0.5 text-[10px] capitalize text-[var(--text)]">
              {problem.difficulty}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-bright)]"
              style={{ background: `${lang.badgeColor}33` }}
              title="Change language from the toolbar anytime"
            >
              {lang.label}
            </span>
            {results && (
              <span
                className={`text-[10px] font-semibold ${
                  allPassed ? "text-[var(--success)]" : "text-[var(--warning)]"
                }`}
              >
                {passed}/{total} passed
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded px-1.5 py-0.5 text-[10px] text-[var(--accent)] hover:underline sm:hidden"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          </div>
          <p
            className={`mt-1 max-w-3xl text-[11px] leading-relaxed text-[var(--text-dim)] ${
              expanded ? "block" : "hidden sm:block"
            }`}
          >
            {problem.description}
            {problem.constraints ? (
              <span className="mt-0.5 block text-[10px] opacity-80">
                Constraints: {problem.constraints}
              </span>
            ) : null}
            <span className="mt-0.5 block text-[10px] opacity-80">
              Solve in any language — switch via the toolbar. Tests use{" "}
              {lang.label}.
            </span>
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onRunTests}
            disabled={isRunning}
            className="min-h-9 flex-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:flex-none"
          >
            {isRunning ? "Testing…" : "Run tests"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isRunning}
            className="min-h-9 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)] hover:bg-[#3d3f43] disabled:opacity-50 sm:min-h-0"
            title="Leave problem mode"
          >
            Close
          </button>
        </div>
      </div>

      {results && results.length > 0 && (
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain border-t border-[var(--border-soft)] px-2 py-2 sm:px-3">
          {results.map((r) => (
            <div
              key={r.testId}
              className={`min-w-[7rem] max-w-[14rem] shrink-0 rounded-md border px-2 py-1.5 text-[10px] sm:min-w-[8rem] ${
                r.passed
                  ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]"
                  : "border-[var(--error)]/40 bg-[var(--error)]/10 text-[var(--error)]"
              }`}
              title={
                r.hidden
                  ? r.passed
                    ? "Hidden test passed"
                    : r.error || "Hidden test failed"
                  : r.error ||
                    (r.passed
                      ? "Passed"
                      : `Expected:\n${r.expected}\n\nGot:\n${r.actual}`)
              }
            >
              <div className="font-semibold">
                {r.passed ? "✓" : "✗"}{" "}
                {r.hidden ? "Hidden test" : r.label}
              </div>
              {!r.hidden && !r.passed && r.actual !== undefined && (
                <div className="mt-0.5 truncate font-mono opacity-80">
                  got: {r.actual.trim() || "(empty)"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
