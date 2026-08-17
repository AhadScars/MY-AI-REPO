"""Domain services: schools, students, attendance."""
from __future__ import annotations

import secrets
from typing import Any, Optional

from app import config
from app.auth import hash_password, verify_password
from app.database import (
    combine_local,
    db,
    local_now,
    local_time_str,
    now_iso,
    row_to_dict,
    rows_to_list,
    today_str,
)
from app.excel_sync import write_attendance_excel
from app.qr_service import parse_payload, student_payload
from app.sms_log import log_check_in, log_check_out


# ── Schools ──────────────────────────────────────────────────────────────


def _new_public_token() -> str:
    return secrets.token_urlsafe(12)


def ensure_public_token(school_id: int) -> str:
    """Ensure school has a public gate token; return it."""
    with db() as conn:
        row = conn.execute(
            "SELECT public_token FROM schools WHERE id = ?", (school_id,)
        ).fetchone()
        if not row:
            return ""
        token = row["public_token"]
        if token:
            return token
        token = _new_public_token()
        conn.execute(
            "UPDATE schools SET public_token = ? WHERE id = ?", (token, school_id)
        )
        return token


def create_school(
    name: str,
    username: str,
    password: str,
    license_key: str | None = None,
    license_expires_at: str | None = None,
) -> tuple[bool, str, Optional[dict]]:
    name = name.strip()
    username = username.strip().lower()
    if not name or not username or not password:
        return False, "Name, username and password are required.", None
    token = _new_public_token()
    with db() as conn:
        exists = conn.execute(
            "SELECT id FROM schools WHERE username = ?", (username,)
        ).fetchone()
        if exists:
            return False, "Username already taken.", None
        cur = conn.execute(
            """
            INSERT INTO schools
                (name, username, password_hash, license_key, license_expires_at,
                 public_token, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                name,
                username,
                hash_password(password),
                license_key,
                license_expires_at,
                token,
                now_iso(),
            ),
        )
        sid = cur.lastrowid
        row = conn.execute("SELECT * FROM schools WHERE id = ?", (sid,)).fetchone()
        return True, "School created.", dict(row)


def authenticate_school(username: str, password: str) -> Optional[dict]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM schools WHERE username = ?", (username.strip().lower(),)
        ).fetchone()
        if not row:
            return None
        if not verify_password(row["password_hash"], password):
            return None
        return dict(row)


def get_school(school_id: int) -> Optional[dict]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM schools WHERE id = ?", (school_id,)
        ).fetchone()
        school = row_to_dict(row)
    if school and not school.get("public_token"):
        school["public_token"] = ensure_public_token(school_id)
    return school


def get_school_by_token(token: str) -> Optional[dict]:
    token = (token or "").strip()
    if not token:
        return None
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM schools WHERE public_token = ? AND is_active = 1",
            (token,),
        ).fetchone()
        return row_to_dict(row)


def list_schools() -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            """
            SELECT s.*,
                (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) AS student_count
            FROM schools s
            ORDER BY s.id DESC
            """
        ).fetchall()
        return rows_to_list(rows)


def set_school_active(school_id: int, active: bool) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE schools SET is_active = ? WHERE id = ?",
            (1 if active else 0, school_id),
        )


def delete_school(school_id: int) -> tuple[bool, str]:
    with db() as conn:
        conn.execute("DELETE FROM attendance WHERE school_id = ?", (school_id,))
        conn.execute("DELETE FROM students WHERE school_id = ?", (school_id,))
        conn.execute(
            "UPDATE license_keys SET school_id = NULL WHERE school_id = ?",
            (school_id,),
        )
        conn.execute("DELETE FROM schools WHERE id = ?", (school_id,))
        return True, "School deleted."


# ── Students ─────────────────────────────────────────────────────────────


def add_student(
    school_id: int,
    student_id: str,
    name: str,
    class_name: str,
    phone: str | None = None,
) -> tuple[bool, str, Optional[dict]]:
    student_id = student_id.strip()
    name = name.strip()
    class_name = class_name.strip()
    phone = (phone or config.DEFAULT_STUDENT_PHONE).strip() or config.DEFAULT_STUDENT_PHONE
    if not student_id or not name or not class_name:
        return False, "Student ID, name and class are required.", None
    payload = student_payload(school_id, student_id)
    with db() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO students
                    (school_id, student_id, name, class_name, phone, qr_payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (school_id, student_id, name, class_name, phone, payload, now_iso()),
            )
            pk = cur.lastrowid
        except Exception as e:
            if "UNIQUE" in str(e).upper():
                return False, "Student ID already exists in this school.", None
            raise
        row = conn.execute("SELECT * FROM students WHERE id = ?", (pk,)).fetchone()
    return True, "Student added.", dict(row)


def update_student(
    school_id: int,
    pk: int,
    student_id: str,
    name: str,
    class_name: str,
    phone: str | None = None,
) -> tuple[bool, str]:
    student_id = student_id.strip()
    name = name.strip()
    class_name = class_name.strip()
    phone = (phone or config.DEFAULT_STUDENT_PHONE).strip() or config.DEFAULT_STUDENT_PHONE
    payload = student_payload(school_id, student_id)
    with db() as conn:
        try:
            conn.execute(
                """
                UPDATE students
                SET student_id = ?, name = ?, class_name = ?, phone = ?, qr_payload = ?
                WHERE id = ? AND school_id = ?
                """,
                (student_id, name, class_name, phone, payload, pk, school_id),
            )
        except Exception as e:
            if "UNIQUE" in str(e).upper():
                return False, "Student ID already exists."
            raise
    return True, "Student updated."


def delete_student(school_id: int, pk: int) -> tuple[bool, str]:
    with db() as conn:
        conn.execute(
            "DELETE FROM students WHERE id = ? AND school_id = ?", (pk, school_id)
        )
    return True, "Student deleted."


def list_students(school_id: int) -> list[dict]:
    """List students sorted by class number → section → name."""
    from app.class_sort import sort_students

    with db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM students
            WHERE school_id = ?
            """,
            (school_id,),
        ).fetchall()
        return sort_students(rows_to_list(rows))


