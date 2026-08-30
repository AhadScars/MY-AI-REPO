#!/usr/bin/env python3
"""Kunafa Mahal site + order API. Admin can see every ticket from any browser."""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import json
import os
import re
import secrets
import smtplib
import threading
import time
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urlparse
import urllib.request

ROOT = Path(__file__).resolve().parent
SEED = ROOT / "data"
DATA = SEED
ORDERS_FILE = DATA / "orders.json"
MESSAGES_FILE = DATA / "messages.json"
GALLERY_FILE = DATA / "gallery.json"
MENU_FILE = DATA / "menu.json"
LOYALTY_FILE = DATA / "loyalty.json"
OAUTH_FILE = DATA / "google_oauth.json"
UPLOADS = ROOT / "assets" / "uploads"


def _on_vercel() -> bool:
    return bool(os.environ.get("VERCEL"))


def _bind_paths() -> None:
    global DATA, ORDERS_FILE, MESSAGES_FILE, GALLERY_FILE, MENU_FILE, LOYALTY_FILE, OAUTH_FILE, UPLOADS
    DATA = Path("/tmp/kunafa-data") if _on_vercel() else SEED
    ORDERS_FILE = DATA / "orders.json"
    MESSAGES_FILE = DATA / "messages.json"
    GALLERY_FILE = DATA / "gallery.json"
    MENU_FILE = DATA / "menu.json"
    LOYALTY_FILE = DATA / "loyalty.json"
    OAUTH_FILE = DATA / "google_oauth.json"
    UPLOADS = (DATA / "uploads") if _on_vercel() else (ROOT / "assets" / "uploads")


def _ensure_runtime() -> None:
    _bind_paths()
    DATA.mkdir(parents=True, exist_ok=True)
    UPLOADS.mkdir(parents=True, exist_ok=True)
    if _on_vercel() and SEED.exists():
        for name in ("menu.json", "gallery.json", "loyalty.json", "orders.json", "messages.json"):
            src, dest = SEED / name, DATA / name
            if src.exists() and not dest.exists():
                dest.write_bytes(src.read_bytes())
POINTS_PER_ORDER = 100
RUPEES_PER_100_POINTS = 50
PORT = 4173
MAX_IMAGE = 8 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MENU_CATS = {
    "signature", "fusion", "exotic", "tubs", "bombs",
    "combos", "bites", "arabic", "shakes", "coffee", "specials",
}

ADMIN_USER = "admin"
ADMIN_PASS = "Kunafa@7771"
TOKEN_TTL = 60 * 60 * 12

_lock = threading.Lock()
STATUS_LABELS = {
    "placed": "Order placed",
    "confirmed": "Kitchen confirmed",
    "preparing": "Fresh kunafa on the griddle",
    "out": "Out for delivery",
    "delivered": "Delivered",
    "ready": "Ready for pickup",
    "collected": "Collected",
    "cancelled": "Cancelled",
}


