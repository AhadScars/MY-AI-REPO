"""Paths and settings for the Smart Attendance System."""

from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
KNOWN_FACES_DIR = BASE_DIR / "known_faces"
TRAINER_DIR = BASE_DIR / "trainer"
RECORDS_DIR = BASE_DIR / "attendance_records"
DATA_DIR = BASE_DIR / "data"
SNAPSHOTS_DIR = BASE_DIR / "snapshots"

# Trained model + label map
MODEL_PATH = TRAINER_DIR / "face_model.yml"
LABELS_PATH = DATA_DIR / "labels.json"
STUDENTS_PATH = DATA_DIR / "students.json"
ADMIN_PATH = DATA_DIR / "admin.json"

# How many face samples to capture per person during registration / update
SAMPLES_PER_PERSON = 30

# LBPH confidence: lower is better. Below this threshold = recognized.
CONFIDENCE_THRESHOLD = 55.0

# Haar cascade for face detection (bundled; OpenCV 5 may not ship cascades)
_MODELS = BASE_DIR / "models"
_BUNDLED_CASCADE = _MODELS / "haarcascade_frontalface_default.xml"


def _resolve_cascade() -> str:
    if _BUNDLED_CASCADE.exists():
        return str(_BUNDLED_CASCADE)
    try:
        import cv2

        candidate = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        if candidate.exists():
            return str(candidate)
    except Exception:
        pass
    return str(_BUNDLED_CASCADE)


CASCADE_PATH = _resolve_cascade()

# Webcam — higher resolution helps detect multiple faces side by side
CAMERA_INDEX = 0
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720
FACE_SIZE = (200, 200)

# Multi-face detection (Haar)
DETECT_MIN_SIZE = (50, 50)       # smaller faces when people stand farther back
DETECT_SCALE_FACTOR = 1.08
DETECT_MIN_NEIGHBORS = 4
DETECT_NMS_THRESHOLD = 0.35      # drop overlapping duplicate boxes
MAX_FACES_PER_FRAME = 20

# Anti-spam between identical face actions (seconds) — per person
RELOG_COOLDOWN_SECONDS = 8

# Schedule — used for On-Time / Late / Absent
# Check-in before or at ON_TIME_UNTIL = On-Time
# After ON_TIME_UNTIL until LATE_UNTIL = Late
# No check-in by end of day (or when marked) = Absent
CHECK_IN_START = "07:00:00"   # earliest sensible check-in window
ON_TIME_UNTIL = "09:15:00"    # inclusive deadline for On-Time
LATE_UNTIL = "12:00:00"       # after this still accepted as Late if checking in
# Default admin PIN (changeable in app). Stored hashed after first run.
DEFAULT_ADMIN_PIN = "1234"

# Green flash duration after a fresh mark (seconds)
JUST_MARKED_FLASH_SECONDS = 3.0


def ensure_dirs() -> None:
    """Create required folders if they do not exist."""
    for path in (KNOWN_FACES_DIR, TRAINER_DIR, RECORDS_DIR, DATA_DIR, SNAPSHOTS_DIR):
        path.mkdir(parents=True, exist_ok=True)


ensure_dirs()
