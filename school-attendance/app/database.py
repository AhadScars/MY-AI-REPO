"""SQLite database layer. Ready to swap to Mongo/cloud later via same service APIs."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Generator, Optional

from app import config


def ensure_dirs() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    config.QR_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(str(config.DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    ensure_dirs()
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS schools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                license_key TEXT,
                license_expires_at TEXT,
                public_token TEXT UNIQUE,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS license_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_code TEXT NOT NULL UNIQUE,
                days_valid INTEGER NOT NULL DEFAULT 30,
                max_students INTEGER NOT NULL DEFAULT 500,
                school_id INTEGER,
                used_at TEXT,
                expires_at TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL DEFAULT 'admin',
                is_revoked INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (school_id) REFERENCES schools(id)
            );

            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                school_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                name TEXT NOT NULL,
                class_name TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '9140980834',
                qr_payload TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(school_id, student_id),
                FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                school_id INTEGER NOT NULL,
                student_pk INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                name TEXT NOT NULL,
                class_name TEXT NOT NULL,
                date TEXT NOT NULL,
                time_in TEXT,
                time_out TEXT,
                is_present INTEGER NOT NULL DEFAULT 0,
                UNIQUE(school_id, student_id, date),
                FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
                FOREIGN KEY (student_pk) REFERENCES students(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_attendance_school_date
                ON attendance(school_id, date);
            CREATE INDEX IF NOT EXISTS idx_students_school
                ON students(school_id);
            """
        )
        # Migrate older DBs missing public_token
        school_cols = {
            r[1]
            for r in conn.execute("PRAGMA table_info(schools)").fetchall()
        }
        if "public_token" not in school_cols:
            conn.execute("ALTER TABLE schools ADD COLUMN public_token TEXT")
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_public_token "
                "ON schools(public_token)"
            )

        # Migrate students.phone
        student_cols = {
            r[1]
            for r in conn.execute("PRAGMA table_info(students)").fetchall()
        }
        if "phone" not in student_cols:
            conn.execute(
                "ALTER TABLE students ADD COLUMN phone TEXT NOT NULL DEFAULT '9140980834'"
            )
            conn.execute(
                "UPDATE students SET phone = '9140980834' "
                "WHERE phone IS NULL OR phone = ''"
            )


def local_now() -> datetime:
    """Current local machine time (not UTC)."""
    return datetime.now()


def now_iso() -> str:
    """Local datetime string: YYYY-MM-DD HH:MM:SS."""
    return local_now().strftime("%Y-%m-%d %H:%M:%S")


def today_str() -> str:
    """Local calendar date: YYYY-MM-DD."""
    return local_now().strftime("%Y-%m-%d")


def local_time_str() -> str:
    """Local clock time: HH:MM:SS."""
    return local_now().strftime("%H:%M:%S")


def combine_local(date_str: str, time_str: str) -> datetime | None:
    """Parse date + time as local naive datetime."""
    if not date_str or not time_str:
        return None
    time_str = time_str.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(f"{date_str} {time_str}", fmt)
        except ValueError:
            continue
    # time only formats paired with date
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(f"{date_str} {time_str}", f"%Y-%m-%d {fmt}")
        except ValueError:
            continue
    return None


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]
