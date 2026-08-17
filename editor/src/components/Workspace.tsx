"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { EditorTabs } from "@/components/EditorTabs";
import { GalleryModal } from "@/components/GalleryModal";
import { Preview } from "@/components/Preview";
import { ProblemPanel } from "@/components/ProblemPanel";
import { ProblemsModal } from "@/components/ProblemsModal";
import { ShareModal } from "@/components/ShareModal";
import { Terminal, type TerminalLine } from "@/components/Terminal";
import { Toolbar } from "@/components/Toolbar";
import type { GalleryItem } from "@/lib/gallery";
import { getGalleryItem } from "@/lib/gallery";
import {
  type LangId,
  buildPreviewHtml,
  fileNameFor,
  getLanguage,
  langFromFileName,
  runCommandFor,
} from "@/lib/languages";
import {
  type Problem,
  type TestRunResult,
  getProblem,
  runProblemTests,
} from "@/lib/problems";
import { runInteractiveJudge0 } from "@/lib/runInteractive";
import { runJavaScript } from "@/lib/runJs";
import {
  buildShareUrl,
  readShareFromLocation,
} from "@/lib/share";
import {
  getGalleryCode,
  getProblemStarter,
  problemSupportsLang,
} from "@/lib/starters";
import {
  type EditorTab,
  createTab,
  tabDisplayName,
  tabEditorPath,
} from "@/lib/tabs";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function appendLines(
  items: Array<{ kind: TerminalLine["kind"]; text: string }>
): TerminalLine[] {
  return items.map((item) => ({ id: uid(), kind: item.kind, text: item.text }));
}

function updateTab(
  tabs: EditorTab[],
  tabId: string,
  patch: Partial<EditorTab> | ((tab: EditorTab) => Partial<EditorTab>)
): EditorTab[] {
  return tabs.map((t) => {
    if (t.id !== tabId) return t;
    const next = typeof patch === "function" ? patch(t) : patch;
    return { ...t, ...next };
  });
}

function formatRunStats(opts: {
  wallSec: string;
  time?: string | null;
  memory?: number | null;
}): string {
  const parts: string[] = [`Finished in ${opts.wallSec}s`];
  const detail: string[] = [];
  if (opts.time) detail.push(`${opts.time}s CPU`);
  if (opts.memory != null && opts.memory > 0) {
    const mb = opts.memory / 1024;
    detail.push(
      mb >= 1 ? `${mb.toFixed(1)} MB memory` : `${opts.memory} KB memory`
    );
  }
  if (detail.length) parts.push(`(${detail.join(" · ")})`);
  return parts.join(" ");
}

