"""Download engines: reliable multi-connection HTTP + yt-dlp media.

Designed for real-world hosts (redirects, large files, Windows paths).
"""

from __future__ import annotations

import os
import shutil
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler, urlopen

from adm.models import JobStatus
from adm.utils import (
    filename_from_content_disposition,
    filename_from_url,
    is_media_site,
    sanitize_filename,
    unique_path,
)

ProgressCb = Callable[[dict[str, Any]], None]
StatusCb = Callable[[str], None]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36 ADM/1.0"
)

CHUNK = 1024 * 1024  # 1 MB
MAX_CONNECTIONS = 32
DEFAULT_CONNECTIONS = 16
MULTI_MIN_SIZE = 512 * 1024  # 512 KB
CONNECT_TIMEOUT = 30
READ_TIMEOUT = 180
SEGMENT_RETRIES = 4
# Never pre-allocate files bigger than this (avoids multi-minute hangs)
MAX_PREALLOC = 64 * 1024 * 1024  # 64 MB


class CancelledError(Exception):
    pass


class DownloadController:
    def __init__(self) -> None:
        self._cancel = threading.Event()
        self._pause = threading.Event()

    def cancel(self) -> None:
        self._cancel.set()
        self._pause.clear()

    def pause(self) -> None:
        self._pause.set()

    def resume(self) -> None:
        self._pause.clear()

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    @property
    def paused(self) -> bool:
        return self._pause.is_set()

    def wait_if_paused(self) -> None:
        while self._pause.is_set():
            if self._cancel.is_set():
                raise CancelledError("Cancelled")
            time.sleep(0.12)
        if self._cancel.is_set():
            raise CancelledError("Cancelled")

    def check(self) -> None:
        if self._cancel.is_set():
            raise CancelledError("Cancelled")
        self.wait_if_paused()


def _headers(extra: Optional[dict[str, str]] = None) -> dict[str, str]:
    h = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Connection": "keep-alive",
    }
    if extra:
        h.update(extra)
    return h


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def _open(url: str, headers: Optional[dict[str, str]] = None, method: str = "GET", timeout: float = CONNECT_TIMEOUT):
    req = Request(url, headers=_headers(headers), method=method)
    return urlopen(req, timeout=timeout)


def _resolve_redirects(url: str, max_hops: int = 10) -> str:
    """Follow redirects and return the final URL (urllib handles https/http)."""
    current = url
    for _ in range(max_hops):
        try:
            req = Request(current, headers=_headers(), method="HEAD")
            with urlopen(req, timeout=CONNECT_TIMEOUT) as resp:
                final = resp.geturl() or current
                return final
        except HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
                loc = e.headers.get("Location")
                if loc.startswith("/"):
                    p = urlparse(current)
                    current = f"{p.scheme}://{p.netloc}{loc}"
                elif loc.startswith("http"):
                    current = loc
                else:
                    current = loc
                continue
            if e.code in (403, 405, 501):
                # HEAD not allowed — try GET range 0-0
                break
            # Other errors: return last known
            return current
        except Exception:
            break
    # Fallback: GET first byte and use geturl()
    try:
        with _open(current, headers={"Range": "bytes=0-0"}, timeout=CONNECT_TIMEOUT) as resp:
            return resp.geturl() or current
    except Exception:
        try:
            with _open(current, timeout=CONNECT_TIMEOUT) as resp:
                return resp.geturl() or current
        except Exception:
            return current


def ideal_connections(size: int, requested: int) -> int:
    requested = max(1, min(MAX_CONNECTIONS, requested))
    if size <= 0 or size < MULTI_MIN_SIZE:
        return 1
    if size < 5 * 1024 * 1024:
        return min(requested, 4)
    if size < 50 * 1024 * 1024:
        return min(requested, 8)
    if size < 500 * 1024 * 1024:
        return min(requested, 16)
    return requested


