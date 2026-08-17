"""Face detection, registration, training, and multi-face recognition (OpenCV LBPH)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from config import (
    CASCADE_PATH,
    CONFIDENCE_THRESHOLD,
    DETECT_MIN_NEIGHBORS,
    DETECT_MIN_SIZE,
    DETECT_NMS_THRESHOLD,
    DETECT_SCALE_FACTOR,
    FACE_SIZE,
    KNOWN_FACES_DIR,
    LABELS_PATH,
    MAX_FACES_PER_FRAME,
    MODEL_PATH,
    TRAINER_DIR,
    ensure_dirs,
)


def _slug(name: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", name.strip(), flags=re.UNICODE)
    cleaned = re.sub(r"[\s-]+", "_", cleaned).strip("_")
    return cleaned or "person"


@dataclass
class FaceMatch:
    """One detected face and its recognition result."""

    box: tuple[int, int, int, int]  # x, y, w, h
    name: str
    confidence: float
    known: bool

    @property
    def label(self) -> str:
        if self.known:
            return f"{self.name} ({self.confidence:.0f})"
        return f"Unknown ({self.confidence:.0f})"


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    if inter <= 0:
        return 0.0
    union = aw * ah + bw * bh - inter
    return inter / union if union > 0 else 0.0


def _nms(boxes: list[tuple[int, int, int, int]], threshold: float) -> list[tuple[int, int, int, int]]:
    """Keep larger boxes when they heavily overlap (one face, not many boxes)."""
    if not boxes:
        return []
    ordered = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept: list[tuple[int, int, int, int]] = []
    for box in ordered:
        if all(_iou(box, k) < threshold for k in kept):
            kept.append(box)
        if len(kept) >= MAX_FACES_PER_FRAME:
            break
    return kept


class FaceEngine:
    def __init__(self) -> None:
        ensure_dirs()
        self.detector = cv2.CascadeClassifier(CASCADE_PATH)
        if self.detector.empty():
            raise RuntimeError(f"Could not load Haar cascade from {CASCADE_PATH}")
        self.recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=1, neighbors=8, grid_x=8, grid_y=8
        )
        self.id_to_name: dict[int, str] = {}
        self.name_to_id: dict[str, int] = {}
        self._model_loaded = False
        self._load_labels()
        self._try_load_model()

    def _load_labels(self) -> None:
        if LABELS_PATH.exists():
            data = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
            self.id_to_name = {int(k): v for k, v in data.get("id_to_name", {}).items()}
            self.name_to_id = {v: int(k) for k, v in self.id_to_name.items()}
        else:
            self.id_to_name = {}
            self.name_to_id = {}

    def _save_labels(self) -> None:
        LABELS_PATH.parent.mkdir(parents=True, exist_ok=True)
        LABELS_PATH.write_text(
            json.dumps(
                {"id_to_name": {str(k): v for k, v in self.id_to_name.items()}},
                indent=2,
            ),
            encoding="utf-8",
        )

    def _try_load_model(self) -> bool:
        self._model_loaded = False
        if MODEL_PATH.exists() and self.id_to_name:
            try:
                self.recognizer.read(str(MODEL_PATH))
                self._model_loaded = True
                return True
            except Exception:
                return False
        return False

    def is_trained(self) -> bool:
        return self._model_loaded and MODEL_PATH.exists() and bool(self.id_to_name)

    def list_registered(self) -> list[str]:
        return sorted(self.name_to_id.keys(), key=str.lower)

    # --------------------------------------------------------------- detection
    def detect_faces(self, gray: np.ndarray) -> list[tuple[int, int, int, int]]:
        """
        Detect ALL faces in the frame (multi-face).

        Dual-pass Haar + histogram equalization + NMS so two people side-by-side
        each get their own box.
        """
        if gray is None or gray.size == 0:
            return []

        eq = cv2.equalizeHist(gray)
        boxes: list[tuple[int, int, int, int]] = []

        for img, neighbors in (
            (eq, DETECT_MIN_NEIGHBORS),
            (gray, DETECT_MIN_NEIGHBORS + 1),
        ):
            raw = self.detector.detectMultiScale(
                img,
                scaleFactor=DETECT_SCALE_FACTOR,
                minNeighbors=neighbors,
                minSize=DETECT_MIN_SIZE,
                flags=cv2.CASCADE_SCALE_IMAGE,
            )
            for (x, y, w, h) in raw:
                boxes.append((int(x), int(y), int(w), int(h)))

        return _nms(boxes, DETECT_NMS_THRESHOLD)

    def largest_face(
        self, faces: list[tuple[int, int, int, int]]
    ) -> tuple[int, int, int, int] | None:
        if not faces:
            return None
        return max(faces, key=lambda b: b[2] * b[3])

    def _prep_face(self, gray: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
        x, y, w, h = box
        gh, gw = gray.shape[:2]
        x = max(0, min(x, gw - 1))
        y = max(0, min(y, gh - 1))
        w = max(1, min(w, gw - x))
        h = max(1, min(h, gh - y))
        face = gray[y : y + h, x : x + w]
        face = cv2.equalizeHist(face)
        face = cv2.resize(face, FACE_SIZE)
        return face

    # ------------------------------------------------------------- registration
    def next_person_id(self) -> int:
        if not self.id_to_name:
            return 1
        return max(self.id_to_name.keys()) + 1

    def person_folder(self, name: str, person_id: int | None = None) -> Path:
        if person_id is None:
            person_id = self.name_to_id.get(name)
        if person_id is None:
            raise ValueError(f"Unknown person: {name}")
        folder = KNOWN_FACES_DIR / f"{person_id}_{_slug(name)}"
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def register_name(self, name: str) -> int:
        name = name.strip()
        if not name:
            raise ValueError("Name cannot be empty.")
        if name in self.name_to_id:
            return self.name_to_id[name]
        person_id = self.next_person_id()
        self.id_to_name[person_id] = name
        self.name_to_id[name] = person_id
        self._save_labels()
        self.person_folder(name, person_id)
        return person_id

    def save_sample(
        self, name: str, gray: np.ndarray, box: tuple[int, int, int, int], index: int
    ) -> Path:
        person_id = self.name_to_id[name]
        folder = self.person_folder(name, person_id)
        face = self._prep_face(gray, box)
        path = folder / f"sample_{index:03d}.jpg"
        cv2.imwrite(str(path), face)
        return path

    def clear_samples(self, name: str) -> int:
        if name not in self.name_to_id:
            raise ValueError(f"Unknown person: {name}")
        folder = self.person_folder(name, self.name_to_id[name])
        count = 0
        if folder.exists():
            for f in list(folder.glob("*.jpg")) + list(folder.glob("*.png")):
                f.unlink()
                count += 1
        return count

    def sample_count(self, name: str) -> int:
        if name not in self.name_to_id:
            return 0
        folder = self.person_folder(name, self.name_to_id[name])
        if not folder.exists():
            return 0
        return len(list(folder.glob("*.jpg"))) + len(list(folder.glob("*.png")))

    # ------------------------------------------------------------------ training
    def train(self) -> tuple[int, int]:
        ensure_dirs()
        faces: list[np.ndarray] = []
        labels: list[int] = []

        for folder in sorted(KNOWN_FACES_DIR.iterdir()):
            if not folder.is_dir():
                continue
            try:
                person_id = int(folder.name.split("_", 1)[0])
            except ValueError:
                continue
            name = self.id_to_name.get(person_id)
            if name is None:
                rest = folder.name.split("_", 1)[1] if "_" in folder.name else folder.name
                name = rest.replace("_", " ")
                self.id_to_name[person_id] = name
                self.name_to_id[name] = person_id

            for img_path in sorted(folder.glob("*.jpg")) + sorted(folder.glob("*.png")):
                img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
                if img is None:
                    continue
                if img.shape[:2] != FACE_SIZE:
                    img = cv2.resize(img, FACE_SIZE)
                img = cv2.equalizeHist(img)
                faces.append(img)
                labels.append(person_id)

        if not faces:
            raise RuntimeError("No face samples found. Register people first.")

        self._save_labels()
        self.recognizer = cv2.face.LBPHFaceRecognizer_create(
            radius=1, neighbors=8, grid_x=8, grid_y=8
        )
        self.recognizer.train(faces, np.array(labels, dtype=np.int32))
        TRAINER_DIR.mkdir(parents=True, exist_ok=True)
        self.recognizer.write(str(MODEL_PATH))
        self._model_loaded = True
        return len(set(labels)), len(faces)

    # --------------------------------------------------------------- recognition
    def recognize(
        self, gray: np.ndarray, box: tuple[int, int, int, int]
    ) -> tuple[str, float]:
        if not self.is_trained():
            return "Unknown", 999.0

        face = self._prep_face(gray, box)
        try:
            label, confidence = self.recognizer.predict(face)
        except Exception:
            return "Unknown", 999.0

        if confidence <= CONFIDENCE_THRESHOLD and label in self.id_to_name:
            return self.id_to_name[label], float(confidence)
        return "Unknown", float(confidence)

    def recognize_all(self, gray: np.ndarray) -> list[FaceMatch]:
        """
        Detect and recognize EVERY face in the frame (multi-face).

        Returns one FaceMatch per person, sorted left-to-right.
        """
        boxes = self.detect_faces(gray)
        results: list[FaceMatch] = []
        for box in boxes:
            name, conf = self.recognize(gray, box)
            results.append(
                FaceMatch(
                    box=box,
                    name=name,
                    confidence=conf,
                    known=name != "Unknown",
                )
            )
        results.sort(key=lambda m: (m.box[0], m.box[1]))
        return results

    def delete_person(self, name: str) -> bool:
        if name not in self.name_to_id:
            return False
        person_id = self.name_to_id[name]
        folder = self.person_folder(name, person_id)
        if folder.exists():
            for f in folder.iterdir():
                f.unlink()
            folder.rmdir()
        del self.name_to_id[name]
        del self.id_to_name[person_id]
        self._save_labels()
        if any(KNOWN_FACES_DIR.iterdir()):
            self.train()
        else:
            self._model_loaded = False
            if MODEL_PATH.exists():
                MODEL_PATH.unlink()
        return True
