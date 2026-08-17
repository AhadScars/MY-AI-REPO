"""Reusable scroll helpers for Tk widgets (mousewheel + dual scrollbars)."""

from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk
from typing import Callable


def bind_mousewheel(widget: tk.Widget, target=None) -> None:
    """
    Bind mouse wheel / trackpad scrolling to a scrollable widget.
    Works on Windows, macOS, and Linux (X11).
    """
    target = target or widget

    def _on_mousewheel(event):
        # Windows / macOS
        if getattr(event, "delta", 0):
            steps = int(-1 * (event.delta / 120)) if abs(event.delta) >= 120 else int(-1 * event.delta)
            if steps == 0:
                steps = -1 if event.delta > 0 else 1
            try:
                target.yview_scroll(steps, "units")
            except tk.TclError:
                pass
            return "break"
        return None

    def _on_linux_up(_event):
        try:
            target.yview_scroll(-3, "units")
        except tk.TclError:
            pass
        return "break"

    def _on_linux_down(_event):
        try:
            target.yview_scroll(3, "units")
        except tk.TclError:
            pass
        return "break"

    def _on_shift_wheel(event):
        # Horizontal scroll with Shift+wheel when supported
        if getattr(event, "delta", 0):
            steps = int(-1 * (event.delta / 120)) if abs(event.delta) >= 120 else int(-1 * event.delta)
            if steps == 0:
                steps = -1 if event.delta > 0 else 1
            try:
                target.xview_scroll(steps, "units")
            except tk.TclError:
                pass
            return "break"
        return None

    # Bind when pointer is over the widget (and children via bind_all pattern)
    widget.bind("<MouseWheel>", _on_mousewheel, add="+")
    widget.bind("<Shift-MouseWheel>", _on_shift_wheel, add="+")
    widget.bind("<Button-4>", _on_linux_up, add="+")
    widget.bind("<Button-5>", _on_linux_down, add="+")

    # Also bind children if any are created later — rebind on Enter
    def _bind_recursive(w):
        w.bind("<MouseWheel>", _on_mousewheel, add="+")
        w.bind("<Shift-MouseWheel>", _on_shift_wheel, add="+")
        w.bind("<Button-4>", _on_linux_up, add="+")
        w.bind("<Button-5>", _on_linux_down, add="+")
        for child in w.winfo_children():
            _bind_recursive(child)

    widget.bind("<Enter>", lambda _e: _bind_recursive(widget), add="+")


def make_scrollable_text(
    parent: tk.Widget,
    *,
    bg: str = "#111827",
    fg: str = "#A7F3D0",
    font=("Consolas", 9),
    wrap: str = "none",
    height: int | None = None,
    width: int | None = None,
    padx: int = 8,
    pady: int = 6,
    border_color: str = "#2A364A",
    trough: str = "#1A2332",
) -> tuple[tk.Frame, tk.Text]:
    """Text widget with vertical + horizontal scrollbars."""
    try:
        pbg = parent.cget("bg")
    except tk.TclError:
        pbg = trough
    wrap_frame = tk.Frame(parent, bg=pbg or trough)
    wrap_frame.rowconfigure(0, weight=1)
    wrap_frame.columnconfigure(0, weight=1)

    kwargs = dict(
        bg=bg,
        fg=fg,
        font=font,
        bd=0,
        highlightthickness=1,
        highlightbackground=border_color,
        relief="flat",
        wrap=wrap,
        padx=padx,
        pady=pady,
        undo=False,
    )
    if height is not None:
        kwargs["height"] = height
    if width is not None:
        kwargs["width"] = width

    text = tk.Text(wrap_frame, **kwargs)
    text.grid(row=0, column=0, sticky="nsew")

    yscroll = tk.Scrollbar(
        wrap_frame, orient="vertical", command=text.yview,
        bg=trough, troughcolor=bg, bd=0, highlightthickness=0,
    )
    yscroll.grid(row=0, column=1, sticky="ns")

    xscroll = tk.Scrollbar(
        wrap_frame, orient="horizontal", command=text.xview,
        bg=trough, troughcolor=bg, bd=0, highlightthickness=0,
    )
    xscroll.grid(row=1, column=0, sticky="ew")

    text.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
    bind_mousewheel(text)
    bind_mousewheel(wrap_frame, target=text)
    return wrap_frame, text


