"""
Single-page PDF resume generator (pure Python, no external deps).
Uses built-in PDF Type1 fonts: Helvetica / Times / Courier (+ Bold / Oblique).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Date formatting
# ---------------------------------------------------------------------------

MONTHS_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]
MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def format_date(
    year: str | int | None,
    month: str | int | None = None,
    day: str | int | None = None,
    style: str = "short_month",
    present_label: str = "Present",
    is_present: bool = False,
) -> str:
    """
    style options:
      - full_month   -> January 2024
      - short_month  -> Jan 2024
      - numeric      -> 01/2024
      - numeric_day  -> 01/15/2024
      - year_only    -> 2024
      - iso          -> 2024-01
      - iso_day      -> 2024-01-15
      - month_year_dot -> Jan. 2024
    """
    if is_present:
        return present_label
    if year in (None, "", 0):
        return ""

    y = str(year).strip()
    m_raw = month
    d_raw = day

    try:
        m = int(m_raw) if m_raw not in (None, "", 0) else None
    except (TypeError, ValueError):
        # month may be name
        name = str(m_raw).strip().lower()
        m = None
        for i, full in enumerate(MONTHS_FULL, 1):
            if name in (full.lower(), MONTHS_SHORT[i - 1].lower()):
                m = i
                break

    try:
        d = int(d_raw) if d_raw not in (None, "", 0) else None
    except (TypeError, ValueError):
        d = None

    if style == "year_only" or m is None:
        return y
    if style == "full_month":
        return f"{MONTHS_FULL[m - 1]} {y}"
    if style == "short_month":
        return f"{MONTHS_SHORT[m - 1]} {y}"
    if style == "month_year_dot":
        return f"{MONTHS_SHORT[m - 1]}. {y}"
    if style == "numeric":
        return f"{m:02d}/{y}"
    if style == "numeric_day":
        dd = d or 1
        return f"{m:02d}/{dd:02d}/{y}"
    if style == "iso":
        return f"{y}-{m:02d}"
    if style == "iso_day":
        dd = d or 1
        return f"{y}-{m:02d}-{dd:02d}"
    return f"{MONTHS_SHORT[m - 1]} {y}"


def format_range(
    start: Dict[str, Any],
    end: Dict[str, Any],
    style: str = "short_month",
    present_label: str = "Present",
    separator: str = " – ",
) -> str:
    s = format_date(
        start.get("year"), start.get("month"), start.get("day"),
        style=style,
    )
    e = format_date(
        end.get("year"), end.get("month"), end.get("day"),
        style=style,
        present_label=present_label,
        is_present=bool(end.get("present")),
    )
    if s and e:
        return f"{s}{separator}{e}"
    return s or e


# ---------------------------------------------------------------------------
# Minimal PDF writer
# ---------------------------------------------------------------------------

def _pdf_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", "")
    )


def _hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
    h = (hex_color or "#000000").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r = int(h[0:2], 16) / 255.0
        g = int(h[2:4], 16) / 255.0
        b = int(h[4:6], 16) / 255.0
        return r, g, b
    except Exception:
        return 0.0, 0.0, 0.0


# Approximate character widths for Helvetica (as fraction of font size)
_HELV_WIDTHS = {
    " ": 0.278, "!": 0.278, '"': 0.355, "#": 0.556, "$": 0.556, "%": 0.889,
    "&": 0.667, "'": 0.191, "(": 0.333, ")": 0.333, "*": 0.389, "+": 0.584,
    ",": 0.278, "-": 0.333, ".": 0.278, "/": 0.278, "0": 0.556, "1": 0.556,
    "2": 0.556, "3": 0.556, "4": 0.556, "5": 0.556, "6": 0.556, "7": 0.556,
    "8": 0.556, "9": 0.556, ":": 0.278, ";": 0.278, "<": 0.584, "=": 0.584,
    ">": 0.584, "?": 0.556, "@": 1.015, "A": 0.667, "B": 0.667, "C": 0.722,
    "D": 0.722, "E": 0.667, "F": 0.611, "G": 0.778, "H": 0.722, "I": 0.278,
    "J": 0.500, "K": 0.667, "L": 0.556, "M": 0.833, "N": 0.722, "O": 0.778,
    "P": 0.667, "Q": 0.778, "R": 0.722, "S": 0.667, "T": 0.611, "U": 0.722,
    "V": 0.667, "W": 0.944, "X": 0.667, "Y": 0.667, "Z": 0.611, "[": 0.278,
    "\\": 0.278, "]": 0.278, "^": 0.469, "_": 0.556, "`": 0.333, "a": 0.556,
    "b": 0.556, "c": 0.500, "d": 0.556, "e": 0.556, "f": 0.278, "g": 0.556,
    "h": 0.556, "i": 0.222, "j": 0.222, "k": 0.500, "l": 0.222, "m": 0.833,
    "n": 0.556, "o": 0.556, "p": 0.556, "q": 0.556, "r": 0.333, "s": 0.500,
    "t": 0.278, "u": 0.556, "v": 0.500, "w": 0.722, "x": 0.500, "y": 0.500,
    "z": 0.500, "{": 0.334, "|": 0.260, "}": 0.334, "~": 0.584,
}
_HELV_BOLD_SCALE = 1.05
_TIMES_SCALE = 0.95
_COURIER_WIDTH = 0.60


def text_width(text: str, size: float, font: str = "Helvetica") -> float:
    family = (font or "Helvetica").split("-")[0]
    bold = "Bold" in (font or "")
    if family == "Courier":
        return len(text) * size * _COURIER_WIDTH
    total = 0.0
    for ch in text:
        w = _HELV_WIDTHS.get(ch, 0.556)
        if family == "Times":
            w *= _TIMES_SCALE
        if bold:
            w *= _HELV_BOLD_SCALE
        total += w
    return total * size


def wrap_text(text: str, max_width: float, size: float, font: str = "Helvetica") -> List[str]:
    text = (text or "").replace("\r", "")
    if not text:
        return []
    lines: List[str] = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split(" ")
        current = ""
        for word in words:
            trial = word if not current else current + " " + word
            if text_width(trial, size, font) <= max_width:
                current = trial
            else:
                if current:
                    lines.append(current)
                # hard-break long words
                if text_width(word, size, font) > max_width:
                    chunk = ""
                    for ch in word:
                        if text_width(chunk + ch, size, font) <= max_width:
                            chunk += ch
                        else:
                            if chunk:
                                lines.append(chunk)
                            chunk = ch
                    current = chunk
                else:
                    current = word
        if current or not words:
            lines.append(current)
    return lines


class PDFBuilder:
    """Very small single-page PDF content stream builder (A4 by default)."""

    def __init__(self, width: float = 595.28, height: float = 841.89):
        self.width = width
        self.height = height
        self.ops: List[str] = []
        self._font = "Helvetica"
        self._size = 11.0

    def set_fill(self, hex_color: str) -> None:
        r, g, b = _hex_to_rgb(hex_color)
        self.ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg")

    def set_stroke(self, hex_color: str) -> None:
        r, g, b = _hex_to_rgb(hex_color)
        self.ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG")

    def set_font(self, name: str, size: float) -> None:
        self._font = name
        self._size = size
        self.ops.append(f"/{name} {size:.2f} Tf")

    def rect(self, x: float, y: float, w: float, h: float, fill: bool = True, stroke: bool = False) -> None:
        mode = "f" if fill and not stroke else ("S" if stroke and not fill else "B")
        self.ops.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re {mode}")

    def line(self, x1: float, y1: float, x2: float, y2: float, width: float = 0.8) -> None:
        self.ops.append(f"{width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S")

    def text(self, x: float, y: float, content: str, font: Optional[str] = None, size: Optional[float] = None) -> None:
        if font or size:
            self.set_font(font or self._font, size or self._size)
        safe = _pdf_escape(content)
        self.ops.append(f"BT {x:.2f} {y:.2f} Td ({safe}) Tj ET")

    def text_right(self, right_x: float, y: float, content: str, font: str, size: float) -> None:
        w = text_width(content, size, font)
        self.text(right_x - w, y, content, font, size)

    def text_center(self, cx: float, y: float, content: str, font: str, size: float) -> None:
        w = text_width(content, size, font)
        self.text(cx - w / 2, y, content, font, size)

    def build(self) -> bytes:
        content = "\n".join(self.ops).encode("latin-1", errors="replace")
        objects: List[bytes] = []

        # 1 Catalog
        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        # 2 Pages
        objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
        # 3 Page
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width:.2f} {self.height:.2f}] "
            f"/Contents 4 0 R /Resources << /Font << "
            f"/Helvetica 5 0 R /Helvetica-Bold 6 0 R /Helvetica-Oblique 7 0 R /Helvetica-BoldOblique 8 0 R "
            f"/Times-Roman 9 0 R /Times-Bold 10 0 R /Times-Italic 11 0 R /Times-BoldItalic 12 0 R "
            f"/Courier 13 0 R /Courier-Bold 14 0 R /Courier-Oblique 15 0 R /Courier-BoldOblique 16 0 R "
            f">> >> >>".encode("ascii")
        )
        # 4 Content
        objects.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")

        fonts = [
            ("Helvetica", "Helvetica"),
            ("Helvetica-Bold", "Helvetica-Bold"),
            ("Helvetica-Oblique", "Helvetica-Oblique"),
            ("Helvetica-BoldOblique", "Helvetica-BoldOblique"),
            ("Times-Roman", "Times-Roman"),
            ("Times-Bold", "Times-Bold"),
            ("Times-Italic", "Times-Italic"),
            ("Times-BoldItalic", "Times-BoldItalic"),
            ("Courier", "Courier"),
            ("Courier-Bold", "Courier-Bold"),
            ("Courier-Oblique", "Courier-Oblique"),
            ("Courier-BoldOblique", "Courier-BoldOblique"),
        ]
        for base, name in fonts:
            objects.append(
                f"<< /Type /Font /Subtype /Type1 /BaseFont /{name} >>".encode("ascii")
            )

        # Assemble PDF
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for i, obj in enumerate(objects, 1):
            offsets.append(len(out))
            out.extend(f"{i} 0 obj\n".encode("ascii"))
            out.extend(obj)
            out.extend(b"\nendobj\n")

        xref_pos = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
        )
        return bytes(out)


def resolve_font(family: str, bold: bool = False, italic: bool = False) -> str:
    fam = (family or "Helvetica").lower()
    if fam.startswith("times"):
        if bold and italic:
            return "Times-BoldItalic"
        if bold:
            return "Times-Bold"
        if italic:
            return "Times-Italic"
        return "Times-Roman"
    if fam.startswith("courier") or fam.startswith("mono"):
        if bold and italic:
            return "Courier-BoldOblique"
        if bold:
            return "Courier-Bold"
        if italic:
            return "Courier-Oblique"
        return "Courier"
    # Helvetica default
    if bold and italic:
        return "Helvetica-BoldOblique"
    if bold:
        return "Helvetica-Bold"
    if italic:
        return "Helvetica-Oblique"
    return "Helvetica"


# ---------------------------------------------------------------------------
# Resume model helpers
# ---------------------------------------------------------------------------

DEFAULT_STYLE: Dict[str, Any] = {
    "page": {
        "size": "A4",  # A4 or Letter
        "margin_top": 36,
        "margin_bottom": 36,
        "margin_left": 40,
        "margin_right": 40,
    },
    "colors": {
        "text": "#1a1a1a",
        "name": "#0f172a",
        "heading": "#0f172a",
        "accent": "#2563eb",
        "muted": "#64748b",
        "line": "#cbd5e1",
        "header_bg": "",  # empty = no bar
        "header_text": "#0f172a",
    },
    "fonts": {
        "family": "Helvetica",  # Helvetica | Times | Courier
        "name_size": 22,
        "name_bold": True,
        "name_italic": False,
        "title_size": 11,
        "title_bold": False,
        "title_italic": True,
        "contact_size": 9,
        "contact_bold": False,
        "contact_italic": False,
        "section_size": 11,
        "section_bold": True,
        "section_italic": False,
        "section_uppercase": True,
        "item_title_size": 10.5,
        "item_title_bold": True,
        "item_title_italic": False,
        "item_sub_size": 9.5,
        "item_sub_bold": False,
        "item_sub_italic": True,
        "body_size": 9.5,
        "body_bold": False,
        "body_italic": False,
        "date_size": 9,
        "date_bold": False,
        "date_italic": False,
    },
    "layout": {
        "header_align": "center",  # left | center | right
        "section_spacing": 10,
        "item_spacing": 6,
        "line_height": 1.28,
        "show_section_lines": True,
        "line_thickness": 0.8,
        "bullet": "•",
        "date_style": "short_month",
        "date_separator": " – ",
        "present_label": "Present",
        "contact_separator": "  |  ",
        "name_spacing": 4,
        "after_header": 14,
    },
    "sections": {
        "order": [
            "summary", "experience", "education", "skills",
            "projects", "certifications", "languages", "custom",
        ],
        "labels": {
            "summary": "Professional Summary",
            "experience": "Experience",
            "education": "Education",
            "skills": "Skills",
            "projects": "Projects",
            "certifications": "Certifications",
            "languages": "Languages",
            "custom": "Additional",
        },
        "visible": {
            "summary": True,
            "experience": True,
            "education": True,
            "skills": True,
            "projects": True,
            "certifications": True,
            "languages": True,
            "custom": False,
        },
    },
}

DEFAULT_RESUME: Dict[str, Any] = {
    "header": {
        "full_name": "Alex Johnson",
        "title": "Software Engineer",
        "email": "alex.johnson@email.com",
        "phone": "+1 (555) 123-4567",
        "location": "San Francisco, CA",
        "website": "alexjohnson.dev",
        "linkedin": "linkedin.com/in/alexjohnson",
        "github": "github.com/alexj",
        "extra": "",
    },
    "summary": (
        "Results-driven software engineer with 5+ years building scalable web applications. "
        "Skilled in Python, JavaScript, and cloud infrastructure. Passionate about clean code, "
        "developer experience, and shipping polished products."
    ),
    "experience": [
        {
            "company": "TechCorp Inc.",
            "role": "Senior Software Engineer",
            "location": "San Francisco, CA",
            "start": {"month": 3, "year": 2021},
            "end": {"present": True},
            "bullets": [
                "Led redesign of core API serving 2M+ monthly requests, cutting latency by 35%.",
                "Mentored 4 junior engineers; improved onboarding docs and code-review process.",
                "Introduced CI/CD pipelines that reduced release cycle from weekly to daily.",
            ],
        },
        {
            "company": "Startup Labs",
            "role": "Software Engineer",
            "location": "Remote",
            "start": {"month": 6, "year": 2018},
            "end": {"month": 2, "year": 2021},
            "bullets": [
                "Built customer dashboard with React and Node.js used by 10k+ users.",
                "Designed PostgreSQL schema and optimized slow queries (40% faster reports).",
            ],
        },
    ],
    "education": [
        {
            "school": "State University",
            "degree": "B.S. Computer Science",
            "location": "Berkeley, CA",
            "start": {"month": 9, "year": 2014},
            "end": {"month": 5, "year": 2018},
            "details": "GPA 3.7/4.0  •  Dean's List",
        },
    ],
    "skills": [
        {"category": "Languages", "items": "Python, JavaScript/TypeScript, SQL, Go"},
        {"category": "Frameworks", "items": "React, Node.js, Django, Flask, FastAPI"},
        {"category": "Tools", "items": "Git, Docker, AWS, PostgreSQL, Linux"},
    ],
    "projects": [
        {
            "name": "Resume Maker",
            "link": "github.com/alexj/resume-maker",
            "description": "Single-page resume builder with full typography and date customization.",
            "start": {"month": 1, "year": 2024},
            "end": {"present": True},
        },
    ],
    "certifications": [
        {
            "name": "AWS Certified Developer – Associate",
            "issuer": "Amazon Web Services",
            "date": {"month": 8, "year": 2023},
        },
    ],
    "languages": [
        {"name": "English", "level": "Native"},
        {"name": "Spanish", "level": "Conversational"},
    ],
    "custom": {
        "title": "Awards",
        "items": [
            {"title": "Hackathon Winner", "subtitle": "City Tech Fair 2022", "detail": ""},
        ],
    },
    "style": DEFAULT_STYLE,
}


def deep_merge(base: Dict, override: Dict) -> Dict:
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


PAGE_SIZES = {
    "A4": (595.28, 841.89),
    "Letter": (612.0, 792.0),
}


def generate_resume_pdf(data: Dict[str, Any]) -> Tuple[bytes, Dict[str, Any]]:
    """
    Render resume to a single-page PDF.
    Returns (pdf_bytes, meta) where meta includes overflow flag and used_height.
    """
    style = deep_merge(DEFAULT_STYLE, data.get("style") or {})
    header = data.get("header") or {}
    fonts = style["fonts"]
    colors = style["colors"]
    layout = style["layout"]
    page = style["page"]
    sections_cfg = style["sections"]

    page_w, page_h = PAGE_SIZES.get(page.get("size", "A4"), PAGE_SIZES["A4"])
    ml = float(page.get("margin_left", 40))
    mr = float(page.get("margin_right", 40))
    mt = float(page.get("margin_top", 36))
    mb = float(page.get("margin_bottom", 36))
    content_w = page_w - ml - mr
    bottom_limit = mb

    pdf = PDFBuilder(page_w, page_h)
    family = fonts.get("family", "Helvetica")
    lh = float(layout.get("line_height", 1.28))
    bullet = layout.get("bullet", "•")
    date_style = layout.get("date_style", "short_month")
    date_sep = layout.get("date_separator", " – ")
    present_label = layout.get("present_label", "Present")

    # y is from bottom in PDF coords; we track cursor from top
    y_top = page_h - mt
    overflow = False

    def cursor_y(from_top: float) -> float:
        return page_h - from_top

    def ensure_space(needed: float, from_top: float) -> bool:
        nonlocal overflow
        remaining = page_h - from_top - bottom_limit
        if needed > remaining + 0.5:
            overflow = True
            return False
        return True

    def draw_text_block(
        text: str,
        from_top: float,
        size: float,
        bold: bool = False,
        italic: bool = False,
        color: str = None,
        align: str = "left",
        max_w: float = None,
        x: float = None,
    ) -> float:
        """Draw wrapped text; return new from_top."""
        nonlocal overflow
        font = resolve_font(family, bold, italic)
        max_w = max_w if max_w is not None else content_w
        x0 = ml if x is None else x
        color = color or colors["text"]
        lines = wrap_text(text, max_w, size, font)
        line_step = size * lh
        if not ensure_space(line_step * max(len(lines), 1), from_top):
            # still draw what fits
            pass
        pdf.set_fill(color)
        for line in lines:
            if from_top + line_step > page_h - bottom_limit + size:
                overflow = True
                break
            y = cursor_y(from_top) - size * 0.2
            if align == "center":
                pdf.text_center(page_w / 2, y, line, font, size)
            elif align == "right":
                pdf.text_right(page_w - mr, y, line, font, size)
            else:
                pdf.text(x0, y, line, font, size)
            from_top += line_step
        return from_top

    # ---- Header background bar ----
    header_bg = (colors.get("header_bg") or "").strip()
    header_text = colors.get("header_text") or colors.get("name") or colors["text"]
    align = layout.get("header_align", "center")

    name = (header.get("full_name") or "").strip()
    title = (header.get("title") or "").strip()
    contact_parts = []
    for key in ("email", "phone", "location", "website", "linkedin", "github", "extra"):
        val = (header.get(key) or "").strip()
        if val:
            contact_parts.append(val)
    contact = layout.get("contact_separator", "  |  ").join(contact_parts)

    # Estimate header height
    header_h = 0.0
    if name:
        header_h += fonts["name_size"] * lh
    if title:
        header_h += fonts["title_size"] * lh + 2
    if contact:
        header_h += fonts["contact_size"] * lh + 2
    header_h += float(layout.get("name_spacing", 4))

    if header_bg:
        bar_pad = 12
        pdf.set_fill(header_bg)
        pdf.rect(0, page_h - mt - header_h - bar_pad, page_w, header_h + bar_pad + mt, fill=True)

    from_top = mt

    if name:
        from_top = draw_text_block(
            name, from_top,
            fonts["name_size"],
            bold=fonts.get("name_bold", True),
            italic=fonts.get("name_italic", False),
            color=header_text if header_bg else colors.get("name", colors["text"]),
            align=align,
        )
        from_top += float(layout.get("name_spacing", 4)) * 0.3

    if title:
        from_top = draw_text_block(
            title, from_top,
            fonts["title_size"],
            bold=fonts.get("title_bold", False),
            italic=fonts.get("title_italic", True),
            color=header_text if header_bg else colors.get("muted", colors["text"]),
            align=align,
        )

    if contact:
        from_top = draw_text_block(
            contact, from_top,
            fonts["contact_size"],
            bold=fonts.get("contact_bold", False),
            italic=fonts.get("contact_italic", False),
            color=header_text if header_bg else colors.get("muted", colors["text"]),
            align=align,
        )

    from_top += float(layout.get("after_header", 14))

    # ---- Section helpers ----
    def draw_section_heading(label: str, from_top: float) -> float:
        size = fonts["section_size"]
        bold = fonts.get("section_bold", True)
        italic = fonts.get("section_italic", False)
        text = label.upper() if fonts.get("section_uppercase", True) else label
        from_top = draw_text_block(
            text, from_top, size, bold=bold, italic=italic,
            color=colors.get("heading", colors["text"]),
        )
        if layout.get("show_section_lines", True):
            y = cursor_y(from_top) + 2
            pdf.set_stroke(colors.get("accent") or colors.get("line", "#cbd5e1"))
            pdf.line(ml, y, page_w - mr, y, float(layout.get("line_thickness", 0.8)))
            from_top += 6
        else:
            from_top += 3
        return from_top

    def draw_item_header(left: str, right: str, from_top: float, left_bold=True, left_italic=False) -> float:
        """Title left, date right on same line."""
        size = fonts["item_title_size"]
        font_l = resolve_font(family, left_bold, left_italic)
        font_r = resolve_font(
            family,
            fonts.get("date_bold", False),
            fonts.get("date_italic", False),
        )
        date_size = fonts["date_size"]
        right_w = text_width(right, date_size, font_r) if right else 0
        gap = 8
        left_max = content_w - right_w - gap if right else content_w

        # date on right
        if right:
            pdf.set_fill(colors.get("muted", colors["text"]))
            pdf.text_right(
                page_w - mr,
                cursor_y(from_top) - date_size * 0.2,
                right, font_r, date_size,
            )

        lines = wrap_text(left, left_max, size, font_l)
        pdf.set_fill(colors["text"])
        for i, line in enumerate(lines):
            pdf.text(ml, cursor_y(from_top) - size * 0.2, line, font_l, size)
            from_top += size * lh
        return from_top

    def draw_bullets(items: List[str], from_top: float) -> float:
        size = fonts["body_size"]
        font = resolve_font(family, fonts.get("body_bold", False), fonts.get("body_italic", False))
        bullet_w = text_width(bullet + " ", size, font)
        for item in items:
            item = (item or "").strip()
            if not item:
                continue
            lines = wrap_text(item, content_w - bullet_w, size, font)
            for i, line in enumerate(lines):
                if not ensure_space(size * lh, from_top):
                    overflow = True
                y = cursor_y(from_top) - size * 0.2
                pdf.set_fill(colors["text"])
                if i == 0:
                    pdf.text(ml, y, f"{bullet} {line}", font, size)
                else:
                    pdf.text(ml + bullet_w, y, line, font, size)
                from_top += size * lh
        return from_top

    # ---- Sections ----
    order = sections_cfg.get("order") or DEFAULT_STYLE["sections"]["order"]
    labels = deep_merge(DEFAULT_STYLE["sections"]["labels"], sections_cfg.get("labels") or {})
    visible = deep_merge(DEFAULT_STYLE["sections"]["visible"], sections_cfg.get("visible") or {})
    section_spacing = float(layout.get("section_spacing", 10))
    item_spacing = float(layout.get("item_spacing", 6))

    for section_key in order:
        if not visible.get(section_key, True):
            continue

        if section_key == "summary":
            summary = (data.get("summary") or "").strip()
            if not summary:
                continue
            from_top += section_spacing * 0.3
            from_top = draw_section_heading(labels.get("summary", "Summary"), from_top)
            from_top = draw_text_block(
                summary, from_top, fonts["body_size"],
                bold=fonts.get("body_bold", False),
                italic=fonts.get("body_italic", False),
            )
            from_top += section_spacing * 0.5
            continue

        if section_key == "experience":
            items = data.get("experience") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("experience", "Experience"), from_top)
            for exp in items:
                role = (exp.get("role") or "").strip()
                company = (exp.get("company") or "").strip()
                loc = (exp.get("location") or "").strip()
                left = " · ".join(p for p in [role, company] if p)
                dates = format_range(
                    exp.get("start") or {}, exp.get("end") or {},
                    style=date_style, present_label=present_label, separator=date_sep,
                )
                from_top = draw_item_header(
                    left, dates, from_top,
                    left_bold=fonts.get("item_title_bold", True),
                    left_italic=fonts.get("item_title_italic", False),
                )
                if loc:
                    from_top = draw_text_block(
                        loc, from_top, fonts["item_sub_size"],
                        bold=fonts.get("item_sub_bold", False),
                        italic=fonts.get("item_sub_italic", True),
                        color=colors.get("muted"),
                    )
                from_top = draw_bullets(exp.get("bullets") or [], from_top)
                from_top += item_spacing
            from_top += section_spacing * 0.3
            continue

        if section_key == "education":
            items = data.get("education") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("education", "Education"), from_top)
            for edu in items:
                degree = (edu.get("degree") or "").strip()
                school = (edu.get("school") or "").strip()
                left = " · ".join(p for p in [degree, school] if p)
                dates = format_range(
                    edu.get("start") or {}, edu.get("end") or {},
                    style=date_style, present_label=present_label, separator=date_sep,
                )
                from_top = draw_item_header(
                    left, dates, from_top,
                    left_bold=fonts.get("item_title_bold", True),
                    left_italic=fonts.get("item_title_italic", False),
                )
                loc = (edu.get("location") or "").strip()
                if loc:
                    from_top = draw_text_block(
                        loc, from_top, fonts["item_sub_size"],
                        bold=fonts.get("item_sub_bold", False),
                        italic=fonts.get("item_sub_italic", True),
                        color=colors.get("muted"),
                    )
                details = (edu.get("details") or "").strip()
                if details:
                    from_top = draw_text_block(
                        details, from_top, fonts["body_size"],
                        bold=fonts.get("body_bold", False),
                        italic=fonts.get("body_italic", False),
                    )
                from_top += item_spacing
            from_top += section_spacing * 0.3
            continue

        if section_key == "skills":
            items = data.get("skills") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("skills", "Skills"), from_top)
            for sk in items:
                cat = (sk.get("category") or "").strip()
                vals = (sk.get("items") or "").strip()
                if cat and vals:
                    line = f"{cat}: {vals}"
                    # draw category bold + rest normal on one line if possible
                    font_b = resolve_font(family, True, False)
                    font_n = resolve_font(family, fonts.get("body_bold", False), fonts.get("body_italic", False))
                    size = fonts["body_size"]
                    prefix = f"{cat}: "
                    # simple: one wrapped block with bold category via two-pass if single line
                    if text_width(prefix + vals, size, font_n) <= content_w:
                        y = cursor_y(from_top) - size * 0.2
                        pdf.set_fill(colors["text"])
                        pdf.text(ml, y, prefix, font_b, size)
                        pdf.text(ml + text_width(prefix, size, font_b), y, vals, font_n, size)
                        from_top += size * lh
                    else:
                        from_top = draw_text_block(line, from_top, size, bold=False)
                elif vals:
                    from_top = draw_text_block(vals, from_top, fonts["body_size"])
            from_top += section_spacing * 0.5
            continue

        if section_key == "projects":
            items = data.get("projects") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("projects", "Projects"), from_top)
            for proj in items:
                name_p = (proj.get("name") or "").strip()
                link = (proj.get("link") or "").strip()
                left = name_p + (f"  ({link})" if link else "")
                dates = format_range(
                    proj.get("start") or {}, proj.get("end") or {},
                    style=date_style, present_label=present_label, separator=date_sep,
                )
                from_top = draw_item_header(left, dates, from_top)
                desc = (proj.get("description") or "").strip()
                if desc:
                    from_top = draw_text_block(desc, from_top, fonts["body_size"])
                from_top += item_spacing
            from_top += section_spacing * 0.3
            continue

        if section_key == "certifications":
            items = data.get("certifications") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("certifications", "Certifications"), from_top)
            for cert in items:
                name_c = (cert.get("name") or "").strip()
                issuer = (cert.get("issuer") or "").strip()
                left = " · ".join(p for p in [name_c, issuer] if p)
                d = cert.get("date") or {}
                right = format_date(d.get("year"), d.get("month"), d.get("day"), style=date_style)
                from_top = draw_item_header(left, right, from_top)
                from_top += item_spacing * 0.5
            from_top += section_spacing * 0.3
            continue

        if section_key == "languages":
            items = data.get("languages") or []
            if not items:
                continue
            from_top = draw_section_heading(labels.get("languages", "Languages"), from_top)
            parts = []
            for lang in items:
                n = (lang.get("name") or "").strip()
                lvl = (lang.get("level") or "").strip()
                if n and lvl:
                    parts.append(f"{n} ({lvl})")
                elif n:
                    parts.append(n)
            if parts:
                from_top = draw_text_block(", ".join(parts), from_top, fonts["body_size"])
            from_top += section_spacing * 0.5
            continue

        if section_key == "custom":
            custom = data.get("custom") or {}
            items = custom.get("items") or []
            if not items:
                continue
            label = custom.get("title") or labels.get("custom", "Additional")
            from_top = draw_section_heading(label, from_top)
            for it in items:
                title_i = (it.get("title") or "").strip()
                sub = (it.get("subtitle") or "").strip()
                left = " · ".join(p for p in [title_i, sub] if p)
                from_top = draw_item_header(left, "", from_top)
                detail = (it.get("detail") or "").strip()
                if detail:
                    from_top = draw_text_block(detail, from_top, fonts["body_size"])
                from_top += item_spacing * 0.5
            continue

    used_height = from_top
    meta = {
        "overflow": overflow or used_height > (page_h - mb),
        "used_height_pt": round(used_height, 1),
        "page_height_pt": page_h,
        "usable_height_pt": round(page_h - mt - mb, 1),
        "fill_ratio": round(min(used_height / max(page_h - mt - mb, 1), 1.0), 3),
    }
    return pdf.build(), meta


if __name__ == "__main__":
    pdf_bytes, meta = generate_resume_pdf(DEFAULT_RESUME)
    out = "exports/sample_resume.pdf"
    import os
    os.makedirs("exports", exist_ok=True)
    with open(out, "wb") as f:
        f.write(pdf_bytes)
    print("Wrote", out, meta)
