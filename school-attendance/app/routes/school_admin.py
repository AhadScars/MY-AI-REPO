"""School admin: students, subscription, exports."""
from __future__ import annotations

from flask import (
    Blueprint,
    flash,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)

from app import config
from app.auth import require_school
from app.class_sort import filter_students
from app.database import today_str
from app.excel_sync import write_attendance_excel
from app.license_service import apply_license_to_school, is_school_licensed
from app.pagination import paginate, parse_page, parse_per_page, query_args
from app.services import (
    add_student,
    attendance_summary,
    delete_student,
    ensure_public_token,
    get_school,
    list_attendance,
    list_students,
    update_student,
)

bp = Blueprint("school", __name__, url_prefix="/school")


def _school():
    return get_school(session["school_id"])


@bp.route("/")
@require_school
def dashboard():
    school = _school()
    date = request.args.get("date") or today_str()
    summary = attendance_summary(school["id"], date)
    # Only show students who checked in today (avoids dumping 960 empty rows)
    recent = [r for r in list_attendance(school["id"], date) if r.get("is_present")]
    licensed = is_school_licensed(school)
    return render_template(
        "school/dashboard.html",
        school=school,
        summary=summary,
        records=recent,
        date=date,
        licensed=licensed,
    )


def _roster_filter_options(students_list: list | None = None) -> dict:
    """
    Class/section dropdown values.
    Always includes 1–8 and A–D so dropdowns are never empty.
    """
    from app.class_sort import parse_class_section, unique_classes

    students_list = students_list or []
    parsed = [parse_class_section(s.get("class_name") or "") for s in students_list]
    from_data_nums = {str(n) for n, _, _ in parsed if n < 9999}
    from_data_secs = {sec for _, sec, _ in parsed if sec}

    # Merge defaults + anything found in roster
    class_nums = sorted(
        set(config.DEFAULT_CLASS_NUMS) | from_data_nums,
        key=lambda x: int(x) if str(x).isdigit() else 9999,
    )
    sections = sorted(set(config.DEFAULT_SECTIONS) | from_data_secs)

    return {
        "class_nums": class_nums,
        "sections": sections,
        "class_options": unique_classes(students_list),
    }


def _annotate_class_parts(rows: list) -> list:
    """Add class_num / section fields for reliable filter data attributes."""
    from app.class_sort import parse_class_section

    out = []
    for s in rows:
        item = dict(s)
        num, sec, _ = parse_class_section(item.get("class_name") or "")
        item["class_num"] = str(num) if num < 9999 else ""
        item["section"] = sec or ""
        out.append(item)
    return out


@bp.route("/students", methods=["GET", "POST"])
@require_school
def students():
    school = _school()
    if request.method == "POST":
        if not is_school_licensed(school):
            flash("Subscription expired. Activate a license to manage students.", "error")
            return redirect(url_for("school.subscription"))
        ok, msg, _ = add_student(
            school["id"],
            request.form.get("student_id") or "",
            request.form.get("name") or "",
            request.form.get("class_name") or "",
            request.form.get("phone") or config.DEFAULT_STUDENT_PHONE,
        )
        flash(msg, "success" if ok else "error")
        return redirect(url_for("school.students"))

    all_students = _annotate_class_parts(list_students(school["id"]))
    f_class = (
        request.args.get("cls")
        or request.args.get("class")
        or ""
    ).strip()
    f_section = (
        request.args.get("sec")
        or request.args.get("section")
        or ""
    ).strip()
    f_q = (request.args.get("q") or "").strip()
    page = parse_page(request.args.get("page"))
    per_page = parse_per_page(request.args.get("per_page"))

    filtered = filter_students(
        all_students,
        class_num=f_class,
        section=f_section,
        q=f_q,
    )
    pagination = paginate(filtered, page=page, per_page=per_page)
    opts = _roster_filter_options(all_students)

    return render_template(
        "school/students.html",
        school=school,
        students=pagination["items"],
        total_count=len(all_students),
        filtered_count=pagination["total"],
        licensed=is_school_licensed(school),
        active_cls=f_class,
        active_sec=f_section,
        active_q=f_q,
        class_nums=opts["class_nums"],
        section_list=opts["sections"],
        pagination=pagination,
        filter_q=query_args(cls=f_class, sec=f_section, q=f_q),
    )