def probe_url(url: str) -> dict[str, Any]:
    """Probe size, range support, filename. Always resolves redirects."""
    result: dict[str, Any] = {
        "url": url,
        "size": 0,
        "accept_ranges": False,
        "filename": filename_from_url(url),
        "content_type": "",
        "final_url": url,
        "is_media": is_media_site(url),
    }
    if result["is_media"]:
        return result

    try:
        final = _resolve_redirects(url)
        result["final_url"] = final

        # Prefer Range probe (works on most CDNs + gives size)
        try:
            with _open(final, headers={"Range": "bytes=0-0"}, timeout=CONNECT_TIMEOUT) as resp:
                result["final_url"] = resp.geturl() or final
                headers = {k.lower(): v for k, v in resp.headers.items()}
                status = getattr(resp, "status", 200)
                result["content_type"] = headers.get("content-type", "")
                cd = headers.get("content-disposition")
                name = filename_from_content_disposition(cd)
                if name:
                    result["filename"] = name
                else:
                    result["filename"] = filename_from_url(result["final_url"])

                cr = headers.get("content-range", "")
                if status == 206 or (cr and "/" in cr):
                    result["accept_ranges"] = True
                    total = cr.split("/")[-1] if cr else ""
                    if total.isdigit():
                        result["size"] = int(total)
                cl = headers.get("content-length")
                if result["size"] <= 0 and cl and str(cl).isdigit():
                    # Range not honored — full length of this response
                    result["size"] = int(cl)
                ar = headers.get("accept-ranges", "").lower()
                if "bytes" in ar:
                    result["accept_ranges"] = True
        except Exception:
            # Plain HEAD / GET
            try:
                with _open(final, method="HEAD", timeout=CONNECT_TIMEOUT) as resp:
                    result["final_url"] = resp.geturl() or final
                    headers = {k.lower(): v for k, v in resp.headers.items()}
                    result["content_type"] = headers.get("content-type", "")
                    cl = headers.get("content-length")
                    if cl and cl.isdigit():
                        result["size"] = int(cl)
                    if "bytes" in headers.get("accept-ranges", "").lower():
                        result["accept_ranges"] = True
                    cd = headers.get("content-disposition")
                    name = filename_from_content_disposition(cd)
                    if name:
                        result["filename"] = name
            except Exception as exc:
                result["probe_error"] = str(exc)

        ct = (result.get("content_type") or "").lower()
        if "text/html" in ct and result["size"] < 5_000_000:
            result["maybe_html"] = True
    except Exception as exc:
        result["probe_error"] = str(exc)
    return result


def _download_range_to_file(
    url: str,
    start: int,
    end: int,
    out_path: Path,
    ctrl: DownloadController,
    on_bytes: Callable[[int], None],
) -> None:
    """Download bytes [start, end] inclusive into out_path (overwrite)."""
    expected = end - start + 1
    headers = {"Range": f"bytes={start}-{end}"}
    last_err: Optional[Exception] = None

    for attempt in range(1, SEGMENT_RETRIES + 1):
        ctrl.check()
        try:
            # Resume within this part if partial exists
            already = out_path.stat().st_size if out_path.exists() else 0
            if already >= expected:
                return
            if already > 0:
                headers = {"Range": f"bytes={start + already}-{end}"}
                mode = "ab"
            else:
                headers = {"Range": f"bytes={start}-{end}"}
                mode = "wb"

            req = Request(url, headers=_headers(headers), method="GET")
            with urlopen(req, timeout=READ_TIMEOUT) as resp:
                status = getattr(resp, "status", 200)
                if status == 200 and start + already > 0:
                    # Server ignored Range — cannot multi-part this server
                    raise IOError("Server ignored HTTP Range (got HTTP 200)")
                # Tune socket if possible
                try:
                    raw = resp.fp
                    while hasattr(raw, "raw"):
                        raw = raw.raw
                    sock = getattr(raw, "_sock", None)
                    if sock is not None:
                        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
                except Exception:
                    pass

                written = already
                with open(out_path, mode) as out:
                    loops = 0
                    while written < expected:
                        loops += 1
                        if loops == 1 or loops % 8 == 0:
                            ctrl.check()
                        data = resp.read(min(CHUNK, expected - written))
                        if not data:
                            break
                        out.write(data)
                        n = len(data)
                        written += n
                        on_bytes(n)

            if out_path.exists() and out_path.stat().st_size >= expected:
                # trim if overshot
                if out_path.stat().st_size > expected:
                    with open(out_path, "r+b") as f:
                        f.truncate(expected)
                return

            last_err = IOError(f"Incomplete segment {start}-{end}: got {out_path.stat().st_size if out_path.exists() else 0}/{expected}")
        except CancelledError:
            raise
        except Exception as exc:
            last_err = exc
            time.sleep(min(2.0, 0.3 * attempt))

    raise IOError(f"Segment {start}-{end} failed after {SEGMENT_RETRIES} tries: {last_err}")


