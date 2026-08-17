"""Download queue manager with concurrent workers."""

from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Callable, Optional

from adm.engine import (
    CancelledError,
    DownloadController,
    MediaDownloader,
    MultiConnectionDownloader,
    probe_url,
    resolve_job_path,
)
from adm.models import DownloadJob, JobKind, JobStatus
from adm.storage import load_history, save_history, _native_path
from adm.utils import detect_platform, is_media_site, sanitize_filename


JobListener = Callable[[], None]


class QueueManager:
    def __init__(self, max_concurrent: int = 3) -> None:
        self.max_concurrent = max(1, max_concurrent)
        self.jobs: list[DownloadJob] = []
        self._controllers: dict[str, DownloadController] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._lock = threading.RLock()
        self._listeners: list[JobListener] = []
        self._scheduler_stop = threading.Event()
        self._scheduler = threading.Thread(target=self._schedule_loop, daemon=True)
        self._scheduler.start()
        self._load()

    def _load(self) -> None:
        history = load_history()
        # Restore non-active jobs; mark stuck downloading as paused
        for job in history:
            if job.status in (
                JobStatus.DOWNLOADING.value,
                JobStatus.CONNECTING.value,
                JobStatus.MERGING.value,
                JobStatus.QUEUED.value,
            ):
                # leftover from last session — user can Resume
                if job.status != JobStatus.QUEUED.value:
                    job.status = JobStatus.PAUSED.value
                job.speed = 0
                job.eta = None
                job.save_dir = _native_path(job.save_dir)
            self.jobs.append(job)

    def persist(self) -> None:
        with self._lock:
            save_history(list(self.jobs))

    def add_listener(self, cb: JobListener) -> None:
        self._listeners.append(cb)

    def _notify(self) -> None:
        for cb in list(self._listeners):
            try:
                cb()
            except Exception:
                pass

    def add_job(self, job: DownloadJob, auto_start: bool = True) -> DownloadJob:
        with self._lock:
            if not auto_start:
                job.status = JobStatus.PAUSED.value
            elif job.status not in (JobStatus.QUEUED.value, JobStatus.PAUSED.value):
                job.status = JobStatus.QUEUED.value
            self.jobs.insert(0, job)
            self.persist()
        self._notify()
        return job

    def get_job(self, job_id: str) -> Optional[DownloadJob]:
        with self._lock:
            for j in self.jobs:
                if j.id == job_id:
                    return j
        return None

    def remove_jobs(self, job_ids: list[str], delete_files: bool = False) -> None:
        with self._lock:
            for jid in job_ids:
                self.cancel(jid, silent=True)
            keep: list[DownloadJob] = []
            for j in self.jobs:
                if j.id in job_ids:
                    if delete_files and j.filepath:
                        try:
                            Path(j.filepath).unlink(missing_ok=True)
                        except Exception:
                            pass
                    continue
                keep.append(j)
            self.jobs = keep
            self.persist()
        self._notify()

    def pause(self, job_id: str) -> None:
        ctrl = self._controllers.get(job_id)
        job = self.get_job(job_id)
        if not job:
            return
        if job.status in (
            JobStatus.DOWNLOADING.value,
            JobStatus.CONNECTING.value,
            JobStatus.MERGING.value,
        ):
            if ctrl:
                ctrl.pause()
            job.status = JobStatus.PAUSED.value
            job.speed = 0
            job.eta = None
            self.persist()
            self._notify()
        elif job.status == JobStatus.QUEUED.value:
            job.status = JobStatus.PAUSED.value
            self.persist()
            self._notify()

    def stop_reset(self, job_id: str) -> None:
        """Stop download and reset progress so Start begins from zero (IDM Stop)."""
        job = self.get_job(job_id)
        if not job:
            return
        # Mark PAUSED first so CancelledError handler does not force CANCELLED
        job.status = JobStatus.PAUSED.value
        job.downloaded_bytes = 0
        job.speed = 0.0
        job.eta = None
        job.error = ""
        job.finished_at = None
        ctrl = self._controllers.get(job_id)
        if ctrl:
            ctrl.cancel()
        # Re-assert after cancel signal (worker thread may race)
        job.status = JobStatus.PAUSED.value
        job.downloaded_bytes = 0
        job.speed = 0.0
        job.eta = None
        # Remove partial artifacts so next start is clean
        try:
            if job.filepath:
                p = Path(job.filepath)
                partial = p.with_suffix(p.suffix + ".adm.partial")
                partial.unlink(missing_ok=True)
            save = Path(job.save_dir)
            if save.is_dir():
                import shutil
                for child in save.glob(".adm_parts_*"):
                    if child.is_dir():
                        shutil.rmtree(child, ignore_errors=True)
        except Exception:
            pass
        self.persist()
        self._notify()


    def resume(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return
        if job.status in (
            JobStatus.PAUSED.value,
            JobStatus.FAILED.value,
            JobStatus.CANCELLED.value,
            JobStatus.QUEUED.value,
        ):
            ctrl = self._controllers.get(job_id)
            if ctrl and job.status == JobStatus.PAUSED.value and job_id in self._threads:
                # Thread still alive and paused
                job.status = JobStatus.DOWNLOADING.value
                ctrl.resume()
                self.persist()
                self._notify()
                return
            job.status = JobStatus.QUEUED.value
            job.error = ""
            job.speed = 0
            self.persist()
            self._notify()

    def cancel(self, job_id: str, silent: bool = False) -> None:
        ctrl = self._controllers.get(job_id)
        if ctrl:
            ctrl.cancel()
        job = self.get_job(job_id)
        if job and job.status not in (JobStatus.COMPLETED.value,):
            job.status = JobStatus.CANCELLED.value
            job.speed = 0
            job.eta = None
            if not silent:
                self.persist()
                self._notify()

    def start_all(self) -> None:
        with self._lock:
            for j in self.jobs:
                if j.status in (
                    JobStatus.PAUSED.value,
                    JobStatus.FAILED.value,
                    JobStatus.CANCELLED.value,
                ):
                    j.status = JobStatus.QUEUED.value
                    j.error = ""
            self.persist()
        self._notify()

    def pause_all(self) -> None:
        with self._lock:
            ids = [j.id for j in self.jobs if j.status in (
                JobStatus.DOWNLOADING.value,
                JobStatus.QUEUED.value,
                JobStatus.CONNECTING.value,
            )]
        for jid in ids:
            self.pause(jid)

    def active_count(self) -> int:
        with self._lock:
            return sum(
                1
                for j in self.jobs
                if j.status in (
                    JobStatus.DOWNLOADING.value,
                    JobStatus.CONNECTING.value,
                    JobStatus.MERGING.value,
                )
            )

    def total_speed(self) -> float:
        with self._lock:
            return sum(
                j.speed
                for j in self.jobs
                if j.status == JobStatus.DOWNLOADING.value
            )

    def _schedule_loop(self) -> None:
        while not self._scheduler_stop.is_set():
            try:
                self._try_start_next()
            except Exception:
                pass
            time.sleep(0.4)

    def _try_start_next(self) -> None:
        with self._lock:
            active = [
                j.id
                for j in self.jobs
                if j.status in (
                    JobStatus.DOWNLOADING.value,
                    JobStatus.CONNECTING.value,
                    JobStatus.MERGING.value,
                )
                and j.id in self._threads
                and self._threads[j.id].is_alive()
            ]
            # Clean dead threads marked active
            for j in self.jobs:
                t = self._threads.get(j.id)
                if t and not t.is_alive() and j.status in (
                    JobStatus.DOWNLOADING.value,
                    JobStatus.CONNECTING.value,
                    JobStatus.MERGING.value,
                ):
                    # orphaned — leave status, scheduler won't double-start if still in controllers
                    pass

            slots = self.max_concurrent - len(active)
            if slots <= 0:
                return
            queued = [
                j
                for j in self.jobs
                if j.status == JobStatus.QUEUED.value
                and (j.id not in self._threads or not self._threads[j.id].is_alive())
            ]
            to_start = queued[:slots]

        for job in to_start:
            self._spawn(job)

    def _spawn(self, job: DownloadJob) -> None:
        ctrl = DownloadController()
        self._controllers[job.id] = ctrl
        job.status = JobStatus.CONNECTING.value
        self.persist()
        self._notify()

        def runner() -> None:
            try:
                self._run_job(job, ctrl)
            except CancelledError:
                # stop_reset leaves PAUSED (restart from zero); plain cancel leaves CANCELLED
                if job.status != JobStatus.PAUSED.value:
                    job.status = JobStatus.CANCELLED.value
                job.speed = 0
                job.eta = None
            except Exception as exc:
                if job.status != JobStatus.PAUSED.value:
                    job.status = JobStatus.FAILED.value
                    job.error = str(exc)[:500]
                    job.speed = 0
                    job.eta = None
            finally:
                job.finished_at = time.time() if job.status in (
                    JobStatus.COMPLETED.value,
                    JobStatus.FAILED.value,
                    JobStatus.CANCELLED.value,
                ) else job.finished_at
                self.persist()
                self._notify()
                self._controllers.pop(job.id, None)

        t = threading.Thread(target=runner, daemon=True, name=f"adm-{job.id}")
        self._threads[job.id] = t
        t.start()

    def _run_job(self, job: DownloadJob, ctrl: DownloadController) -> None:
        # Progress updates must NOT call _notify() — that rebuilds the entire UI list
        # and freezes the window on large files. The GUI polls job fields instead.

        def on_progress(info: dict) -> None:
            if ctrl.paused or ctrl.cancelled:
                return
            job.downloaded_bytes = int(info.get("downloaded") or 0)
            total = info.get("total")
            if total:
                job.total_bytes = int(total)
            job.speed = float(info.get("speed") or 0)
            job.eta = info.get("eta")

        def on_status(status: str) -> None:
            if ctrl.cancelled:
                return
            if job.status == JobStatus.PAUSED.value:
                return
            # Only notify UI when the status string actually changes (rare)
            if job.status == status:
                return
            job.status = status
            self._notify()

        # Normalize WSL paths when running on Windows
        job.save_dir = _native_path(job.save_dir)
        save_dir = Path(job.save_dir)
        try:
            save_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            raise RuntimeError(f"Cannot create save folder '{save_dir}': {exc}") from exc

        # Auto-detect media if needed
        kind = job.kind
        if kind == JobKind.DIRECT.value and is_media_site(job.url):
            kind = JobKind.MEDIA.value
            job.kind = kind
            job.platform = detect_platform(job.url)

        if kind == JobKind.MEDIA.value:
            engine = MediaDownloader(ctrl)
            path = engine.download(
                job.url,
                save_dir,
                on_progress=on_progress,
                on_status=on_status,
                mode=job.media_mode,
                quality=job.media_quality,
                preferred_name=job.filename if job.filename else "",
            )
            job.filepath = str(path)
            job.filename = path.name
            if path.exists():
                job.total_bytes = path.stat().st_size
                job.downloaded_bytes = job.total_bytes
            job.status = JobStatus.COMPLETED.value
            job.speed = 0
            job.eta = 0
            job.percent  # property
            return

        # Direct multi-connection
        probe = probe_url(job.url)
        if probe.get("filename") and (not job.filename or job.filename == "download.bin"):
            job.filename = sanitize_filename(probe["filename"])
        if probe.get("size"):
            job.total_bytes = int(probe["size"])

        # HTML landing page → try media engine
        ct = (probe.get("content_type") or "").lower()
        if probe.get("maybe_html") or ("text/html" in ct and not probe.get("size")):
            try:
                engine = MediaDownloader(ctrl)
                job.kind = JobKind.MEDIA.value
                job.platform = detect_platform(job.url)
                path = engine.download(
                    job.url,
                    save_dir,
                    on_progress=on_progress,
                    on_status=on_status,
                    mode=job.media_mode,
                    quality=job.media_quality,
                    preferred_name=job.filename,
                )
                job.filepath = str(path)
                job.filename = path.name
                if path.exists():
                    job.total_bytes = path.stat().st_size
                    job.downloaded_bytes = job.total_bytes
                job.status = JobStatus.COMPLETED.value
                job.speed = 0
                job.eta = 0
                return
            except CancelledError:
                raise
            except Exception:
                # fall through to direct
                job.kind = JobKind.DIRECT.value

        dest = resolve_job_path(job.save_dir, job.filename or "download.bin")
        job.filename = dest.name
        engine = MultiConnectionDownloader(ctrl)
        path = engine.download(
            job.url,
            dest,
            connections=job.connections,
            on_progress=on_progress,
            on_status=on_status,
            known_size=job.total_bytes,
            accept_ranges=bool(probe.get("accept_ranges")),
        )
        job.filepath = str(path)
        if path.exists():
            job.total_bytes = path.stat().st_size
            job.downloaded_bytes = job.total_bytes
        job.status = JobStatus.COMPLETED.value
        job.speed = 0
        job.eta = 0

    def shutdown(self) -> None:
        self._scheduler_stop.set()
        with self._lock:
            for jid in list(self._controllers.keys()):
                self.cancel(jid, silent=True)
        self.persist()


def build_job_from_url(
    url: str,
    save_dir: str,
    *,
    filename: str = "",
    connections: int = 16,
    force_media: bool = False,
    media_mode: str = "video",
    media_quality: str = "Best (Original)",
) -> DownloadJob:
    url = url.strip()
    platform = detect_platform(url)
    media = force_media or is_media_site(url)
    kind = JobKind.MEDIA.value if media else JobKind.DIRECT.value

    name = filename
    total = 0
    if not media:
        probe = probe_url(url)
        name = name or probe.get("filename") or "download.bin"
        total = int(probe.get("size") or 0)
        if probe.get("probe_error") and not name:
            name = "download.bin"
    else:
        name = name or f"{platform} media"
        # Try quick info for nicer name
        try:
            ctrl = DownloadController()
            info = MediaDownloader(ctrl).fetch_info(url)
            title = sanitize_filename(info.get("title") or name)
            ext = "mp3" if media_mode == "audio" else (info.get("ext") or "mp4")
            name = f"{title}.{ext}"
            total = int(info.get("filesize") or 0)
        except Exception:
            ext = "mp3" if media_mode == "audio" else "mp4"
            if not name.endswith(f".{ext}"):
                name = f"{sanitize_filename(name)}.{ext}"

    job = DownloadJob.new(
        url=url,
        filename=sanitize_filename(name),
        save_dir=save_dir,
        connections=connections,
        kind=kind,
        platform=platform if media else "Direct",
        media_mode=media_mode,
        media_quality=media_quality,
    )
    job.total_bytes = total
    return job
