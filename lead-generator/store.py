"""SQLite storage for leads, saved searches, and jobs."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "leads.db"


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS searches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                niche TEXT NOT NULL,
                location TEXT NOT NULL,
                no_website_only INTEGER NOT NULL DEFAULT 1,
                max_results INTEGER NOT NULL DEFAULT 80,
                status TEXT NOT NULL DEFAULT 'idle',
                found INTEGER DEFAULT 0,
                no_website INTEGER DEFAULT 0,
                has_website INTEGER DEFAULT 0,
                unknown INTEGER DEFAULT 0,
                schedule_days INTEGER,
                last_run TEXT,
                next_run TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                search_id INTEGER,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL DEFAULT 0,
                message TEXT,
                log TEXT,
                created_at TEXT NOT NULL,
                finished_at TEXT,
                FOREIGN KEY (search_id) REFERENCES searches(id)
            );

            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_name TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                zip TEXT,
                borough TEXT,
                neighborhood TEXT,
                niche TEXT,
                website TEXT,
                has_website INTEGER NOT NULL DEFAULT 2,
                online_presence TEXT,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                source TEXT,
                search_id INTEGER,
                osm_id TEXT,
                lat REAL,
                lon REAL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
            CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(has_website);
            CREATE INDEX IF NOT EXISTS idx_leads_niche ON leads(niche);
            """
        )


def _row(r: sqlite3.Row | None) -> dict[str, Any] | None:
    if r is None:
        return None
    return dict(r)


def create_search(niche: str, location: str, no_website_only: bool, max_results: int, schedule_days: int | None) -> int:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO searches (niche, location, no_website_only, max_results, schedule_days, next_run, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                niche,
                location,
                1 if no_website_only else 0,
                max_results,
                schedule_days,
                (datetime.now(timezone.utc) + timedelta(days=schedule_days)).isoformat()
                if schedule_days
                else None,
                utcnow(),
            ),
        )
        return int(cur.lastrowid)


