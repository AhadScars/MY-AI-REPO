/**
 * Offline resume text extraction for PDF / DOCX / plain text.
 * Uses local libraries only (no cloud OCR).
 */

export type ExtractResult = {
  text: string;
  source: "paste" | "txt" | "pdf" | "docx" | "unknown";
  pages?: number;
  charCount: number;
  warning?: string;
};

function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // common PDF hyphenation at line breaks
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

/** Very old fallback if pdf-parse fails */
function crudePdfLatin1(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];

  // Parentheses strings
  const re = /\((?:\\.|[^\\)]){2,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let s = m[0].slice(1, -1);
    s = s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{1,3})/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
    if (/[A-Za-z]{3,}/.test(s) && !/Font|Identity|Adobe|CID|Glyph/i.test(s)) {
      chunks.push(s);
    }
  }

  // Tj / TJ operators (common text show ops)
  const tj = /(?:\((?:\\.|[^\\)])*\)|\[[^\]]*\])\s*Tj/gi;
  while ((m = tj.exec(raw)) !== null) {
    const piece = m[0]
      .replace(/\)\s*Tj$/i, "")
      .replace(/^\(/, "")
      .replace(/\\n/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")");
    if (/[A-Za-z]{3,}/.test(piece)) chunks.push(piece);
  }

  return cleanExtractedText(chunks.join(" ").replace(/\s+/g, " "));
}

async function extractPdf(buf: Buffer): Promise<{ text: string; pages?: number; warning?: string }> {
  try {
    // pdf-parse v2+ class API (offline, pure local)
    const mod = await import("pdf-parse");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParse = (mod as any).PDFParse || (mod as any).default?.PDFParse;
    if (!PDFParse) {
      throw new Error("PDFParse class not found in pdf-parse package");
    }
    const parser = new PDFParse({ data: buf });
    try {
      const data = await parser.getText();
      const text = cleanExtractedText(String(data?.text || ""))
        // strip page footers like "-- 1 of 3 --"
        .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n?/g, "\n");
      const pages = typeof data?.total === "number" ? data.total : data?.pages?.length;
      if (text.length >= 40) {
        return { text, pages };
      }
    } finally {
      try {
        if (typeof parser.destroy === "function") await parser.destroy();
      } catch {
        /* ignore */
      }
    }
    // fall through if nearly empty (likely scanned)
  } catch (err) {
    console.warn("[resume-parse] pdf-parse failed, trying crude fallback", err);
  }

  const fallback = crudePdfLatin1(buf);
  if (fallback.length >= 40) {
    return {
      text: fallback,
      warning:
        "Used fallback PDF text extract — quality may be lower. Prefer text-based PDF or paste text.",
    };
  }

  throw new Error(
    "Could not read text from this PDF. It may be a scanned image. Export as a text PDF, or paste resume text."
  );
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = cleanExtractedText(result.value || "");
  if (text.length < 40) {
    throw new Error("Could not read enough text from this DOCX file.");
  }
  return text;
}

/**
 * Priority: uploaded file wins over leftover paste (old bug: paste always overrode PDF).
 */
export async function extractResumeText(opts: {
  file: File | null;
  pastedText: string;
}): Promise<ExtractResult> {
  const { file, pastedText } = opts;

  if (file && file.size > 0) {
    const name = file.name.toLowerCase();
    const type = file.type || "";
    const buf = Buffer.from(await file.arrayBuffer());

    if (
      type.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv")
    ) {
      const text = cleanExtractedText(buf.toString("utf8"));
      return { text, source: "txt", charCount: text.length };
    }

    if (type.includes("pdf") || name.endsWith(".pdf")) {
      const { text, pages, warning } = await extractPdf(buf);
      return { text, source: "pdf", pages, charCount: text.length, warning };
    }

    if (
      type.includes("wordprocessingml") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc")
    ) {
      if (name.endsWith(".doc") && !name.endsWith(".docx")) {
        throw new Error("Legacy .doc is not supported offline. Save as .docx, .pdf, or .txt.");
      }
      const text = await extractDocx(buf);
      return { text, source: "docx", charCount: text.length };
    }

    // last resort: try as utf8 text
    try {
      const text = cleanExtractedText(buf.toString("utf8"));
      if (text.length >= 40) {
        return { text, source: "unknown", charCount: text.length };
      }
    } catch {
      /* ignore */
    }

    throw new Error(
      "Unsupported file type. Upload PDF, DOCX, or TXT — or paste resume text."
    );
  }

  if (pastedText.trim()) {
    const text = cleanExtractedText(pastedText);
    return { text, source: "paste", charCount: text.length };
  }

  return { text: "", source: "unknown", charCount: 0 };
}