@bp.route("/students/<int:pk>/edit", methods=["POST"])
@require_school
def edit_student(pk: int):
    school = _school()
    ok, msg = update_student(
        school["id"],
        pk,
        request.form.get("student_id") or "",
        request.form.get("name") or "",
        request.form.get("class_name") or "",
        request.form.get("phone") or config.DEFAULT_STUDENT_PHONE,
    )
    flash(msg, "success" if ok else "error")
    return redirect(url_for("school.students"))


@bp.route("/students/<int:pk>/delete", methods=["POST"])
@require_school
def remove_student(pk: int):
    school = _school()
    ok, msg = delete_student(school["id"], pk)
    flash(msg, "success" if ok else "error")
    return redirect(url_for("school.students"))


@bp.route("/mark-attendance")
@bp.route("/gate-qr")  # old URL still works
@require_school
def mark_attendance():
    """Open the Enter-ID attendance page (check-in / check-out). No QR."""
    school = _school()
    if not is_school_licensed(school):
        flash("Subscription expired. Renew license to mark attendance.", "error")
        return redirect(url_for("school.subscription"))
    token = ensure_public_token(school["id"])
    # Public page: enter student ID → check in / check out
    return redirect(url_for("gate.enter_id", token=token))


@bp.route("/attendance")
@require_school
def attendance():
    school = _school()
    date = request.args.get("date") or today_str()
    filter_status = request.args.get("status") or "all"
    f_class = (
        request.args.get("cls")
        or request.args.get("class")
        or ""
    ).strip()
    f_section = (
        request.args.get("sec")
        or request.args.get("section")
        or ""
    ).strip()
    f_q = (request.args.get("q") or "").strip()

    all_records = _annotate_class_parts(list_attendance(school["id"], date))
    page = parse_page(request.args.get("page"))
    per_page = parse_per_page(request.args.get("per_page"))

    # Filters on server so pagination matches
    records = filter_students(
        all_records,
        class_num=f_class,
        section=f_section,
        q=f_q,
    )
    if filter_status == "present":
        records = [r for r in records if r["is_present"]]
    elif filter_status == "absent":
        records = [r for r in records if not r["is_present"]]

    pagination = paginate(records, page=page, per_page=per_page)

    # Summary for whole day (unfiltered by page)
    total = len(all_records)
    present = sum(1 for r in all_records if r["is_present"])
    checked_out = sum(1 for r in all_records if r.get("time_out"))
    summary = {
        "total": total,
        "present": present,
        "absent": total - present,
        "checked_out": checked_out,
        "still_in": present - checked_out,
    }
    opts = _roster_filter_options(all_records)

    return render_template(
        "school/attendance.html",
        school=school,
        records=pagination["items"],
        date=date,
        status=filter_status,
        summary=summary,
        total_count=len(all_records),
        filtered_count=pagination["total"],
        active_cls=f_class,
        active_sec=f_section,
        active_q=f_q,
        class_nums=opts["class_nums"],
        section_list=opts["sections"],
        pagination=pagination,
        filter_q=query_args(
            date=date,
            status=filter_status if filter_status != "all" else None,
            cls=f_class,
            sec=f_section,
            q=f_q,
        ),
    )


@bp.route("/export")
@require_school
def export_excel():
    school = _school()
    date = request.args.get("date") or today_str()
    path = write_attendance_excel(school["id"], school["name"], date)
    return send_file(
        path,
        as_attachment=True,
        download_name=path.name,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@bp.route("/subscription", methods=["GET", "POST"])
@require_school
def subscription():
    school = _school()
    if request.method == "POST":
        key = request.form.get("license_key") or ""
        ok, msg = apply_license_to_school(school["id"], key)
        flash(msg, "success" if ok else "error")
        return redirect(url_for("school.subscription"))
    school = _school()  # refresh after apply
    return render_template(
        "school/subscription.html",
        school=school,
        licensed=is_school_licensed(school),
    )
