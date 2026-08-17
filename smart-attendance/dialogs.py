"""Modal dialogs for Smart Attendance admin and records."""

from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Callable

from admin_auth import change_pin, verify_pin
from attendance_logger import (
    STATUS_ABSENT,
    STATUS_LATE,
    STATUS_ON_TIME,
    check_in,
    check_out,
    delete_entry,
    format_day_text,
    list_record_dates,
    load_day,
    mark_absent,
    mark_all_missing_absent,
    person_history,
    update_entry,
)
from scroll_utils import make_scrollable_frame, make_scrollable_text, make_scrollable_tree
from students import get_student, upsert_student

# Shared theme tokens (mirror main)
BG = "#0B1220"
SURFACE = "#111827"
CARD = "#1A2332"
ELEVATED = "#1F2A3D"
BORDER = "#2A364A"
PRIMARY = "#2563EB"
TEXT = "#F8FAFC"
MUTED = "#94A3B8"
DIM = "#64748B"
DANGER = "#EF4444"
SUCCESS = "#10B981"
FONT = "Segoe UI"


def _font(size: int = 10, weight: str = "normal"):
    return (FONT, size, "bold") if weight == "bold" else (FONT, size)


def _center(win: tk.Toplevel, parent: tk.Tk, w: int, h: int) -> None:
    win.update_idletasks()
    x = parent.winfo_rootx() + max(0, (parent.winfo_width() - w) // 2)
    y = parent.winfo_rooty() + max(0, (parent.winfo_height() - h) // 2)
    win.geometry(f"{w}x{h}+{x}+{y}")


class PinDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk, title: str = "Admin PIN"):
        super().__init__(parent)
        self.title(title)
        self.configure(bg=SURFACE)
        self.resizable(False, False)
        self.result = False
        self.transient(parent)
        self.grab_set()
        w, h = 360, 200
        _center(self, parent, w, h)

        frame = tk.Frame(self, bg=SURFACE, padx=24, pady=20)
        frame.pack(fill="both", expand=True)
        tk.Label(frame, text=title, bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(anchor="w")
        tk.Label(
            frame, text="Enter admin PIN to continue (default: 1234)",
            bg=SURFACE, fg=MUTED, font=_font(9),
        ).pack(anchor="w", pady=(4, 14))

        self.entry = tk.Entry(
            frame, show="•", font=_font(14), bg=CARD, fg=TEXT,
            insertbackground=TEXT, relief="flat", highlightthickness=1,
            highlightbackground=BORDER, highlightcolor=PRIMARY,
        )
        self.entry.pack(fill="x", ipady=8)
        self.entry.focus_set()
        self.entry.bind("<Return>", lambda _e: self._ok())
        self.entry.bind("<Escape>", lambda _e: self._cancel())

        btns = tk.Frame(frame, bg=SURFACE)
        btns.pack(fill="x", pady=(16, 0))
        tk.Button(btns, text="Cancel", command=self._cancel, bg=ELEVATED, fg=TEXT,
                  relief="flat", padx=14, pady=6, cursor="hand2").pack(side="right", padx=(8, 0))
        tk.Button(btns, text="Unlock", command=self._ok, bg=PRIMARY, fg="white",
                  relief="flat", padx=14, pady=6, cursor="hand2").pack(side="right")
        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.wait_window()

    def _ok(self) -> None:
        if verify_pin(self.entry.get()):
            self.result = True
            self.destroy()
        else:
            messagebox.showerror("Access Denied", "Incorrect admin PIN.", parent=self)
            self.entry.delete(0, tk.END)

    def _cancel(self) -> None:
        self.result = False
        self.destroy()


class ChangePinDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk):
        super().__init__(parent)
        self.title("Change Admin PIN")
        self.configure(bg=SURFACE)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        _center(self, parent, 400, 280)
        f = tk.Frame(self, bg=SURFACE, padx=24, pady=20)
        f.pack(fill="both", expand=True)
        tk.Label(f, text="Change Admin PIN", bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(anchor="w")

        self.old = self._field(f, "Current PIN")
        self.new = self._field(f, "New PIN")
        self.confirm = self._field(f, "Confirm New PIN")
        self.old.focus_set()

        btns = tk.Frame(f, bg=SURFACE)
        btns.pack(fill="x", pady=(16, 0))
        tk.Button(btns, text="Cancel", command=self.destroy, bg=ELEVATED, fg=TEXT,
                  relief="flat", padx=12, pady=6).pack(side="right", padx=(8, 0))
        tk.Button(btns, text="Save", command=self._save, bg=PRIMARY, fg="white",
                  relief="flat", padx=12, pady=6).pack(side="right")
        self.wait_window()

    def _field(self, parent, label: str) -> tk.Entry:
        tk.Label(parent, text=label, bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w", pady=(10, 2))
        e = tk.Entry(parent, show="•", font=_font(11), bg=CARD, fg=TEXT, insertbackground=TEXT,
                     relief="flat", highlightthickness=1, highlightbackground=BORDER, highlightcolor=PRIMARY)
        e.pack(fill="x", ipady=6)
        return e

    def _save(self) -> None:
        if self.new.get() != self.confirm.get():
            messagebox.showerror("Mismatch", "New PIN confirmation does not match.", parent=self)
            return
        ok, msg = change_pin(self.old.get(), self.new.get())
        if ok:
            messagebox.showinfo("Success", msg, parent=self)
            self.destroy()
        else:
            messagebox.showerror("Error", msg, parent=self)


class StudentMetaDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk, name: str, on_saved: Callable[[], None] | None = None):
        super().__init__(parent)
        self.title(f"Student Profile — {name}")
        self.configure(bg=SURFACE)
        self.resizable(True, True)
        self.minsize(420, 360)
        self.transient(parent)
        self.grab_set()
        self.name = name
        self.on_saved = on_saved
        _center(self, parent, 480, 460)

        meta = get_student(name)
        root = tk.Frame(self, bg=SURFACE)
        root.pack(fill="both", expand=True)
        root.rowconfigure(0, weight=1)
        root.columnconfigure(0, weight=1)

        outer, f = make_scrollable_frame(root, bg=SURFACE)
        outer.grid(row=0, column=0, sticky="nsew", padx=8, pady=8)

        body = tk.Frame(f, bg=SURFACE, padx=16, pady=10)
        body.pack(fill="both", expand=True)
        tk.Label(body, text="Student Metadata", bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(anchor="w")
        tk.Label(body, text=name, bg=SURFACE, fg=PRIMARY, font=_font(11, "bold")).pack(anchor="w", pady=(2, 12))

        self.fields: dict[str, tk.Entry] = {}
        for key, label in [
            ("student_id", "Student ID"),
            ("class_name", "Class / Section"),
            ("roll_no", "Roll No."),
            ("phone", "Phone"),
            ("email", "Email"),
            ("notes", "Notes"),
        ]:
            tk.Label(body, text=label.upper(), bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w")
            e = tk.Entry(body, font=_font(10), bg=CARD, fg=TEXT, insertbackground=TEXT,
                         relief="flat", highlightthickness=1, highlightbackground=BORDER, highlightcolor=PRIMARY)
            e.pack(fill="x", ipady=5, pady=(2, 8))
            e.insert(0, meta.get(key, ""))
            self.fields[key] = e

        btns = tk.Frame(root, bg=SURFACE)
        btns.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 14))
        tk.Button(btns, text="Cancel", command=self.destroy, bg=ELEVATED, fg=TEXT,
                  relief="flat", padx=12, pady=6).pack(side="right", padx=(8, 0))
        tk.Button(btns, text="Save Profile", command=self._save, bg=PRIMARY, fg="white",
                  relief="flat", padx=12, pady=6).pack(side="right")
        self.wait_window()

    def _save(self) -> None:
        data = {k: e.get().strip() for k, e in self.fields.items()}
        upsert_student(self.name, **data)
        messagebox.showinfo("Saved", f"Profile saved for {self.name}.", parent=self)
        if self.on_saved:
            self.on_saved()
        self.destroy()


class ManualEntryDialog(tk.Toplevel):
    """Add or fix attendance for a day (admin)."""

    def __init__(
        self,
        parent: tk.Tk,
        names: list[str],
        date_str: str,
        on_changed: Callable[[], None] | None = None,
    ):
        super().__init__(parent)
        self.title("Manual Entry / Fix")
        self.configure(bg=SURFACE)
        self.resizable(True, True)
        self.minsize(440, 380)
        self.transient(parent)
        self.grab_set()
        self.date_str = date_str
        self.on_changed = on_changed
        _center(self, parent, 500, 480)

        root = tk.Frame(self, bg=SURFACE)
        root.pack(fill="both", expand=True)
        root.rowconfigure(0, weight=1)
        root.columnconfigure(0, weight=1)

        outer, f = make_scrollable_frame(root, bg=SURFACE)
        outer.grid(row=0, column=0, sticky="nsew", padx=6, pady=6)

        body = tk.Frame(f, bg=SURFACE, padx=16, pady=12)
        body.pack(fill="both", expand=True)
        tk.Label(body, text="Manual Entry / Fix Mistake", bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(anchor="w")
        tk.Label(body, text=f"Date: {date_str}", bg=SURFACE, fg=MUTED, font=_font(9)).pack(anchor="w", pady=(2, 12))

        tk.Label(body, text="STUDENT", bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w")
        self.name_var = tk.StringVar(value=names[0] if names else "")
        self.name_combo = ttk.Combobox(body, textvariable=self.name_var, values=names, font=_font(10))
        self.name_combo.pack(fill="x", pady=(2, 8))
        if names:
            self.name_combo.current(0)

        row = tk.Frame(body, bg=SURFACE)
        row.pack(fill="x", pady=4)
        left = tk.Frame(row, bg=SURFACE)
        left.pack(side="left", fill="x", expand=True, padx=(0, 6))
        right = tk.Frame(row, bg=SURFACE)
        right.pack(side="left", fill="x", expand=True, padx=(6, 0))

        tk.Label(left, text="CHECK-IN (HH:MM:SS)", bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w")
        self.in_e = tk.Entry(left, font=_font(10), bg=CARD, fg=TEXT, insertbackground=TEXT, relief="flat",
                             highlightthickness=1, highlightbackground=BORDER)
        self.in_e.pack(fill="x", ipady=5, pady=(2, 0))

        tk.Label(right, text="CHECK-OUT (HH:MM:SS)", bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w")
        self.out_e = tk.Entry(right, font=_font(10), bg=CARD, fg=TEXT, insertbackground=TEXT, relief="flat",
                              highlightthickness=1, highlightbackground=BORDER)
        self.out_e.pack(fill="x", ipady=5, pady=(2, 0))

        tk.Label(body, text="STATUS", bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w", pady=(10, 0))
        self.status_var = tk.StringVar(value=STATUS_ON_TIME)
        ttk.Combobox(
            body, textvariable=self.status_var,
            values=[STATUS_ON_TIME, STATUS_LATE, STATUS_ABSENT],
            state="readonly", font=_font(10),
        ).pack(fill="x", pady=(2, 8))

        tk.Label(body, text="NOTES", bg=SURFACE, fg=DIM, font=_font(8, "bold")).pack(anchor="w")
        self.notes_e = tk.Entry(body, font=_font(10), bg=CARD, fg=TEXT, insertbackground=TEXT, relief="flat",
                                highlightthickness=1, highlightbackground=BORDER)
        self.notes_e.pack(fill="x", ipady=5, pady=(2, 12))

        self.name_combo.bind("<<ComboboxSelected>>", lambda _e: self._prefill())
        self._prefill()

        actions = tk.Frame(root, bg=SURFACE)
        actions.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))
        tk.Button(actions, text="Delete Entry", command=self._delete, bg="#7F1D1D", fg="white",
                  relief="flat", padx=10, pady=6).pack(side="left")
        tk.Button(actions, text="Mark Absent", command=self._absent, bg="#78350F", fg="white",
                  relief="flat", padx=10, pady=6).pack(side="left", padx=6)
        tk.Button(actions, text="Cancel", command=self.destroy, bg=ELEVATED, fg=TEXT,
                  relief="flat", padx=10, pady=6).pack(side="right", padx=(6, 0))
        tk.Button(actions, text="Save Entry", command=self._save, bg=PRIMARY, fg="white",
                  relief="flat", padx=10, pady=6).pack(side="right")
        self.wait_window()

    def _prefill(self) -> None:
        name = self.name_var.get().strip()
        if not name:
            return
        e = None
        for row in load_day(self.date_str).get("entries", []):
            if (row.get("name") or "").strip().lower() == name.lower():
                e = row
                break
        self.in_e.delete(0, tk.END)
        self.out_e.delete(0, tk.END)
        self.notes_e.delete(0, tk.END)
        if e:
            self.in_e.insert(0, e.get("check_in") or "")
            self.out_e.insert(0, e.get("check_out") or "")
            self.status_var.set(e.get("status") or STATUS_ON_TIME)
            self.notes_e.insert(0, e.get("notes") or "")

    def _save(self) -> None:
        name = self.name_var.get().strip()
        if not name:
            messagebox.showerror("Error", "Select a student.", parent=self)
            return
        status = self.status_var.get()
        ok, msg = update_entry(
            name,
            date_str=self.date_str,
            check_in=self.in_e.get().strip(),
            check_out=self.out_e.get().strip(),
            status=status,
            notes=self.notes_e.get().strip(),
        )
        messagebox.showinfo("Saved", msg, parent=self)
        if self.on_changed:
            self.on_changed()
        self.destroy()

    def _absent(self) -> None:
        name = self.name_var.get().strip()
        if not name:
            return
        ok, msg = mark_absent(name, date_str=self.date_str, notes=self.notes_e.get().strip() or "manual absent")
        messagebox.showinfo("Absent", msg, parent=self)
        if self.on_changed:
            self.on_changed()
        self.destroy()

    def _delete(self) -> None:
        name = self.name_var.get().strip()
        if not name:
            return
        if not messagebox.askyesno("Confirm", f"Delete entry for {name} on {self.date_str}?", parent=self):
            return
        ok, msg = delete_entry(name, self.date_str)
        messagebox.showinfo("Delete", msg, parent=self)
        if self.on_changed:
            self.on_changed()
        self.destroy()


class BrowseDaysDialog(tk.Toplevel):
    def __init__(
        self,
        parent: tk.Tk,
        names: list[str],
        on_changed: Callable[[], None] | None = None,
        require_admin: Callable[[], bool] | None = None,
    ):
        super().__init__(parent)
        self.title("Browse Past Days")
        self.configure(bg=SURFACE)
        self.transient(parent)
        self.grab_set()
        self.names = names
        self.on_changed = on_changed
        self.require_admin = require_admin
        self.resizable(True, True)
        self.minsize(640, 420)
        _center(self, parent, 760, 560)

        f = tk.Frame(self, bg=SURFACE, padx=16, pady=14)
        f.pack(fill="both", expand=True)
        f.rowconfigure(2, weight=1)
        f.columnconfigure(0, weight=1)

        top = tk.Frame(f, bg=SURFACE)
        top.grid(row=0, column=0, sticky="ew")
        tk.Label(top, text="Attendance Archive", bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(side="left")

        self.date_var = tk.StringVar()
        dates = list_record_dates()
        self.date_combo = ttk.Combobox(top, textvariable=self.date_var, values=dates, width=14, state="readonly")
        self.date_combo.pack(side="right")
        if dates:
            self.date_combo.current(0)
        self.date_combo.bind("<<ComboboxSelected>>", lambda _e: self._load())

        tk.Label(top, text="Date:", bg=SURFACE, fg=MUTED, font=_font(9)).pack(side="right", padx=(0, 6))

        tools = tk.Frame(f, bg=SURFACE)
        tools.grid(row=1, column=0, sticky="ew", pady=10)
        tk.Button(tools, text="Refresh", command=self._load, bg=ELEVATED, fg=TEXT, relief="flat", padx=10, pady=5).pack(side="left")
        tk.Button(tools, text="Manual Fix…", command=self._manual, bg=PRIMARY, fg="white", relief="flat", padx=10, pady=5).pack(side="left", padx=6)
        tk.Button(tools, text="Mark Missing Absent", command=self._absents, bg="#78350F", fg="white", relief="flat", padx=10, pady=5).pack(side="left")
        tk.Button(tools, text="Close", command=self.destroy, bg=ELEVATED, fg=TEXT, relief="flat", padx=10, pady=5).pack(side="right")

        text_wrap, self.text = make_scrollable_text(
            f, bg=CARD, fg="#A7F3D0", font=("Consolas", 9), wrap="none",
            border_color=BORDER, trough=SURFACE, padx=10, pady=8,
        )
        text_wrap.grid(row=2, column=0, sticky="nsew")
        self._load()
        self.wait_window()

    def _load(self) -> None:
        d = self.date_var.get()
        content = format_day_text(d) if d else "No date selected."
        self.text.configure(state="normal")
        self.text.delete("1.0", tk.END)
        self.text.insert(tk.END, content)
        self.text.configure(state="disabled")
        # Jump to top when switching days
        self.text.yview_moveto(0)

    def _admin(self) -> bool:
        if self.require_admin:
            return self.require_admin()
        return True

    def _manual(self) -> None:
        if not self._admin():
            return
        ManualEntryDialog(self, self.names, self.date_var.get(), on_changed=self._after)
        self._load()

    def _absents(self) -> None:
        if not self._admin():
            return
        if not messagebox.askyesno(
            "Mark Absents",
            f"Mark all registered students without check-in as Absent for {self.date_var.get()}?",
            parent=self,
        ):
            return
        n, msg = mark_all_missing_absent(self.names, self.date_var.get())
        messagebox.showinfo("Absents", msg, parent=self)
        self._after()

    def _after(self) -> None:
        self._load()
        if self.on_changed:
            self.on_changed()


class PersonHistoryDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk, name: str):
        super().__init__(parent)
        self.title(f"History — {name}")
        self.configure(bg=SURFACE)
        self.resizable(True, True)
        self.minsize(640, 400)
        self.transient(parent)
        self.grab_set()
        _center(self, parent, 760, 520)

        f = tk.Frame(self, bg=SURFACE, padx=16, pady=14)
        f.pack(fill="both", expand=True)
        f.rowconfigure(1, weight=1)
        f.columnconfigure(0, weight=1)

        meta = get_student(name)
        header = tk.Frame(f, bg=SURFACE)
        header.grid(row=0, column=0, sticky="ew")
        tk.Label(header, text=f"Attendance History — {name}", bg=SURFACE, fg=TEXT, font=_font(14, "bold")).pack(anchor="w")
        tk.Label(
            header,
            text=f"ID: {meta.get('student_id') or '—'}   Class: {meta.get('class_name') or '—'}   Roll: {meta.get('roll_no') or '—'}",
            bg=SURFACE, fg=MUTED, font=_font(9),
        ).pack(anchor="w", pady=(2, 10))

        cols = ("date", "check_in", "check_out", "status", "source", "notes")
        headers = {
            "date": "Date", "check_in": "Check-In", "check_out": "Check-Out",
            "status": "Status", "source": "Source", "notes": "Notes",
        }
        widths = {"date": 100, "check_in": 90, "check_out": 90, "status": 80, "source": 70, "notes": 220}
        tree_wrap, tree = make_scrollable_tree(
            f, cols, headers, widths, height=16, trough=SURFACE,
        )
        tree_wrap.grid(row=1, column=0, sticky="nsew")

        rows = person_history(name)
        for r in rows:
            tree.insert(
                "",
                tk.END,
                values=(
                    r.get("date", ""),
                    r.get("check_in") or "—",
                    r.get("check_out") or "—",
                    r.get("status") or "—",
                    r.get("source") or "—",
                    (r.get("notes") or "")[:80],
                ),
            )
        if not rows:
            tree.insert("", tk.END, values=("—", "—", "—", "No records", "—", "—"))

        tk.Button(f, text="Close", command=self.destroy, bg=ELEVATED, fg=TEXT, relief="flat",
                  padx=12, pady=6).grid(row=2, column=0, sticky="e", pady=(10, 0))
        self.wait_window()


class NameDialog(tk.Toplevel):
    def __init__(self, parent: tk.Tk, title: str = "Register New Person", prompt: str = "Full name"):
        super().__init__(parent)
        self.title(title)
        self.configure(bg=SURFACE)
        self.resizable(False, False)
        self.result: str | None = None
        self.transient(parent)
        self.grab_set()
        _center(self, parent, 420, 220)

        outer = tk.Frame(self, bg=SURFACE, padx=28, pady=24)
        outer.pack(fill="both", expand=True)
        tk.Label(outer, text=title, bg=SURFACE, fg=TEXT, font=_font(16, "bold")).pack(anchor="w")
        tk.Label(outer, text=prompt, bg=SURFACE, fg=MUTED, font=_font(9)).pack(anchor="w", pady=(6, 14))
        self.entry = tk.Entry(
            outer, font=_font(12), bg=CARD, fg=TEXT, insertbackground=TEXT, relief="flat",
            highlightthickness=1, highlightbackground=BORDER, highlightcolor=PRIMARY,
        )
        self.entry.pack(fill="x", ipady=10)
        self.entry.focus_set()
        self.entry.bind("<Return>", lambda _e: self._ok())
        self.entry.bind("<Escape>", lambda _e: self._cancel())
        btns = tk.Frame(outer, bg=SURFACE)
        btns.pack(fill="x", pady=(16, 0))
        tk.Button(btns, text="Cancel", command=self._cancel, bg=ELEVATED, fg=TEXT, relief="flat",
                  padx=14, pady=6).pack(side="right", padx=(8, 0))
        tk.Button(btns, text="Continue", command=self._ok, bg=PRIMARY, fg="white", relief="flat",
                  padx=14, pady=6).pack(side="right")
        self.protocol("WM_DELETE_WINDOW", self._cancel)
        self.wait_window()

    def _ok(self) -> None:
        val = self.entry.get().strip()
        if not val:
            return
        self.result = val
        self.destroy()

    def _cancel(self) -> None:
        self.result = None
        self.destroy()