def list_searches() -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM searches ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def get_search(search_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        return _row(conn.execute("SELECT * FROM searches WHERE id=?", (search_id,)).fetchone())


def update_search(search_id: int, **fields: Any) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with connect() as conn:
        conn.execute(f"UPDATE searches SET {cols} WHERE id=?", (*fields.values(), search_id))


def create_job(search_id: int | None) -> str:
    job_id = uuid.uuid4().hex[:12]
    with connect() as conn:
        conn.execute(
            "INSERT INTO jobs (id, search_id, status, progress, message, log, created_at) VALUES (?,?,?,?,?,?,?)",
            (job_id, search_id, "running", 0, "Starting…", "[]", utcnow()),
        )
    return job_id


def append_job_log(job_id: str, line: str, progress: int | None = None, message: str | None = None) -> None:
    with connect() as conn:
        row = conn.execute("SELECT log FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return
        log = json.loads(row["log"] or "[]")
        log.append({"t": utcnow(), "msg": line})
        log = log[-80:]
        fields = ["log=?"]
        vals: list[Any] = [json.dumps(log)]
        if progress is not None:
            fields.append("progress=?")
            vals.append(progress)
        if message is not None:
            fields.append("message=?")
            vals.append(message)
        vals.append(job_id)
        conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id=?", vals)


def finish_job(job_id: str, status: str, message: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE jobs SET status=?, progress=?, message=?, finished_at=? WHERE id=?",
            (status, 100 if status == "done" else 0, message, utcnow(), job_id),
        )


def get_job(job_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        row = _row(conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())
    if row and isinstance(row.get("log"), str):
        row["log"] = json.loads(row["log"] or "[]")
    return row


def list_jobs(limit: int = 20) -> list[dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["log"] = json.loads(d.get("log") or "[]")
        out.append(d)
    return out


def upsert_lead(lead: dict[str, Any]) -> tuple[int, bool]:
    """Insert or update. Returns (id, created)."""
    name = (lead.get("name") or "").strip()
    phone = (lead.get("phone") or "").strip()
    address = (lead.get("address") or "").strip()
    now = utcnow()
    with connect() as conn:
        existing = conn.execute(
            """
            SELECT id FROM leads
            WHERE lower(name)=lower(?) AND ifnull(phone,'')=? AND ifnull(address,'')=?
            """,
            (name, phone, address),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE leads SET contact_name=?, email=?, city=?, state=?, zip=?, borough=?,
                    neighborhood=?, niche=?, website=?, has_website=?, online_presence=?,
                    source=?, search_id=?, osm_id=?, lat=?, lon=?, updated_at=?
                WHERE id=?
                """,
                (
                    lead.get("contact_name"),
                    lead.get("email"),
                    lead.get("city"),
                    lead.get("state"),
                    lead.get("zip"),
                    lead.get("borough"),
                    lead.get("neighborhood"),
                    lead.get("niche"),
                    lead.get("website"),
                    lead.get("has_website", 2),
                    lead.get("online_presence"),
                    lead.get("source"),
                    lead.get("search_id"),
                    lead.get("osm_id"),
                    lead.get("lat"),
                    lead.get("lon"),
                    now,
                    existing["id"],
                ),
            )
            return int(existing["id"]), False
        cur = conn.execute(
            """
            INSERT INTO leads (
                name, contact_name, phone, email, address, city, state, zip, borough,
                neighborhood, niche, website, has_website, online_presence, notes,
                status, source, search_id, osm_id, lat, lon, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                name,
                lead.get("contact_name"),
                phone,
                lead.get("email"),
                address,
                lead.get("city"),
                lead.get("state"),
                lead.get("zip"),
                lead.get("borough"),
                lead.get("neighborhood"),
                lead.get("niche"),
                lead.get("website"),
                lead.get("has_website", 2),
                lead.get("online_presence"),
                lead.get("notes"),
                lead.get("status") or "new",
                lead.get("source"),
                lead.get("search_id"),
                lead.get("osm_id"),
                lead.get("lat"),
                lead.get("lon"),
                now,
                now,
            ),
        )
        return int(cur.lastrowid), True


def list_leads(
    q: str = "",
    niche: str = "",
    city: str = "",
    borough: str = "",
    status: str = "",
    website: str = "",
    limit: int = 500,
) -> list[dict[str, Any]]:
    sql = "SELECT * FROM leads WHERE 1=1"
    args: list[Any] = []
    if q:
        sql += " AND (name LIKE ? OR phone LIKE ? OR address LIKE ? OR contact_name LIKE ?)"
        like = f"%{q}%"
        args += [like, like, like, like]
    if niche:
        sql += " AND niche=?"
        args.append(niche)
    if city:
        sql += " AND (city LIKE ? OR borough LIKE ?)"
        args += [f"%{city}%", f"%{city}%"]
    if borough:
        sql += " AND borough=?"
        args.append(borough)
    if status:
        sql += " AND status=?"
        args.append(status)
    if website == "no":
        sql += " AND has_website=0"
    elif website == "yes":
        sql += " AND has_website=1"
    elif website == "unknown":
        sql += " AND has_website=2"
    sql += " ORDER BY updated_at DESC LIMIT ?"
    args.append(limit)
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def update_lead(lead_id: int, **fields: Any) -> dict[str, Any] | None:
    allowed = {"status", "notes", "email", "contact_name", "phone"}
    clean = {k: v for k, v in fields.items() if k in allowed}
    if not clean:
        return get_lead(lead_id)
    clean["updated_at"] = utcnow()
    cols = ", ".join(f"{k}=?" for k in clean)
    with connect() as conn:
        conn.execute(f"UPDATE leads SET {cols} WHERE id=?", (*clean.values(), lead_id))
    return get_lead(lead_id)


def get_lead(lead_id: int) -> dict[str, Any] | None:
    with connect() as conn:
        return _row(conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone())


def delete_lead(lead_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM leads WHERE id=?", (lead_id,))


def stats() -> dict[str, Any]:
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) c FROM leads").fetchone()["c"]
        no_web = conn.execute("SELECT COUNT(*) c FROM leads WHERE has_website=0").fetchone()["c"]
        has_web = conn.execute("SELECT COUNT(*) c FROM leads WHERE has_website=1").fetchone()["c"]
        unknown = conn.execute("SELECT COUNT(*) c FROM leads WHERE has_website=2").fetchone()["c"]
        new = conn.execute("SELECT COUNT(*) c FROM leads WHERE status='new'").fetchone()["c"]
        contacted = conn.execute("SELECT COUNT(*) c FROM leads WHERE status='contacted'").fetchone()["c"]
        by_borough = [
            dict(r)
            for r in conn.execute(
                "SELECT ifnull(nullif(borough,''),'Unknown') AS borough, COUNT(*) AS c FROM leads GROUP BY 1 ORDER BY c DESC"
            ).fetchall()
        ]
        by_niche = [
            dict(r)
            for r in conn.execute(
                "SELECT ifnull(nullif(niche,''),'Unknown') AS niche, COUNT(*) AS c FROM leads GROUP BY 1 ORDER BY c DESC"
            ).fetchall()
        ]
    return {
        "total": total,
        "no_website": no_web,
        "has_website": has_web,
        "unknown": unknown,
        "new": new,
        "contacted": contacted,
        "by_borough": by_borough,
        "by_niche": by_niche,
    }


def due_searches() -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM searches
            WHERE schedule_days IS NOT NULL AND next_run IS NOT NULL AND next_run <= ?
            """,
            (now,),
        ).fetchall()
    return [dict(r) for r in rows]


def mark_search_ran(search_id: int, found: int, no_website: int, has_website: int, unknown: int) -> None:
    row = get_search(search_id)
    days = (row or {}).get("schedule_days")
    next_run = None
    if days:
        next_run = (datetime.now(timezone.utc) + timedelta(days=int(days))).isoformat()
    update_search(
        search_id,
        status="idle",
        found=found,
        no_website=no_website,
        has_website=has_website,
        unknown=unknown,
        last_run=utcnow(),
        next_run=next_run,
    )
