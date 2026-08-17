"""City bounding boxes + Nominatim geocoding."""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parent / "data" / "geocode_cache.json"

# south, west, north, east
KNOWN = {
    "new york": (40.49, -74.27, 40.92, -73.68),
    "new york, ny": (40.49, -74.27, 40.92, -73.68),
    "nyc": (40.49, -74.27, 40.92, -73.68),
    "manhattan": (40.70, -74.02, 40.88, -73.91),
    "brooklyn": (40.57, -74.05, 40.74, -73.83),
    "queens": (40.54, -73.96, 40.80, -73.70),
    "bronx": (40.79, -73.93, 40.92, -73.75),
    "staten island": (40.50, -74.26, 40.65, -74.05),
    "los angeles": (33.70, -118.67, 34.34, -118.16),
    "chicago": (41.64, -87.94, 42.02, -87.52),
    "houston": (29.52, -95.79, 30.11, -95.01),
    "miami": (25.70, -80.32, 25.86, -80.13),
    "dallas": (32.62, -96.99, 33.02, -96.46),
    "philadelphia": (39.87, -75.28, 40.14, -74.96),
    "atlanta": (33.65, -84.55, 33.89, -84.29),
    "phoenix": (33.29, -112.32, 33.76, -111.93),
    "boston": (42.23, -71.19, 42.40, -70.92),
    "seattle": (47.49, -122.44, 47.73, -122.22),
    "san francisco": (37.71, -122.52, 37.83, -122.35),
    "denver": (39.61, -105.11, 39.81, -104.60),
    "austin": (30.10, -97.94, 30.52, -97.56),
    "detroit": (42.26, -83.29, 42.45, -82.91),
    "buffalo": (42.83, -78.92, 42.97, -78.80),
    "albany": (42.61, -73.88, 42.73, -73.72),
    "rochester": (43.10, -77.70, 43.26, -77.53),
}

UA = "LeadGenerator/1.0 (local research tool; contact=local-user)"


def _load_cache() -> dict:
    if CACHE.exists():
        try:
            return json.loads(CACHE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def geocode(location: str) -> tuple[float, float, float, float]:
    """Return (south, west, north, east)."""
    key = (location or "").strip().lower()
    if not key:
        raise ValueError("Location is required")
    if key in KNOWN:
        return KNOWN[key]

    cache = _load_cache()
    if key in cache:
        b = cache[key]
        return tuple(b)  # type: ignore[return-value]

    q = urllib.parse.urlencode({"q": location, "format": "json", "limit": 1})
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{q}",
        headers={"User-Agent": UA, "Accept": "application/json"},
    )
    time.sleep(1.1)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not data:
        raise ValueError(f"Could not find location: {location}")
    bb = data[0]["boundingbox"]  # south, north, west, east as strings
    south, north, west, east = map(float, bb)
    result = (south, west, north, east)
    cache[key] = list(result)
    _save_cache(cache)
    return result


def guess_state(location: str) -> str:
    loc = (location or "").upper()
    for token in loc.replace(",", " ").split():
        if len(token) == 2 and token.isalpha():
            return token
    if "NEW YORK" in loc or "NYC" in loc:
        return "NY"
    return ""
