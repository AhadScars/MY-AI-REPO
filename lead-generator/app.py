#!/usr/bin/env python3
"""Lead Generator — find local businesses that do not have a website."""

from __future__ import annotations

import argparse
import sys
import threading
import time
import webbrowser
from datetime import timedelta
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory

import store
from engine import run_search
from export_xlsx import export_leads
from niches import NICHES, niche_choices
from seed import seed

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder="static", template_folder="templates")

_lock = threading.Lock()
_running_jobs: set[str] = set()


def _log(job_id: str, line: str, progress: int | None = None, message: str | None = None) -> None:
    store.append_job_log(job_id, line, progress, message)
    print(f"[{job_id}] {line}", flush=True)


def _execute_search(job_id: str, search_id: int) -> None:
    search = store.get_search(search_id)
    if not search:
        store.finish_job(job_id, "error", "Saved search not found")
        return
    store.update_search(search_id, status="running")
    try:
        leads = run_search(
            niche=search["niche"],
            location=search["location"],
            no_website_only=bool(search["no_website_only"]),
            max_results=int(search["max_results"] or 80),
            log=lambda line, progress=None, message=None: _log(job_id, line, progress, message),
        )
        created = 0
        no_web = has_web = unknown = 0
        for rec in leads:
            rec["search_id"] = search_id
            _id, is_new = store.upsert_lead(rec)
            if is_new:
                created += 1
            flag = rec.get("has_website", 2)
            if flag == 0:
                no_web += 1
            elif flag == 1:
                has_web += 1
            else:
                unknown += 1
        store.mark_search_ran(search_id, len(leads), no_web, has_web, unknown)
        msg = f"Saved {len(leads)} leads ({created} new). {no_web} with no website."
        _log(job_id, msg, 100, msg)
        store.finish_job(job_id, "done", msg)
    except Exception as exc:
        store.update_search(search_id, status="error")
        store.finish_job(job_id, "error", str(exc))
        _log(job_id, f"Failed: {exc}")
    finally:
        with _lock:
            _running_jobs.discard(job_id)


def start_job(search_id: int) -> str:
    job_id = store.create_job(search_id)
    with _lock:
        _running_jobs.add(job_id)
    t = threading.Thread(target=_execute_search, args=(job_id, search_id), daemon=True)
    t.start()
    return job_id


def scheduler_loop() -> None:
    while True:
        time.sleep(45)
        try:
            for search in store.due_searches():
                with _lock:
                    busy = bool(_running_jobs)
                if busy:
                    continue
                print(f"Scheduled re-run: {search['niche']} in {search['location']}", flush=True)
                start_job(int(search["id"]))
        except Exception as exc:
            print(f"Scheduler error: {exc}", flush=True)


@app.get("/")
def home():
    return send_from_directory(ROOT / "templates", "index.html")


@app.get("/api/niches")
def api_niches():
    return jsonify(niche_choices())


@app.get("/api/stats")
def api_stats():
    return jsonify(store.stats())


@app.get("/api/leads")
def api_leads():
    return jsonify(
        store.list_leads(
            q=request.args.get("q", ""),
            niche=request.args.get("niche", ""),
            city=request.args.get("city", ""),
            borough=request.args.get("borough", ""),
            status=request.args.get("status", ""),
            website=request.args.get("website", ""),
        )
    )


@app.patch("/api/leads/<int:lead_id>")
def api_patch_lead(lead_id: int):
    body = request.get_json(force=True, silent=True) or {}
    lead = store.update_lead(lead_id, **body)
    if not lead:
        return jsonify({"error": "Not found"}), 404
    return jsonify(lead)


@app.delete("/api/leads/<int:lead_id>")
def api_delete_lead(lead_id: int):
    store.delete_lead(lead_id)
    return jsonify({"ok": True})


@app.get("/api/searches")
def api_searches():
    return jsonify(store.list_searches())


@app.post("/api/searches")
def api_create_search():
    body = request.get_json(force=True, silent=True) or {}
    niche = (body.get("niche") or "dentist").strip()
    location = (body.get("location") or "").strip()
    if niche not in NICHES:
        return jsonify({"error": "Unknown industry"}), 400
    if not location:
        return jsonify({"error": "Location is required"}), 400
    max_results = max(10, min(int(body.get("max_results") or 60), 150))
    schedule_days = body.get("schedule_days")
    if schedule_days in ("", None):
        schedule_days = None
    else:
        schedule_days = max(1, min(int(schedule_days), 30))
    search_id = store.create_search(
        niche=niche,
        location=location,
        no_website_only=bool(body.get("no_website_only", True)),
        max_results=max_results,
        schedule_days=schedule_days,
    )
    job_id = start_job(search_id)
    return jsonify({"search_id": search_id, "job_id": job_id})


