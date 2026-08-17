"""Student metadata storage."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any

from config import STUDENTS_PATH, ensure_dirs

EMPTY_META = {
    "student_id": "",
    "class_name": "",
    "roll_no": "",
    "phone": "",
    "email": "",
    "notes": "",
}


def _load_raw() -> dict[str, Any]:
    ensure_dirs()
    if not STUDENTS_PATH.exists():
        return {"students": {}}
    try:
        data = json.loads(STUDENTS_PATH.read_text(encoding="utf-8"))
        if "students" not in data:
            data = {"students": {}}
        return data
    except Exception:
        return {"students": {}}


def _save_raw(data: dict[str, Any]) -> None:
    ensure_dirs()
    STUDENTS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def all_students() -> dict[str, dict[str, Any]]:
    """Map name -> metadata dict (includes name)."""
    raw = _load_raw()
    return deepcopy(raw.get("students", {}))


def get_student(name: str) -> dict[str, Any]:
    name = name.strip()
    students = all_students()
    if name in students:
        meta = deepcopy(students[name])
        meta.setdefault("name", name)
        for k, v in EMPTY_META.items():
            meta.setdefault(k, v)
        return meta
    meta = {"name": name, **EMPTY_META}
    return meta


def upsert_student(name: str, **fields: Any) -> dict[str, Any]:
    name = name.strip()
    if not name:
        raise ValueError("Name cannot be empty.")
    raw = _load_raw()
    students = raw.setdefault("students", {})
    current = students.get(name, {"name": name, **EMPTY_META})
    current["name"] = name
    for k in EMPTY_META:
        if k in fields and fields[k] is not None:
            current[k] = str(fields[k]).strip()
    # allow extra notes etc.
    for k, v in fields.items():
        if k not in current and v is not None:
            current[k] = str(v).strip()
    students[name] = current
    _save_raw(raw)
    return deepcopy(current)


def rename_student(old_name: str, new_name: str) -> bool:
    old_name, new_name = old_name.strip(), new_name.strip()
    if not old_name or not new_name or old_name == new_name:
        return False
    raw = _load_raw()
    students = raw.setdefault("students", {})
    if old_name not in students:
        # create empty under new name
        students[new_name] = {"name": new_name, **EMPTY_META}
        _save_raw(raw)
        return True
    meta = students.pop(old_name)
    meta["name"] = new_name
    students[new_name] = meta
    _save_raw(raw)
    return True


def delete_student(name: str) -> bool:
    raw = _load_raw()
    students = raw.setdefault("students", {})
    if name not in students:
        return False
    del students[name]
    _save_raw(raw)
    return True


def ensure_from_names(names: list[str]) -> None:
    """Create empty metadata rows for registered face names."""
    raw = _load_raw()
    students = raw.setdefault("students", {})
    changed = False
    for name in names:
        name = name.strip()
        if name and name not in students:
            students[name] = {"name": name, **EMPTY_META}
            changed = True
    if changed:
        _save_raw(raw)
