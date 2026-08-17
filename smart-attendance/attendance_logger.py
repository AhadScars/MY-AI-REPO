"""Attendance records: check-in/out, late/on-time/absent, manual fixes, history."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, time as dtime
from pathlib import Path
from typing import Any

from config import (
    CHECK_IN_START,
    LATE_UNTIL,
    ON_TIME_UNTIL,
    RECORDS_DIR,
    SNAPSHOTS_DIR,
    ensure_dirs,
)
from students import get_student

# Status values
STATUS_ON_TIME = "On-Time"
STATUS_LATE = "Late"
STATUS_ABSENT = "Absent"
STATUS_CHECKED_OUT = "Checked-Out"  # display helper when both times exist

SOURCE_FACE = "face"
SOURCE_MANUAL = "manual"


def _parse_hms(s: str) -> dtime:
    parts = s.strip().split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    sec = int(parts[2]) if len(parts) > 2 else 0
    return dtime(h, m, sec)


def _now_str() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def date_file_json(date_str: str | None = None) -> Path:
    ensure_dirs()
    d = date_str or _today()
    return RECORDS_DIR / f"attendance_{d}.json"


def date_file_txt(date_str: str | None = None) -> Path:
    ensure_dirs()
    d = date_str or _today()
    return RECORDS_DIR / f"attendance_{d}.txt"


def list_record_dates() -> list[str]:
    ensure_dirs()
    dates: set[str] = set()
    for p in RECORDS_DIR.glob("attendance_*.json"):
        dates.add(p.stem.replace("attendance_", ""))
    for p in RECORDS_DIR.glob("attendance_*.txt"):
        dates.add(p.stem.replace("attendance_", ""))
    # always include today
    dates.add(_today())
    return sorted(dates, reverse=True)


def classify_check_in(time_str: str) -> str:
    """Return On-Time or Late based on schedule windows."""
    t = _parse_hms(time_str)
    on_time_until = _parse_hms(ON_TIME_UNTIL)
    if t <= on_time_until:
        return STATUS_ON_TIME
    return STATUS_LATE


def _empty_day(date_str: str) -> dict[str, Any]:
    return {"date": date_str, "entries": []}


def load_day(date_str: str | None = None) -> dict[str, Any]:
    d = date_str or _today()
    path = date_file_json(d)
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            data.setdefault("date", d)
            data.setdefault("entries", [])
            return data
        except Exception:
            pass
    # Migrate legacy txt if present
    txt = date_file_txt(d)
    if txt.exists():
        migrated = _migrate_txt(d, txt)
        save_day(migrated)
        return migrated
    return _empty_day(d)


def save_day(data: dict[str, Any]) -> None:
    ensure_dirs()
    d = data.get("date") or _today()
    data["date"] = d
    path = date_file_json(d)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    _write_notepad(data)


def _write_notepad(data: dict[str, Any]) -> None:
    d = data["date"]
    path = date_file_txt(d)
    lines = [
        "SMART ATTENDANCE SYSTEM - DAILY RECORD",
        f"Date: {d}",
        f"Schedule: On-Time until {ON_TIME_UNTIL}  |  Late after",
        "=" * 88,
        f"{'No.':<5}{'Name':<20}{'ID':<10}{'Check-In':<11}{'Check-Out':<11}{'Status':<12}{'Source':<8}",
        "-" * 88,
    ]
    for i, e in enumerate(data.get("entries", []), start=1):
        lines.append(
            f"{i:<5}"
            f"{(e.get('name') or '')[:19]:<20}"
            f"{(e.get('student_id') or '-')[:9]:<10}"
            f"{(e.get('check_in') or '-'):<11}"
            f"{(e.get('check_out') or '-'):<11}"
            f"{(e.get('status') or '-'):<12}"
            f"{(e.get('source') or '-'):<8}"
        )
    lines.append("-" * 88)
    present = sum(1 for e in data.get("entries", []) if e.get("check_in") and e.get("status") != STATUS_ABSENT)
    late = sum(1 for e in data.get("entries", []) if e.get("status") == STATUS_LATE)
    absent = sum(1 for e in data.get("entries", []) if e.get("status") == STATUS_ABSENT)
    lines.append(f"Summary: Present={present}  Late={late}  Absent={absent}  Total={len(data.get('entries', []))}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _migrate_txt(date_str: str, path: Path) -> dict[str, Any]:
    data = _empty_day(date_str)
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if not parts or not parts[0].isdigit():
            continue
        time_idx = None
        for i, token in enumerate(parts):
            if len(token) == 8 and token[2] == ":" and token[5] == ":":
                time_idx = i
                break
        if time_idx is None or time_idx < 2:
            continue
        name = " ".join(parts[1:time_idx]).strip()
        check_in = parts[time_idx]
        old_status = parts[time_idx + 1] if time_idx + 1 < len(parts) else "Present"
        status = classify_check_in(check_in) if old_status.lower() in {"present", "late", "on-time", "ontime"} else old_status
        if old_status.lower() == "late":
            status = STATUS_LATE
        meta = get_student(name)
        data["entries"].append(
            {
                "name": name,
                "student_id": meta.get("student_id", ""),
                "class_name": meta.get("class_name", ""),
                "check_in": check_in,
                "check_out": "",
                "status": status if status != "Present" else classify_check_in(check_in),
                "source": SOURCE_FACE,
                "snapshot_in": "",
                "snapshot_out": "",
                "notes": "migrated",
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
    return data


def find_entry(data: dict[str, Any], name: str) -> dict[str, Any] | None:
    key = name.strip().lower()
    for e in data.get("entries", []):
        if (e.get("name") or "").strip().lower() == key:
            return e
    return None


def get_person_state(name: str, date_str: str | None = None) -> str:
    """
    Return: none | checked_in | checked_out | absent
    """
    e = find_entry(load_day(date_str), name)
    if not e:
        return "none"
    if e.get("status") == STATUS_ABSENT:
        return "absent"
    if e.get("check_out"):
        return "checked_out"
    if e.get("check_in"):
        return "checked_in"
    return "none"


def save_snapshot_frame(frame_bgr, name: str, kind: str, date_str: str | None = None) -> str:
    """Save a JPEG snapshot; return path relative to project root."""
    import cv2
    from config import BASE_DIR

    ensure_dirs()
    d = date_str or _today()
    day_dir = SNAPSHOTS_DIR / d
    day_dir.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_ " else "_" for c in name).strip().replace(" ", "_")
    ts = datetime.now().strftime("%H%M%S")
    path = day_dir / f"{safe}_{kind}_{ts}.jpg"
    cv2.imwrite(str(path), frame_bgr)
    try:
        return str(path.relative_to(BASE_DIR))
    except Exception:
        return str(path)


def check_in(
    name: str,
    *,
    time_str: str | None = None,
    source: str = SOURCE_FACE,
    snapshot_path: str = "",
    notes: str = "",
    force_status: str | None = None,
    date_str: str | None = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    """
    Record check-in. Returns (ok, message, entry).
    """
    name = name.strip()
    if not name:
        return False, "Name is empty.", None

    d = date_str or _today()
    data = load_day(d)
    existing = find_entry(data, name)
    if existing and existing.get("check_in") and existing.get("status") != STATUS_ABSENT:
        return False, f"{name} already checked in at {existing.get('check_in')}.", existing

    t = time_str or _now_str()
    status = force_status or classify_check_in(t)
    meta = get_student(name)

    if existing and existing.get("status") == STATUS_ABSENT:
        # upgrade absent -> present
        existing["check_in"] = t
        existing["check_out"] = existing.get("check_out") or ""
        existing["status"] = status
        existing["source"] = source
        if snapshot_path:
            existing["snapshot_in"] = snapshot_path
        if notes:
            existing["notes"] = notes
        existing["student_id"] = meta.get("student_id", existing.get("student_id", ""))
        existing["class_name"] = meta.get("class_name", existing.get("class_name", ""))
        existing["updated_at"] = datetime.now().isoformat(timespec="seconds")
        save_day(data)
        return True, f"Check-in updated for {name} at {t} ({status})", existing

    entry = {
        "name": name,
        "student_id": meta.get("student_id", ""),
        "class_name": meta.get("class_name", ""),
        "check_in": t,
        "check_out": "",
        "status": status,
        "source": source,
        "snapshot_in": snapshot_path,
        "snapshot_out": "",
        "notes": notes,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    data["entries"].append(entry)
    save_day(data)
    return True, f"Check-in saved for {name} at {t} ({status})", entry


def check_out(
    name: str,
    *,
    time_str: str | None = None,
    source: str = SOURCE_FACE,
    snapshot_path: str = "",
    notes: str = "",
    date_str: str | None = None,
) -> tuple[bool, str, dict[str, Any] | None]:
    name = name.strip()
    if not name:
        return False, "Name is empty.", None

    d = date_str or _today()
    data = load_day(d)
    existing = find_entry(data, name)
    if not existing or not existing.get("check_in") or existing.get("status") == STATUS_ABSENT:
        return False, f"{name} has no check-in today. Check in first.", None
    if existing.get("check_out"):
        return False, f"{name} already checked out at {existing.get('check_out')}.", existing

    t = time_str or _now_str()
    existing["check_out"] = t
    if snapshot_path:
        existing["snapshot_out"] = snapshot_path
    if notes:
        existing["notes"] = (existing.get("notes") or "") + (("; " if existing.get("notes") else "") + notes)
    if source == SOURCE_MANUAL:
        existing["source"] = SOURCE_MANUAL
    existing["updated_at"] = datetime.now().isoformat(timespec="seconds")
    save_day(data)
    return True, f"Check-out saved for {name} at {t}", existing


def mark_absent(
    name: str,
    *,
    source: str = SOURCE_MANUAL,
    notes: str = "",
    date_str: str | None = None,
) -> tuple[bool, str]:
    name = name.strip()
    d = date_str or _today()
    data = load_day(d)
    existing = find_entry(data, name)
    meta = get_student(name)
    if existing:
        if existing.get("check_in") and existing.get("status") != STATUS_ABSENT:
            return False, f"{name} already has a check-in; clear it before marking absent."
        existing["status"] = STATUS_ABSENT
        existing["check_in"] = ""
        existing["check_out"] = ""
        existing["source"] = source
        if notes:
            existing["notes"] = notes
        existing["updated_at"] = datetime.now().isoformat(timespec="seconds")
    else:
        data["entries"].append(
            {
                "name": name,
                "student_id": meta.get("student_id", ""),
                "class_name": meta.get("class_name", ""),
                "check_in": "",
                "check_out": "",
                "status": STATUS_ABSENT,
                "source": source,
                "snapshot_in": "",
                "snapshot_out": "",
                "notes": notes or "marked absent",
                "updated_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
    save_day(data)
    return True, f"{name} marked Absent"


def mark_all_missing_absent(registered_names: list[str], date_str: str | None = None) -> tuple[int, str]:
    """Mark every registered student without check-in as Absent."""
    d = date_str or _today()
    count = 0
    for name in registered_names:
        state = get_person_state(name, d)
        if state in {"none"}:
            ok, _ = mark_absent(name, date_str=d, notes="auto absent")
            if ok:
                count += 1
    return count, f"Marked {count} student(s) Absent for {d}"


def update_entry(
    name: str,
    *,
    date_str: str | None = None,
    check_in: str | None = None,
    check_out: str | None = None,
    status: str | None = None,
    notes: str | None = None,
    source: str = SOURCE_MANUAL,
) -> tuple[bool, str]:
    """Admin fix: update fields on an existing entry (or create)."""
    name = name.strip()
    d = date_str or _today()
    data = load_day(d)
    e = find_entry(data, name)
    meta = get_student(name)
    if not e:
        e = {
            "name": name,
            "student_id": meta.get("student_id", ""),
            "class_name": meta.get("class_name", ""),
            "check_in": "",
            "check_out": "",
            "status": STATUS_ON_TIME,
            "source": source,
            "snapshot_in": "",
            "snapshot_out": "",
            "notes": "",
            "updated_at": "",
        }
        data["entries"].append(e)

    if check_in is not None:
        e["check_in"] = check_in.strip()
    if check_out is not None:
        e["check_out"] = check_out.strip()
    if status is not None:
        e["status"] = status
    elif e.get("check_in") and e.get("status") != STATUS_ABSENT:
        e["status"] = classify_check_in(e["check_in"])
    if notes is not None:
        e["notes"] = notes
    e["source"] = source
    e["student_id"] = meta.get("student_id", e.get("student_id", ""))
    e["class_name"] = meta.get("class_name", e.get("class_name", ""))
    e["updated_at"] = datetime.now().isoformat(timespec="seconds")
    save_day(data)
    return True, f"Updated entry for {name} on {d}"


def delete_entry(name: str, date_str: str | None = None) -> tuple[bool, str]:
    d = date_str or _today()
    data = load_day(d)
    key = name.strip().lower()
    before = len(data["entries"])
    data["entries"] = [e for e in data["entries"] if (e.get("name") or "").strip().lower() != key]
    if len(data["entries"]) == before:
        return False, f"No entry for {name} on {d}"
    save_day(data)
    return True, f"Deleted entry for {name} on {d}"


def format_day_text(date_str: str | None = None) -> str:
    data = load_day(date_str)
    path = date_file_txt(data["date"])
    if path.exists():
        return path.read_text(encoding="utf-8")
    _write_notepad(data)
    return path.read_text(encoding="utf-8") if path.exists() else "No records."


def day_summary(date_str: str | None = None) -> dict[str, int]:
    data = load_day(date_str)
    entries = data.get("entries", [])
    present = sum(1 for e in entries if e.get("check_in") and e.get("status") != STATUS_ABSENT)
    on_time = sum(1 for e in entries if e.get("status") == STATUS_ON_TIME)
    late = sum(1 for e in entries if e.get("status") == STATUS_LATE)
    absent = sum(1 for e in entries if e.get("status") == STATUS_ABSENT)
    checked_out = sum(1 for e in entries if e.get("check_out"))
    return {
        "total": len(entries),
        "present": present,
        "on_time": on_time,
        "late": late,
        "absent": absent,
        "checked_out": checked_out,
    }


def person_history(name: str) -> list[dict[str, Any]]:
    """All day entries for a person across record files."""
    key = name.strip().lower()
    rows: list[dict[str, Any]] = []
    for d in list_record_dates():
        data = load_day(d)
        for e in data.get("entries", []):
            if (e.get("name") or "").strip().lower() == key:
                row = deepcopy(e)
                row["date"] = d
                rows.append(row)
    rows.sort(key=lambda r: r.get("date", ""), reverse=True)
    return rows


def open_today_file_path() -> Path:
    data = load_day()
    save_day(data)
    return date_file_txt(data["date"])


# Back-compat wrappers used by older code paths
def already_marked_today(name: str) -> bool:
    return get_person_state(name) in {"checked_in", "checked_out"}


def mark_attendance(name: str, status: str = "Present") -> tuple[bool, str]:
    """Legacy: treat as check-in."""
    force = None
    if status.lower() == "late":
        force = STATUS_LATE
    elif status.lower() in {"on-time", "ontime", "present"}:
        force = None
    ok, msg, _ = check_in(name, force_status=force)
    return ok, msg


def get_today_records() -> str:
    return format_day_text()


def list_all_record_files() -> list[Path]:
    ensure_dirs()
    return sorted(RECORDS_DIR.glob("attendance_*.txt"), reverse=True)