class MultiConnectionDownloader:
    """Multi-connection downloader using temp part files (safe for huge files)."""

    def __init__(self, controller: DownloadController) -> None:
        self.ctrl = controller
        self._downloaded = 0
        self._lock = threading.Lock()
        self._last_report = 0.0
        self._bytes_window = 0
        self._window_t0 = time.time()
        self._speed_ema = 0.0

    def download(
        self,
        url: str,
        dest: Path,
        connections: int,
        on_progress: ProgressCb,
        on_status: StatusCb,
        known_size: int = 0,
        accept_ranges: bool = False,
    ) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        on_status(JobStatus.CONNECTING.value)

        probe = probe_url(url)
        size = known_size or int(probe.get("size") or 0)
        accept = accept_ranges or bool(probe.get("accept_ranges"))
        final_url = probe.get("final_url") or url

        # Ensure we use post-redirect URL (critical for GitHub, CDNs, file hosts)
        try:
            final_url = _resolve_redirects(final_url)
        except Exception:
            pass

        connections = ideal_connections(size, connections)
        if not accept or size <= 0:
            connections = 1

        on_status(JobStatus.DOWNLOADING.value)
        self._downloaded = 0
        self._speed_ema = 0.0
        self._bytes_window = 0
        self._window_t0 = time.time()

        if connections == 1:
            return self._download_single(final_url, dest, size, on_progress)

        # ---- Multi part files (no multi-GB preallocation) ----
        # Fewer larger parts for huge files to limit open files / merge cost
        if size >= 10 * 1024 * 1024 * 1024:  # >= 10 GB
            connections = min(connections, 8)
            part_count = connections
        elif size >= 1024 * 1024 * 1024:  # >= 1 GB
            connections = min(connections, 12)
            part_count = connections
        else:
            # more segments than connections for work-stealing feel
            part_count = max(connections, min(connections * 2, 32))

        part_size = size // part_count
        ranges: list[tuple[int, int, int]] = []
        for i in range(part_count):
            start = i * part_size
            end = size - 1 if i == part_count - 1 else (start + part_size - 1)
            ranges.append((i, start, end))

        temp_dir = dest.parent / f".adm_parts_{dest.stem}_{os.getpid()}_{threading.get_ident()}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        part_paths = {i: temp_dir / f"part_{i:04d}.bin" for i, _, _ in ranges}

        def on_bytes(n: int) -> None:
            with self._lock:
                self._downloaded += n
                self._bytes_window += n
            self._maybe_report(size, on_progress)

        # Work queue for dynamic scheduling
        queue: list[tuple[int, int, int]] = list(ranges)
        qlock = threading.Lock()
        errors: list[BaseException] = []

        def worker() -> None:
            while True:
                self.ctrl.check()
                with qlock:
                    if not queue:
                        return
                    item = queue.pop(0)
                idx, start, end = item
                try:
                    _download_range_to_file(
                        final_url, start, end, part_paths[idx], self.ctrl, on_bytes
                    )
                except CancelledError:
                    raise
                except Exception as exc:
                    # one retry by re-queue once
                    with qlock:
                        # avoid infinite loop — mark error if already attempted via missing file size
                        pass
                    with self._lock:
                        errors.append(exc)
                    # try once more inline
                    try:
                        if part_paths[idx].exists():
                            part_paths[idx].unlink()
                        _download_range_to_file(
                            final_url, start, end, part_paths[idx], self.ctrl, on_bytes
                        )
                        with self._lock:
                            if errors:
                                errors.pop()
                    except CancelledError:
                        raise
                    except Exception as exc2:
                        with self._lock:
                            errors.append(exc2)
                        return

        try:
            with ThreadPoolExecutor(max_workers=connections) as pool:
                futs = [pool.submit(worker) for _ in range(connections)]
                for f in as_completed(futs):
                    try:
                        f.result()
                    except CancelledError:
                        raise
                    except Exception as exc:
                        errors.append(exc)

            # Verify all parts
            missing = []
            for i, start, end in ranges:
                need = end - start + 1
                p = part_paths[i]
                if not p.exists() or p.stat().st_size < need:
                    missing.append((i, start, end))

            # Fill missing sequentially (fallback)
            for i, start, end in missing:
                self.ctrl.check()
                if part_paths[i].exists():
                    try:
                        part_paths[i].unlink()
                    except Exception:
                        pass
                _download_range_to_file(final_url, start, end, part_paths[i], self.ctrl, on_bytes)

            # Final verify
            for i, start, end in ranges:
                need = end - start + 1
                p = part_paths[i]
                if not p.exists() or p.stat().st_size < need:
                    raise IOError(
                        f"Part {i} incomplete ({p.stat().st_size if p.exists() else 0}/{need}). "
                        f"Server may block multi-connection downloads."
                    )

            on_status(JobStatus.MERGING.value)
            # Stream-merge parts into destination
            with open(dest, "wb") as out:
                for i, _, _ in ranges:
                    with open(part_paths[i], "rb") as inp:
                        shutil.copyfileobj(inp, out, length=CHUNK)

            on_progress({
                "downloaded": size,
                "total": size,
                "speed": self._speed_ema,
                "eta": 0,
                "percent": 100.0,
            })
            return dest
        except CancelledError:
            raise
        except Exception:
            # Last resort: single-connection full download
            on_status(JobStatus.DOWNLOADING.value)
            try:
                return self._download_single(final_url, dest, size, on_progress)
            except CancelledError:
                raise
            except Exception as single_exc:
                raise IOError(f"Download failed: {single_exc}") from single_exc
        finally:
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

    def _maybe_report(self, total: int, on_progress: ProgressCb) -> None:
        now = time.time()
        if now - self._last_report < 0.4:
            return
        self._last_report = now
        with self._lock:
            downloaded = self._downloaded
            elapsed = max(0.001, now - self._window_t0)
            instant = self._bytes_window / elapsed
            if self._speed_ema <= 0:
                self._speed_ema = instant
            else:
                self._speed_ema = self._speed_ema * 0.3 + instant * 0.7
            if elapsed >= 0.8:
                self._bytes_window = 0
                self._window_t0 = now
            speed = self._speed_ema
        remaining = max(0, total - downloaded) if total else 0
        eta = (remaining / speed) if speed > 0 else None
        pct = min(99.9, (downloaded / total * 100)) if total else 0
        on_progress({
            "downloaded": min(downloaded, total) if total else downloaded,
            "total": total,
            "speed": speed,
            "eta": eta,
            "percent": pct,
        })

    def _download_single(
        self,
        url: str,
        dest: Path,
        known_size: int,
        on_progress: ProgressCb,
    ) -> Path:
        partial = dest.with_suffix(dest.suffix + ".adm.partial")
        already = partial.stat().st_size if partial.exists() else 0
        headers: dict[str, str] = {}
        if already > 0:
            headers["Range"] = f"bytes={already}-"

        req = Request(url, headers=_headers(headers), method="GET")
        with urlopen(req, timeout=READ_TIMEOUT) as resp:
            status = getattr(resp, "status", 200)
            if already > 0 and status == 200:
                already = 0  # server ignored resume
            mode = "ab" if already > 0 else "wb"
            total = known_size
            cr = resp.headers.get("Content-Range") or resp.headers.get("content-range")
            if cr and "/" in cr:
                t = cr.split("/")[-1]
                if t.isdigit():
                    total = int(t)
            elif not total:
                cl = resp.headers.get("Content-Length") or resp.headers.get("content-length")
                if cl and str(cl).isdigit():
                    total = int(cl) + already

            try:
                raw = resp.fp
                while hasattr(raw, "raw"):
                    raw = raw.raw
                sock = getattr(raw, "_sock", None)
                if sock is not None:
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * 1024 * 1024)
            except Exception:
                pass

            downloaded = already
            window_bytes = 0
            window_t0 = time.time()
            last = 0.0
            speed_ema = 0.0

            with open(partial, mode) as out:
                loops = 0
                while True:
                    loops += 1
                    if loops == 1 or loops % 8 == 0:
                        self.ctrl.check()
                    data = resp.read(CHUNK)
                    if not data:
                        break
                    out.write(data)
                    n = len(data)
                    downloaded += n
                    window_bytes += n
                    now = time.time()
                    if now - last >= 0.4:
                        last = now
                        elapsed = max(0.001, now - window_t0)
                        instant = window_bytes / elapsed
                        speed_ema = instant if speed_ema <= 0 else speed_ema * 0.3 + instant * 0.7
                        if elapsed >= 0.8:
                            window_bytes = 0
                            window_t0 = now
                        remaining = max(0, total - downloaded) if total else 0
                        eta = (remaining / speed_ema) if speed_ema > 0 else None
                        pct = (downloaded / total * 100) if total else 0
                        on_progress({
                            "downloaded": downloaded,
                            "total": total,
                            "speed": speed_ema,
                            "eta": eta,
                            "percent": pct,
                        })

        if dest.exists():
            try:
                dest.unlink()
            except Exception:
                pass
        partial.replace(dest)
        return dest