export function Workspace() {
  const first = useMemo(() => createTab("java"), []);
  const [tabs, setTabs] = useState<EditorTab[]>([first]);
  const [activeTabId, setActiveTabId] = useState(first.id);
  const [isRunning, setIsRunning] = useState(false);
  const [runningTabId, setRunningTabId] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [editorRatio, setEditorRatio] = useState(0.62);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [testResults, setTestResults] = useState<TestRunResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** Phone / small tablet: swap full-height Code vs Output instead of cramped split */
  const [isNarrow, setIsNarrow] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "output">("editor");
  const shareBootstrapped = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const runLockRef = useRef(false);
  const abortedRef = useRef(false);
  const inputResolverRef = useRef<((line: string) => void) | null>(null);
  const isNarrowRef = useRef(false);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  isNarrowRef.current = isNarrow;

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const language = useMemo(
    () => getLanguage(activeTab.langId),
    [activeTab.langId]
  );

  const displayName = useMemo(
    () => tabDisplayName(activeTab, tabs),
    [activeTab, tabs]
  );

  const editorPath = useMemo(
    () => tabEditorPath(activeTab, displayName),
    [activeTab, displayName]
  );

  const activeProblem: Problem | null = useMemo(() => {
    if (!activeTab.problemId) return null;
    return getProblem(activeTab.problemId) ?? null;
  }, [activeTab.problemId]);

  // Load shareable link on first mount
  useEffect(() => {
    if (shareBootstrapped.current) return;
    shareBootstrapped.current = true;
    if (typeof window === "undefined") return;
    const payload = readShareFromLocation(window.location.search);
    if (!payload) return;
    const tab = createTab(payload.l, {
      code: payload.c,
      stdin: payload.s,
      title: payload.t,
    });
    setTabs([tab]);
    setActiveTabId(tab.id);
    // Clean URL without losing ability to re-share
    const url = new URL(window.location.href);
    url.searchParams.delete("p");
    window.history.replaceState({}, "", url.pathname + url.hash);
  }, []);

  // Track narrow viewports (phones / small tablets in portrait)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const narrow = mq.matches;
      setIsNarrow(narrow);
      if (narrow) {
        setEditorRatio((r) => Math.min(r, 0.55));
      }
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const patchActive = useCallback(
    (patch: Partial<EditorTab> | ((tab: EditorTab) => Partial<EditorTab>)) => {
      setTabs((prev) => updateTab(prev, activeTabId, patch));
    },
    [activeTabId]
  );

  const patchTabById = useCallback(
    (
      tabId: string,
      patch: Partial<EditorTab> | ((tab: EditorTab) => Partial<EditorTab>)
    ) => {
      setTabs((prev) => updateTab(prev, tabId, patch));
    },
    []
  );

  const handleLanguageChange = useCallback(
    (id: LangId) => {
      const lang = getLanguage(id);
      setTestResults(null);

      const tab = tabsRef.current.find((t) => t.id === activeTabId);
      const problem = tab?.problemId ? getProblem(tab.problemId) : null;
      const gallery = tab?.galleryId ? getGalleryItem(tab.galleryId) : null;

      // Stay in problem mode — only swap language + starter
      if (problem) {
        if (!problemSupportsLang(problem, id)) {
          patchActive((t) => ({
            lines: [
              ...t.lines,
              ...appendLines([
                {
                  kind: "error",
                  text: `${lang.label} is not supported for this problem. Pick a terminal language.`,
                },
                { kind: "info", text: "" },
              ]),
            ],
          }));
          return;
        }
        patchActive((t) => ({
          langId: id,
          code: getProblemStarter(problem, id),
          previewHtml: "",
          stdin: lang.defaultStdin,
          problemId: problem.id,
          galleryId: null,
          title: problem.title,
          lines: [
            ...t.lines,
            ...appendLines([
              {
                kind: "system",
                text: `Language → ${lang.label} (problem: ${problem.title})`,
              },
              {
                kind: "info",
                text: "Starter reloaded for the new language. Run tests when ready.",
              },
              { kind: "info", text: "" },
            ]),
          ],
        }));
        return;
      }

      // Stay on gallery context — load example or template for new language
      if (gallery) {
        patchActive((t) => ({
          langId: id,
          code: getGalleryCode(gallery, id),
          previewHtml: "",
          stdin: lang.defaultStdin,
          problemId: null,
          galleryId: gallery.id,
          title: gallery.title,
          lines: [
            ...t.lines,
            ...appendLines([
              {
                kind: "system",
                text: `Language → ${lang.label} (gallery: ${gallery.title})`,
              },
              { kind: "info", text: "" },
            ]),
          ],
        }));
        return;
      }

      // Normal free edit
      patchActive({
        langId: id,
        code: lang.sample,
        lines: [],
        previewHtml: "",
        stdin: lang.defaultStdin,
        problemId: null,
        galleryId: null,
        title: undefined,
      });
    },
    [activeTabId, patchActive]
  );

  const handleNewTab = useCallback((langId: LangId) => {
    const tab = createTab(langId);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setTestResults(null);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          setActiveTabId(fallback.id);
          setTestResults(null);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const clearOutput = useCallback(() => {
    patchActive({ lines: [], previewHtml: "" });
  }, [patchActive]);

  const clearCode = useCallback(() => {
    patchActive((tab) => ({
      code: "",
      previewHtml: "",
      lines: [
        ...tab.lines,
        ...appendLines([
          {
            kind: "system",
            text: "Editor cleared.",
          },
          { kind: "info", text: "" },
        ]),
      ],
    }));
  }, [patchActive]);

  const resetCode = useCallback(() => {
    if (activeProblem) {
      patchActive((tab) => ({
        code: getProblemStarter(activeProblem, tab.langId),
        lines: [
          ...tab.lines,
          ...appendLines([
            {
              kind: "system",
              text: `Problem starter restored: ${activeProblem.title} (${getLanguage(tab.langId).label})`,
            },
            { kind: "info", text: "" },
          ]),
        ],
      }));
      setTestResults(null);
      return;
    }
    const gallery = activeTab.galleryId
      ? getGalleryItem(activeTab.galleryId)
      : null;
    if (gallery) {
      patchActive((tab) => ({
        code: getGalleryCode(gallery, tab.langId),
        lines: [
          ...tab.lines,
          ...appendLines([
            {
              kind: "system",
              text: `Gallery example restored: ${gallery.title}`,
            },
            { kind: "info", text: "" },
          ]),
        ],
      }));
      return;
    }
    const lang = getLanguage(activeTab.langId);
    patchActive((tab) => ({
      code: lang.sample,
      stdin: lang.defaultStdin,
      lines: [
        ...tab.lines,
        ...appendLines([
          {
            kind: "system",
            text: `${lang.label} sample code restored.`,
          },
          { kind: "info", text: "" },
        ]),
      ],
    }));
  }, [activeTab.langId, activeTab.galleryId, activeProblem, patchActive]);

  const appendToTab = useCallback(
    (
      tabId: string,
      items: Array<{ kind: TerminalLine["kind"]; text: string }>
    ) => {
      setTabs((prev) =>
        updateTab(prev, tabId, (tab) => ({
          lines: [...tab.lines, ...appendLines(items)],
        }))
      );
    },
    []
  );

  const exportCode = useCallback(() => {
    const tab = tabsRef.current.find((t) => t.id === activeTabId);
    if (!tab) return;

    const name = tabDisplayName(tab, tabsRef.current);
    const blob = new Blob([tab.code], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    appendToTab(tab.id, [
      { kind: "system", text: `Exported ${name}` },
      { kind: "info", text: "" },
    ]);
  }, [activeTabId, appendToTab]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const langId = langFromFileName(file.name) ?? activeTab.langId;
        const tab = createTab(langId, {
          code: text,
          title: file.name,
          problemId: null,
        });
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
        setTestResults(null);
        // delay append until tab exists in state — use lines on create
        setTabs((prev) =>
          updateTab(prev, tab.id, {
            lines: appendLines([
              {
                kind: "system",
                text: `Imported ${file.name} as ${getLanguage(langId).label}`,
              },
              { kind: "info", text: "" },
            ]),
          })
        );
      } catch {
        appendToTab(activeTabId, [
          { kind: "error", text: `Failed to import ${file.name}` },
          { kind: "info", text: "" },
        ]);
      }
    },
    [activeTab.langId, activeTabId, appendToTab]
  );

  const handleShare = useCallback(() => {
    const tab = tabsRef.current.find((t) => t.id === activeTabId);
    if (!tab || typeof window === "undefined") return;
    const url = buildShareUrl(window.location.origin, window.location.pathname, {
      l: tab.langId,
      c: tab.code,
      s: tab.stdin || undefined,
      t: tab.title,
    });
    setShareUrl(url);
    setShareOpen(true);
  }, [activeTabId]);

  const openGalleryItem = useCallback((item: GalleryItem, langId: LangId) => {
    const lang = getLanguage(langId);
    const code = getGalleryCode(item, langId);
    const tab = createTab(langId, {
      code,
      stdin: item.stdin ?? lang.defaultStdin,
      title: item.title,
      problemId: null,
      galleryId: item.id,
    });
    tab.lines = appendLines([
      {
        kind: "system",
        text: `Opened gallery: ${item.title} · ${lang.label}`,
      },
      ...(langId !== item.langId
        ? [
            {
              kind: "info" as const,
              text: `Original example language was ${getLanguage(item.langId).label}. Adapt the code as needed.`,
            },
          ]
        : []),
      { kind: "info", text: "" },
    ]);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setTestResults(null);
  }, []);

  const openProblem = useCallback((problem: Problem, langId: LangId) => {
    const lang = getLanguage(langId);
    const code = getProblemStarter(problem, langId);
    const tab = createTab(langId, {
      code,
      title: problem.title,
      problemId: problem.id,
      galleryId: null,
    });
    tab.lines = appendLines([
      {
        kind: "system",
        text: `Problem loaded: ${problem.title} · ${lang.label}`,
      },
      {
        kind: "info",
        text: "Write your solution in any language, then click Run tests. Change language anytime from the toolbar.",
      },
      { kind: "info", text: "" },
    ]);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setTestResults(null);
  }, []);

  const clearProblem = useCallback(() => {
    patchActive({ problemId: null, galleryId: null, title: undefined });
    setTestResults(null);
  }, [patchActive]);

  const handleRunTests = useCallback(async () => {
    if (runLockRef.current || !activeProblem) return;
    const tab = tabsRef.current.find((t) => t.id === activeTabId);
    if (!tab) return;

    runLockRef.current = true;
    abortedRef.current = false;
    setRunningTabId(tab.id);
    setIsRunning(true);
    setTestResults(null);

    appendToTab(tab.id, [
      {
        kind: "system",
        text: `> run tests · ${activeProblem.title} · ${getLanguage(tab.langId).label} (${activeProblem.tests.length} cases)`,
      },
    ]);

    try {
      const results = await runProblemTests(
        activeProblem,
        tab.code,
        tab.langId
      );
      setTestResults(results);
      const passed = results.filter((r) => r.passed).length;
      const total = results.length;
      for (const r of results) {
        if (r.hidden) {
          appendToTab(tab.id, [
            {
              kind: r.passed ? "success" : "error",
              text: r.passed
                ? `✓ Hidden test passed`
                : `✗ Hidden test failed${r.error ? `: ${r.error}` : ""}`,
            },
          ]);
        } else {
          appendToTab(tab.id, [
            {
              kind: r.passed ? "success" : "error",
              text: r.passed
                ? `✓ ${r.label}`
                : `✗ ${r.label}${r.error ? `: ${r.error}` : ""}`,
            },
          ]);
          if (!r.passed && !r.error) {
            appendToTab(tab.id, [
              {
                kind: "info",
                text: `  expected: ${JSON.stringify(r.expected)}`,
              },
              {
                kind: "info",
                text: `  got:      ${JSON.stringify(r.actual.trim())}`,
              },
            ]);
          }
        }
      }
      appendToTab(tab.id, [
        {
          kind: passed === total ? "success" : "error",
          text:
            passed === total
              ? `All ${total} tests passed`
              : `${passed}/${total} tests passed`,
        },
        { kind: "info", text: "" },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test run failed";
      appendToTab(tab.id, [
        { kind: "error", text: message },
        { kind: "info", text: "" },
      ]);
    } finally {
      setIsRunning(false);
      setRunningTabId(null);
      runLockRef.current = false;
    }
  }, [activeProblem, activeTabId, appendToTab]);

  const clearInputWait = useCallback(() => {
    setWaitingForInput(false);
    inputResolverRef.current = null;
  }, []);

  const submitProgramInput = useCallback((line: string) => {
    const resolve = inputResolverRef.current;
    if (!resolve) return;
    inputResolverRef.current = null;
    setWaitingForInput(false);
    resolve(line);
  }, []);

  const cancelRun = useCallback(() => {
    abortedRef.current = true;
    const resolve = inputResolverRef.current;
    inputResolverRef.current = null;
    setWaitingForInput(false);
    resolve?.("");
  }, []);

  const runInteractiveLanguage = useCallback(
    async (tabId: string, lang: LangId, source: string) => {
      const started = performance.now();
      const cmd = runCommandFor(lang, source);
      appendToTab(tabId, [{ kind: "system", text: cmd }]);

      const result = await runInteractiveJudge0(lang, source, {
        write: (kind, text) => {
          if (!text && kind !== "input") return;
          appendToTab(tabId, [{ kind, text }]);
        },
        readLine: () =>
          new Promise<string>((resolve) => {
            if (abortedRef.current) {
              resolve("");
              return;
            }
            setWaitingForInput(true);
            if (isNarrowRef.current) setMobilePanel("output");
            inputResolverRef.current = resolve;
          }),
        isAborted: () => abortedRef.current,
      });

      const elapsed = ((performance.now() - started) / 1000).toFixed(2);

      if (result.error && result.signal === "ABORTED") {
        appendToTab(tabId, [
          { kind: "error", text: "Process stopped." },
          { kind: "info", text: formatRunStats({ wallSec: elapsed }) },
          { kind: "info", text: "" },
        ]);
        return;
      }

      if (result.error && !result.compileFailed) {
        appendToTab(tabId, [
          { kind: "error", text: `Error: ${result.error}` },
          {
            kind: "info",
            text: formatRunStats({
              wallSec: elapsed,
              time: result.time,
              memory: result.memory,
            }),
          },
          { kind: "info", text: "" },
        ]);
        return;
      }

      appendToTab(tabId, [
        {
          kind: "info",
          text: formatRunStats({
            wallSec: elapsed,
            time: result.time,
            memory: result.memory,
          }),
        },
        { kind: "info", text: "" },
      ]);
    },
    [appendToTab]
  );

  const runCode = useCallback(async () => {
    if (runLockRef.current) return;
    const tab = tabsRef.current.find((t) => t.id === activeTabId);
    if (!tab) return;

    runLockRef.current = true;
    abortedRef.current = false;
    clearInputWait();
    setRunningTabId(tab.id);
    setIsRunning(true);
    // On phones, show output as soon as a run starts
    if (isNarrowRef.current) setMobilePanel("output");

    const lang = getLanguage(tab.langId);
    const fname = fileNameFor(tab.langId, tab.code);

    try {
      if (lang.runner === "preview") {
        const html = buildPreviewHtml(tab.langId, tab.code);
        patchTabById(tab.id, (t) => ({
          previewHtml: html,
          lines: [
            ...t.lines,
            ...appendLines([
              { kind: "system", text: `> preview ${fname}` },
              {
                kind: "success",
                text: `${lang.label} preview updated.`,
              },
              { kind: "info", text: "" },
            ]),
          ],
        }));
        return;
      }

      if (lang.runner === "browser-js") {
        const started = performance.now();
        appendToTab(tab.id, [{ kind: "system", text: `> node ${fname}` }]);
        const result = runJavaScript(tab.code);
        const elapsed = ((performance.now() - started) / 1000).toFixed(3);
        const next: Array<{ kind: TerminalLine["kind"]; text: string }> = [];
        if (result.logs.length) {
          for (const log of result.logs) next.push({ kind: "stdout", text: log });
        } else if (!result.errors.length) {
          next.push({ kind: "info", text: "(no output)" });
        }
        for (const err of result.errors) {
          next.push({ kind: "stderr", text: err });
        }
        next.push({
          kind: result.ok ? "success" : "error",
          text: result.ok
            ? "Process finished successfully"
            : "Process finished with errors",
        });
        next.push({
          kind: "info",
          text: formatRunStats({ wallSec: elapsed }),
        });
        next.push({ kind: "info", text: "" });
        appendToTab(tab.id, next);
        return;
      }

      await runInteractiveLanguage(tab.id, tab.langId, tab.code);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      appendToTab(tab.id, [
        { kind: "error", text: `Request failed: ${message}` },
        { kind: "info", text: "" },
      ]);
    } finally {
      clearInputWait();
      setIsRunning(false);
      setRunningTabId(null);
      runLockRef.current = false;
    }
  }, [
    activeTabId,
    appendToTab,
    clearInputWait,
    patchTabById,
    runInteractiveLanguage,
  ]);

  // Splitter: mouse + touch (pointer events)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const min = isNarrowRef.current ? 0.2 : 0.25;
      const max = isNarrowRef.current ? 0.8 : 0.85;
      const ratio = y / rect.height;
      setEditorRatio(Math.min(max, Math.max(min, ratio)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.(".monaco-editor")) return;
        e.preventDefault();
        void runCode();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab(activeTab.langId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleCloseTab(activeTabId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCode, handleNewTab, handleCloseTab, activeTab.langId, activeTabId]);

  // Drag-and-drop import onto workspace
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      setDragOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      setDragOver(false);
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void importFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [importFile]);

  // Reset test results when switching tabs
  useEffect(() => {
    setTestResults(null);
  }, [activeTabId]);

  const showPreview = language.outputMode === "preview";
  const runningThisTab = isRunning && runningTabId === activeTab.id;

  // On narrow screens, one full panel at a time; on desktop, resizable split
  const showEditorPane = !isNarrow || mobilePanel === "editor";
  const showOutputPane = !isNarrow || mobilePanel === "output";

  const outputPane = showPreview ? (
    <Preview
      html={activeTab.previewHtml}
      label={activeTab.langId === "css" ? "CSS Preview" : "HTML Preview"}
      tabLabel={displayName}
    />
  ) : (
    <Terminal
      lines={activeTab.lines}
      isRunning={runningThisTab}
      waitingForInput={runningThisTab && waitingForInput}
      onSubmitInput={submitProgramInput}
      onCancelRun={cancelRun}
      tabLabel={displayName}
    />
  );

  return (
    <div className="app-shell relative flex min-h-0 flex-col">
      <Toolbar
        language={language}
        fileName={displayName}
        isRunning={isRunning}
        onLanguageChange={handleLanguageChange}
        onRun={() => void runCode()}
        onClearCode={clearCode}
        onClearTerminal={clearOutput}
        onResetCode={resetCode}
        onExportCode={exportCode}
        onImportFile={(file) => void importFile(file)}
        onShare={handleShare}
        onOpenGallery={() => setGalleryOpen(true)}
        onOpenProblems={() => setProblemsOpen(true)}
      />

      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {activeProblem && (
        <ProblemPanel
          problem={activeProblem}
          langId={activeTab.langId}
          isRunning={isRunning}
          results={testResults}
          onRunTests={() => {
            if (isNarrow) setMobilePanel("output");
            void handleRunTests();
          }}
          onClear={clearProblem}
        />
      )}

      {/* Mobile: Code | Output switcher */}
      {isNarrow && (
        <div
          className="flex shrink-0 border-b border-[var(--border)] bg-[#1a1b1e] p-1"
          role="tablist"
          aria-label="Editor or output"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "editor"}
            onClick={() => setMobilePanel("editor")}
            className={`min-h-9 flex-1 rounded-md text-xs font-semibold transition ${
              mobilePanel === "editor"
                ? "bg-[#2b2d30] text-[var(--text-bright)] shadow-sm"
                : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            Code
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "output"}
            onClick={() => setMobilePanel("output")}
            className={`min-h-9 flex-1 rounded-md text-xs font-semibold transition ${
              mobilePanel === "output"
                ? "bg-[#2b2d30] text-[var(--text-bright)] shadow-sm"
                : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {showPreview ? "Preview" : "Output"}
            {runningThisTab && (
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
            )}
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
        {showEditorPane && (
          <div
            className="min-h-0 overflow-hidden"
            style={
              isNarrow
                ? { flex: "1 1 auto" }
                : { flex: `0 0 ${editorRatio * 100}%` }
            }
          >
            <CodeEditor
              value={activeTab.code}
              onChange={(value) => patchActive({ code: value })}
              onRun={() => void runCode()}
              language={language.monaco}
              fileName={displayName}
              langId={activeTab.langId}
              editorPath={editorPath}
            />
          </div>
        )}

        {!isNarrow && (
          <div
            className="splitter relative z-10 h-1.5 shrink-0 cursor-row-resize bg-[var(--border)]"
            onPointerDown={(e) => {
              e.preventDefault();
              dragging.current = true;
              document.body.style.cursor = "row-resize";
              document.body.style.userSelect = "none";
              try {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            title="Drag to resize"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize editor and output"
          />
        )}

        {showOutputPane && (
          <div
            className="min-h-0 overflow-hidden"
            style={isNarrow ? { flex: "1 1 auto" } : { flex: "1 1 0%" }}
          >
            {outputPane}
          </div>
        )}
      </div>

      {dragOver && !isNarrow && (
        <div className="pointer-events-none absolute inset-0 z-[50000] flex items-center justify-center bg-[var(--accent)]/15 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-[var(--accent)] bg-[#1e1f22]/90 px-8 py-6 text-sm font-semibold text-[var(--text-bright)] shadow-xl">
            Drop file to import
          </div>
        </div>
      )}

      <GalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onOpen={openGalleryItem}
      />
      <ProblemsModal
        open={problemsOpen}
        onClose={() => setProblemsOpen(false)}
        onOpen={openProblem}
      />
      <ShareModal
        open={shareOpen}
        url={shareUrl}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