def make_scrollable_listbox(
    parent: tk.Widget,
    *,
    height: int = 8,
    bg: str = "#111827",
    fg: str = "#CBD5E1",
    selectbackground: str = "#2563EB",
    selectforeground: str = "#FFFFFF",
    font=("Segoe UI", 10),
    border_color: str = "#2A364A",
    trough: str = "#1A2332",
) -> tuple[tk.Frame, tk.Listbox]:
    """Listbox with vertical scrollbar + mousewheel."""
    try:
        pbg = parent.cget("bg")
    except tk.TclError:
        pbg = trough
    wrap = tk.Frame(parent, bg=pbg or trough)
    wrap.rowconfigure(0, weight=1)
    wrap.columnconfigure(0, weight=1)

    lb = tk.Listbox(
        wrap,
        height=height,
        bg=bg,
        fg=fg,
        selectbackground=selectbackground,
        selectforeground=selectforeground,
        font=font,
        bd=0,
        highlightthickness=1,
        highlightbackground=border_color,
        activestyle="none",
        exportselection=False,
    )
    lb.grid(row=0, column=0, sticky="nsew")

    yscroll = tk.Scrollbar(
        wrap, orient="vertical", command=lb.yview,
        bg=trough, troughcolor=bg, bd=0, highlightthickness=0,
    )
    yscroll.grid(row=0, column=1, sticky="ns")
    lb.configure(yscrollcommand=yscroll.set)
    bind_mousewheel(lb)
    bind_mousewheel(wrap, target=lb)
    return wrap, lb


def make_scrollable_tree(
    parent: tk.Widget,
    columns: tuple[str, ...],
    headings: dict[str, str],
    widths: dict[str, int],
    *,
    height: int = 14,
    trough: str = "#1A2332",
) -> tuple[tk.Frame, ttk.Treeview]:
    """Treeview with vertical + horizontal scrollbars."""
    try:
        pbg = parent.cget("bg")
    except tk.TclError:
        pbg = trough
    wrap = tk.Frame(parent, bg=pbg or trough)
    wrap.rowconfigure(0, weight=1)
    wrap.columnconfigure(0, weight=1)

    tree = ttk.Treeview(wrap, columns=columns, show="headings", height=height)
    for c in columns:
        tree.heading(c, text=headings.get(c, c))
        tree.column(c, width=widths.get(c, 100), anchor="w", minwidth=40)
    tree.grid(row=0, column=0, sticky="nsew")

    yscroll = ttk.Scrollbar(wrap, orient="vertical", command=tree.yview)
    yscroll.grid(row=0, column=1, sticky="ns")
    xscroll = ttk.Scrollbar(wrap, orient="horizontal", command=tree.xview)
    xscroll.grid(row=1, column=0, sticky="ew")
    tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)

    bind_mousewheel(tree)
    bind_mousewheel(wrap, target=tree)
    return wrap, tree


def make_scrollable_frame(
    parent: tk.Widget,
    *,
    bg: str = "#0F172A",
    width: int | None = None,
) -> tuple[tk.Frame, tk.Frame]:
    """
    Canvas-based scrollable container.
    Returns (outer_frame, inner_frame). Pack widgets into inner_frame.
    """
    outer = tk.Frame(parent, bg=bg)
    if width is not None:
        outer.configure(width=width)

    canvas = tk.Canvas(outer, bg=bg, highlightthickness=0, bd=0)
    yscroll = tk.Scrollbar(outer, orient="vertical", command=canvas.yview, bg=bg, troughcolor=bg, bd=0)
    canvas.configure(yscrollcommand=yscroll.set)

    yscroll.pack(side="right", fill="y")
    canvas.pack(side="left", fill="both", expand=True)

    inner = tk.Frame(canvas, bg=bg)
    window_id = canvas.create_window((0, 0), window=inner, anchor="nw")

    def _on_inner_configure(_event=None):
        canvas.configure(scrollregion=canvas.bbox("all"))

    def _on_canvas_configure(event):
        canvas.itemconfigure(window_id, width=event.width)

    inner.bind("<Configure>", _on_inner_configure)
    canvas.bind("<Configure>", _on_canvas_configure)
    bind_mousewheel(canvas, target=canvas)
    bind_mousewheel(inner, target=canvas)

    # Mousewheel when hovering any child
    def _wheel(event):
        if getattr(event, "delta", 0):
            steps = int(-1 * (event.delta / 120)) if abs(event.delta) >= 120 else int(-1 * event.delta)
            if steps == 0:
                steps = -1 if event.delta > 0 else 1
            canvas.yview_scroll(steps, "units")
        return "break"

    def _up(_e):
        canvas.yview_scroll(-3, "units")
        return "break"

    def _down(_e):
        canvas.yview_scroll(3, "units")
        return "break"

    def _bind_all_children(w):
        w.bind("<MouseWheel>", _wheel, add="+")
        w.bind("<Button-4>", _up, add="+")
        w.bind("<Button-5>", _down, add="+")
        for c in w.winfo_children():
            _bind_all_children(c)

    inner.bind("<Enter>", lambda _e: _bind_all_children(inner), add="+")
    return outer, inner
