"""ADM desktop UI — IDM-inspired download manager."""

from __future__ import annotations

import sys
import threading
import time
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Optional

try:
    import customtkinter as ctk
except ImportError:
    print("Missing dependency: customtkinter")
    print("Install with:  pip install -r requirements.txt")
    sys.exit(1)

from adm import __app_name__, __app_short__, __version__
from adm.models import JobStatus
from adm.queue import QueueManager, build_job_from_url
from adm.storage import load_settings, save_settings
from adm.utils import format_eta, format_size, format_speed

# ---------------------------------------------------------------------------
# Theme — clean light UI
# ---------------------------------------------------------------------------
C_BG = "#F4F6F9"
C_SURFACE = "#FFFFFF"
C_CARD = "#FFFFFF"
C_BORDER = "#E2E8F0"
C_PRIMARY = "#2563EB"
C_PRIMARY_HOVER = "#1D4ED8"
C_SECONDARY = "#F1F5F9"
C_SECONDARY_HOVER = "#E2E8F0"
C_ACCENT = "#0284C7"
C_WARN = "#D97706"
C_WARN_HOVER = "#B45309"
C_DANGER = "#DC2626"
C_DANGER_HOVER = "#B91C1C"
C_SUCCESS = "#16A34A"
C_TEXT = "#0F172A"
C_MUTED = "#64748B"
C_DIM = "#94A3B8"
C_ROW_ALT = "#F8FAFC"
C_ROW_SEL = "#DBEAFE"
C_PROGRESS = "#2563EB"
C_PROGRESS_TRACK = "#E2E8F0"

STATUS_COLORS = {
    JobStatus.QUEUED.value: C_MUTED,
    JobStatus.CONNECTING.value: C_ACCENT,
    JobStatus.DOWNLOADING.value: C_PRIMARY,
    JobStatus.PAUSED.value: C_WARN,
    JobStatus.MERGING.value: C_ACCENT,
    JobStatus.COMPLETED.value: C_SUCCESS,
    JobStatus.FAILED.value: C_DANGER,
    JobStatus.CANCELLED.value: C_DIM,
}

FILTERS = ["All", "Downloading", "Queued", "Completed", "Paused", "Failed"]