def get_student_by_code(school_id: int, student_id: str) -> Optional[dict]:
    with db() as conn:
        row = conn.execute(
            """
            SELECT * FROM students
            WHERE school_id = ? AND student_id = ? AND is_active = 1
            """,
            (school_id, student_id.strip()),
        ).fetchone()
        return row_to_dict(row)


# ── Attendance ───────────────────────────────────────────────────────────


def _ensure_attendance_row(conn, school_id: int, student: dict, date: str) -> dict:
    row = conn.execute(
        """
        SELECT * FROM attendance
        WHERE school_id = ? AND student_id = ? AND date = ?
        """,
        (school_id, student["student_id"], date),
    ).fetchone()
    if row:
        return dict(row)
    cur = conn.execute(
        """
        INSERT INTO attendance
            (school_id, student_pk, student_id, name, class_name,
             date, time_in, time_out, is_present)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0)
        """,
        (
            school_id,
            student["id"],
            student["student_id"],
            student["name"],
            student["class_name"],
            date,
        ),
    )
    row = conn.execute(
        "SELECT * FROM attendance WHERE id = ?", (cur.lastrowid,)
    ).fetchone()
    return dict(row)


def _cooldown_remaining(
    date_str: str, time_str: str | None, minutes: int
) -> tuple[bool, int]:
    """
    Return (blocked, minutes_left) using local PC time.
    blocked=True if last action was less than `minutes` ago.
    """
    if not time_str or minutes <= 0:
        return False, 0
    last = combine_local(date_str, time_str)
    if not last:
        return False, 0
    elapsed = (local_now() - last).total_seconds()
    need = minutes * 60
    if elapsed < need:
        left = int((need - elapsed + 59) // 60)  # ceil minutes remaining
        return True, max(1, left)
    return False, 0


def check_in(
    school_id: int,
    raw_input: str,
    school_name: str,
) -> tuple[bool, str, Optional[dict]]:
    """Check-in by QR payload or student ID. Uses local PC time + cooldown."""
    payload_school, student_id = parse_payload(raw_input)
    if not student_id:
        return False, "Enter or scan a student ID.", None
    if payload_school is not None and payload_school != school_id:
        return False, "This QR belongs to another school.", None

    student = get_student_by_code(school_id, student_id)
    if not student:
        return False, f"Student ID '{student_id}' not found.", None

    date = today_str()  # local date
    time_now = local_time_str()  # local clock
    cooldown_min = config.CHECKIN_COOLDOWN_MINUTES

    with db() as conn:
        rec = _ensure_attendance_row(conn, school_id, student, date)

        # Already checked in today and still present (not checked out)
        if rec.get("time_in") and rec.get("is_present") and not rec.get("time_out"):
            blocked, left = _cooldown_remaining(date, rec.get("time_in"), cooldown_min)
            if blocked:
                # Do NOT write to database — cool-down active
                return (
                    False,
                    (
                        f"{student['name']} already checked in at {rec['time_in']} "
                        f"(local). Try again in ~{left} min "
                        f"(cool-down {cooldown_min} min)."
                    ),
                    rec,
                )
            # Past cool-down but still marked present — no second check-in write
            return (
                False,
                (
                    f"{student['name']} already checked in at {rec['time_in']} "
                    f"(local). Use Check out first."
                ),
                rec,
            )

        # Re-entry after check-out: respect cool-down from last check-in
        if rec.get("time_in") and rec.get("time_out"):
            blocked, left = _cooldown_remaining(date, rec.get("time_in"), cooldown_min)
            if blocked:
                return (
                    False,
                    (
                        f"{student['name']} checked in at {rec['time_in']} (local). "
                        f"Cool-down active — try again in ~{left} min."
                    ),
                    rec,
                )
            # Allow re-check-in: new local time_in, clear time_out
            conn.execute(
                """
                UPDATE attendance
                SET time_in = ?, time_out = NULL, is_present = 1,
                    name = ?, class_name = ?
                WHERE id = ?
                """,
                (time_now, student["name"], student["class_name"], rec["id"]),
            )
        else:
            # First check-in of the day
            conn.execute(
                """
                UPDATE attendance
                SET time_in = ?, is_present = 1, name = ?, class_name = ?
                WHERE id = ?
                """,
                (time_now, student["name"], student["class_name"], rec["id"]),
            )

        rec = dict(
            conn.execute(
                "SELECT * FROM attendance WHERE id = ?", (rec["id"],)
            ).fetchone()
        )

    try:
        write_attendance_excel(school_id, school_name, date)
    except Exception:
        pass  # Excel is best-effort; DB is source of truth

    # Always write SMS.txt on successful check-in
    log_check_in(
        student["name"],
        time_now,
        phone=student.get("phone") or config.DEFAULT_STUDENT_PHONE,
    )

    return True, f"Checked in: {student['name']} at {time_now} (local)", rec


def check_out(
    school_id: int,
    raw_input: str,
    school_name: str,
) -> tuple[bool, str, Optional[dict]]:
    """Check-out / logout. Uses local PC time + cool-down against double-tap."""
    payload_school, student_id = parse_payload(raw_input)
    if not student_id:
        return False, "Enter or scan a student ID.", None
    if payload_school is not None and payload_school != school_id:
        return False, "This QR belongs to another school.", None

    student = get_student_by_code(school_id, student_id)
    if not student:
        return False, f"Student ID '{student_id}' not found.", None

    date = today_str()
    time_now = local_time_str()
    cooldown_min = config.CHECKOUT_COOLDOWN_MINUTES

    with db() as conn:
        rec = _ensure_attendance_row(conn, school_id, student, date)
        if not rec.get("time_in"):
            return (
                False,
                f"{student['name']} has not checked in today.",
                rec,
            )
        if rec.get("time_out"):
            blocked, left = _cooldown_remaining(date, rec.get("time_out"), cooldown_min)
            if blocked:
                return (
                    False,
                    (
                        f"{student['name']} already checked out at {rec['time_out']} "
                        f"(local). Try again in ~{left} min."
                    ),
                    rec,
                )
            return (
                False,
                f"{student['name']} already checked out at {rec['time_out']} (local).",
                rec,
            )

        conn.execute(
            "UPDATE attendance SET time_out = ? WHERE id = ?",
            (time_now, rec["id"]),
        )
        rec = dict(
            conn.execute(
                "SELECT * FROM attendance WHERE id = ?", (rec["id"],)
            ).fetchone()
        )

    try:
        write_attendance_excel(school_id, school_name, date)
    except Exception:
        pass

    # Always write SMS.txt on successful check-out
    log_check_out(
        student["name"],
        time_now,
        phone=student.get("phone") or config.DEFAULT_STUDENT_PHONE,
    )

    return True, f"Checked out: {student['name']} at {time_now} (local)", rec


def list_attendance(school_id: int, date: str | None = None) -> list[dict]:
    """Attendance rows sorted by class → section → name."""
    from app.class_sort import sort_students

    date = date or today_str()
    with db() as conn:
        students = sort_students(
            rows_to_list(
                conn.execute(
                    """
                    SELECT * FROM students
                    WHERE school_id = ? AND is_active = 1
                    """,
                    (school_id,),
                ).fetchall()
            )
        )
        att_rows = {
            r["student_id"]: dict(r)
            for r in conn.execute(
                """
                SELECT * FROM attendance
                WHERE school_id = ? AND date = ?
                """,
                (school_id, date),
            ).fetchall()
        }

    result = []
    for s in students:
        a = att_rows.get(s["student_id"])
        if a:
            result.append(
                {
                    "student_id": s["student_id"],
                    "name": s["name"],
                    "class_name": s["class_name"],
                    "date": date,
                    "time_in": a.get("time_in"),
                    "time_out": a.get("time_out"),
                    "is_present": bool(a.get("is_present")),
                }
            )
        else:
            result.append(
                {
                    "student_id": s["student_id"],
                    "name": s["name"],
                    "class_name": s["class_name"],
                    "date": date,
                    "time_in": None,
                    "time_out": None,
                    "is_present": False,
                }
            )
    return result


def attendance_summary(school_id: int, date: str | None = None) -> dict[str, int]:
    rows = list_attendance(school_id, date)
    total = len(rows)
    present = sum(1 for r in rows if r["is_present"])
    checked_out = sum(1 for r in rows if r.get("time_out"))
    return {
        "total": total,
        "present": present,
        "absent": total - present,
        "checked_out": checked_out,
        "still_in": present - checked_out,
    }
