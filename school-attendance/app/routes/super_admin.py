"""Main admin: manage schools, generate license keys, extend subscriptions."""
from __future__ import annotations

from flask import Blueprint, flash, redirect, render_template, request, url_for

from app.auth import require_super_admin
from app.license_service import (
    create_license_key,
    extend_school_subscription,
    is_school_licensed,
    list_license_keys,
    revoke_license,
)
from app.services import delete_school, get_school, list_schools, set_school_active

bp = Blueprint("super", __name__, url_prefix="/admin")


@bp.route("/")
@require_super_admin
def dashboard():
    schools = list_schools()
    for s in schools:
        s["licensed"] = is_school_licensed(s)
    licenses = list_license_keys()
    unused = sum(1 for k in licenses if not k["school_id"] and not k["is_revoked"])
    return render_template(
        "super/dashboard.html",
        schools=schools,
        licenses=licenses[:10],
        stats={
            "schools": len(schools),
            "active": sum(1 for s in schools if s.get("is_active")),
            "licensed": sum(1 for s in schools if s.get("licensed")),
            "unused_keys": unused,
        },
    )


@bp.route("/schools")
@require_super_admin
def schools():
    schools_list = list_schools()
    for s in schools_list:
        s["licensed"] = is_school_licensed(s)
    return render_template("super/schools.html", schools=schools_list)


@bp.route("/schools/<int:school_id>/toggle", methods=["POST"])
@require_super_admin
def toggle_school(school_id: int):
    school = get_school(school_id)
    if not school:
        flash("School not found.", "error")
    else:
        set_school_active(school_id, not school["is_active"])
        flash("School status updated.", "success")
    return redirect(url_for("super.schools"))


@bp.route("/schools/<int:school_id>/extend", methods=["POST"])
@require_super_admin
def extend_school(school_id: int):
    days = int(request.form.get("days") or 30)
    notes = request.form.get("notes") or ""
    ok, msg = extend_school_subscription(school_id, days, notes)
    flash(msg, "success" if ok else "error")
    return redirect(url_for("super.schools"))


@bp.route("/schools/<int:school_id>/delete", methods=["POST"])
@require_super_admin
def remove_school(school_id: int):
    ok, msg = delete_school(school_id)
    flash(msg, "success" if ok else "error")
    return redirect(url_for("super.schools"))


@bp.route("/licenses", methods=["GET", "POST"])
@require_super_admin
def licenses():
    if request.method == "POST":
        days = int(request.form.get("days_valid") or 30)
        max_students = int(request.form.get("max_students") or 500)
        notes = request.form.get("notes") or ""
        count = max(1, min(int(request.form.get("count") or 1), 20))
        created = []
        for _ in range(count):
            lic = create_license_key(
                days_valid=days,
                max_students=max_students,
                notes=notes,
                created_by="admin",
            )
            created.append(lic["key_code"])
        flash(f"Generated {len(created)} license key(s): {', '.join(created)}", "success")
        return redirect(url_for("super.licenses"))

    keys = list_license_keys()
    return render_template("super/licenses.html", licenses=keys)


@bp.route("/licenses/<int:key_id>/revoke", methods=["POST"])
@require_super_admin
def revoke_key(key_id: int):
    ok, msg = revoke_license(key_id)
    flash(msg, "success" if ok else "error")
    return redirect(url_for("super.licenses"))