class AddDownloadDialog(ctk.CTkToplevel):
    def __init__(self, master: "ADMApp", preset_url: str = "") -> None:
        super().__init__(master)
        self.master_app = master
        self.title("Add URL — ADM")
        self.geometry("640x480")
        self.resizable(False, False)
        self.configure(fg_color=C_BG)
        self.transient(master)
        self.grab_set()
        self.result = None

        self._build(preset_url)
        self.after(100, self._center)
        self.entry_url.focus_set()
        if preset_url:
            self.entry_url.insert(0, preset_url)
            self.entry_url.select_range(0, "end")

    def _center(self) -> None:
        self.update_idletasks()
        x = self.master_app.winfo_rootx() + 80
        y = self.master_app.winfo_rooty() + 60
        self.geometry(f"+{x}+{y}")

    def _build(self, preset_url: str) -> None:
        pad = {"padx": 20, "pady": (12, 0)}

        ctk.CTkLabel(
            self,
            text="Add new download",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=C_TEXT,
        ).pack(anchor="w", **pad)

        ctk.CTkLabel(self, text="URL / Address", text_color=C_MUTED, font=ctk.CTkFont(size=12)).pack(
            anchor="w", padx=20, pady=(16, 4)
        )
        self.entry_url = ctk.CTkEntry(
            self,
            height=38,
            placeholder_text="https://…  (file link, YouTube, Instagram, …)",
            fg_color="#F8FAFC",
            border_color=C_BORDER,
            text_color=C_TEXT,
        )
        self.entry_url.pack(fill="x", padx=20)

        # Save path
        ctk.CTkLabel(self, text="Save to", text_color=C_MUTED, font=ctk.CTkFont(size=12)).pack(
            anchor="w", padx=20, pady=(14, 4)
        )
        path_row = ctk.CTkFrame(self, fg_color="transparent")
        path_row.pack(fill="x", padx=20)
        self.entry_path = ctk.CTkEntry(
            path_row, height=36, fg_color="#F8FAFC", border_color=C_BORDER, text_color=C_TEXT
        )
        self.entry_path.pack(side="left", fill="x", expand=True)
        self.entry_path.insert(0, self.master_app.settings.get("download_dir", ""))
        ctk.CTkButton(
            path_row,
            text="Browse",
            width=90,
            height=36,
            fg_color=C_SECONDARY,
            hover_color=C_SECONDARY_HOVER,
            text_color=C_TEXT,
            border_width=1,
            border_color=C_BORDER,
            command=self._browse,
        ).pack(side="left", padx=(8, 0))

        # Filename (optional)
        ctk.CTkLabel(
            self, text="File name (optional — leave blank to auto-detect)", text_color=C_MUTED, font=ctk.CTkFont(size=12)
        ).pack(anchor="w", padx=20, pady=(14, 4))
        self.entry_name = ctk.CTkEntry(
            self, height=36, fg_color="#F8FAFC", border_color=C_BORDER, text_color=C_TEXT,
            placeholder_text="Auto from server / page title",
        )
        self.entry_name.pack(fill="x", padx=20)

        # Options row
        opts = ctk.CTkFrame(self, fg_color=C_SECONDARY, corner_radius=12, border_width=1, border_color=C_BORDER)
        opts.pack(fill="x", padx=20, pady=(16, 0))

        inner = ctk.CTkFrame(opts, fg_color="transparent")
        inner.pack(fill="x", padx=14, pady=12)

        ctk.CTkLabel(inner, text="Connections", text_color=C_MUTED).grid(row=0, column=0, sticky="w")
        self.conn_var = ctk.StringVar(value=str(self.master_app.settings.get("default_connections", 16)))
        ctk.CTkOptionMenu(
            inner,
            variable=self.conn_var,
            values=[str(i) for i in (1, 2, 4, 8, 12, 16, 24, 32)],
            width=80,
            fg_color="#F8FAFC",
            button_color=C_SECONDARY_HOVER,
            button_hover_color=C_DIM,
            text_color=C_TEXT,
        ).grid(row=0, column=1, padx=(8, 24))

        ctk.CTkLabel(inner, text="Type", text_color=C_MUTED).grid(row=0, column=2, sticky="w")
        self.type_var = ctk.StringVar(value="Auto")
        ctk.CTkOptionMenu(
            inner,
            variable=self.type_var,
            values=["Auto", "Direct file", "Video / Media", "Audio only"],
            width=140,
            fg_color="#F8FAFC",
            button_color=C_SECONDARY_HOVER,
            button_hover_color=C_DIM,
            text_color=C_TEXT,
        ).grid(row=0, column=3, padx=(8, 24))

        ctk.CTkLabel(inner, text="Quality", text_color=C_MUTED).grid(row=0, column=4, sticky="w")
        self.quality_var = ctk.StringVar(value="Best (Original)")
        ctk.CTkOptionMenu(
            inner,
            variable=self.quality_var,
            values=["Best (Original)", "1080p", "720p", "480p", "360p"],
            width=130,
            fg_color="#F8FAFC",
            button_color=C_SECONDARY_HOVER,
            button_hover_color=C_DIM,
            text_color=C_TEXT,
        ).grid(row=0, column=5, padx=(8, 0))

        self.start_var = ctk.BooleanVar(value=bool(self.master_app.settings.get("auto_start", True)))
        ctk.CTkCheckBox(
            self,
            text="Start downloading immediately",
            variable=self.start_var,
            text_color=C_TEXT,
            fg_color=C_PRIMARY,
            hover_color=C_PRIMARY_HOVER,
        ).pack(anchor="w", padx=20, pady=(14, 0))

        # Buttons
        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(fill="x", padx=20, pady=20)
        ctk.CTkButton(
            btn_row,
            text="Cancel",
            width=110,
            height=38,
            fg_color=C_SECONDARY,
            hover_color=C_SECONDARY_HOVER,
            text_color=C_TEXT,
            border_width=1,
            border_color=C_BORDER,
            command=self.destroy,
        ).pack(side="right", padx=(8, 0))
        ctk.CTkButton(
            btn_row,
            text="Download",
            width=130,
            height=38,
            fg_color=C_PRIMARY,
            hover_color=C_PRIMARY_HOVER,
            text_color="#FFFFFF",
            font=ctk.CTkFont(weight="bold"),
            command=self._submit,
        ).pack(side="right")

        self.bind("<Return>", lambda e: self._submit())
        self.bind("<Escape>", lambda e: self.destroy())

    def _browse(self) -> None:
        d = filedialog.askdirectory(initialdir=self.entry_path.get() or str(Path.home()))
        if d:
            self.entry_path.delete(0, "end")
            self.entry_path.insert(0, d)

    def _submit(self) -> None:
        url = self.entry_url.get().strip()
        if not url:
            messagebox.showwarning("Missing URL", "Please paste a download link.", parent=self)
            return
        if not url.startswith(("http://", "https://", "ftp://")):
            messagebox.showwarning("Invalid URL", "URL must start with http:// or https://", parent=self)
            return
        path = self.entry_path.get().strip()
        if not path:
            messagebox.showwarning("Save folder", "Choose a save folder.", parent=self)
            return

        t = self.type_var.get()
        force_media = t in ("Video / Media", "Audio only")
        media_mode = "audio" if t == "Audio only" else "video"
        # If Auto and user picked audio quality only matters for media
        if t == "Direct file":
            force_media = False

        name = self.entry_name.get().strip()
        try:
            conns = int(self.conn_var.get())
        except ValueError:
            conns = 8

        self.btn_busy(True)
        def work() -> None:
            try:
                job = build_job_from_url(
                    url,
                    path,
                    filename=name,
                    connections=conns,
                    force_media=force_media or t == "Video / Media",
                    media_mode=media_mode,
                    media_quality=self.quality_var.get(),
                )
                if t == "Direct file":
                    job.kind = "direct"
                    job.platform = "Direct"
                self.master_app.after(0, lambda: self._done(job))
            except Exception as exc:
                self.master_app.after(0, lambda: self._fail(str(exc)))

        threading.Thread(target=work, daemon=True).start()

    def btn_busy(self, busy: bool) -> None:
        # simple title feedback
        self.title("Resolving link…" if busy else "Add URL — ADM")

    def _done(self, job) -> None:
        auto = self.start_var.get()
        if not auto:
            job.status = JobStatus.PAUSED.value
        self.master_app.queue.add_job(job, auto_start=auto)
        # Remember folder
        self.master_app.settings["download_dir"] = self.entry_path.get().strip()
        save_settings(self.master_app.settings)
        # Close add dialog first, then open IDM-style progress window
        app = self.master_app
        jid = job.id
        self.destroy()
        app.after(50, lambda: app.open_progress_window(jid))

    def _fail(self, err: str) -> None:
        self.btn_busy(False)
        messagebox.showerror("Could not add download", err, parent=self)



