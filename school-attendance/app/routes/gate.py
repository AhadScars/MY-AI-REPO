"""
Public gate: scanning the school QR opens this page (no login).
User enters student ID, then check-in or check-out.
"""
from __future__ import annotations

from flask import Blueprint, flash, redirect, render_template, request, url_for

from app.license_service import is_school_licensed
from app.services import check_in, check_out, get_school_by_token

bp = Blueprint("gate", __name__)


@bp.route("/g/<token>", methods=["GET", "POST"])
def enter_id(token: str):
    school = get_school_by_token(token)
    if not school:
        return render_template(
            "gate/error.html",
            message="Invalid or disabled school QR link.",
        ), 404

    if not is_school_licensed(school):
        return render_template(
            "gate/error.html",
            message="This school's subscription has expired. Contact the office.",
        ), 403

    prefill = (request.args.get("id") or request.form.get("student_id") or "").strip()
    result = None
    ok = None

    if request.method == "POST":
        student_id = (request.form.get("student_id") or "").strip()
        action = request.form.get("action") or "in"
        if not student_id:
            flash("Please enter your student ID.", "error")
            prefill = ""
        else:
            if action == "out":
                ok, msg, rec = check_out(school["id"], student_id, school["name"])
            else:
                ok, msg, rec = check_in(school["id"], student_id, school["name"])
            result = {"ok": ok, "message": msg, "record": rec}
            prefill = student_id if not ok else ""  # clear on success for next student

    return render_template(
        "gate/enter_id.html",
        school=school,
        token=token,
        prefill=prefill,
        result=result,
    )