@app.post("/api/searches/<int:search_id>/rerun")
def api_rerun(search_id: int):
    if not store.get_search(search_id):
        return jsonify({"error": "Not found"}), 404
    return jsonify({"job_id": start_job(search_id)})


@app.get("/api/jobs")
def api_jobs():
    return jsonify(store.list_jobs())


@app.get("/api/jobs/<job_id>")
def api_job(job_id: str):
    job = store.get_job(job_id)
    if not job:
        return jsonify({"error": "Not found"}), 404
    return jsonify(job)


@app.post("/api/export")
def api_export():
    leads = store.list_leads(
        q=request.json.get("q", "") if request.is_json else request.args.get("q", ""),
        niche=(request.json or {}).get("niche", "") if request.is_json else request.args.get("niche", ""),
        city=(request.json or {}).get("city", "") if request.is_json else request.args.get("city", ""),
        borough=(request.json or {}).get("borough", "") if request.is_json else request.args.get("borough", ""),
        status=(request.json or {}).get("status", "") if request.is_json else request.args.get("status", ""),
        website=(request.json or {}).get("website", "no") if request.is_json else request.args.get("website", "no"),
        limit=2000,
    )
    if not leads:
        leads = store.list_leads(website="no", limit=2000)
    path = export_leads(leads)
    return jsonify({"path": str(path), "file": path.name, "count": len(leads)})


@app.get("/api/export/download/<name>")
def api_download(name: str):
    folder = ROOT / "exports"
    return send_file(folder / name, as_attachment=True)


def cli_search(args: argparse.Namespace) -> int:
    store.init()
    search_id = store.create_search(
        niche=args.niche,
        location=args.location,
        no_website_only=not args.include_with_website,
        max_results=args.max,
        schedule_days=args.every_days,
    )
    job_id = start_job(search_id)
    print(f"Job {job_id} started for {args.niche} in {args.location}")
    while True:
        job = store.get_job(job_id)
        if not job:
            print("Job disappeared")
            return 1
        print(f"  {job['progress']}%  {job.get('message') or ''}")
        if job["status"] in {"done", "error"}:
            if args.export:
                leads = store.list_leads(niche=args.niche, website="no" if not args.include_with_website else "")
                path = export_leads(leads)
                print(f"Excel: {path}")
            return 0 if job["status"] == "done" else 1
        time.sleep(2)


def main() -> int:
    store.init()
    seed()

    parser = argparse.ArgumentParser(description="Find local businesses that do not have a website.")
    sub = parser.add_subparsers(dest="cmd")

    p_ui = sub.add_parser("ui", help="Open the dashboard (default)")
    p_ui.add_argument("--host", default="127.0.0.1")
    p_ui.add_argument("--port", type=int, default=5055)
    p_ui.add_argument("--no-browser", action="store_true")

    p_s = sub.add_parser("search", help="Run one search from the terminal")
    p_s.add_argument("--niche", default="dentist", choices=sorted(NICHES))
    p_s.add_argument("--location", required=True, help='e.g. "New York, NY" or Brooklyn')
    p_s.add_argument("--max", type=int, default=60)
    p_s.add_argument("--include-with-website", action="store_true")
    p_s.add_argument("--every-days", type=int, default=None, help="Re-run automatically every N days")
    p_s.add_argument("--export", action="store_true")

    p_x = sub.add_parser("export", help="Export current no-website leads to Excel")
    p_x.add_argument("--niche", default="")
    p_x.add_argument("--all", action="store_true", help="Include businesses that already have a website")

    args = parser.parse_args()
    cmd = args.cmd or "ui"

    if cmd == "search":
        return cli_search(args)

    if cmd == "export":
        website = "" if args.all else "no"
        leads = store.list_leads(niche=args.niche, website=website, limit=2000)
        path = export_leads(leads)
        print(f"Wrote {len(leads)} leads → {path}")
        return 0

    host = getattr(args, "host", "127.0.0.1")
    port = getattr(args, "port", 5055)
    threading.Thread(target=scheduler_loop, daemon=True).start()
    url = f"http://{host}:{port}"
    print(f"Lead Generator → {url}")
    if not getattr(args, "no_browser", False):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    app.run(host=host, port=port, debug=False, threaded=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
