"""School Attendance System — multi-tenant QR check-in/out."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from flask import Flask

from app import config
from app.seed import seed_if_empty


def _resource_root() -> Path:
    """Templates/static live next to package; under PyInstaller in _MEIPASS."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / "app"
    return Path(__file__).resolve().parent


def create_app() -> Flask:
    root = _resource_root()
    app = Flask(
        __name__,
        template_folder=str(root / "templates"),
        static_folder=str(root / "static"),
    )
    app.secret_key = config.SECRET_KEY
    app.config["TEMPLATES_AUTO_RELOAD"] = True

    from app.routes.auth_routes import bp as auth_bp
    from app.routes.super_admin import bp as super_bp
    from app.routes.school_admin import bp as school_bp
    from app.routes.attendance import bp as attendance_bp
    from app.routes.gate import bp as gate_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(super_bp)
    app.register_blueprint(school_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(gate_bp)

    seed_if_empty()

    # Ensure SMS.txt exists next to the app on startup
    try:
        from app.sms_log import ensure_sms_file

        ensure_sms_file()
    except Exception:
        pass

    return app
