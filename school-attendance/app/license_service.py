"""License key generation and subscription management."""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta
from typing import Any, Optional

from app.database import db, now_iso, row_to_dict, rows_to_list


def _generate_key_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    parts = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(4)]
    return "-".join(parts)


def create_license_key(
    days_valid: int = 30,
    max_students: int = 500,
    notes: str = "",
    created_by: str = "admin",
) -> dict[str, Any]:
    key_code = _generate_key_code()
    created = now_iso()
    with db() as conn:
        # Ensure uniqueness
        for _ in range(5):
            existing = conn.execute(
                "SELECT id FROM license_keys WHERE key_code = ?", (key_code,)
            ).fetchone()
            if not existing:
                break
            key_code = _generate_key_code()
        cur = conn.execute(
            """
            INSERT INTO license_keys
                (key_code, days_valid, max_students, notes, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (key_code, days_valid, max_students, notes, created, created_by),
        )
        lid = cur.lastrowid
        row = conn.execute("SELECT * FROM license_keys WHERE id = ?", (lid,)).fetchone()
        return dict(row)


def list_license_keys() -> list[dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT lk.*, s.name AS school_name, s.username AS school_username
            FROM license_keys lk
            LEFT JOIN schools s ON s.id = lk.school_id
            ORDER BY lk.id DESC
            """
        ).fetchall()
        return rows_to_list(rows)


def get_license_by_code(key_code: str) -> Optional[dict[str, Any]]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM license_keys WHERE key_code = ?",
            (key_code.strip().upper(),),
        ).fetchone()
        return row_to_dict(row)


def apply_license_to_school(school_id: int, key_code: str) -> tuple[bool, str]:
    """Activate or extend school subscription using an unused license key."""
    key_code = key_code.strip().upper()
    with db() as conn:
        lic = conn.execute(
            "SELECT * FROM license_keys WHERE key_code = ?", (key_code,)
        ).fetchone()
        if not lic:
            return False, "Invalid license key."
        if lic["is_revoked"]:
            return False, "This license key has been revoked."
        if lic["school_id"] is not None and lic["school_id"] != school_id:
            return False, "This license key is already used by another school."

        school = conn.execute(
            "SELECT * FROM schools WHERE id = ?", (school_id,)
        ).fetchone()
        if not school:
            return False, "School not found."

        days = int(lic["days_valid"])
        now = datetime.now()
        # If same key re-applied already linked to this school and still valid, reject re-use
        if lic["school_id"] == school_id and lic["used_at"]:
            return False, "This license key is already applied to your school."

        current_exp = school["license_expires_at"]
        base = now
        if current_exp:
            try:
                exp_dt = datetime.strptime(current_exp, "%Y-%m-%d %H:%M:%S")
                if exp_dt > now:
                    base = exp_dt
            except ValueError:
                pass

        new_exp = base + timedelta(days=days)
        new_exp_str = new_exp.strftime("%Y-%m-%d %H:%M:%S")
        used_at = now_iso()

        conn.execute(
            """
            UPDATE schools
            SET license_key = ?, license_expires_at = ?, is_active = 1
            WHERE id = ?
            """,
            (key_code, new_exp_str, school_id),
        )
        conn.execute(
            """
            UPDATE license_keys
            SET school_id = ?, used_at = ?, expires_at = ?
            WHERE id = ?
            """,
            (school_id, used_at, new_exp_str, lic["id"]),
        )
        return True, f"License applied. Valid until {new_exp_str}."


def extend_school_subscription(
    school_id: int, days: int, notes: str = ""
) -> tuple[bool, str]:
    """Main admin extends subscription without a pre-generated key."""
    if days < 1:
        return False, "Days must be at least 1."
    with db() as conn:
        school = conn.execute(
            "SELECT * FROM schools WHERE id = ?", (school_id,)
        ).fetchone()
        if not school:
            return False, "School not found."

        now = datetime.now()
        base = now
        if school["license_expires_at"]:
            try:
                exp_dt = datetime.strptime(
                    school["license_expires_at"], "%Y-%m-%d %H:%M:%S"
                )
                if exp_dt > now:
                    base = exp_dt
            except ValueError:
                pass

        new_exp = base + timedelta(days=days)
        new_exp_str = new_exp.strftime("%Y-%m-%d %H:%M:%S")
        # Create a virtual used key for audit trail
        key_code = _generate_key_code()
        created = now_iso()
        conn.execute(
            """
            INSERT INTO license_keys
                (key_code, days_valid, max_students, school_id, used_at, expires_at,
                 notes, created_at, created_by)
            VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'admin')
            """,
            (
                key_code,
                days,
                school_id,
                created,
                new_exp_str,
                notes or f"Admin extension +{days} days",
                created,
            ),
        )
        conn.execute(
            """
            UPDATE schools
            SET license_key = ?, license_expires_at = ?, is_active = 1
            WHERE id = ?
            """,
            (key_code, new_exp_str, school_id),
        )
        return True, f"Subscription extended until {new_exp_str}."


def is_school_licensed(school: dict[str, Any]) -> bool:
    if not school.get("is_active"):
        return False
    exp = school.get("license_expires_at")
    if not exp:
        return False
    try:
        exp_dt = datetime.strptime(exp, "%Y-%m-%d %H:%M:%S")
        return exp_dt >= datetime.now()
    except ValueError:
        return False


def revoke_license(key_id: int) -> tuple[bool, str]:
    with db() as conn:
        lic = conn.execute(
            "SELECT * FROM license_keys WHERE id = ?", (key_id,)
        ).fetchone()
        if not lic:
            return False, "License not found."
        conn.execute(
            "UPDATE license_keys SET is_revoked = 1 WHERE id = ?", (key_id,)
        )
        return True, "License revoked."
