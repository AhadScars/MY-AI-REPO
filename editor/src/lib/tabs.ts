import type { TerminalLine } from "@/components/Terminal";
import {
  type LangId,
  fileNameFor,
  getLanguage,
} from "@/lib/languages";

export type EditorTab = {
  id: string;
  langId: LangId;
  code: string;
  stdin: string;
  lines: TerminalLine[];
  previewHtml: string;
  /** Display name override (optional) */
  title?: string;
  /** Active teacher problem id, if any */
  problemId?: string | null;
  /** Active gallery example id, if any */
  galleryId?: string | null;
};

export function createTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTab(
  langId: LangId = "java",
  overrides?: Partial<
    Pick<EditorTab, "code" | "stdin" | "title" | "problemId" | "galleryId">
  >
): EditorTab {
  const lang = getLanguage(langId);
  return {
    id: createTabId(),
    langId,
    code: overrides?.code ?? lang.sample,
    stdin: overrides?.stdin ?? lang.defaultStdin,
    lines: [],
    previewHtml: "",
    title: overrides?.title,
    problemId: overrides?.problemId ?? null,
    galleryId: overrides?.galleryId ?? null,
  };
}

/** Unique display name when multiple tabs share the same base file name. */
export function tabDisplayName(
  tab: EditorTab,
  allTabs: EditorTab[]
): string {
  if (tab.title) return tab.title;

  const base = fileNameFor(tab.langId, tab.code);
  const sameName = allTabs.filter(
    (t) => fileNameFor(t.langId, t.code) === base || t.id === tab.id
  );

  // Count siblings with same base language file pattern
  const sameLang = allTabs.filter((t) => t.langId === tab.langId);
  if (sameLang.length <= 1) return base;

  const index = sameLang.findIndex((t) => t.id === tab.id);
  if (index <= 0) return base;

  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
  const stem = base.includes(".")
    ? base.slice(0, base.lastIndexOf("."))
    : base;
  return `${stem}-${index + 1}${ext}`;
}

/** Monaco model path — must be unique per tab. */
export function tabEditorPath(tab: EditorTab, displayName: string): string {
  return `file:///${tab.id}/${displayName}`;
}
