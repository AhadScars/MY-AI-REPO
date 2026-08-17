"""Seed main demo school + 960 fake students (Class 1–8, sections A–D)."""
from __future__ import annotations

from datetime import datetime, timedelta

from app import config
from app.database import db, init_db, now_iso
from app.fake_students import expected_count, generate_fake_students
from app.license_service import create_license_key
from app.qr_service import student_payload
from app.services import create_school, get_school


def bulk_insert_students(school_id: int, students: list[dict[str, str]]) -> int:
    """Fast bulk insert (no per-row QR files)."""
    created = now_iso()
    default_phone = getattr(config, "DEFAULT_STUDENT_PHONE", "9140980834")
    rows = []
    for s in students:
        payload = student_payload(school_id, s["student_id"])
        phone = (s.get("phone") or default_phone).strip() or default_phone
        rows.append(
            (
                school_id,
                s["student_id"],
                s["name"],
                s["class_name"],
                phone,
                payload,
                created,
            )
        )
    with db() as conn:
        conn.executemany(
            """
            INSERT OR IGNORE INTO students
                (school_id, student_id, name, class_name, phone, qr_payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM students WHERE school_id = ?",
            (school_id,),
        ).fetchone()["c"]
    return count


def replace_demo_students(school_id: int) -> int:
    """Wipe students for a school and load 960 fake ones."""
    with db() as conn:
        conn.execute("DELETE FROM attendance WHERE school_id = ?", (school_id,))
        conn.execute("DELETE FROM students WHERE school_id = ?", (school_id,))
    return bulk_insert_students(school_id, generate_fake_students())


def ensure_demo_roster() -> None:
    """
    If demoschool exists but has fewer than the full roster, refill to 960.
    Also backfill phone numbers. Safe to call on every startup.
    """
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM schools WHERE username = ?",
            (config.DEMO_SCHOOL_USER,),
        ).fetchone()
        if not row:
            # Still backfill phones for all schools
            conn.execute(
                "UPDATE students SET phone = ? WHERE phone IS NULL OR phone = ''",
                (config.DEFAULT_STUDENT_PHONE,),
            )
            return
        school_id = row["id"]
        count = conn.execute(
            "SELECT COUNT(*) AS c FROM students WHERE school_id = ?",
            (school_id,),
        ).fetchone()["c"]
        conn.execute(
            "UPDATE students SET phone = ? WHERE phone IS NULL OR phone = ''",
            (config.DEFAULT_STUDENT_PHONE,),
        )
    target = expected_count()
    if count < target:
        replace_demo_students(school_id)


def seed_if_empty() -> None:
    init_db()
    with db() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM schools").fetchone()["c"]
        if count > 0:
            # Existing install: top up demo roster if small
            ensure_demo_roster()
            return

    # Demo license: 365 days, enough seats for 960+
    lic = create_license_key(
        days_valid=365,
        max_students=2000,
        notes="Demo school starter license",
        created_by="system",
    )
    expires = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d %H:%M:%S")
    ok, msg, school = create_school(
        name=config.DEMO_SCHOOL_NAME,
        username=config.DEMO_SCHOOL_USER,
        password=config.DEMO_SCHOOL_PASS,
        license_key=lic["key_code"],
        license_expires_at=expires,
    )
    if not ok or not school:
        return

    with db() as conn:
        conn.execute(
            """
            UPDATE license_keys
            SET school_id = ?, used_at = ?, expires_at = ?
            WHERE key_code = ?
            """,
            (school["id"], now_iso(), expires, lic["key_code"]),
        )

    bulk_insert_students(school["id"], generate_fake_students())

    # Extra unused license for testing registration
    create_license_key(
        days_valid=30,
        max_students=500,
        notes="Sample unused key for registration",
        created_by="system",
    )