class DownloadProgressWindow(ctk.CTkToplevel):
    """IDM-style per-download progress popup."""

    def __init__(self, master: "ADMApp", job_id: str) -> None:
        super().__init__(master)
        self.master_app = master
        self.job_id = job_id
        self._closed = False
        self._wrap = 420

        job = master.queue.get_job(job_id)
        title_name = (job.filename if job else "Download")[:50]
        self.title(f"Downloading — {title_name}")
        self.geometry("640x520")
        self.minsize(560, 480)
        self.resizable(True, True)
        self.configure(fg_color=C_BG)
        self.transient(master)

        self._build()
        self.protocol("WM_DELETE_WINDOW", self._hide)
        self.bind("<Configure>", self._on_resize)
        self.after(80, self._center)
        self.after(200, self._tick)

    def _center(self) -> None:
        try:
            self.update_idletasks()
            open_n = len(self.master_app._progress_windows)
            x = self.master_app.winfo_rootx() + 80 + (open_n % 5) * 28
            y = self.master_app.winfo_rooty() + 60 + (open_n % 5) * 28
            self.geometry(f"+{x}+{y}")
            self.lift()
            self.focus_force()
            self._update_wraplengths()
        except Exception:
            pass

    def _on_resize(self, event=None) -> None:
        if event is not None and event.widget is not self:
            return
        self._update_wraplengths()

    def _update_wraplengths(self) -> None:
        try:
            w = max(280, self.winfo_width() - 200)
            self._wrap = w
            for lbl in (
                self.lbl_name, self.lbl_status, self.lbl_size, self.lbl_done,
                self.lbl_speed, self.lbl_eta, self.lbl_conn, self.lbl_detail, self.lbl_hint,
            ):
                lbl.configure(wraplength=w)
        except Exception:
            pass

    def _build(self) -> None:
        # Header
        head = ctk.CTkFrame(self, fg_color=C_SURFACE, corner_radius=0, height=48)
        head.pack(fill="x")
        head.pack_propagate(False)
        ctk.CTkLabel(
            head,
            text="Download File Info",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=C_TEXT,
        ).pack(side="left", padx=16, pady=10)
        self.badge = ctk.CTkLabel(
            head, text="Connecting", font=ctk.CTkFont(size=12, weight="bold"), text_color=C_ACCENT
        )
        self.badge.pack(side="right", padx=16)

        # Scrollable body so nothing is clipped on small screens
        body = ctk.CTkScrollableFrame(
            self, fg_color=C_BG, corner_radius=0,
            scrollbar_button_color=C_SECONDARY_HOVER,
            scrollbar_button_hover_color=C_DIM,
        )
        body.pack(fill="both", expand=True, padx=12, pady=(8, 0))
        body.grid_columnconfigure(1, weight=1)
        self._body = body

        def add_row(r: int, label: str, multiline: bool = False):
            ctk.CTkLabel(
                body,
                text=label,
                anchor="ne" if multiline else "w",
                justify="left",
                font=ctk.CTkFont(size=12),
                text_color=C_MUTED,
                width=118,
            ).grid(row=r, column=0, sticky="nw", padx=(8, 10), pady=5)
            val = ctk.CTkLabel(
                body,
                text="—",
                anchor="w",
                justify="left",
                font=ctk.CTkFont(size=12),
                text_color=C_TEXT,
                wraplength=self._wrap,
            )
            val.grid(row=r, column=1, sticky="ew", padx=(0, 8), pady=5)
            return val

        self.lbl_name = add_row(0, "File name:")

        # URL + Save use readonly entries so long paths fit and scroll
        ctk.CTkLabel(
            body, text="URL:", anchor="w", font=ctk.CTkFont(size=12),
            text_color=C_MUTED, width=118,
        ).grid(row=1, column=0, sticky="w", padx=(8, 10), pady=5)
        self.entry_url = ctk.CTkEntry(
            body, height=30, fg_color="#F8FAFC", border_color=C_BORDER,
            text_color=C_TEXT, border_width=1,
        )
        self.entry_url.grid(row=1, column=1, sticky="ew", padx=(0, 8), pady=5)
        self.entry_url.configure(state="readonly")

        ctk.CTkLabel(
            body, text="Save as:", anchor="w", font=ctk.CTkFont(size=12),
            text_color=C_MUTED, width=118,
        ).grid(row=2, column=0, sticky="w", padx=(8, 10), pady=5)
        self.entry_save = ctk.CTkEntry(
            body, height=30, fg_color="#F8FAFC", border_color=C_BORDER,
            text_color=C_TEXT, border_width=1,
        )
        self.entry_save.grid(row=2, column=1, sticky="ew", padx=(0, 8), pady=5)
        self.entry_save.configure(state="readonly")

        self.lbl_status = add_row(3, "Status:")
        self.lbl_size = add_row(4, "File size:")
        self.lbl_done = add_row(5, "Downloaded:")
        self.lbl_speed = add_row(6, "Transfer rate:")
        self.lbl_eta = add_row(7, "Time left:")
        self.lbl_conn = add_row(8, "Connections:")

        # Progress section
        prog_box = ctk.CTkFrame(body, fg_color=C_SECONDARY, corner_radius=12, border_width=1, border_color=C_BORDER)
        prog_box.grid(row=9, column=0, columnspan=2, sticky="ew", padx=4, pady=(12, 8))
        prog_box.grid_columnconfigure(0, weight=1)

        self.pct_big = ctk.CTkLabel(
            prog_box, text="0.0%",
            font=ctk.CTkFont(size=22, weight="bold"), text_color=C_TEXT,
        )
        self.pct_big.pack(pady=(14, 6))

        self.bar = ctk.CTkProgressBar(
            prog_box, height=20, progress_color=C_PROGRESS, fg_color=C_PROGRESS_TRACK,
            corner_radius=6,
        )
        self.bar.pack(fill="x", padx=18, pady=(0, 6))
        self.bar.set(0)

        self.lbl_detail = ctk.CTkLabel(
            prog_box, text="Waiting to start…",
            font=ctk.CTkFont(size=11), text_color=C_MUTED,
            wraplength=self._wrap, justify="center",
        )
        self.lbl_detail.pack(fill="x", padx=16, pady=(0, 14))

        # Buttons bar
        btns = ctk.CTkFrame(self, fg_color=C_SURFACE, corner_radius=0)
        btns.pack(fill="x", side="bottom")

        inner = ctk.CTkFrame(btns, fg_color="transparent")
        inner.pack(fill="x", pady=(10, 4), padx=10)

        def b(text, cmd, color=C_SECONDARY, hover=C_SECONDARY_HOVER, width=100):
            primary = color in (C_PRIMARY, C_DANGER, C_WARN, C_SUCCESS)
            return ctk.CTkButton(
                inner, text=text, width=width, height=34,
                fg_color=color, hover_color=hover,
                text_color="#FFFFFF" if primary else C_TEXT,
                font=ctk.CTkFont(size=12, weight="bold") if primary else ctk.CTkFont(size=12),
                border_width=0 if primary else 1,
                border_color=C_BORDER,
                command=cmd,
            )

        # Equal-ish buttons that stay inside the window
        self.btn_pause = b("Pause", self._on_pause, C_WARN, C_WARN_HOVER, 100)
        self.btn_pause.pack(side="left", expand=True, fill="x", padx=3)
        self.btn_resume = b("Resume", self._on_resume, C_PRIMARY, C_PRIMARY_HOVER, 100)
        self.btn_resume.pack(side="left", expand=True, fill="x", padx=3)
        self.btn_stop = b("Stop", self._on_stop, C_CARD, C_BORDER, 100)
        self.btn_stop.pack(side="left", expand=True, fill="x", padx=3)
        self.btn_cancel = b("Cancel", self._on_cancel, C_DANGER, C_DANGER_HOVER, 100)
        self.btn_cancel.pack(side="left", expand=True, fill="x", padx=3)
        self.btn_hide = b("Hide", self._hide, C_CARD, C_BORDER, 100)
        self.btn_hide.pack(side="left", expand=True, fill="x", padx=3)

        self.lbl_hint = ctk.CTkLabel(
            btns,
            text="Stop = restart from 0%   ·   Cancel = abort   ·   Hide = keep going in list",
            font=ctk.CTkFont(size=10),
            text_color=C_DIM,
            wraplength=560,
            justify="center",
        )
        self.lbl_hint.pack(fill="x", padx=12, pady=(0, 10))

    def _set_entry(self, entry: ctk.CTkEntry, value: str) -> None:
        entry.configure(state="normal")
        entry.delete(0, "end")
        entry.insert(0, value or "")
        entry.configure(state="readonly")

    def _tick(self) -> None:
        if self._closed:
            return
        try:
            if not self.winfo_exists():
                return
            self._refresh()
        except Exception:
            pass
        if not self._closed:
            # 400ms is plenty for a progress dialog; keeps UI thread free
            self.after(400, self._tick)

    def _refresh(self) -> None:
        job = self.master_app.queue.get_job(self.job_id)
        if not job:
            self.lbl_status.configure(text="Removed from list")
            self.badge.configure(text="Gone", text_color=C_DIM)
            self._set_buttons_finished()
            return

        # Skip identical paints (big files fire many progress ticks)
        pct_r = round(job.percent, 1)
        paint_key = (
            job.filename, job.status, job.downloaded_bytes, job.total_bytes,
            pct_r, round(job.speed or 0), job.eta, job.error,
        )
        if getattr(self, "_last_paint", None) == paint_key:
            return
        self._last_paint = paint_key

        name = job.filename or "…"
        self.lbl_name.configure(text=name)
        self._set_entry(self.entry_url, job.url or "")
        save_path = str(Path(job.save_dir) / (job.filename or ""))
        self._set_entry(self.entry_save, save_path)

        st = job.status
        st_color = STATUS_COLORS.get(st, C_MUTED)
        status_text = st
        if job.error and st == JobStatus.FAILED.value:
            err = job.error if len(job.error) <= 120 else job.error[:117] + "…"
            status_text = f"{st} — {err}"
        self.lbl_status.configure(text=status_text)
        self.badge.configure(text=st, text_color=st_color)

        total = job.total_bytes or 0
        done = job.downloaded_bytes or 0
        if total > 0:
            self.lbl_size.configure(text=format_size(total))
            self.lbl_done.configure(
                text=f"{format_size(done)} of {format_size(total)}  ({job.percent:.1f}%)"
            )
        else:
            self.lbl_size.configure(
                text=format_size(done) if st == JobStatus.COMPLETED.value and done else "Unknown"
            )
            self.lbl_done.configure(text=format_size(done) if done else "—")

        if st == JobStatus.DOWNLOADING.value:
            self.lbl_speed.configure(text=format_speed(job.speed))
            self.lbl_eta.configure(text=format_eta(job.eta))
        elif st == JobStatus.COMPLETED.value:
            self.lbl_speed.configure(text="—")
            self.lbl_eta.configure(text="Done")
        elif st == JobStatus.PAUSED.value:
            self.lbl_speed.configure(text="Paused")
            self.lbl_eta.configure(text="—")
        else:
            self.lbl_speed.configure(text="—")
            self.lbl_eta.configure(text="—")

        if job.kind == "media":
            self.lbl_conn.configure(text=f"Media ({job.platform}) · {job.media_mode}")
        else:
            self.lbl_conn.configure(text=f"{job.connections} parts")

        pct = max(0.0, min(100.0, job.percent))
        if st == JobStatus.COMPLETED.value:
            pct = 100.0
        self.bar.set(pct / 100.0)
        self.pct_big.configure(text=f"{pct:.1f}%")

        if st == JobStatus.COMPLETED.value:
            self.lbl_detail.configure(text="Download completed successfully.", text_color=C_SUCCESS)
            self.bar.configure(progress_color=C_SUCCESS)
            self.title(f"Completed — {(job.filename or '')[:48]}")
            self._set_buttons_finished(success=True)
        elif st == JobStatus.FAILED.value:
            err = job.error or "Download failed."
            if len(err) > 140:
                err = err[:137] + "…"
            self.lbl_detail.configure(text=err, text_color=C_DANGER)
            self.bar.configure(progress_color=C_DANGER)
            self._set_buttons_finished(success=False)
        elif st == JobStatus.CANCELLED.value:
            self.lbl_detail.configure(text="Download cancelled.", text_color=C_DIM)
            self._set_buttons_finished(success=False)
        elif st == JobStatus.PAUSED.value:
            self.lbl_detail.configure(
                text="Paused. Resume to continue, or Stop then Resume to restart from 0%.",
                text_color=C_WARN,
            )
            self.bar.configure(progress_color=C_WARN)
            self._set_buttons_active(paused=True)
        elif st in (JobStatus.DOWNLOADING.value, JobStatus.CONNECTING.value, JobStatus.MERGING.value):
            detail = {
                JobStatus.CONNECTING.value: "Connecting to server…",
                JobStatus.MERGING.value: "Merging file parts…",
                JobStatus.DOWNLOADING.value: f"Downloading…  {format_speed(job.speed)}",
            }.get(st, "Working…")
            self.lbl_detail.configure(text=detail, text_color=C_MUTED)
            self.bar.configure(progress_color=C_PROGRESS)
            self._set_buttons_active(paused=False)
        else:
            self.lbl_detail.configure(text="In queue — waiting for a free slot…", text_color=C_MUTED)
            self._set_buttons_active(paused=True)

        if st in (JobStatus.DOWNLOADING.value, JobStatus.CONNECTING.value, JobStatus.MERGING.value):
            self.title(f"{pct:.0f}% — {(job.filename or 'Download')[:46]}")

    def _set_buttons_active(self, paused: bool) -> None:
        try:
            self.btn_pause.configure(state="disabled" if paused else "normal")
            self.btn_resume.configure(state="normal" if paused else "disabled", text="Resume")
            self.btn_stop.configure(state="normal")
            self.btn_cancel.configure(state="normal")
            self.btn_hide.configure(text="Hide", command=self._hide)
        except Exception:
            pass

    def _set_buttons_finished(self, success: bool = False) -> None:
        try:
            self.btn_pause.configure(state="disabled")
            self.btn_resume.configure(state="normal", text="Restart")
            self.btn_stop.configure(state="disabled")
            self.btn_cancel.configure(state="disabled")
            if success:
                self.btn_hide.configure(text="Open folder", command=self._open_folder_and_close)
            else:
                self.btn_hide.configure(text="Close", command=self._hide)
        except Exception:
            pass

    def _on_pause(self) -> None:
        self.master_app.queue.pause(self.job_id)

    def _on_resume(self) -> None:
        job = self.master_app.queue.get_job(self.job_id)
        if not job:
            return
        if job.status in (JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value):
            self.master_app.queue.stop_reset(self.job_id)
            self.btn_resume.configure(text="Resume")
        self.master_app.queue.resume(self.job_id)
        try:
            self.btn_resume.configure(text="Resume")
            self.bar.configure(progress_color=C_PROGRESS)
        except Exception:
            pass

    def _on_stop(self) -> None:
        """Stop and reset so next Resume starts from the beginning."""
        self.master_app.queue.stop_reset(self.job_id)

    def _on_cancel(self) -> None:
        if messagebox.askyesno("Cancel download", "Cancel this download?", parent=self):
            self.master_app.queue.cancel(self.job_id)
            self._hide()

    def _open_folder_and_close(self) -> None:
        job = self.master_app.queue.get_job(self.job_id)
        if job:
            p = Path(job.filepath).parent if job.filepath else Path(job.save_dir)
            p.mkdir(parents=True, exist_ok=True)
            try:
                if sys.platform == "win32":
                    import os
                    os.startfile(str(p))  # type: ignore[attr-defined]
                else:
                    webbrowser.open(p.as_uri())
            except Exception:
                pass
        self._hide()

    def _hide(self) -> None:
        self._closed = True
        self.master_app._progress_windows.pop(self.job_id, None)
        try:
            self.destroy()
        except Exception:
            pass


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, master: "ADMApp") -> None:
        super().__init__(master)
        self.master_app = master
        self.title("Settings — ADM")
        self.geometry("480x320")
        self.configure(fg_color=C_BG)
        self.transient(master)
        self.grab_set()

        s = master.settings
        ctk.CTkLabel(self, text="Settings", font=ctk.CTkFont(size=18, weight="bold"), text_color=C_TEXT).pack(
            anchor="w", padx=20, pady=(16, 8)
        )

        form = ctk.CTkFrame(self, fg_color=C_SECONDARY, corner_radius=12, border_width=1, border_color=C_BORDER)
        form.pack(fill="both", expand=True, padx=20, pady=8)

        ctk.CTkLabel(form, text="Default save folder", text_color=C_MUTED).pack(anchor="w", padx=14, pady=(14, 4))
        row = ctk.CTkFrame(form, fg_color="transparent")
        row.pack(fill="x", padx=14)
        self.path = ctk.CTkEntry(row, height=34, fg_color="#F8FAFC", border_color=C_BORDER, text_color=C_TEXT)
        self.path.pack(side="left", fill="x", expand=True)
        self.path.insert(0, s.get("download_dir", ""))
        ctk.CTkButton(row, text="…", width=40, height=34, fg_color=C_SECONDARY, hover_color=C_SECONDARY_HOVER, text_color=C_TEXT, border_width=1, border_color=C_BORDER, command=self._browse).pack(
            side="left", padx=(6, 0)
        )

        ctk.CTkLabel(form, text="Default connections (per file)", text_color=C_MUTED).pack(
            anchor="w", padx=14, pady=(14, 4)
        )
        self.conn = ctk.StringVar(value=str(s.get("default_connections", 16)))
        ctk.CTkOptionMenu(
            form, variable=self.conn, values=[str(i) for i in (1, 2, 4, 8, 12, 16, 24, 32)], width=120, fg_color="#F8FAFC", text_color=C_TEXT, button_color=C_SECONDARY_HOVER
        ).pack(anchor="w", padx=14)

        ctk.CTkLabel(form, text="Max simultaneous downloads", text_color=C_MUTED).pack(
            anchor="w", padx=14, pady=(14, 4)
        )
        self.conc = ctk.StringVar(value=str(s.get("max_concurrent", 3)))
        ctk.CTkOptionMenu(
            form, variable=self.conc, values=[str(i) for i in range(1, 9)], width=120, fg_color="#F8FAFC", text_color=C_TEXT, button_color=C_SECONDARY_HOVER
        ).pack(anchor="w", padx=14)

        ctk.CTkButton(
            self, text="Save", width=120, height=36, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOVER,
            text_color="#FFFFFF", command=self._save
        ).pack(pady=16)

    def _browse(self) -> None:
        d = filedialog.askdirectory()
        if d:
            self.path.delete(0, "end")
            self.path.insert(0, d)

    def _save(self) -> None:
        s = self.master_app.settings
        s["download_dir"] = self.path.get().strip()
        s["default_connections"] = int(self.conn.get())
        s["max_concurrent"] = int(self.conc.get())
        save_settings(s)
        self.master_app.queue.max_concurrent = int(self.conc.get())
        self.destroy()


class ADMApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")

        self.settings = load_settings()
        self.queue = QueueManager(max_concurrent=int(self.settings.get("max_concurrent", 3)))
        self.queue.add_listener(self._on_queue_change)

        self.title(f"{__app_name__} ({__app_short__}) v{__version__}")
        self.geometry("1100x640")
        self.minsize(900, 520)
        self.configure(fg_color=C_BG)

        self._filter = "All"
        self._selected_ids: set[str] = set()
        self._row_widgets: dict[str, dict] = {}
        self._progress_windows: dict[str, DownloadProgressWindow] = {}
        self._ui_dirty = True
        self._building = False

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)
        self.after(200, self._refresh_loop)
        self._render_rows()

        # Clipboard paste shortcut
        self.bind("<Control-v>", self._paste_add)
        self.bind("<Control-n>", lambda e: self.open_add_dialog())
        self.bind("<Delete>", lambda e: self._delete_selected())

    # ------------------------------------------------------------------ UI
    def _build_ui(self) -> None:
        # Top bar
        top = ctk.CTkFrame(self, fg_color=C_SURFACE, height=58, corner_radius=0, border_width=0)
        top.pack(fill="x")
        top.pack_propagate(False)

        brand = ctk.CTkFrame(top, fg_color="transparent")
        brand.pack(side="left", padx=16)
        ctk.CTkLabel(
            brand,
            text="ADM",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=C_PRIMARY,
        ).pack(side="left")
        ctk.CTkLabel(
            brand,
            text="Any Download Manager",
            font=ctk.CTkFont(size=13),
            text_color=C_MUTED,
        ).pack(side="left", padx=(10, 0))

        btns = ctk.CTkFrame(top, fg_color="transparent")
        btns.pack(side="right", padx=12)

        def tool(text, cmd, color=C_SECONDARY, hover=C_SECONDARY_HOVER, **kw):
            return ctk.CTkButton(
                btns,
                text=text,
                width=kw.get("width", 88),
                height=34,
                fg_color=color,
                hover_color=hover,
                text_color=C_TEXT if color != C_PRIMARY else "#FFFFFF",
                font=ctk.CTkFont(size=12, weight="bold") if color == C_PRIMARY else ctk.CTkFont(size=12),
                border_width=1 if color != C_PRIMARY else 0,
                border_color=C_BORDER,
                command=cmd,
            )

        tool("＋ Add URL", self.open_add_dialog, C_PRIMARY, C_PRIMARY_HOVER, width=100).pack(side="left", padx=3)
        tool("▶ Start", self._start_selected).pack(side="left", padx=3)
        tool("⏸ Pause", self._pause_selected).pack(side="left", padx=3)
        tool("⏹ Stop", self._stop_selected).pack(side="left", padx=3)
        tool("🗑 Delete", self._delete_selected).pack(side="left", padx=3)
        tool("📂 Folder", self._open_folder).pack(side="left", padx=3)
        tool("⚙", self._open_settings, width=40).pack(side="left", padx=3)

        # Filter chips
        filt = ctk.CTkFrame(self, fg_color=C_BG)
        filt.pack(fill="x", padx=12, pady=(10, 4))
        self._filter_btns: dict[str, ctk.CTkButton] = {}
        for name in FILTERS:
            b = ctk.CTkButton(
                filt,
                text=name,
                width=90,
                height=28,
                corner_radius=14,
                fg_color=C_PRIMARY if name == "All" else C_SECONDARY,
                hover_color=C_SECONDARY_HOVER,
                text_color="#FFFFFF" if name == "All" else C_TEXT,
                border_width=0 if name == "All" else 1,
                border_color=C_BORDER,
                font=ctk.CTkFont(size=12),
                command=lambda n=name: self._set_filter(n),
            )
            b.pack(side="left", padx=3)
            self._filter_btns[name] = b

        # Batch actions
        batch = ctk.CTkFrame(filt, fg_color="transparent")
        batch.pack(side="right")
        ctk.CTkButton(
            batch, text="Start all", width=80, height=28, fg_color=C_SECONDARY, hover_color=C_SECONDARY_HOVER, text_color=C_TEXT, border_width=1, border_color=C_BORDER,
            command=self.queue.start_all,
        ).pack(side="left", padx=3)
        ctk.CTkButton(
            batch, text="Pause all", width=80, height=28, fg_color=C_SECONDARY, hover_color=C_SECONDARY_HOVER, text_color=C_TEXT, border_width=1, border_color=C_BORDER,
            command=self.queue.pause_all,
        ).pack(side="left", padx=3)

        # Column header
        header = ctk.CTkFrame(self, fg_color=C_SURFACE, height=36, corner_radius=8, border_width=1, border_color=C_BORDER)
        header.pack(fill="x", padx=12, pady=(8, 0))
        header.pack_propagate(False)
        cols = [
            ("", 28),
            ("File name", 280),
            ("Size", 90),
            ("Status", 110),
            ("Progress", 160),
            ("Speed", 90),
            ("ETA", 80),
            ("Type", 90),
        ]
        # Use grid-like labels with fixed widths via pack
        x = 8
        self._header_labels = []
        for text, w in cols:
            lbl = ctk.CTkLabel(
                header, text=text, width=w, anchor="w",
                font=ctk.CTkFont(size=11, weight="bold"), text_color=C_MUTED,
            )
            lbl.pack(side="left", padx=(6 if text else 4, 0))
            self._header_labels.append(lbl)

        # Scrollable list
        self.list_frame = ctk.CTkScrollableFrame(
            self, fg_color=C_BG, corner_radius=0,
            scrollbar_button_color=C_SECONDARY_HOVER,
            scrollbar_button_hover_color=C_DIM,
        )
        self.list_frame.pack(fill="both", expand=True, padx=12, pady=(4, 0))

        # Empty state
        self.empty_label = ctk.CTkLabel(
            self.list_frame,
            text="No downloads yet.\nClick “Add URL” or press Ctrl+N and paste a link.",
            text_color=C_DIM,
            font=ctk.CTkFont(size=14),
            justify="center",
        )

        # Status bar
        bar = ctk.CTkFrame(self, fg_color=C_SURFACE, height=34, corner_radius=0)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)
        self.status_left = ctk.CTkLabel(bar, text="Ready", text_color=C_MUTED, font=ctk.CTkFont(size=11))
        self.status_left.pack(side="left", padx=14)
        self.status_right = ctk.CTkLabel(bar, text="", text_color=C_MUTED, font=ctk.CTkFont(size=11))
        self.status_right.pack(side="right", padx=14)

    def _set_filter(self, name: str) -> None:
        self._filter = name
        for n, b in self._filter_btns.items():
            b.configure(
                fg_color=C_PRIMARY if n == name else C_SECONDARY,
                text_color="#FFFFFF" if n == name else C_TEXT,
                border_width=0 if n == name else 1,
            )
        self._ui_dirty = True
        self._render_rows()

    def _filtered_jobs(self):
        jobs = list(self.queue.jobs)
        f = self._filter
        if f == "All":
            return jobs
        if f == "Downloading":
            return [j for j in jobs if j.status in (
                JobStatus.DOWNLOADING.value, JobStatus.CONNECTING.value, JobStatus.MERGING.value
            )]
        if f == "Queued":
            return [j for j in jobs if j.status == JobStatus.QUEUED.value]
        if f == "Completed":
            return [j for j in jobs if j.status == JobStatus.COMPLETED.value]
        if f == "Paused":
            return [j for j in jobs if j.status == JobStatus.PAUSED.value]
        if f == "Failed":
            return [j for j in jobs if j.status in (JobStatus.FAILED.value, JobStatus.CANCELLED.value)]
        return jobs

    def _on_queue_change(self) -> None:
        # Full list rebuild only for add/remove/status changes (not progress)
        self._ui_dirty = True

    def _refresh_loop(self) -> None:
        try:
            if self._ui_dirty and not self._building:
                self._ui_dirty = False
                self._render_rows()
            else:
                # Lightweight: update existing row widgets only (no destroy/recreate)
                self._update_row_values()
            self._update_status_bar()
        except Exception:
            pass
        # ~4 UI ticks/sec is enough for smooth bars without starving the event loop
        self.after(250, self._refresh_loop)

    def _render_rows(self) -> None:
        self._building = True
        jobs = self._filtered_jobs()

        # Clear
        for child in self.list_frame.winfo_children():
            child.destroy()
        self._row_widgets.clear()
        self._row_paint_cache = {}

        if not jobs:
            self.empty_label = ctk.CTkLabel(
                self.list_frame,
                text="No downloads in this view.\nClick “Add URL” or press Ctrl+N.",
                text_color=C_DIM,
                font=ctk.CTkFont(size=14),
                justify="center",
            )
            self.empty_label.pack(pady=60)
            self._building = False
            return

        for i, job in enumerate(jobs):
            self._make_row(job, i)
        self._building = False

    def _make_row(self, job, index: int) -> None:
        bg = C_ROW_SEL if job.id in self._selected_ids else (C_ROW_ALT if index % 2 else C_CARD)
        row = ctk.CTkFrame(
            self.list_frame, fg_color=bg, height=54, corner_radius=8,
            border_width=1, border_color=C_BORDER,
        )
        row.pack(fill="x", pady=3, padx=2)
        row.pack_propagate(False)

        def select(e=None, jid=job.id):
            if jid in self._selected_ids:
                self._selected_ids.discard(jid)
            else:
                self._selected_ids.add(jid)
            self._ui_dirty = True
            self._render_rows()

        row.bind("<Button-1>", select)

        # Checkbox-like indicator
        mark = "☑" if job.id in self._selected_ids else "☐"
        chk = ctk.CTkLabel(row, text=mark, width=28, text_color=C_ACCENT if job.id in self._selected_ids else C_DIM)
        chk.pack(side="left", padx=(6, 0))
        chk.bind("<Button-1>", select)

        name_lbl = ctk.CTkLabel(
            row, text=job.filename or "…", width=280, anchor="w",
            font=ctk.CTkFont(size=12, weight="bold"), text_color=C_TEXT,
        )
        name_lbl.pack(side="left", padx=(6, 0))
        name_lbl.bind("<Button-1>", select)
        name_lbl.bind("<Double-Button-1>", lambda e, j=job: self._on_row_double_click(j))

        size_lbl = ctk.CTkLabel(
            row, text=self._size_text(job), width=90, anchor="w", text_color=C_MUTED, font=ctk.CTkFont(size=11)
        )
        size_lbl.pack(side="left", padx=(6, 0))

        st_color = STATUS_COLORS.get(job.status, C_MUTED)
        status_lbl = ctk.CTkLabel(
            row, text=job.status, width=110, anchor="w", text_color=st_color, font=ctk.CTkFont(size=11, weight="bold")
        )
        status_lbl.pack(side="left", padx=(6, 0))

        prog_frame = ctk.CTkFrame(row, fg_color="transparent", width=160, height=40)
        prog_frame.pack(side="left", padx=(6, 0))
        prog_frame.pack_propagate(False)
        bar = ctk.CTkProgressBar(
            prog_frame, width=150, height=10, progress_color=C_PROGRESS, fg_color=C_PROGRESS_TRACK
        )
        bar.pack(pady=(8, 0))
        pct = job.percent / 100.0
        bar.set(max(0.0, min(1.0, pct)))
        pct_lbl = ctk.CTkLabel(
            prog_frame, text=f"{job.percent:.1f}%", font=ctk.CTkFont(size=10), text_color=C_DIM
        )
        pct_lbl.pack()

        speed_lbl = ctk.CTkLabel(
            row, text=format_speed(job.speed) if job.status == JobStatus.DOWNLOADING.value else "—",
            width=90, anchor="w", text_color=C_TEXT, font=ctk.CTkFont(size=11),
        )
        speed_lbl.pack(side="left", padx=(6, 0))

        eta_lbl = ctk.CTkLabel(
            row, text=format_eta(job.eta) if job.status == JobStatus.DOWNLOADING.value else "—",
            width=80, anchor="w", text_color=C_MUTED, font=ctk.CTkFont(size=11),
        )
        eta_lbl.pack(side="left", padx=(6, 0))

        type_lbl = ctk.CTkLabel(
            row, text=job.platform or job.kind, width=90, anchor="w",
            text_color=C_ACCENT if job.kind == "media" else C_MUTED, font=ctk.CTkFont(size=11),
        )
        type_lbl.pack(side="left", padx=(6, 0))

        self._row_widgets[job.id] = {
            "row": row,
            "name": name_lbl,
            "size": size_lbl,
            "status": status_lbl,
            "bar": bar,
            "pct": pct_lbl,
            "speed": speed_lbl,
            "eta": eta_lbl,
            "type": type_lbl,
        }

        # Tooltip-ish: show error on status if failed
        if job.status == JobStatus.FAILED.value and job.error:
            status_lbl.configure(text="Failed")

    def _size_text(self, job) -> str:
        if job.total_bytes > 0:
            if job.downloaded_bytes and job.status not in (JobStatus.COMPLETED.value,):
                return f"{format_size(job.downloaded_bytes)} / {format_size(job.total_bytes)}"
            return format_size(job.total_bytes)
        if job.downloaded_bytes:
            return format_size(job.downloaded_bytes)
        return "—"

    def _update_row_values(self) -> None:
        # Only refresh rows we still have widgets for; cache last paint to skip no-ops
        if not hasattr(self, "_row_paint_cache"):
            self._row_paint_cache = {}
        cache = self._row_paint_cache
        for job in self.queue.jobs:
            w = self._row_widgets.get(job.id)
            if not w:
                continue
            try:
                pct = round(job.percent, 1)
                speed_txt = format_speed(job.speed) if job.status == JobStatus.DOWNLOADING.value else "—"
                eta_txt = format_eta(job.eta) if job.status == JobStatus.DOWNLOADING.value else "—"
                size_txt = self._size_text(job)
                name = job.filename or "…"
                key = (name, size_txt, job.status, pct, speed_txt, eta_txt, job.platform or job.kind)
                if cache.get(job.id) == key:
                    continue
                cache[job.id] = key

                w["name"].configure(text=name)
                w["size"].configure(text=size_txt)
                st_color = STATUS_COLORS.get(job.status, C_MUTED)
                w["status"].configure(text=job.status, text_color=st_color)
                w["bar"].set(max(0.0, min(1.0, pct / 100.0)))
                w["pct"].configure(text=f"{pct:.1f}%")
                w["speed"].configure(text=speed_txt)
                w["eta"].configure(text=eta_txt)
                w["type"].configure(text=job.platform or job.kind)
            except Exception:
                pass
        # Drop cache for removed jobs
        live = {j.id for j in self.queue.jobs}
        for jid in list(cache.keys()):
            if jid not in live:
                cache.pop(jid, None)

    def _update_status_bar(self) -> None:
        total = len(self.queue.jobs)
        active = self.queue.active_count()
        done = sum(1 for j in self.queue.jobs if j.status == JobStatus.COMPLETED.value)
        speed = self.queue.total_speed()
        left = f"{total} downloads  ·  {active} active  ·  {done} completed"
        right = f"Total speed: {format_speed(speed)}   |   ADM v{__version__}"
        if getattr(self, "_status_left_txt", None) != left:
            self._status_left_txt = left
            self.status_left.configure(text=left)
        if getattr(self, "_status_right_txt", None) != right:
            self._status_right_txt = right
            self.status_right.configure(text=right)

    # -------------------------------------------------------------- actions
    def open_add_dialog(self, url: str = "") -> None:
        AddDownloadDialog(self, preset_url=url)

    def open_progress_window(self, job_id: str) -> None:
        """Show IDM-style download popup for a job (one window per job)."""
        existing = self._progress_windows.get(job_id)
        if existing is not None:
            try:
                if existing.winfo_exists():
                    existing.lift()
                    existing.focus_force()
                    return
            except Exception:
                pass
            self._progress_windows.pop(job_id, None)
        win = DownloadProgressWindow(self, job_id)
        self._progress_windows[job_id] = win

    def _paste_add(self, event=None) -> None:
        try:
            clip = self.clipboard_get().strip()
        except Exception:
            clip = ""
        if clip.startswith("http://") or clip.startswith("https://"):
            self.open_add_dialog(clip)
        else:
            self.open_add_dialog()

    def _selected_jobs(self):
        return [j for j in self.queue.jobs if j.id in self._selected_ids]

    def _start_selected(self) -> None:
        jobs = self._selected_jobs()
        if not jobs:
            self.queue.start_all()
            return
        for j in jobs:
            self.queue.resume(j.id)
            self.open_progress_window(j.id)

    def _pause_selected(self) -> None:
        jobs = self._selected_jobs()
        if not jobs:
            self.queue.pause_all()
            return
        for j in jobs:
            self.queue.pause(j.id)

    def _stop_selected(self) -> None:
        for j in self._selected_jobs():
            self.queue.cancel(j.id)

    def _delete_selected(self) -> None:
        ids = list(self._selected_ids)
        if not ids:
            return
        if not messagebox.askyesno("Delete", f"Remove {len(ids)} item(s) from the list?"):
            return
        self.queue.remove_jobs(ids, delete_files=False)
        self._selected_ids.clear()
        self._ui_dirty = True

    def _open_folder(self) -> None:
        jobs = self._selected_jobs()
        if jobs and jobs[0].filepath:
            p = Path(jobs[0].filepath).parent
        elif jobs:
            p = Path(jobs[0].save_dir)
        else:
            p = Path(self.settings.get("download_dir", "."))
        p.mkdir(parents=True, exist_ok=True)
        try:
            if sys.platform == "win32":
                import os
                os.startfile(str(p))  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                import subprocess
                subprocess.Popen(["open", str(p)])
            else:
                import subprocess
                subprocess.Popen(["xdg-open", str(p)])
        except Exception:
            webbrowser.open(p.as_uri())

    def _on_row_double_click(self, job) -> None:
        # Active / paused / queued → open progress popup; completed → open file
        if job.status == JobStatus.COMPLETED.value and job.filepath:
            self._open_job_file(job)
        else:
            self.open_progress_window(job.id)

    def _open_job_file(self, job) -> None:
        if job.filepath and Path(job.filepath).exists():
            path = Path(job.filepath)
            try:
                if sys.platform == "win32":
                    import os
                    os.startfile(str(path))  # type: ignore[attr-defined]
                else:
                    webbrowser.open(path.as_uri())
            except Exception:
                pass

    def _open_settings(self) -> None:
        SettingsDialog(self)

    def _on_close(self) -> None:
        self.queue.shutdown()
        self.destroy()


def run() -> None:
    app = ADMApp()
    app.mainloop()


if __name__ == "__main__":
    run()
