"""Login, logout, school registration."""
from __future__ import annotations

from datetime import datetime, timedelta

from flask import Blueprint, flash, redirect, render_template, request, url_for

from app import config
from app.auth import login_school, login_super_admin, logout_user
from app.license_service import apply_license_to_school, get_license_by_code
from app.services import authenticate_school, create_school

bp = Blueprint("auth", __name__)


@bp.route("/")
def index():
    return redirect(url_for("auth.login"))


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        role = request.form.get("role") or "school"

        if role == "super_admin":
            if (
                username == config.SUPER_ADMIN_USER
                and password == config.SUPER_ADMIN_PASS
            ):
                login_super_admin()
                return redirect(url_for("super.dashboard"))
            flash("Invalid main admin credentials.", "error")
        else:
            school = authenticate_school(username, password)
            if school:
                if not school.get("is_active"):
                    flash("This school account is disabled. Contact main admin.", "error")
                else:
                    login_school(school)
                    return redirect(url_for("school.dashboard"))
            else:
                flash("Invalid school username or password.", "error")

    return render_template("login.html")


@bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name") or ""
        username = request.form.get("username") or ""
        password = request.form.get("password") or ""
        confirm = request.form.get("confirm") or ""
        license_key = (request.form.get("license_key") or "").strip()

        if password != confirm:
            flash("Passwords do not match.", "error")
            return render_template("register.html")

        # Trial by default; license key applied after account creation
        trial_expires = (
            datetime.now() + timedelta(days=7)
        ).strftime("%Y-%m-%d %H:%M:%S")

        if license_key:
            lic = get_license_by_code(license_key)
            if not lic:
                flash("Invalid license key.", "error")
                return render_template("register.html")
            if lic["is_revoked"]:
                flash("License key has been revoked.", "error")
                return render_template("register.html")
            if lic["school_id"] is not None:
                flash("License key already used.", "error")
                return render_template("register.html")

        ok, msg, school = create_school(
            name=name,
            username=username,
            password=password,
            license_key=None,
            license_expires_at=trial_expires,
        )
        if not ok or not school:
            flash(msg, "error")
            return render_template("register.html")

        if license_key:
            ok_lic, lic_msg = apply_license_to_school(school["id"], license_key)
            if not ok_lic:
                flash(f"School created, but license failed: {lic_msg}", "error")
            else:
                flash(f"School registered. {lic_msg}", "success")
                return redirect(url_for("auth.login"))

        flash("School registered successfully (7-day trial). Please log in.", "success")
        return redirect(url_for("auth.login"))

    return render_template("register.html")


@bp.route("/logout")
def logout():
    logout_user()
    flash("Logged out.", "success")
    return redirect(url_for("auth.login"))
