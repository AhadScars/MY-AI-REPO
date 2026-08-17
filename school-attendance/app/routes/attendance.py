"""QR / ID check-in and check-out endpoints."""
from __future__ import annotations

from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from app.auth import require_school
from app.license_service import is_school_licensed
from app.services import check_in, check_out, get_school

bp = Blueprint("attendance", __name__, url_prefix="/scan")


@bp.route("/")
@require_school
def scan_page():
    school = get_school(session["school_id"])
    mode = request.args.get("mode") or "in"
    if mode not in ("in", "out"):
        mode = "in"
    return render_template(
        "school/scan.html",
        school=school,
        mode=mode,
        licensed=is_school_licensed(school),
    )


@bp.route("/submit", methods=["POST"])
@require_school
def submit():
    school = get_school(session["school_id"])
    if not is_school_licensed(school):
        flash("Subscription expired. Renew license to use check-in/out.", "error")
        return redirect(url_for("school.subscription"))

    mode = request.form.get("mode") or "in"
    raw = request.form.get("student_input") or request.form.get("student_id") or ""
    wants_json = (
        request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or request.accept_mimetypes.best == "application/json"
        or request.args.get("format") == "json"
    )

    if mode == "out":
        ok, msg, rec = check_out(school["id"], raw, school["name"])
    else:
        ok, msg, rec = check_in(school["id"], raw, school["name"])

    if wants_json:
        return jsonify(
            {
                "ok": ok,
                "message": msg,
                "record": rec,
            }
        )

    flash(msg, "success" if ok else "error")
    return redirect(url_for("attendance.scan_page", mode=mode))


@bp.route("/api", methods=["POST"])
@require_school
def api_scan():
    """JSON API for scanner hardware / future NFC readers."""
    school = get_school(session["school_id"])
    if not is_school_licensed(school):
        return jsonify({"ok": False, "message": "Subscription expired."}), 403

    data = request.get_json(silent=True) or {}
    mode = data.get("mode") or request.form.get("mode") or "in"
    raw = data.get("code") or data.get("student_id") or ""

    if mode == "out":
        ok, msg, rec = check_out(school["id"], raw, school["name"])
    else:
        ok, msg, rec = check_in(school["id"], raw, school["name"])

    return jsonify({"ok": ok, "message": msg, "record": rec}), (200 if ok else 400)
