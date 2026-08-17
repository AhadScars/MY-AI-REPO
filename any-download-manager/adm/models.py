"""Download job models and status enums."""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Optional


class JobStatus(str, Enum):
    QUEUED = "Queued"
    CONNECTING = "Connecting"
    DOWNLOADING = "Downloading"
    PAUSED = "Paused"
    MERGING = "Merging"
    COMPLETED = "Completed"
    FAILED = "Failed"
    CANCELLED = "Cancelled"


class JobKind(str, Enum):
    DIRECT = "direct"
    MEDIA = "media"


@dataclass
class DownloadJob:
    id: str
    url: str
    filename: str
    save_dir: str
    status: str = JobStatus.QUEUED.value
    kind: str = JobKind.DIRECT.value
    connections: int = 16
    total_bytes: int = 0
    downloaded_bytes: int = 0
    speed: float = 0.0
    eta: Optional[float] = None
    error: str = ""
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    filepath: str = ""
    platform: str = "Direct"
    media_mode: str = "video"  # video | audio
    media_quality: str = "Best (Original)"
    note: str = ""

    @property
    def percent(self) -> float:
        if self.total_bytes > 0:
            return min(100.0, self.downloaded_bytes / self.total_bytes * 100.0)
        if self.status == JobStatus.COMPLETED.value:
            return 100.0
        return 0.0

    @staticmethod
    def new(
        url: str,
        filename: str,
        save_dir: str,
        *,
        connections: int = 16,
        kind: str = JobKind.DIRECT.value,
        platform: str = "Direct",
        media_mode: str = "video",
        media_quality: str = "Best (Original)",
    ) -> "DownloadJob":
        return DownloadJob(
            id=uuid.uuid4().hex[:12],
            url=url.strip(),
            filename=filename,
            save_dir=save_dir,
            connections=max(1, min(32, connections)),
            kind=kind,
            platform=platform,
            media_mode=media_mode,
            media_quality=media_quality,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DownloadJob":
        known = {f.name for f in cls.__dataclass_fields__.values()}  # type: ignore[attr-defined]
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)