class MediaDownloader:
    def __init__(self, controller: DownloadController) -> None:
        self.ctrl = controller

    def fetch_info(self, url: str) -> dict[str, Any]:
        import yt_dlp

        opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info:
            raise RuntimeError("Could not extract media information.")
        return {
            "title": info.get("title") or "Untitled",
            "uploader": info.get("uploader") or info.get("channel") or "Unknown",
            "duration": info.get("duration"),
            "ext": info.get("ext") or "mp4",
            "filesize": info.get("filesize") or info.get("filesize_approx") or 0,
            "webpage_url": info.get("webpage_url") or url,
        }

    def download(
        self,
        url: str,
        out_dir: Path,
        on_progress: ProgressCb,
        on_status: StatusCb,
        mode: str = "video",
        quality: str = "Best (Original)",
        preferred_name: str = "",
    ) -> Path:
        import yt_dlp

        out_dir.mkdir(parents=True, exist_ok=True)
        on_status(JobStatus.CONNECTING.value)

        quality_map = {
            "Best (Original)": "bestvideo*+bestaudio/best",
            "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
            "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
            "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
            "360p": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
        }

        last_prog = [0.0]
        status_set = [False]

        def hook(d: dict) -> None:
            status = d.get("status")
            if status == "downloading":
                now = time.time()
                if now - last_prog[0] < 0.4:
                    return
                last_prog[0] = now
                self.ctrl.check()
                if not status_set[0]:
                    on_status(JobStatus.DOWNLOADING.value)
                    status_set[0] = True
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                done = d.get("downloaded_bytes") or 0
                speed = d.get("speed") or 0
                eta = d.get("eta")
                pct = (done / total * 100) if total else 0
                on_progress({
                    "downloaded": done,
                    "total": total,
                    "speed": speed,
                    "eta": eta,
                    "percent": pct,
                    "filename": d.get("filename") or "",
                })
            elif status == "finished":
                on_status(JobStatus.MERGING.value)

        outtmpl = str(out_dir / "%(title).180B [%(id)s].%(ext)s")
        if preferred_name:
            stem = sanitize_filename(Path(preferred_name).stem)
            outtmpl = str(out_dir / f"{stem}.%(ext)s")

        opts: dict[str, Any] = {
            "outtmpl": outtmpl,
            "progress_hooks": [hook],
            "noplaylist": True,
            "retries": 10,
            "fragment_retries": 10,
            "file_access_retries": 5,
            "quiet": True,
            "no_warnings": True,
            "concurrent_fragment_downloads": 8,
            "buffersize": 1024 * 1024,
            "http_chunk_size": 10 * 1024 * 1024,
            "merge_output_format": "mp4",
            "socket_timeout": 30,
        }

        if mode == "audio":
            opts["format"] = "bestaudio/best"
            opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "320",
            }]
            opts.pop("merge_output_format", None)
        else:
            opts["format"] = quality_map.get(quality, quality_map["Best (Original)"])
            opts["postprocessors"] = [{
                "key": "FFmpegVideoRemuxer",
                "preferedformat": "mp4",
            }]

        final_path: list[str] = []

        def post_hook(d: dict) -> None:
            if d.get("status") == "finished" and d.get("filename"):
                final_path.append(d["filename"])

        opts["progress_hooks"].append(post_hook)
        on_status(JobStatus.DOWNLOADING.value)

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info:
                try:
                    prepared = ydl.prepare_filename(info)
                    if mode == "audio":
                        prepared = str(Path(prepared).with_suffix(".mp3"))
                    elif not prepared.endswith(".mp4"):
                        prepared = str(Path(prepared).with_suffix(".mp4"))
                    final_path.append(prepared)
                except Exception:
                    pass

        candidates = [Path(p) for p in final_path if p]
        for c in reversed(candidates):
            if c.exists():
                return c
            for ext in (".mp4", ".mp3", ".webm", ".mkv", ".m4a"):
                alt = c.with_suffix(ext)
                if alt.exists():
                    return alt

        recent = sorted(out_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in recent:
            if p.is_file() and not p.name.startswith("."):
                return p

        raise RuntimeError("Download finished but output file was not found.")


def resolve_job_path(save_dir: str, filename: str) -> Path:
    path = Path(save_dir) / sanitize_filename(filename)
    return unique_path(path)