def _load(path: Path) -> list:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _save(path: Path, rows: list) -> None:
    DATA.mkdir(exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def _cookies(handler: "Handler") -> dict:
    raw = handler.headers.get("Cookie") or ""
    out = {}
    for part in raw.split(";"):
        if "=" not in part:
            continue
        key, _, val = part.partition("=")
        out[key.strip()] = val.strip()
    return out


def _sign_secret() -> bytes:
    return (_env("GOOGLE_CLIENT_SECRET") or _env("SMTP_PASS") or "kunafa-mahal-live").encode()


def _sign(data: dict) -> str:
    raw = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    sig = hmac.new(_sign_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
    return body + "." + sig


def _unsign(token: str) -> dict | None:
    token = (token or "").strip()
    if "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    expect = hmac.new(_sign_secret(), body.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, sig):
        return None
    pad = "=" * (-len(body) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode(body + pad).decode("utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    try:
        if float(data.get("exp") or 0) < time.time():
            return None
    except (TypeError, ValueError):
        return None
    return data


def _user_from_request(handler: "Handler") -> dict | None:
    token = _cookies(handler).get("km_user", "")
    rec = _unsign(token)
    if not rec or rec.get("kind") not in (None, "user"):
        return None
    return rec


def _auth(handler: "Handler") -> bool:
    token = handler.headers.get("X-Admin-Token", "").strip()
    rec = _unsign(token)
    if rec and rec.get("kind") == "admin":
        return True
    user = _user_from_request(handler)
    return bool(user and user.get("admin"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("directory", str(ROOT))
        try:
            super().__init__(*args, **kwargs)
        except TypeError:
            super().__init__(*args)

    def log_message(self, fmt, *args):
        print("[km]", self.address_string(), fmt % args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code: int, payload, cookie: str | None = None) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(raw)

    def _redirect(self, location: str, cookie: str | None = None) -> None:
        self.send_response(302)
        self.send_header("Location", location)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def _serve_upload(self, name: str) -> None:
        safe = Path(name).name
        path = (UPLOADS / safe).resolve()
        if path.parent != UPLOADS.resolve() or not path.is_file():
            return self._json(404, {"error": "Photo not found."})
        data = path.read_bytes()
        ext = path.suffix.lower()
        types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        self.send_response(200)
        self.send_header("Content-Type", types.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _raw(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length > 0 else b""

    def _body(self) -> dict:
        raw = self._raw()
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path == "/api/health":
            return self._json(200, {
                "ok": True,
                "smtp": _smtp_status(),
                "google": _google_status(),
            })
        if path in ("/api/auth/google", "/auth/google"):
            return self._google_start(parsed)
        if path in ("/api/auth/google/callback", "/auth/google/callback"):
            return self._google_callback(parsed)
        if path in ("/oauth-setup", "/api/auth/setup"):
            return self._redirect("/index.html")
        if path == "/api/me":
            user = _user_from_request(self)
            if not user:
                return self._json(200, {"signedIn": False, "google": _google_status()})
            loy = _loyalty_for(email=user.get("email") or "")
            return self._json(200, {
                "signedIn": True,
                "google": _google_status(),
                "email": user.get("email") or "",
                "name": user.get("name") or "",
                "picture": user.get("picture") or "",
                "admin": bool(user.get("admin")),
                "loyalty": _loyalty_public(loy),
            })
        if path == "/api/smtp-status":
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            status = _smtp_status()
            status["google"] = _google_status()
            return self._json(200, status)
        if path == "/api/orders":
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            with _lock:
                return self._json(200, {"orders": _load(ORDERS_FILE)})
        if path.startswith("/api/orders/"):
            oid = path.rsplit("/", 1)[-1].upper()
            with _lock:
                order = next((o for o in _load(ORDERS_FILE) if o.get("id") == oid), None)
            if not order:
                return self._json(404, {"error": "Order not found."})
            return self._json(200, {"order": order})
        if path == "/api/messages":
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            with _lock:
                return self._json(200, {"messages": _load(MESSAGES_FILE)})
        if path == "/api/gallery":
            with _lock:
                return self._json(200, {"photos": _load(GALLERY_FILE)})
        if path == "/api/menu":
            with _lock:
                return self._json(200, {"items": _load(MENU_FILE)})
        if path == "/api/loyalty":
            qs = parse_qs(parsed.query)
            phone = _norm_phone((qs.get("phone") or [""])[0])
            me = _user_from_request(self)
            if phone:
                with _lock:
                    acct = _loyalty_for(phone=phone)
                return self._json(200, _loyalty_public(acct))
            if me and me.get("email"):
                with _lock:
                    acct = _loyalty_for(email=me.get("email") or "")
                return self._json(200, _loyalty_public(acct))
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            with _lock:
                book = _load_map(LOYALTY_FILE)
            accounts = sorted(
                (_loyalty_public(v) for v in book.values()),
                key=lambda a: a.get("points") or 0,
                reverse=True,
            )
            return self._json(200, {"accounts": accounts})
        if path == "/api/account/history":
            me = _user_from_request(self)
            if not me or not me.get("email"):
                return self._json(401, {"error": "Sign in with Google to see your history."})
            email = (me.get("email") or "").strip().lower()
            with _lock:
                acct = _loyalty_for(email=email)
                orders = [
                    o for o in _load(ORDERS_FILE)
                    if (o.get("email") or "").strip().lower() == email
                ]
            return self._json(200, {
                "loyalty": {
                    **_loyalty_public(acct),
                    "history": acct.get("history") or [],
                },
                "orders": orders,
            })
        if path.startswith("/api/file/"):
            return self._serve_upload(path.rsplit("/", 1)[-1])
        if _on_vercel():
            return self._json(404, {"error": "Unknown route."})
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        ctype = self.headers.get("Content-Type", "")

        if path == "/api/gallery":
            raw = self._raw()
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            return self._gallery_create(raw, ctype)

        if path == "/api/menu":
            raw = self._raw()
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            return self._menu_create(raw, ctype)

        body = {}
        if "multipart/form-data" not in ctype:
            try:
                raw = self._raw()
                body = json.loads(raw.decode("utf-8")) if raw else {}
                if not isinstance(body, dict):
                    body = {}
            except json.JSONDecodeError:
                body = {}

        if path == "/api/admin/login":
            user = str(body.get("user") or "").strip()
            password = str(body.get("password") or "")
            if user != ADMIN_USER or password != ADMIN_PASS:
                return self._json(401, {"error": "Wrong username or password."})
            token = _sign({"kind": "admin", "user": user, "exp": time.time() + TOKEN_TTL})
            return self._json(200, {"token": token, "user": user})

        if path == "/api/admin/logout":
            return self._json(200, {"ok": True})

        if path == "/api/auth/logout":
            return self._json(200, {"ok": True}, cookie=_clear_user_cookie())

        if path == "/api/orders":
            return self._place_order(body)

        if path == "/api/messages":
            name = str(body.get("name") or "").strip()
            reach = str(body.get("reach") or "").strip()
            msg = str(body.get("msg") or "").strip()
            if not (name and reach and msg):
                return self._json(400, {"error": "Name, contact and message are required."})
            row = {
                "id": "MSG" + secrets.token_hex(4).upper(),
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "name": name,
                "reach": reach,
                "msg": msg,
                "read": False,
            }
            with _lock:
                rows = _load(MESSAGES_FILE)
                rows.insert(0, row)
                _save(MESSAGES_FILE, rows)
            _mail_async(_mail_contact, row)
            return self._json(201, {"message": row})

        return self._json(404, {"error": "Unknown route."})

    def _google_start(self, parsed) -> None:
        qs = parse_qs(parsed.query)
        mode = (qs.get("mode") or ["login"])[0]
        nxt = _safe_next((qs.get("next") or [""])[0])
        if not _google_ready():
            return self._redirect(nxt + ("&" if "?" in nxt else "?") + "oauth=missing")
        state = _sign({"kind": "oauth", "next": nxt, "mode": mode, "exp": time.time() + 600})
        scopes = ["openid", "email", "profile"]
        prompt = "select_account"
        if mode == "gmail":
            if not _auth(self):
                return self._redirect("/admin.html")
            scopes.append("https://www.googleapis.com/auth/gmail.send")
            prompt = "consent"
        params = {
            "client_id": _env("GOOGLE_CLIENT_ID"),
            "redirect_uri": _google_redirect(),
            "response_type": "code",
            "scope": " ".join(scopes),
            "state": state,
            "access_type": "offline",
            "prompt": prompt,
            "include_granted_scopes": "true",
        }
        return self._redirect("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))

    def _google_callback(self, parsed) -> None:
        qs = parse_qs(parsed.query)
        err = (qs.get("error") or [""])[0]
        state = (qs.get("state") or [""])[0]
        rec = _unsign(state)
        nxt = (rec or {}).get("next") or "/index.html"
        mode = (rec or {}).get("mode") or "login"
        if err:
            return self._oauth_error(err, "Google cancelled or blocked the sign-in.")
        if not rec or rec.get("kind") != "oauth":
            return self._oauth_error("state", "Sign-in expired. Click Google again.")
        code = (qs.get("code") or [""])[0]
        tokens = _google_exchange(code)
        if not tokens.get("access_token"):
            detail = tokens.get("error_description") or tokens.get("error") or "token exchange failed"
            return self._oauth_error("token", str(detail))
        profile = _google_profile(tokens["access_token"])
        email = (profile.get("email") or "").strip().lower()
        if not email:
            return self._oauth_error("email", "Google did not share an email. Allow email access and try again.")
        if mode == "gmail":
            if tokens.get("refresh_token"):
                _save_oauth({
                    "email": email,
                    "refresh_token": tokens["refresh_token"],
                    "access_token": tokens.get("access_token") or "",
                    "exp": time.time() + int(tokens.get("expires_in") or 3500),
                })
            return self._redirect("/admin.html?gmail=1")
        admin = _is_cafe_email(email)
        cookie, _sid = _issue_user({
            "email": email,
            "name": profile.get("name") or email.split("@")[0],
            "picture": profile.get("picture") or "",
            "admin": admin,
        })
        dest = "/admin.html" if admin and "admin" in nxt else nxt
        if admin and "admin.html" not in dest:
            dest = nxt
        return self._redirect(dest, cookie=cookie)

    def _oauth_error(self, code: str, message: str) -> None:
        page = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Google sign-in</title>
<style>body{{font-family:Arial,sans-serif;background:#fbf7f2;color:#2a2a2a;padding:40px}}
.card{{max-width:520px;margin:0 auto;background:#fff;padding:28px;border-radius:16px}}
h1{{color:#961b27}} a{{color:#961b27}}</style></head>
<body><div class="card">
<h1>Google sign-in failed</h1>
<p>{html.escape(message)}</p>
<p><a href="/api/auth/google?next=/index.html">Try again</a> · <a href="/index.html">Home</a></p>
</div></body></html>"""
        raw = page.encode("utf-8")
        self.send_response(400)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _oauth_setup_page(self) -> None:
        uri = _google_redirect()
        ready = "yes" if _google_ready() else "no — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
        page = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Google OAuth setup</title>
<style>body{{font-family:Arial,sans-serif;background:#fbf7f2;color:#2a2a2a;padding:40px}}
.card{{max-width:640px;margin:0 auto;background:#fff;padding:28px;border-radius:16px}}
h1{{color:#961b27}} code{{display:block;background:#f6ede4;padding:10px 12px;border-radius:8px;margin:8px 0;word-break:break-all}}
ol{{line-height:1.7}}</style></head>
<body><div class="card">
<h1>Fix redirect_uri_mismatch</h1>
<p>Client ready: <strong>{html.escape(ready)}</strong></p>
<p>This app sends Google this redirect URI:</p>
<code>{html.escape(uri)}</code>
<ol>
<li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a></li>
<li>Click your <strong>Web client</strong> OAuth 2.0 Client ID</li>
<li>Under <strong>Authorized redirect URIs</strong> click Add URI</li>
<li>Paste the URI above, exactly, no slash at the end</li>
<li>Also add <code>http://127.0.0.1:4173/auth/google/callback</code> if you open the site as 127.0.0.1</li>
<li>Save, wait 1–2 minutes, then try Google sign-in again</li>
</ol>
<p>Open the café as <strong>http://localhost:4173</strong> (same host as the URI).</p>
<p><a href="/api/auth/google?next=/checkout.html">Try Google sign-in</a> · <a href="/index.html">Home</a></p>
</div></body></html>"""
        raw = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path.startswith("/api/menu/"):
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            mid = path.rsplit("/", 1)[-1]
            with _lock:
                rows = _load(MENU_FILE)
                if not any(i.get("id") == mid for i in rows):
                    return self._json(404, {"error": "Dish not found."})
                rows = [i for i in rows if i.get("id") != mid]
                _save(MENU_FILE, rows)
            return self._json(200, {"ok": True, "id": mid})
        if not path.startswith("/api/gallery/"):
            return self._json(404, {"error": "Unknown route."})
        if not _auth(self):
            return self._json(401, {"error": "Sign in to the admin desk."})
        pid = path.rsplit("/", 1)[-1].upper()
        with _lock:
            rows = _load(GALLERY_FILE)
            photo = next((p for p in rows if p.get("id") == pid), None)
            if not photo:
                return self._json(404, {"error": "Photo not found."})
            rows = [p for p in rows if p.get("id") != pid]
            _save(GALLERY_FILE, rows)
        _remove_upload(photo.get("src") or "")
        return self._json(200, {"ok": True, "id": pid})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path.startswith("/api/menu/"):
            raw = self._raw()
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            return self._menu_update(path.rsplit("/", 1)[-1], raw, self.headers.get("Content-Type", ""))
        if path.startswith("/api/gallery/"):
            raw = self._raw()
            if not _auth(self):
                return self._json(401, {"error": "Sign in to the admin desk."})
            return self._gallery_update(path.rsplit("/", 1)[-1].upper(), raw, self.headers.get("Content-Type", ""))
        if not path.startswith("/api/orders/"):
            return self._json(404, {"error": "Unknown route."})
        if not _auth(self):
            return self._json(401, {"error": "Sign in to the admin desk."})
        oid = path.rsplit("/", 1)[-1].upper()
        try:
            body = json.loads(self._raw().decode("utf-8") or "{}")
            if not isinstance(body, dict):
                body = {}
        except json.JSONDecodeError:
            body = {}
        status = str(body.get("status") or "").strip()
        allowed = {
            "placed", "confirmed", "preparing", "out", "delivered",
            "ready", "collected", "cancelled",
        }
        if status not in allowed:
            return self._json(400, {"error": "Unknown status."})
        with _lock:
            rows = _load(ORDERS_FILE)
            order = next((o for o in rows if o.get("id") == oid), None)
            if not order:
                return self._json(404, {"error": "Order not found."})
            order["status"] = status
            history = order.setdefault("history", [])
            history.append({
                "status": status,
                "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            _save(ORDERS_FILE, rows)
        _mail_async(_mail_order_status, order)
        return self._json(200, {"order": order})

    def _place_order(self, body: dict):
        user = _user_from_request(self)
        signed = bool(user and user.get("email"))
        if signed:
            body["email"] = user.get("email") or ""
            if user.get("name") and not str(body.get("name") or "").strip():
                body["name"] = user["name"]
        if not signed:
            body["useLoyalty"] = False
            body["loyaltyPoints"] = 0
        body["pay"] = "loyalty" if signed and body.get("pay") == "loyalty" else ""
        order = _new_order(body)
        if not order:
            return self._json(400, {"error": "Order is missing dishes or a name."})
        order["guest"] = not signed
        redeem = bool(signed and body.get("useLoyalty"))
        try:
            requested = int(body.get("loyaltyPoints") or 0) if signed else 0
        except (TypeError, ValueError):
            requested = 0
        with _lock:
            tot = order.setdefault("totals", {})
            tot["grand"] = int(tot.get("grand") or 0) + int(tot.get("loyalty") or 0)
            tot["loyalty"] = 0
            if signed:
                _apply_loyalty(order, redeem, requested)
            else:
                order["loyalty"] = {"earned": 0, "used": 0, "rupees": 0, "balance": 0}
                tot["loyalty"] = 0
                order["pay"] = ""
            rows = _load(ORDERS_FILE)
            rows.insert(0, order)
            _save(ORDERS_FILE, rows)
        _mail_async(_mail_new_order, order)
        return self._json(201, {"order": order})

    def _gallery_create(self, raw: bytes, content_type: str):
        fields, files = _parse_form(raw, content_type)
        caption = (fields.get("caption") or fields.get("cap") or "").strip()
        if not caption:
            return self._json(400, {"error": "Give the photo a name."})
        upload = files.get("image") or files.get("photo") or files.get("file")
        if not upload or not upload[1]:
            return self._json(400, {"error": "Choose a kunafa photo to upload."})
        try:
            src = _store_image(upload[0], upload[1])
        except ValueError as err:
            return self._json(400, {"error": str(err)})
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        photo = {
            "id": "IMG" + secrets.token_hex(4).upper(),
            "src": src,
            "cap": caption,
            "createdAt": now,
            "updatedAt": now,
        }
        with _lock:
            rows = _load(GALLERY_FILE)
            rows.insert(0, photo)
            _save(GALLERY_FILE, rows)
        return self._json(201, {"photo": photo})

    def _gallery_update(self, pid: str, raw: bytes, content_type: str):
        fields, files = _parse_form(raw, content_type)
        with _lock:
            rows = _load(GALLERY_FILE)
            photo = next((p for p in rows if p.get("id") == pid), None)
            if not photo:
                return self._json(404, {"error": "Photo not found."})
            caption = (fields.get("caption") or fields.get("cap") or "").strip()
            if caption:
                photo["cap"] = caption
            upload = files.get("image") or files.get("photo") or files.get("file")
            old_src = photo.get("src") or ""
            if upload and upload[1]:
                try:
                    photo["src"] = _store_image(upload[0], upload[1])
                except ValueError as err:
                    return self._json(400, {"error": str(err)})
                if photo["src"] != old_src:
                    _remove_upload(old_src)
            photo["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            _save(GALLERY_FILE, rows)
        return self._json(200, {"photo": photo})

    def _menu_create(self, raw: bytes, content_type: str):
        fields, files = _parse_form(raw, content_type)
        try:
            item = _dish_from_form(fields, files)
        except ValueError as err:
            return self._json(400, {"error": str(err)})
        with _lock:
            rows = _load(MENU_FILE)
            item["id"] = _unique_dish_id(item["name"], rows)
            rows.insert(0, item)
            _save(MENU_FILE, rows)
        return self._json(201, {"item": item})

    def _menu_update(self, mid: str, raw: bytes, content_type: str):
        fields, files = _parse_form(raw, content_type)
        with _lock:
            rows = _load(MENU_FILE)
            item = next((i for i in rows if i.get("id") == mid), None)
            if not item:
                return self._json(404, {"error": "Dish not found."})
            try:
                patch = _dish_from_form(fields, files, existing=item)
            except ValueError as err:
                return self._json(400, {"error": str(err)})
            item.update(patch)
            item["id"] = mid
            _save(MENU_FILE, rows)
        return self._json(200, {"item": item})


def _parse_price(val) -> int:
    text = str(val or "").replace("₹", "").replace(",", "").strip()
    try:
        n = int(round(float(text)))
    except (TypeError, ValueError):
        raise ValueError("Enter a price in rupees.")
    if n < 1 or n > 20000:
        raise ValueError("Price must be between ₹1 and ₹20,000.")
    return n


def _unique_dish_id(name: str, rows: list) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-") or "dish"
    base = base[:40]
    used = {str(i.get("id") or "") for i in rows}
    if base not in used:
        return base
    return base + "-" + secrets.token_hex(2)


def _dish_from_form(fields: dict, files: dict, existing: dict | None = None) -> dict:
    name = (fields.get("name") or (existing or {}).get("name") or "").strip()
    if not name:
        raise ValueError("Give the dish a name.")
    price_raw = fields.get("price")
    if price_raw in (None, "") and existing:
        price = int(existing.get("price") or 0)
        if price < 1:
            raise ValueError("Enter a price in rupees.")
    else:
        price = _parse_price(price_raw)
    cat = (fields.get("cat") or (existing or {}).get("cat") or "specials").strip()
    if cat not in MENU_CATS:
        cat = "specials"
    desc = (fields.get("desc") if "desc" in fields else (existing or {}).get("desc") or "")
    desc = str(desc).strip()
    tag = (fields.get("tag") if "tag" in fields else (existing or {}).get("tag") or "")
    tag = str(tag).strip()
    if "popular" in fields:
        popular = str(fields.get("popular") or "").lower() in {"1", "true", "on", "yes"}
    else:
        popular = bool((existing or {}).get("popular"))
    img = (fields.get("img") or "").strip()
    upload = files.get("image") or files.get("photo") or files.get("file")
    if upload and upload[1]:
        img = _store_image(upload[0], upload[1])
    if not img:
        img = (existing or {}).get("img") or "assets/dishes/nabulsi.jpg"
    return {
        "name": name,
        "cat": cat,
        "price": price,
        "desc": desc,
        "img": img,
        "popular": popular,
        "tag": tag,
    }


def _parse_form(raw: bytes, content_type: str) -> tuple[dict, dict]:
    if "multipart/form-data" not in (content_type or ""):
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            return {}, {}
        fields = {k: str(v) for k, v in data.items() if k != "image" and not isinstance(v, dict)}
        files = {}
        b64 = data.get("image")
        if isinstance(b64, str) and b64.startswith("data:image"):
            header, _, blob = b64.partition(",")
            ext = ".jpg"
            if "png" in header:
                ext = ".png"
            elif "webp" in header:
                ext = ".webp"
            try:
                files["image"] = ("photo" + ext, base64.b64decode(blob))
            except Exception:
                pass
        return fields, files
    match = re.search(r"boundary=([^;]+)", content_type, re.I)
    if not match:
        return {}, {}
    boundary = match.group(1).strip().strip('"').encode()
    fields: dict[str, str] = {}
    files: dict[str, tuple[str, bytes]] = {}
    for part in raw.split(b"--" + boundary):
        part = part.strip()
        if not part or part == b"--" or part.startswith(b"--"):
            continue
        header_blob, sep, body = part.partition(b"\r\n\r\n")
        if not sep:
            header_blob, sep, body = part.partition(b"\n\n")
        if not sep:
            continue
        if body.endswith(b"\r\n"):
            body = body[:-2]
        elif body.endswith(b"\n"):
            body = body[:-1]
        headers = header_blob.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]+)"', headers)
        if not name_m:
            continue
        name = name_m.group(1)
        file_m = re.search(r'filename="([^"]*)"', headers)
        if file_m:
            files[name] = (file_m.group(1), body)
        else:
            fields[name] = body.decode("utf-8", "replace")
    return fields, files


def _store_image(filename: str, data: bytes) -> str:
    if not data:
        raise ValueError("That photo file is empty.")
    if len(data) > MAX_IMAGE:
        raise ValueError("Use a photo smaller than 8 MB.")
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        if data[:3] == b"\xff\xd8\xff":
            ext = ".jpg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n":
            ext = ".png"
        elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            ext = ".webp"
        else:
            raise ValueError("Use a JPG, PNG or WebP photo.")
    UPLOADS.mkdir(parents=True, exist_ok=True)
    name = "km-" + secrets.token_hex(6) + ext
    (UPLOADS / name).write_bytes(data)
    if _on_vercel():
        return "/api/file/" + name
    return "assets/uploads/" + name


def _remove_upload(src: str) -> None:
    name = Path(src or "").name
    if not name.startswith("km-"):
        return
    path = (UPLOADS / name).resolve()
    if path.parent == UPLOADS.resolve() and path.exists() and path.is_file():
        path.unlink()


def _new_order(body: dict) -> dict | None:
    items = body.get("items") or []
    name = str(body.get("name") or "").strip()
    phone = str(body.get("phone") or "").strip()
    if not items or not name:
        return None
    totals = body.get("totals") or {}
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "id": "KM" + secrets.token_hex(4).upper(),
        "createdAt": now,
        "status": "placed",
        "history": [{"status": "placed", "at": now}],
        "type": "pickup" if body.get("type") == "pickup" else "delivery",
        "name": name,
        "phone": phone,
        "email": str(body.get("email") or "").strip(),
        "zone": str(body.get("zone") or ""),
        "zoneName": str(body.get("zoneName") or ""),
        "address": str(body.get("address") or "").strip(),
        "notes": str(body.get("notes") or "").strip(),
        "pay": "loyalty" if str(body.get("pay") or "").strip().lower() == "loyalty" else "",
        "items": [
            {
                "id": str(i.get("id") or ""),
                "name": str(i.get("name") or ""),
                "qty": int(i.get("qty") or 1),
                "price": int(i.get("price") or 0),
                "line": int(i.get("line") or 0),
            }
            for i in items
        ],
        "totals": {
            "subtotal": int(totals.get("subtotal") or 0),
            "packaging": int(totals.get("packaging") or 0),
            "delivery": int(totals.get("delivery") or 0),
            "gst": int(totals.get("gst") or 0),
            "discount": int(totals.get("discount") or 0),
            "promoLabel": str(totals.get("promoLabel") or ""),
            "grand": int(totals.get("grand") or 0),
            "loyalty": 0,
        },
        "loyalty": {"earned": 0, "used": 0, "rupees": 0, "balance": 0},
    }


def _load_map(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _norm_phone(val: str) -> str:
    digits = re.sub(r"\D", "", str(val or ""))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits if len(digits) == 10 else ""


def _rupees_from_points(points: int) -> int:
    return (int(points or 0) * RUPEES_PER_100_POINTS) // 100


def _loyalty_public(acct: dict) -> dict:
    points = int((acct or {}).get("points") or 0)
    return {
        "phone": (acct or {}).get("phone") or "",
        "email": (acct or {}).get("email") or "",
        "points": points,
        "rupees": _rupees_from_points(points),
        "name": (acct or {}).get("name") or "",
    }


def _loyalty_lookup(book: dict, phone: str = "", email: str = "") -> tuple[str, dict | None]:
    email = (email or "").strip().lower()
    if phone and phone in book:
        return phone, book[phone]
    if email:
        for key, rec in book.items():
            if (rec.get("email") or "").strip().lower() == email:
                return key, rec
        email_key = "e:" + email
        if email_key in book:
            return email_key, book[email_key]
    return "", None


def _loyalty_for(phone: str = "", email: str = "") -> dict:
    book = _load_map(LOYALTY_FILE)
    _key, acct = _loyalty_lookup(book, _norm_phone(phone), email)
    return acct or {"phone": _norm_phone(phone), "email": (email or "").strip().lower(), "points": 0, "history": []}


def _apply_loyalty(order: dict, redeem: bool, requested: int) -> None:
    phone = _norm_phone(order.get("phone") or "")
    email = (order.get("email") or "").strip().lower()
    order["phone"] = phone or str(order.get("phone") or "")
    book = _load_map(LOYALTY_FILE)
    key, acct = _loyalty_lookup(book, phone, email)
    if not acct:
        key = phone or (("e:" + email) if email else "")
        acct = {"phone": phone, "email": email, "points": 0, "name": "", "history": []}
    acct["name"] = order.get("name") or acct.get("name") or ""
    if email:
        acct["email"] = email
    if phone:
        acct["phone"] = phone
    used = 0
    rupees = 0
    identified = bool(phone or email)
    if redeem and identified and int(acct.get("points") or 0) > 0:
        grand = int((order.get("totals") or {}).get("grand") or 0)
        max_rs = min(grand, _rupees_from_points(acct["points"]))
        if requested > 0:
            max_rs = min(max_rs, _rupees_from_points(requested))
        rupees = max(0, max_rs)
        used = rupees * (100 // RUPEES_PER_100_POINTS)
        if used > int(acct["points"]):
            used = int(acct["points"]) - (int(acct["points"]) % 2)
            rupees = _rupees_from_points(used)
        acct["points"] = int(acct["points"]) - used
        order.setdefault("totals", {})["loyalty"] = rupees
        order["totals"]["grand"] = max(0, grand - rupees)
        if order["totals"]["grand"] == 0:
            order["pay"] = "loyalty"
    earned = POINTS_PER_ORDER if identified else 0
    acct["points"] = int(acct.get("points") or 0) + earned
    history = acct.setdefault("history", [])
    history.insert(0, {
        "orderId": order.get("id"),
        "earned": earned,
        "used": used,
        "rupees": rupees,
        "at": order.get("createdAt"),
        "balance": acct["points"],
    })
    acct["history"] = history[:40]
    if key:
        if phone and key != phone:
            book.pop(key, None)
            key = phone
        book[key] = acct
        _save(LOYALTY_FILE, book)
    order["loyalty"] = {
        "earned": earned,
        "used": used,
        "rupees": rupees,
        "balance": int(acct.get("points") or 0),
    }


def main() -> None:
    _load_env()
    _ensure_runtime()
    if not ORDERS_FILE.exists():
        _save(ORDERS_FILE, [])
    if not MESSAGES_FILE.exists():
        _save(MESSAGES_FILE, [])
    if not GALLERY_FILE.exists():
        _save(GALLERY_FILE, [])
    if not MENU_FILE.exists():
        _save(MENU_FILE, [])
    if not LOYALTY_FILE.exists():
        _save(LOYALTY_FILE, {})
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    smtp = _smtp_status()
    print(f"Kunafa Mahal → http://localhost:{PORT}")
    print(f"Admin desk   → http://localhost:{PORT}/admin.html")
    print(f"Google OAuth → add this redirect URI in Cloud Console:")
    print(f"               {_google_redirect()}")
    print("Admin login  → user admin / password Kunafa@7771")
    if smtp["ready"]:
        print(f"SMTP Gmail   → ready as {smtp['user']} → {smtp['to']}")
    else:
        print("SMTP Gmail   → not set. Edit .env (SMTP_USER / SMTP_PASS) and restart.")
    httpd.serve_forever()


def _http_json(url: str, method: str = "GET", data: dict | None = None, headers: dict | None = None) -> dict:
    body = None
    hdrs = dict(headers or {})
    if data is not None:
        if hdrs.get("Content-Type") == "application/x-www-form-urlencoded":
            body = urlencode(data).encode()
        else:
            hdrs.setdefault("Content-Type", "application/json")
            body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as err:
        try:
            return json.loads(err.read().decode("utf-8"))
        except Exception:
            return {"error": str(err)}
    except Exception as err:
        return {"error": str(err)}


def _google_ready() -> bool:
    return bool(_env("GOOGLE_CLIENT_ID") and _env("GOOGLE_CLIENT_SECRET"))


def _google_redirect() -> str:
    return (
        _env("GOOGLE_REDIRECT_URI")
        or _env("GOOGLE_CALLBACK_URL")
        or (_site_url() + "/auth/google/callback")
    )


def _google_status() -> dict:
    rec = _load_oauth()
    return {
        "ready": _google_ready(),
        "gmailConnected": bool(rec.get("refresh_token")),
        "gmailEmail": rec.get("email") or "",
    }


def _google_exchange(code: str) -> dict:
    return _http_json(
        "https://oauth2.googleapis.com/token",
        "POST",
        {
            "code": code,
            "client_id": _env("GOOGLE_CLIENT_ID"),
            "client_secret": _env("GOOGLE_CLIENT_SECRET"),
            "redirect_uri": _google_redirect(),
            "grant_type": "authorization_code",
        },
        {"Content-Type": "application/x-www-form-urlencoded"},
    )


def _google_profile(access_token: str) -> dict:
    return _http_json(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": "Bearer " + access_token},
    )


def _safe_next(val: str) -> str:
    val = (val or "").strip() or "/index.html"
    if val.startswith("http://") or val.startswith("https://"):
        parsed = urlparse(val)
        host = urlparse(_site_url()).netloc
        if parsed.netloc and parsed.netloc != host:
            return "/index.html"
        val = parsed.path or "/index.html"
        if parsed.query:
            val += "?" + parsed.query
    if not val.startswith("/"):
        val = "/" + val
    if ".." in val or val.startswith("//"):
        return "/index.html"
    return val


def _is_cafe_email(email: str) -> bool:
    email = (email or "").strip().lower()
    allowed = {
        _env("ADMIN_EMAIL").lower(),
        _env("SMTP_TO").lower(),
        _env("SMTP_USER").lower(),
    }
    return bool(email and email in allowed)


def _cookie_flags() -> str:
    flags = "Path=/; HttpOnly; SameSite=Lax"
    if _on_vercel() or _site_url().startswith("https"):
        flags += "; Secure"
    return flags


def _issue_user(profile: dict) -> tuple[str, str]:
    token = _sign({
        "kind": "user",
        "email": profile.get("email") or "",
        "name": profile.get("name") or "",
        "picture": profile.get("picture") or "",
        "admin": bool(profile.get("admin")),
        "exp": time.time() + TOKEN_TTL,
    })
    cookie = f"km_user={token}; {_cookie_flags()}; Max-Age={TOKEN_TTL}"
    return cookie, token


def _clear_user_cookie() -> str:
    return f"km_user=; {_cookie_flags()}; Max-Age=0"


def _load_oauth() -> dict:
    return _load_map(OAUTH_FILE)


def _save_oauth(rec: dict) -> None:
    DATA.mkdir(exist_ok=True)
    _save(OAUTH_FILE, rec)


def _google_access_token() -> str:
    rec = _load_oauth()
    if rec.get("access_token") and rec.get("exp", 0) > time.time() + 30:
        return rec["access_token"]
    refresh = rec.get("refresh_token")
    if not refresh:
        return ""
    data = _http_json(
        "https://oauth2.googleapis.com/token",
        "POST",
        {
            "client_id": _env("GOOGLE_CLIENT_ID"),
            "client_secret": _env("GOOGLE_CLIENT_SECRET"),
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        },
        {"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = data.get("access_token") or ""
    if token:
        rec["access_token"] = token
        rec["exp"] = time.time() + int(data.get("expires_in") or 3500)
        _save_oauth(rec)
    return token


def _send_via_gmail_api(msg: EmailMessage) -> bool:
    token = _google_access_token()
    if not token:
        return False
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii").rstrip("=")
    data = _http_json(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        "POST",
        {"raw": raw},
        {"Authorization": "Bearer " + token},
    )
    if data.get("id"):
        print("[km] gmail oauth sent:", msg["Subject"], "→", msg["To"])
        return True
    print("[km] gmail oauth failed:", data.get("error") or data)
    return False


def _load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            os.environ[key] = value


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


_load_env()
_ensure_runtime()


def _smtp_status() -> dict:
    user = _env("SMTP_USER")
    password = _env("SMTP_PASS")
    ready = bool(user and password and "your-gmail" not in user.lower())
    return {
        "ready": ready,
        "host": _env("SMTP_HOST", "smtp.gmail.com"),
        "port": int(_env("SMTP_PORT", "587") or 587),
        "user": user,
        "from": _env("SMTP_FROM") or user,
        "to": _env("SMTP_TO") or user,
    }


def _mail_async(fn, *args) -> None:
    threading.Thread(target=fn, args=args, daemon=True).start()


def _site_url() -> str:
    return _env("SITE_URL", "http://localhost:4173").rstrip("/")


def _send_mail(to: str, subject: str, text: str, html_body: str | None = None) -> bool:
    cfg = _smtp_status()
    to = (to or "").strip()
    if not to or "@" not in to:
        return False
    oauth_on = bool(_load_oauth().get("refresh_token"))
    if not cfg["ready"] and not oauth_on:
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["from"] or cfg["user"] or _env("ADMIN_EMAIL")
    msg["To"] = to
    msg.set_content(text or subject)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
        logo = ROOT / "assets" / "brand" / "logo.jpg"
        if logo.exists():
            try:
                html_part = msg.get_payload()[1]
                html_part.add_related(
                    logo.read_bytes(),
                    maintype="image",
                    subtype="jpeg",
                    cid="km-logo",
                )
            except Exception as err:
                print("[km] logo attach skipped:", err)
    if _send_via_gmail_api(msg):
        return True
    if not cfg["ready"]:
        return False
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
            smtp.ehlo()
            if _env("SMTP_SECURE", "starttls").lower() != "none":
                smtp.starttls()
                smtp.ehlo()
            smtp.login(cfg["user"], _env("SMTP_PASS"))
            smtp.send_message(msg)
        print("[km] mail sent:", subject, "→", to)
        return True
    except Exception as err:
        print("[km] mail failed:", err)
        return False


def _inr(n) -> str:
    return "₹" + format(int(n or 0), ",")


def _order_lines(order: dict) -> str:
    lines = []
    for item in order.get("items") or []:
        lines.append(f"- {item.get('qty')} × {item.get('name')}  {_inr(item.get('line'))}")
    tot = order.get("totals") or {}
    loy = order.get("loyalty") or {}
    lines.append(f"Subtotal {_inr(tot.get('subtotal'))}")
    if tot.get("loyalty"):
        lines.append(f"Loyalty −{_inr(tot.get('loyalty'))}")
    lines.append(f"To pay {_inr(tot.get('grand'))}")
    if loy.get("earned"):
        lines.append(f"Loyalty earned: {loy.get('earned')} points. Balance: {loy.get('balance')} points.")
    kind = "Pickup" if order.get("type") == "pickup" else "Delivery"
    lines.append(f"{kind} · {order.get('zoneName') or ''} {order.get('address') or ''}".strip())
    return "\n".join(lines)


def _mail_new_order(order: dict) -> None:
    import emails
    site = _site_url()
    cafe = _smtp_status()["to"]
    subject, html_body, text = emails.cafe_order(order, site)
    _send_mail(cafe, subject, text, html_body)
    guest = (order.get("email") or "").strip()
    if guest:
        subject, html_body, text = emails.guest_order(order, site)
        _send_mail(guest, subject, text, html_body)


def _mail_order_status(order: dict) -> None:
    import emails
    guest = (order.get("email") or "").strip()
    if not guest:
        return
    subject, html_body, text = emails.status_mail(order, _site_url())
    _send_mail(guest, subject, text, html_body)


def _mail_contact(row: dict) -> None:
    import emails
    cafe = _smtp_status()["to"]
    subject, html_body, text = emails.contact_mail(row)
    _send_mail(cafe, subject, text, html_body)


if __name__ == "__main__":
    main()
