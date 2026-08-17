"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useState } from "react";
import type { LangId } from "@/lib/languages";
import { usesWideTabs } from "@/lib/languages";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  language: string;
  fileName: string;
  langId: LangId;
  editorPath: string;
};

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}

export function CodeEditor({
  value,
  onChange,
  onRun,
  language,
  fileName,
  langId,
  editorPath,
}: CodeEditorProps) {
  const isNarrow = useIsNarrow();

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => onRun()
      );
      // Don't auto-focus on mobile — avoids keyboard popping open
      if (window.matchMedia("(min-width: 768px)").matches) {
        editor.focus();
      }
    },
    [onRun]
  );

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "#1e1f22",
      }}
    >
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={value}
        path={editorPath}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        loading={
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6f737a",
              fontSize: 14,
            }}
          >
            Loading editor…
          </div>
        }
        options={{
          fontSize: isNarrow ? 13 : 14,
          fontFamily:
            "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: !isNarrow, scale: 1 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: usesWideTabs(langId) ? 4 : 2,
          insertSpaces: true,
          wordWrap: "on",
          lineNumbers: isNarrow ? "on" : "on",
          lineNumbersMinChars: isNarrow ? 3 : 5,
          glyphMargin: !isNarrow,
          folding: !isNarrow,
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          padding: { top: isNarrow ? 6 : 8, bottom: isNarrow ? 6 : 8 },
          bracketPairColorization: { enabled: true },
          guides: {
            indentation: true,
            bracketPairs: !isNarrow,
          },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          formatOnPaste: true,
          // Better mobile editing
          mouseWheelZoom: true,
          scrollbar: {
            verticalScrollbarSize: isNarrow ? 8 : 12,
            horizontalScrollbarSize: isNarrow ? 8 : 12,
          },
        }}
      />
      <span className="sr-only">{fileName}</span>
    </div>
  );
}
