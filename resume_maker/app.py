#!/usr/bin/env python3
"""
Resume Maker — single-page resume builder with full customization.
Pure Python standard library (no pip packages required).

Run:
    python3 app.py
Then open http://127.0.0.1:5050
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
import traceback
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pdf_generator import (
    DEFAULT_RESUME,
    DEFAULT_STYLE,
    deep_merge,
    generate_resume_pdf,
)
from ats_analyzer import analyze_ats, ai_status

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
TEMPLATES = ROOT / "templates"
DATA_DIR = ROOT / "data"
EXPORTS = ROOT / "exports"

HOST = os.environ.get("RESUME_HOST", "127.0.0.1")
PORT = int(os.environ.get("RESUME_PORT", "5050"))


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    EXPORTS.mkdir(parents=True, exist_ok=True)


def read_json_body(handler: BaseHTTPRequestHandler) -> Dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    raw = handler.rfile.read(length) if length else b"{}"
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def safe_filename(name: str) -> str:
    name = (name or "resume").strip()
    name = re.sub(r"[^\w\s\-\.]", "", name, flags=re.UNICODE)
    name = re.sub(r"\s+", "_", name).strip("._") or "resume"
    return name[:80]


class ResumeHandler(BaseHTTPRequestHandler):
    server_version = "ResumeMaker/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, code: int, body: bytes, content_type: str, extra_headers: Optional[Dict[str, str]] = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj: Any) -> None:
        body = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        self._send(code, body, "application/json; charset=utf-8")

    def _text(self, code: int, text: str, content_type: str = "text/plain; charset=utf-8") -> None:
        self._send(code, text.encode("utf-8"), content_type)

    def _file(self, path: Path, content_type: Optional[str] = None) -> None:
        if not path.is_file():
            self._text(404, "Not found")
            return
        data = path.read_bytes()
        ctype = content_type or mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype = ctype + "; charset=utf-8" if "charset" not in ctype else ctype
        self._send(200, data, ctype)

    # ---- routing ----
    def do_GET(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            if path in ("/", "/index.html"):
                self._file(TEMPLATES / "index.html", "text/html; charset=utf-8")
            elif path.startswith("/static/"):
                rel = path[len("/static/"):]
                # prevent path traversal
                target = (STATIC / rel).resolve()
                if not str(target).startswith(str(STATIC.resolve())):
                    self._text(403, "Forbidden")
                    return
                self._file(target)
            elif path == "/api/default":
                self._json(200, DEFAULT_RESUME)
            elif path == "/api/style-defaults":
                self._json(200, DEFAULT_STYLE)
            elif path == "/api/ats/status":
                self._json(200, ai_status())
            elif path == "/api/list":
                files = sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
                self._json(200, {
                    "resumes": [
                        {
                            "id": f.stem,
                            "name": f.stem,
                            "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
                            "size": f.stat().st_size,
                        }
                        for f in files
                    ]
                })
            elif path.startswith("/api/load/"):
                rid = urllib.parse.unquote(path[len("/api/load/"):])
                rid = safe_filename(rid)
                fp = DATA_DIR / f"{rid}.json"
                if not fp.is_file():
                    self._json(404, {"error": "Resume not found"})
                    return
                self._json(200, json.loads(fp.read_text(encoding="utf-8")))
            elif path.startswith("/exports/"):
                rel = path[len("/exports/"):]
                target = (EXPORTS / rel).resolve()
                if not str(target).startswith(str(EXPORTS.resolve())):
                    self._text(403, "Forbidden")
                    return
                self._file(target)
            else:
                self._text(404, "Not found")
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e)})

    def do_POST(self) -> None:
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            data = read_json_body(self)

            if path == "/api/pdf":
                pdf_bytes, meta = generate_resume_pdf(data)
                name = safe_filename((data.get("header") or {}).get("full_name") or "resume")
                filename = f"{name}_resume.pdf"
                # also save a copy under exports
                out = EXPORTS / filename
                out.write_bytes(pdf_bytes)
                self._send(
                    200,
                    pdf_bytes,
                    "application/pdf",
                    {
                        "Content-Disposition": f'attachment; filename="{filename}"',
                        "X-Resume-Overflow": "1" if meta.get("overflow") else "0",
                        "X-Resume-Fill": str(meta.get("fill_ratio", 0)),
                        "X-Resume-Meta": json.dumps(meta),
                    },
                )
                return

            if path == "/api/preview-meta":
                _, meta = generate_resume_pdf(data)
                self._json(200, meta)
                return

            if path == "/api/save":
                name = safe_filename(data.get("id") or (data.get("data", {}).get("header") or {}).get("full_name") or "resume")
                payload = data.get("data") if "data" in data else data
                fp = DATA_DIR / f"{name}.json"
                fp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                self._json(200, {"ok": True, "id": name, "path": str(fp)})
                return

            if path == "/api/delete":
                name = safe_filename(data.get("id") or "")
                fp = DATA_DIR / f"{name}.json"
                if fp.is_file():
                    fp.unlink()
                    self._json(200, {"ok": True})
                else:
                    self._json(404, {"error": "Not found"})
                return

            if path == "/api/export-json":
                name = safe_filename((data.get("header") or {}).get("full_name") or "resume")
                body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
                self._send(
                    200,
                    body,
                    "application/json; charset=utf-8",
                    {"Content-Disposition": f'attachment; filename="{name}_resume.json"'},
                )
                return

            if path == "/api/ats":
                # Body: { resume: {...}, job_description: "...", use_ai: bool }
                # Or raw resume dict with optional job_description / use_ai keys.
                if "resume" in data:
                    resume = data.get("resume") or {}
                    jd = data.get("job_description") or ""
                    use_ai = bool(data.get("use_ai"))
                else:
                    resume = {k: v for k, v in data.items() if k not in ("job_description", "use_ai")}
                    jd = data.get("job_description") or ""
                    use_ai = bool(data.get("use_ai"))
                report = analyze_ats(resume, job_description=jd, use_ai=use_ai)
                self._json(200, report)
                return

            self._json(404, {"error": "Unknown endpoint"})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"error": str(e), "trace": traceback.format_exc()})

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main() -> None:
    ensure_dirs()
    # smoke-generate default PDF so exports folder has a sample
    try:
        pdf_bytes, meta = generate_resume_pdf(DEFAULT_RESUME)
        sample = EXPORTS / "sample_resume.pdf"
        sample.write_bytes(pdf_bytes)
        print(f"Sample PDF ready: {sample}  (overflow={meta['overflow']}, fill={meta['fill_ratio']})")
    except Exception as e:
        print("Warning: could not pre-generate sample PDF:", e)

    httpd = ThreadingHTTPServer((HOST, PORT), ResumeHandler)
    status = ai_status()
    print("=" * 56)
    print("  Resume Maker  —  1-page customizable resume builder")
    print("=" * 56)
    print(f"  Open in browser:  http://{HOST}:{PORT}")
    if status.get("available"):
        print(f"  AI ATS: ON  (model {status.get('model')})")
    else:
        print("  AI ATS: OFF (rule-based only) — set XAI_API_KEY for SpaceXAI")
    print("  Press Ctrl+C to stop")
    print("=" * 56)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down…")
        httpd.server_close()


if __name__ == "__main__":
    main()
