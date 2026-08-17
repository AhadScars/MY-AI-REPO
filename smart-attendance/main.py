#!/usr/bin/env python3
"""
Smart Attendance System — Face Recognition
Check-in / Check-out, Late / On-Time / Absent, admin tools, snapshots, history.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import tkinter as tk
from datetime import datetime
from tkinter import messagebox, ttk

import cv2
from PIL import Image, ImageTk

import admin_auth
from attendance_logger import (
    STATUS_ABSENT,
    STATUS_LATE,
    STATUS_ON_TIME,
    check_in,
    check_out,
    day_summary,
    format_day_text,
    get_person_state,
    mark_all_missing_absent,
    open_today_file_path,
    save_snapshot_frame,
)
from config import (
    CAMERA_HEIGHT,
    CAMERA_INDEX,
    CAMERA_WIDTH,
    CONFIDENCE_THRESHOLD,
    JUST_MARKED_FLASH_SECONDS,
    ON_TIME_UNTIL,
    RELOG_COOLDOWN_SECONDS,
    RECORDS_DIR,
    SAMPLES_PER_PERSON,
)
from dialogs import (
    BrowseDaysDialog,
    ChangePinDialog,
    ManualEntryDialog,
    NameDialog,
    PersonHistoryDialog,
    PinDialog,
    StudentMetaDialog,
)
from face_engine import FaceEngine, FaceMatch
from scroll_utils import make_scrollable_frame, make_scrollable_listbox, make_scrollable_text
from students import ensure_from_names, get_student, upsert_student, delete_student as delete_student_meta


# ── Theme ───────────────────────────────────────────────────────────────────
class Theme:
    BG = "#0B1220"
    SIDEBAR = "#0F172A"
    SURFACE = "#111827"
    CARD = "#1A2332"
    ELEVATED = "#1F2A3D"
    BORDER = "#2A364A"
    PRIMARY = "#2563EB"
    PRIMARY_HOVER = "#1D4ED8"
    PRIMARY_SOFT = "#1E3A5F"
    ACCENT = "#38BDF8"
    SUCCESS = "#10B981"
    SUCCESS_SOFT = "#064E3B"
    WARNING = "#F59E0B"
    WARNING_SOFT = "#78350F"
    DANGER = "#EF4444"
    DANGER_SOFT = "#7F1D1D"
    PURPLE = "#7C3AED"
    GRAY = "#6B7280"
    GRAY_SOFT = "#374151"
    TEXT = "#F8FAFC"
    TEXT_SECONDARY = "#CBD5E1"
    MUTED = "#94A3B8"
    DIM = "#64748B"
    VIDEO_BG = "#020617"
    FONT = "Segoe UI"
    FONT_MONO = "Consolas"


T = Theme


def _font(size: int = 10, weight: str = "normal") -> tuple:
    return (T.FONT, size, "bold") if weight == "bold" else (T.FONT, size)


class HoverButton(tk.Canvas):
    def __init__(
        self, parent, text: str, command=None, bg: str = T.PRIMARY, fg: str = "#FFFFFF",
        hover: str | None = None, width: int = 220, height: int = 38, font=_font(10, "bold"),
        state: str = "normal", icon: str = "", **kwargs,
    ):
        super().__init__(
            parent, width=width, height=height,
            bg=parent.cget("bg") if str(parent.cget("bg")) else T.CARD,
            highlightthickness=0, bd=0, cursor="hand2", **kwargs,
        )
        self._bg = bg
        self._fg = fg
        self._hover = hover or self._darken(bg)
        self._disabled_bg = T.BORDER
        self._disabled_fg = T.DIM
        self._command = command
        self._text = f"{icon}  {text}".strip() if icon else text
        self._font = font
        self._width = width
        self._height = height
        self._enabled = state == "normal"
        self._draw(self._bg if self._enabled else self._disabled_bg)
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<Button-1>", self._on_click)

    @staticmethod
    def _darken(hex_color: str, factor: float = 0.85) -> str:
        hex_color = hex_color.lstrip("#")
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"

    def _draw(self, fill: str) -> None:
        self.delete("all")
        r, w, h = 8, self._width, self._height
        self.create_rectangle(r, 0, w - r, h, fill=fill, outline=fill)
        self.create_rectangle(0, r, w, h - r, fill=fill, outline=fill)
        self.create_oval(0, 0, 2 * r, 2 * r, fill=fill, outline=fill)
        self.create_oval(w - 2 * r, 0, w, 2 * r, fill=fill, outline=fill)
        self.create_oval(0, h - 2 * r, 2 * r, h, fill=fill, outline=fill)
        self.create_oval(w - 2 * r, h - 2 * r, w, h, fill=fill, outline=fill)
        fg = self._fg if self._enabled else self._disabled_fg
        self.create_text(w // 2, h // 2, text=self._text, fill=fg, font=self._font)

    def _on_enter(self, _e=None) -> None:
        if self._enabled:
            self._draw(self._hover)

    def _on_leave(self, _e=None) -> None:
        self._draw(self._bg if self._enabled else self._disabled_bg)

    def _on_click(self, _e=None) -> None:
        if self._enabled and self._command:
            self._command()

    def configure(self, cnf=None, **kw):  # noqa: A003
        if cnf:
            kw.update(cnf)
        if "state" in kw:
            self._enabled = kw.pop("state") == "normal"
            self._draw(self._bg if self._enabled else self._disabled_bg)
            try:
                super().configure(cursor="hand2" if self._enabled else "arrow")
            except Exception:
                pass
        if "text" in kw:
            self._text = kw.pop("text")
            self._draw(self._bg if self._enabled else self._disabled_bg)
        if kw:
            return super().configure(**kw)
        return None

    config = configure


class StatCard(tk.Frame):
    def __init__(self, parent, title: str, value: str = "0", accent: str = T.ACCENT, **kwargs):
        super().__init__(parent, bg=T.CARD, highlightthickness=1, highlightbackground=T.BORDER, **kwargs)
        inner = tk.Frame(self, bg=T.CARD)
        inner.pack(fill="both", expand=True, padx=14, pady=12)
        top = tk.Frame(inner, bg=T.CARD)
        top.pack(fill="x")
        tk.Label(top, text=title.upper(), bg=T.CARD, fg=T.DIM, font=_font(8, "bold")).pack(side="left")
        self._dot = tk.Label(top, text="●", bg=T.CARD, fg=accent, font=_font(8))
        self._dot.pack(side="right")
        self.value_lbl = tk.Label(inner, text=value, bg=T.CARD, fg=T.TEXT, font=_font(20, "bold"))
        self.value_lbl.pack(anchor="w", pady=(6, 0))

    def set_value(self, value: str, accent: str | None = None) -> None:
        self.value_lbl.configure(text=value)
        if accent:
            self._dot.configure(fg=accent)


class SmartAttendanceApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Smart Attendance  ·  Check-In / Check-Out")
        self.geometry("1320x800")
        self.minsize(1120, 700)
        self.configure(bg=T.BG)
        try:
            self.state("zoomed")
        except tk.TclError:
            pass

        self.engine = FaceEngine()
        ensure_from_names(self.engine.list_registered())

        self.cap: cv2.VideoCapture | None = None
        self.running = False
        self.mode = "idle"  # idle | register | attendance
        self.session_kind = "check_in"  # check_in | check_out
        self.register_name = ""
        self.samples_taken = 0
        self._last_sample_time = 0.0
        self._last_action: dict[str, float] = {}  # name -> last face action time
        self._just_marked: dict[str, float] = {}  # name -> flash until timestamp
        self._photo = None
        self._clock_job = None
        self._admin_unlocked_until = 0.0

        self.status_var = tk.StringVar(value="System ready")
        self.info_var = tk.StringVar(value="Camera idle")
        self.mode_var = tk.StringVar(value="IDLE")
        self.clock_var = tk.StringVar(value="")
        self.progress_var = tk.DoubleVar(value=0.0)
        self.session_kind_var = tk.StringVar(value="Check-In")

        self._build_styles()
        self._build_ui()
        self._refresh_people()
        self._refresh_records_view()
        self._update_stats()
        self._tick_clock()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        if admin_auth.is_default_pin():
            self.after(600, self._hint_default_pin)

    def _hint_default_pin(self) -> None:
        self._set_status("Admin PIN default is 1234 — change it under Admin tools", "warn")

    def _build_styles(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TFrame", background=T.BG)
        style.configure(
            "Horizontal.TProgressbar",
            troughcolor=T.BORDER, background=T.PRIMARY,
            bordercolor=T.BORDER, lightcolor=T.PRIMARY, darkcolor=T.PRIMARY, thickness=6,
        )

    # ── Auth ────────────────────────────────────────────────────────────────
    def require_admin(self) -> bool:
        if time.time() < self._admin_unlocked_until:
            return True
        dlg = PinDialog(self)
        if dlg.result:
            self._admin_unlocked_until = time.time() + 300  # 5 min
            return True
        return False

    # ── Layout ──────────────────────────────────────────────────────────────
    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=0)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)
        self._build_sidebar()
        self._build_main()

    def _build_sidebar(self) -> None:
        side = tk.Frame(self, bg=T.SIDEBAR, width=268)
        side.grid(row=0, column=0, sticky="nsw")
        side.grid_propagate(False)
        side.rowconfigure(0, weight=1)
        side.columnconfigure(0, weight=1)

        # Entire sidebar content is scrollable on short screens
        outer, body = make_scrollable_frame(side, bg=T.SIDEBAR, width=268)
        outer.grid(row=0, column=0, sticky="nsew")

        brand = tk.Frame(body, bg=T.SIDEBAR)
        brand.pack(fill="x", padx=18, pady=(20, 14))
        logo_row = tk.Frame(brand, bg=T.SIDEBAR)
        logo_row.pack(fill="x")
        badge = tk.Canvas(logo_row, width=40, height=40, bg=T.SIDEBAR, highlightthickness=0)
        badge.pack(side="left")
        badge.create_oval(2, 2, 38, 38, fill=T.PRIMARY, outline="")
        badge.create_text(20, 20, text="SA", fill="white", font=_font(11, "bold"))
        titles = tk.Frame(logo_row, bg=T.SIDEBAR)
        titles.pack(side="left", padx=(10, 0))
        tk.Label(titles, text="SmartAttend", bg=T.SIDEBAR, fg=T.TEXT, font=_font(13, "bold")).pack(anchor="w")
        tk.Label(titles, text="Pro Attendance Suite", bg=T.SIDEBAR, fg=T.MUTED, font=_font(8)).pack(anchor="w")

        tk.Frame(body, bg=T.BORDER, height=1).pack(fill="x", padx=18, pady=(0, 12))

        sk = tk.Frame(body, bg=T.SIDEBAR)
        sk.pack(fill="x", padx=16, pady=(0, 10))
        tk.Label(sk, text="SESSION MODE", bg=T.SIDEBAR, fg=T.DIM, font=_font(8, "bold")).pack(anchor="w")
        mode_row = tk.Frame(sk, bg=T.SIDEBAR)
        mode_row.pack(fill="x", pady=(6, 0))
        self.btn_mode_in = HoverButton(
            mode_row, "Check-In", command=lambda: self._set_session_kind("check_in"),
            bg=T.SUCCESS, width=110, height=34, font=_font(9, "bold"),
        )
        self.btn_mode_in.pack(side="left", padx=(0, 6))
        self.btn_mode_out = HoverButton(
            mode_row, "Check-Out", command=lambda: self._set_session_kind("check_out"),
            bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=110, height=34, font=_font(9, "bold"),
        )
        self.btn_mode_out.pack(side="left")

        tk.Label(body, text="CAMERA", bg=T.SIDEBAR, fg=T.DIM, font=_font(8, "bold")).pack(
            anchor="w", padx=22, pady=(8, 6)
        )
        nav = tk.Frame(body, bg=T.SIDEBAR)
        nav.pack(fill="x", padx=16)
        self.btn_register = HoverButton(nav, "Register Face", icon="+", command=self.start_register, bg=T.PRIMARY, width=228, height=36)
        self.btn_register.pack(pady=3)
        self.btn_update = HoverButton(nav, "Update Face Samples", icon="↻", command=self.start_update_face, bg=T.PURPLE, width=228, height=36)
        self.btn_update.pack(pady=3)
        self.btn_train = HoverButton(nav, "Train Model", icon="◎", command=self.do_train, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=36)
        self.btn_train.pack(pady=3)
        self.btn_attend = HoverButton(nav, "Start Live Session", icon="●", command=self.start_attendance, bg=T.SUCCESS, width=228, height=36)
        self.btn_attend.pack(pady=3)
        self.btn_stop = HoverButton(nav, "Stop Session", icon="■", command=self.stop_camera, bg=T.DANGER, width=228, height=36, state="disabled")
        self.btn_stop.pack(pady=3)

        tk.Frame(body, bg=T.BORDER, height=1).pack(fill="x", padx=18, pady=12)
        tk.Label(body, text="RECORDS & ADMIN", bg=T.SIDEBAR, fg=T.DIM, font=_font(8, "bold")).pack(
            anchor="w", padx=22, pady=(0, 6)
        )
        adm = tk.Frame(body, bg=T.SIDEBAR)
        adm.pack(fill="x", padx=16)
        HoverButton(adm, "Browse Past Days", command=self.open_browse, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=34).pack(pady=2)
        HoverButton(adm, "Manual Entry / Fix", command=self.open_manual, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=34).pack(pady=2)
        HoverButton(adm, "Mark Remaining Absent", command=self.mark_absents_today, bg=T.WARNING_SOFT, fg="#FDE68A", width=228, height=34).pack(pady=2)
        HoverButton(adm, "Open Today's Notepad", command=self.open_notepad, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=34).pack(pady=2)
        HoverButton(adm, "Change Admin PIN", command=self.change_pin, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=34).pack(pady=2)
        HoverButton(adm, "Refresh", command=self._refresh_all, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=228, height=34).pack(pady=2)

        foot = tk.Frame(body, bg=T.SIDEBAR)
        foot.pack(fill="x", padx=18, pady=14)
        tk.Label(foot, text="ON-TIME UNTIL", bg=T.SIDEBAR, fg=T.DIM, font=_font(7, "bold")).pack(anchor="w")
        tk.Label(foot, text=ON_TIME_UNTIL, bg=T.SIDEBAR, fg=T.MUTED, font=_font(9)).pack(anchor="w", pady=(1, 6))
        tk.Label(
            foot,
            text="Legend: Green flash = just marked  ·  Gray = already done\nSidebar scrolls if content is long.",
            bg=T.SIDEBAR, fg=T.DIM, font=_font(7), wraplength=220, justify="left",
        ).pack(anchor="w")

    def _build_main(self) -> None:
        main = tk.Frame(self, bg=T.BG)
        main.grid(row=0, column=1, sticky="nsew")
        main.columnconfigure(0, weight=1)
        main.rowconfigure(2, weight=1)

        header = tk.Frame(main, bg=T.BG)
        header.grid(row=0, column=0, sticky="ew", padx=24, pady=(18, 10))
        header.columnconfigure(0, weight=1)
        left_h = tk.Frame(header, bg=T.BG)
        left_h.grid(row=0, column=0, sticky="w")
        tk.Label(left_h, text="Attendance Dashboard", bg=T.BG, fg=T.TEXT, font=_font(20, "bold")).pack(anchor="w")
        tk.Label(
            left_h,
            text="Multi-face Check-In / Out  ·  On-Time / Late / Absent  ·  Snapshots  ·  Admin PIN",
            bg=T.BG, fg=T.MUTED, font=_font(9),
        ).pack(anchor="w", pady=(3, 0))

        right_h = tk.Frame(header, bg=T.BG)
        right_h.grid(row=0, column=1, sticky="e")
        self.mode_badge = tk.Label(
            right_h, textvariable=self.mode_var, bg=T.ELEVATED, fg=T.ACCENT,
            font=_font(9, "bold"), padx=12, pady=6,
        )
        self.mode_badge.pack(side="right", padx=(12, 0))
        clock_box = tk.Frame(right_h, bg=T.BG)
        clock_box.pack(side="right")
        tk.Label(clock_box, textvariable=self.clock_var, bg=T.BG, fg=T.TEXT, font=_font(14, "bold")).pack(anchor="e")
        tk.Label(clock_box, text="Local time", bg=T.BG, fg=T.DIM, font=_font(8)).pack(anchor="e")

        kpi = tk.Frame(main, bg=T.BG)
        kpi.grid(row=1, column=0, sticky="ew", padx=24, pady=(0, 12))
        for i in range(5):
            kpi.columnconfigure(i, weight=1, uniform="kpi")
        self.stat_people = StatCard(kpi, "Registered", "0", T.ACCENT)
        self.stat_people.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.stat_present = StatCard(kpi, "Present", "0", T.SUCCESS)
        self.stat_present.grid(row=0, column=1, sticky="ew", padx=4)
        self.stat_late = StatCard(kpi, "Late", "0", T.WARNING)
        self.stat_late.grid(row=0, column=2, sticky="ew", padx=4)
        self.stat_absent = StatCard(kpi, "Absent", "0", T.DANGER)
        self.stat_absent.grid(row=0, column=3, sticky="ew", padx=4)
        self.stat_session = StatCard(kpi, "Session", "Standby", T.PURPLE)
        self.stat_session.grid(row=0, column=4, sticky="ew", padx=(8, 0))

        content = tk.Frame(main, bg=T.BG)
        content.grid(row=2, column=0, sticky="nsew", padx=24, pady=(0, 6))
        content.columnconfigure(0, weight=3)
        content.columnconfigure(1, weight=2)
        content.rowconfigure(0, weight=1)
        self._build_camera_panel(content)
        self._build_side_panels(content)

        status = tk.Frame(main, bg=T.CARD, highlightthickness=1, highlightbackground=T.BORDER)
        status.grid(row=3, column=0, sticky="ew", padx=24, pady=(0, 14))
        left_s = tk.Frame(status, bg=T.CARD)
        left_s.pack(side="left", padx=14, pady=9)
        self.status_dot = tk.Label(left_s, text="●", bg=T.CARD, fg=T.SUCCESS, font=_font(8))
        self.status_dot.pack(side="left")
        tk.Label(left_s, textvariable=self.status_var, bg=T.CARD, fg=T.TEXT_SECONDARY, font=_font(9)).pack(
            side="left", padx=(8, 0)
        )
        tk.Label(status, textvariable=self.info_var, bg=T.CARD, fg=T.MUTED, font=_font(9)).pack(
            side="right", padx=14, pady=9
        )

    def _build_camera_panel(self, parent: tk.Frame) -> None:
        panel = tk.Frame(parent, bg=T.CARD, highlightthickness=1, highlightbackground=T.BORDER)
        panel.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        panel.rowconfigure(1, weight=1)
        panel.columnconfigure(0, weight=1)

        ph = tk.Frame(panel, bg=T.CARD)
        ph.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 6))
        ph.columnconfigure(1, weight=1)
        tk.Label(ph, text="Live Camera Feed", bg=T.CARD, fg=T.TEXT, font=_font(12, "bold")).grid(row=0, column=0, sticky="w")
        self.cam_hint = tk.Label(ph, text="Select Check-In or Check-Out, then start session", bg=T.CARD, fg=T.MUTED, font=_font(9))
        self.cam_hint.grid(row=0, column=1, sticky="e")

        video_wrap = tk.Frame(panel, bg=T.VIDEO_BG, highlightthickness=1, highlightbackground=T.BORDER)
        video_wrap.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 6))
        video_wrap.rowconfigure(0, weight=1)
        video_wrap.columnconfigure(0, weight=1)
        self.video_label = tk.Label(
            video_wrap, bg=T.VIDEO_BG, fg=T.DIM,
            text="Camera offline\n\nGreen flash = just marked\nGray box = already checked",
            font=_font(11), justify="center",
        )
        self.video_label.grid(row=0, column=0, sticky="nsew")

        prog_wrap = tk.Frame(panel, bg=T.CARD)
        prog_wrap.grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 12))
        prog_wrap.columnconfigure(0, weight=1)
        prog_top = tk.Frame(prog_wrap, bg=T.CARD)
        prog_top.grid(row=0, column=0, sticky="ew")
        tk.Label(prog_top, text="Enrollment / update progress", bg=T.CARD, fg=T.DIM, font=_font(8, "bold")).pack(side="left")
        self.progress_lbl = tk.Label(prog_top, text="0 / 0", bg=T.CARD, fg=T.MUTED, font=_font(8))
        self.progress_lbl.pack(side="right")
        self.progress = ttk.Progressbar(prog_wrap, variable=self.progress_var, maximum=SAMPLES_PER_PERSON, mode="determinate")
        self.progress.grid(row=1, column=0, sticky="ew", pady=(6, 0))

    def _build_side_panels(self, parent: tk.Frame) -> None:
        right = tk.Frame(parent, bg=T.BG)
        right.grid(row=0, column=1, sticky="nsew")
        # Both roster and log can grow; log gets more vertical space
        right.rowconfigure(0, weight=1, minsize=160)
        right.rowconfigure(1, weight=2, minsize=200)
        right.columnconfigure(0, weight=1)

        roster = tk.Frame(right, bg=T.CARD, highlightthickness=1, highlightbackground=T.BORDER)
        roster.grid(row=0, column=0, sticky="nsew", pady=(0, 10))
        roster.rowconfigure(1, weight=1)
        roster.columnconfigure(0, weight=1)

        rh = tk.Frame(roster, bg=T.CARD)
        rh.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        tk.Label(rh, text="Registered Roster", bg=T.CARD, fg=T.TEXT, font=_font(11, "bold")).pack(side="left")
        self.roster_count = tk.Label(rh, text="0 people", bg=T.CARD, fg=T.MUTED, font=_font(8))
        self.roster_count.pack(side="right")

        list_wrap, self.people_list = make_scrollable_listbox(
            roster,
            height=10,
            bg=T.SURFACE,
            fg=T.TEXT_SECONDARY,
            selectbackground=T.PRIMARY,
            selectforeground="#FFFFFF",
            font=_font(10),
            border_color=T.BORDER,
            trough=T.CARD,
        )
        list_wrap.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 6))

        actions = tk.Frame(roster, bg=T.CARD)
        actions.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 10))
        HoverButton(actions, "Profile", command=self.edit_selected_profile, bg=T.PRIMARY_SOFT, fg=T.ACCENT, width=88, height=30, font=_font(8, "bold")).pack(side="left", padx=(0, 4))
        HoverButton(actions, "History", command=self.show_selected_history, bg=T.ELEVATED, fg=T.TEXT_SECONDARY, width=88, height=30, font=_font(8, "bold")).pack(side="left", padx=4)
        HoverButton(actions, "Remove", command=self.delete_selected, bg=T.DANGER_SOFT, fg="#FECACA", width=88, height=30, font=_font(8, "bold")).pack(side="left", padx=4)

        log = tk.Frame(right, bg=T.CARD, highlightthickness=1, highlightbackground=T.BORDER)
        log.grid(row=1, column=0, sticky="nsew")
        log.rowconfigure(2, weight=1)
        log.columnconfigure(0, weight=1)
        lh = tk.Frame(log, bg=T.CARD)
        lh.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        tk.Label(lh, text="Today's Attendance Log", bg=T.CARD, fg=T.TEXT, font=_font(11, "bold")).pack(side="left")
        tk.Label(lh, text="Scroll · Notepad", bg=T.CARD, fg=T.DIM, font=_font(8)).pack(side="right")

        cols = tk.Frame(log, bg=T.ELEVATED)
        cols.grid(row=1, column=0, sticky="ew", padx=12)
        for i, (txt, col_w) in enumerate([("NAME", 14), ("IN", 8), ("OUT", 8), ("STATUS", 8)]):
            tk.Label(cols, text=txt, bg=T.ELEVATED, fg=T.DIM, font=_font(8, "bold"), width=col_w, anchor="w").pack(
                side="left", padx=(8 if i == 0 else 0, 0), pady=5
            )

        text_wrap, self.records_text = make_scrollable_text(
            log,
            bg=T.SURFACE,
            fg="#A7F3D0",
            font=(T.FONT_MONO, 9),
            wrap="none",
            border_color=T.BORDER,
            trough=T.CARD,
        )
        text_wrap.grid(row=2, column=0, sticky="nsew", padx=12, pady=(0, 10))
        self.records_text.configure(state="disabled")

    # ── Helpers ─────────────────────────────────────────────────────────────
    def _tick_clock(self) -> None:
        self.clock_var.set(datetime.now().strftime("%H:%M:%S"))
        # expire just-marked flashes
        now = time.time()
        expired = [k for k, t in self._just_marked.items() if t <= now]
        for k in expired:
            del self._just_marked[k]
        self._clock_job = self.after(1000, self._tick_clock)

    def _set_status(self, msg: str, level: str = "info") -> None:
        self.status_var.set(msg)
        colors = {"info": T.SUCCESS, "warn": T.WARNING, "error": T.DANGER, "active": T.ACCENT}
        self.status_dot.configure(fg=colors.get(level, T.SUCCESS))

    def _set_info(self, msg: str) -> None:
        self.info_var.set(msg)

    def _set_mode_badge(self, mode: str) -> None:
        styles = {
            "IDLE": (T.ELEVATED, T.MUTED, "IDLE"),
            "REGISTER": (T.PRIMARY_SOFT, T.ACCENT, "ENROLLING"),
            "UPDATE": (T.PRIMARY_SOFT, T.ACCENT, "UPDATING FACE"),
            "CHECK_IN": (T.SUCCESS_SOFT, T.SUCCESS, "CHECK-IN LIVE"),
            "CHECK_OUT": (T.WARNING_SOFT, T.WARNING, "CHECK-OUT LIVE"),
        }
        bg, fg, label = styles.get(mode, styles["IDLE"])
        self.mode_var.set(label)
        self.mode_badge.configure(bg=bg, fg=fg)

    def _set_session_kind(self, kind: str) -> None:
        self.session_kind = kind
        if kind == "check_in":
            self.session_kind_var.set("Check-In")
            self.btn_mode_in.configure(state="normal")  # redraw
            # visual: recreate colors via _bg
            self.btn_mode_in._bg = T.SUCCESS
            self.btn_mode_in._fg = "#FFFFFF"
            self.btn_mode_in._draw(T.SUCCESS)
            self.btn_mode_out._bg = T.ELEVATED
            self.btn_mode_out._fg = T.TEXT_SECONDARY
            self.btn_mode_out._draw(T.ELEVATED)
            self.cam_hint.configure(text="Mode: Check-In · On-Time until " + ON_TIME_UNTIL)
        else:
            self.session_kind_var.set("Check-Out")
            self.btn_mode_out._bg = T.WARNING
            self.btn_mode_out._fg = "#1C1917"
            self.btn_mode_out._draw(T.WARNING)
            self.btn_mode_in._bg = T.ELEVATED
            self.btn_mode_in._fg = T.TEXT_SECONDARY
            self.btn_mode_in._draw(T.ELEVATED)
            self.cam_hint.configure(text="Mode: Check-Out · requires prior Check-In")
        if self.mode == "attendance":
            self._set_mode_badge("CHECK_IN" if kind == "check_in" else "CHECK_OUT")
        self._update_stats()

    def _selected_name(self) -> str | None:
        sel = self.people_list.curselection()
        if not sel:
            return None
        raw = self.people_list.get(sel[0]).strip()
        if raw.startswith("No people") or not raw:
            return None
        # "01   Name" or with status suffix
        parts = raw.split(None, 1)
        if len(parts) < 2:
            return None
        name = parts[1]
        # strip trailing state markers like [In]
        for tag in (" [In]", " [Out]", " [Absent]", " [—]"):
            if name.endswith(tag):
                name = name[: -len(tag)]
        return name.strip()

    def _update_stats(self) -> None:
        people = self.engine.list_registered()
        n = len(people)
        s = day_summary()
        self.stat_people.set_value(str(n), T.ACCENT if n else T.DIM)
        self.stat_present.set_value(str(s["present"]), T.SUCCESS if s["present"] else T.DIM)
        self.stat_late.set_value(str(s["late"]), T.WARNING if s["late"] else T.DIM)
        self.stat_absent.set_value(str(s["absent"]), T.DANGER if s["absent"] else T.DIM)
        if self.mode == "attendance":
            self.stat_session.set_value("Check-In" if self.session_kind == "check_in" else "Check-Out", T.SUCCESS if self.session_kind == "check_in" else T.WARNING)
        elif self.mode in {"register", "update"}:
            self.stat_session.set_value("Enrolling", T.ACCENT)
        else:
            self.stat_session.set_value("Standby", T.DIM)
        self.roster_count.configure(text=f"{n} people" if n != 1 else "1 person")

    def _refresh_people(self) -> None:
        self.people_list.delete(0, tk.END)
        people = self.engine.list_registered()
        ensure_from_names(people)
        if not people:
            self.people_list.insert(tk.END, "  No people registered yet")
            self.people_list.itemconfig(0, fg=T.DIM)
        else:
            for i, name in enumerate(people, start=1):
                state = get_person_state(name)
                tag = {"checked_in": " [In]", "checked_out": " [Out]", "absent": " [Absent]", "none": " [—]"}.get(state, "")
                self.people_list.insert(tk.END, f"  {i:02d}   {name}{tag}")
                if state == "checked_out":
                    self.people_list.itemconfig(i - 1, fg=T.GRAY)
                elif state == "checked_in":
                    self.people_list.itemconfig(i - 1, fg="#86EFAC")
                elif state == "absent":
                    self.people_list.itemconfig(i - 1, fg="#FCA5A5")
        self._update_stats()

    def _refresh_records_view(self) -> None:
        text = format_day_text()
        self.records_text.configure(state="normal")
        self.records_text.delete("1.0", tk.END)
        self.records_text.insert(tk.END, text)
        self.records_text.configure(state="disabled")
        self._update_stats()

    def _refresh_all(self) -> None:
        self.engine = FaceEngine()
        ensure_from_names(self.engine.list_registered())
        self._refresh_people()
        self._refresh_records_view()
        self._set_status("Dashboard refreshed")

    def _set_buttons_camera_on(self, on: bool) -> None:
        state_idle = "disabled" if on else "normal"
        state_stop = "normal" if on else "disabled"
        for b in (self.btn_register, self.btn_update, self.btn_train, self.btn_attend):
            b.configure(state=state_idle)
        self.btn_stop.configure(state=state_stop)

    def _set_progress(self, current: int) -> None:
        self.progress_var.set(current)
        self.progress_lbl.configure(text=f"{current} / {SAMPLES_PER_PERSON}")

    # ── Camera ──────────────────────────────────────────────────────────────
    def _open_camera(self) -> bool:
        if self.cap is not None and self.cap.isOpened():
            return True
        self.cap = cv2.VideoCapture(CAMERA_INDEX)
        if not self.cap.isOpened():
            for idx in (1, 2, 0):
                self.cap = cv2.VideoCapture(idx)
                if self.cap.isOpened():
                    break
        if not self.cap.isOpened():
            messagebox.showerror("Camera Unavailable", "Could not access the webcam.")
            self.cap = None
            return False
        # Higher resolution so multiple people fit and detect cleanly
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
        return True

    def stop_camera(self) -> None:
        self.running = False
        self.mode = "idle"
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.video_label.configure(
            image="",
            text="Camera offline\n\nGreen flash = just marked\nGray box = already checked",
        )
        self._photo = None
        self._set_buttons_camera_on(False)
        self._set_mode_badge("IDLE")
        self._set_status("Session ended — camera offline")
        self._set_info("Camera idle")
        self.cam_hint.configure(text="Select Check-In or Check-Out, then start session")
        self._set_progress(0)
        self._refresh_people()
        self._refresh_records_view()

    def start_register(self) -> None:
        if not self.require_admin():
            return
        dialog = NameDialog(self, "Register New Person", "Enter full name as it should appear on records.")
        name = dialog.result
        if not name:
            return
        try:
            self.engine.register_name(name)
            upsert_student(name)
        except ValueError as e:
            messagebox.showerror("Error", str(e))
            return
        if not self._open_camera():
            return
        self.register_name = name
        self.samples_taken = 0
        self._last_sample_time = 0.0
        self.mode = "register"
        self.running = True
        self._set_buttons_camera_on(True)
        self._set_mode_badge("REGISTER")
        self._set_status(f"Enrolling {name}", "active")
        self._set_progress(0)
        self.after(30, self._loop)

    def start_update_face(self) -> None:
        if not self.require_admin():
            return
        name = self._selected_name()
        if not name:
            messagebox.showinfo("Update Face", "Select a person from the roster first.")
            return
        if not messagebox.askyesno(
            "Update Face Samples",
            f"Re-capture face samples for:\n\n    {name}\n\nOld samples will be replaced.",
        ):
            return
        try:
            self.engine.clear_samples(name)
        except ValueError as e:
            messagebox.showerror("Error", str(e))
            return
        if not self._open_camera():
            return
        self.register_name = name
        self.samples_taken = 0
        self._last_sample_time = 0.0
        self.mode = "update"
        self.running = True
        self._set_buttons_camera_on(True)
        self._set_mode_badge("UPDATE")
        self._set_status(f"Updating face samples for {name}", "active")
        self._set_progress(0)
        self.after(30, self._loop)

    def start_attendance(self) -> None:
        if not self.engine.is_trained():
            messagebox.showwarning(
                "Model Not Ready",
                "Register faces and train the model first.",
            )
            return
        self.engine = FaceEngine()
        if not self._open_camera():
            return
        self.mode = "attendance"
        self.running = True
        self._last_action.clear()
        self._set_buttons_camera_on(True)
        self._set_mode_badge("CHECK_IN" if self.session_kind == "check_in" else "CHECK_OUT")
        kind = "Check-In" if self.session_kind == "check_in" else "Check-Out"
        self._set_status(f"{kind} live · multi-face — all people in frame are processed", "active")
        self.cam_hint.configure(
            text=f"Multi-face {kind} · every face marked · green=new · gray=already"
        )
        self._update_stats()
        self.after(30, self._loop)

    def do_train(self) -> None:
        if not self.require_admin():
            return
        self._set_status("Training recognition model…", "active")
        self.update_idletasks()
        try:
            people, images = self.engine.train()
            messagebox.showinfo("Training Complete", f"People: {people}\nSamples: {images}")
            self._set_status(f"Model trained — {people} people, {images} samples")
            self._refresh_people()
        except Exception as e:
            messagebox.showerror("Training Failed", str(e))
            self._set_status("Training failed", "error")

    def delete_selected(self) -> None:
        if not self.require_admin():
            return
        name = self._selected_name()
        if not name:
            messagebox.showinfo("Remove", "Select a person first.")
            return
        if not messagebox.askyesno("Confirm", f"Remove face data and metadata for '{name}'?"):
            return
        if self.engine.delete_person(name):
            delete_student_meta(name)
            self._set_status(f"Removed {name}")
            self._refresh_people()
        else:
            messagebox.showerror("Error", f"Could not remove {name}")

    def edit_selected_profile(self) -> None:
        name = self._selected_name()
        if not name:
            messagebox.showinfo("Profile", "Select a person from the roster.")
            return
        if not self.require_admin():
            return
        StudentMetaDialog(self, name, on_saved=self._refresh_people)

    def show_selected_history(self) -> None:
        name = self._selected_name()
        if not name:
            messagebox.showinfo("History", "Select a person from the roster.")
            return
        PersonHistoryDialog(self, name)

    def open_browse(self) -> None:
        BrowseDaysDialog(
            self,
            self.engine.list_registered(),
            on_changed=self._refresh_all,
            require_admin=self.require_admin,
        )
        self._refresh_records_view()
        self._refresh_people()

    def open_manual(self) -> None:
        if not self.require_admin():
            return
        today = datetime.now().strftime("%Y-%m-%d")
        ManualEntryDialog(self, self.engine.list_registered(), today, on_changed=self._refresh_all)

    def mark_absents_today(self) -> None:
        if not self.require_admin():
            return
        if not messagebox.askyesno(
            "Mark Absents",
            "Mark all registered students without check-in today as Absent?",
        ):
            return
        n, msg = mark_all_missing_absent(self.engine.list_registered())
        messagebox.showinfo("Absents", msg)
        self._refresh_records_view()
        self._refresh_people()
        self._set_status(msg, "warn")

    def change_pin(self) -> None:
        if not self.require_admin():
            return
        ChangePinDialog(self)

    def open_notepad(self) -> None:
        path = open_today_file_path()
        self._refresh_records_view()
        try:
            if sys.platform.startswith("win"):
                os.startfile(str(path))  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(path)])
            else:
                try:
                    win_path = subprocess.check_output(["wslpath", "-w", str(path)], text=True).strip()
                    subprocess.Popen(["notepad.exe", win_path])
                except Exception:
                    subprocess.Popen(["xdg-open", str(path)])
            self._set_status(f"Opened {path.name}")
        except Exception as e:
            messagebox.showinfo("Attendance Log", f"{path}\n\n{e}")

    # ── Video loop ──────────────────────────────────────────────────────────
    def _loop(self) -> None:
        if not self.running or self.cap is None:
            return
        ok, frame = self.cap.read()
        if not ok:
            self._set_status("Failed to read camera frame", "error")
            self.after(100, self._loop)
            return

        frame = cv2.flip(frame, 1)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        face_count = 0
        known_count = 0

        if self.mode in {"register", "update"}:
            faces = self.engine.detect_faces(gray)
            face_count = len(faces)
            self._handle_register(frame, gray, faces)
        elif self.mode == "attendance":
            # Multi-face: detect + recognize every person in the frame
            matches = self.engine.recognize_all(gray)
            face_count = len(matches)
            known_count = sum(1 for m in matches if m.known)
            self._handle_attendance_multi(frame, matches)
        else:
            faces = self.engine.detect_faces(gray)
            face_count = len(faces)
            for (x, y, w, h) in faces:
                cv2.rectangle(frame, (x, y), (x + w, y + h), (56, 189, 248), 2)

        self._draw_hud(frame, face_count=face_count, known_count=known_count)
        self._show_frame(frame)
        if self.running:
            self.after(20, self._loop)

    def _draw_hud(self, frame, face_count: int = 0, known_count: int = 0) -> None:
        h, w = frame.shape[:2]
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 36), (11, 18, 32), -1)
        cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
        ts = datetime.now().strftime("%Y-%m-%d   %H:%M:%S")
        if self.mode == "attendance":
            mode_txt = "MULTI CHECK-IN" if self.session_kind == "check_in" else "MULTI CHECK-OUT"
        elif self.mode == "update":
            mode_txt = "UPDATE"
        elif self.mode == "register":
            mode_txt = "ENROLL"
        else:
            mode_txt = "IDLE"
        cv2.putText(
            frame,
            f"SmartAttend  |  {mode_txt}  |  Faces: {face_count}  Known: {known_count}",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (248, 250, 252),
            1,
            cv2.LINE_AA,
        )
        cv2.putText(
            frame, ts, (w - 210, 24),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (148, 163, 184), 1, cv2.LINE_AA,
        )

    def _handle_register(self, frame, gray, faces) -> None:
        # Enroll largest face only; still draw other faces so multi-detect is visible
        if not faces:
            cv2.putText(frame, "Center your face in the frame", (20, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (245, 158, 11), 2, cv2.LINE_AA)
            return
        primary = self.engine.largest_face(faces)
        for (x, y, w, h) in faces:
            is_primary = primary is not None and (x, y, w, h) == primary
            color = (16, 185, 129) if is_primary else (100, 116, 139)
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2 if is_primary else 1)
            if not is_primary:
                cv2.putText(frame, "other", (x, max(y - 8, 50)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
        x, y, w, h = primary  # type: ignore[misc]
        if self.samples_taken < SAMPLES_PER_PERSON:
            now = time.time()
            if now - self._last_sample_time >= 0.12:
                self.samples_taken += 1
                self._last_sample_time = now
                self.engine.save_sample(self.register_name, gray, (x, y, w, h), self.samples_taken)
                self._set_progress(self.samples_taken)
                self._set_info(f"Sample {self.samples_taken}/{SAMPLES_PER_PERSON}")
            cv2.putText(frame, f"ENROLL {self.samples_taken}/{SAMPLES_PER_PERSON}", (x, max(y - 12, 50)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (16, 185, 129), 2, cv2.LINE_AA)
        if self.samples_taken >= SAMPLES_PER_PERSON:
            self.running = False
            name = self.register_name
            kind = self.mode
            self.after(100, lambda: self._finish_register(name, kind))

    def _finish_register(self, name: str, kind: str) -> None:
        self.stop_camera()
        try:
            people, images = self.engine.train()
            title = "Face Updated" if kind == "update" else "Enrollment Complete"
            messagebox.showinfo(
                title,
                f"{name}\n\nSamples: {SAMPLES_PER_PERSON}\nModel: {people} people · {images} images\n\n"
                "Live sessions recognize multiple faces at once.",
            )
            self._set_status(f"{'Updated' if kind == 'update' else 'Enrolled'}: {name}")
        except Exception as e:
            messagebox.showwarning("Samples Saved", f"Saved for {name}. Train later.\n{e}")
            self._set_status(f"Samples saved for {name}", "warn")
        self._refresh_people()

    def _handle_attendance_multi(self, frame, matches: list[FaceMatch]) -> None:
        """Process EVERY detected face for check-in or check-out."""
        if not matches:
            self._set_info("No faces in view")
            return

        now = time.time()
        newly: list[str] = []
        already: list[str] = []
        unknown = 0
        need_refresh = False

        for idx, match in enumerate(matches, start=1):
            x, y, w, h = match.box
            color, label, did_mark = self._process_one_face(frame, match, now, idx)
            self._draw_face_box(frame, x, y, w, h, color, label, index=idx)
            if match.known:
                if did_mark:
                    newly.append(match.name)
                    need_refresh = True
                else:
                    already.append(match.name)
            else:
                unknown += 1

        if need_refresh:
            self._refresh_records_view()
            self._refresh_people()

        total = len(matches)
        known_n = total - unknown
        if newly:
            self._set_status(
                f"Marked {len(newly)}/{total}: {', '.join(newly)}",
                "info",
            )
        elif known_n:
            self._set_status(
                f"{known_n} known face(s) in view · {unknown} unknown",
                "warn" if unknown else "info",
            )
        else:
            self._set_status(f"{total} face(s) detected — none registered", "warn")

        parts = [f"{total} face(s)", f"{known_n} known"]
        if newly:
            parts.append("new: " + ", ".join(newly))
        if already:
            # unique preserve order
            seen: set[str] = set()
            uniq = []
            for n in already:
                if n not in seen:
                    seen.add(n)
                    uniq.append(n)
            parts.append("already: " + ", ".join(uniq[:5]))
        if unknown:
            parts.append(f"{unknown} unknown")
        self._set_info("  ·  ".join(parts))

    def _process_one_face(
        self, frame, match: FaceMatch, now: float, idx: int
    ) -> tuple[tuple[int, int, int], str, bool]:
        """
        Apply check-in/out logic for a single FaceMatch.
        Returns (color_bgr, label, did_new_mark).
        """
        if not match.known:
            return (239, 68, 68), f"#{idx} Unknown", False

        name = match.name
        state = get_person_state(name)
        in_flash = self._just_marked.get(name, 0) > now
        last = self._last_action.get(name, 0)
        can_act = (now - last) >= RELOG_COOLDOWN_SECONDS

        if self.session_kind == "check_in":
            if state in {"checked_in", "checked_out"}:
                if in_flash:
                    return (16, 185, 129), f"#{idx} {name} · JUST IN", False
                tag = "Done" if state == "checked_out" else "Already In"
                return (107, 114, 128), f"#{idx} {name} · {tag}", False
            if can_act:
                snap = save_snapshot_frame(frame, name, "checkin")
                ok, _msg, entry = check_in(name, snapshot_path=snap)
                self._last_action[name] = now
                if ok:
                    self._just_marked[name] = now + JUST_MARKED_FLASH_SECONDS
                    status = (entry or {}).get("status", "IN")
                    return (16, 185, 129), f"#{idx} {name} · {status}", True
                return (107, 114, 128), f"#{idx} {name} · Already In", False
            if in_flash:
                return (16, 185, 129), f"#{idx} {name} · JUST IN", False
            return (107, 114, 128), f"#{idx} {name} · Already In", False

        # Check-out mode
        if state == "checked_out":
            if in_flash:
                return (16, 185, 129), f"#{idx} {name} · JUST OUT", False
            return (107, 114, 128), f"#{idx} {name} · Already Out", False
        if state != "checked_in":
            return (245, 158, 11), f"#{idx} {name} · No check-in", False
        if can_act:
            snap = save_snapshot_frame(frame, name, "checkout")
            ok, _msg, _entry = check_out(name, snapshot_path=snap)
            self._last_action[name] = now
            if ok:
                self._just_marked[name] = now + JUST_MARKED_FLASH_SECONDS
                return (16, 185, 129), f"#{idx} {name} · CHECKED OUT", True
            return (107, 114, 128), f"#{idx} {name} · Already Out", False
        if in_flash:
            return (16, 185, 129), f"#{idx} {name} · JUST OUT", False
        return (107, 114, 128), f"#{idx} {name} · Already Out", False

    def _draw_face_box(
        self, frame, x, y, w, h, color, label: str, index: int | None = None
    ) -> None:
        thickness = 3 if color == (16, 185, 129) else 2
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)
        bar_h = 28
        y2 = min(y + h + bar_h, frame.shape[0] - 1)
        cv2.rectangle(frame, (x, y + h), (x + w, y2), color, -1)
        cv2.putText(
            frame, label[:42], (x + 4, y + h + 20),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA,
        )
        if index is not None:
            cv2.rectangle(frame, (x, y), (x + 26, y + 22), color, -1)
            cv2.putText(
                frame, str(index), (x + 7, y + 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA,
            )

    def _show_frame(self, frame) -> None:
        self.video_label.update_idletasks()
        lw = max(self.video_label.winfo_width(), 320)
        lh = max(self.video_label.winfo_height(), 240)
        h, w = frame.shape[:2]
        scale = min(lw / w, lh / h)
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        self._photo = ImageTk.PhotoImage(image=Image.fromarray(rgb))
        self.video_label.configure(image=self._photo, text="")

    def _on_close(self) -> None:
        self.running = False
        if self._clock_job is not None:
            try:
                self.after_cancel(self._clock_job)
            except Exception:
                pass
        if self.cap is not None:
            self.cap.release()
        self.destroy()


def main() -> None:
    app = SmartAttendanceApp()
    app.mainloop()


if __name__ == "__main__":
    main()
