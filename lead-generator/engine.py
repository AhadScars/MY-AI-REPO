"""Find local businesses and check whether they have a website."""

from __future__ import annotations

import json
import re
import urllib.request
from typing import Any, Callable

from niches import NICHES
from places import geocode, guess_state
from verify import check_website, polite_pause

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
)
UA = "LeadGenerator/1.0 (local research tool)"

GENERIC_NAMES = {
    "",
    "dental office",
    "dentist",
    "family dentist",
    "dentista",
    "cosmetic dentistry",
    "dental",
    "office",
    "clinic",
}

LogFn = Callable[[str, int | None, str | None], None]


def _fetch_overpass(query: str) -> dict[str, Any]:
    import time
    import urllib.error
    import urllib.parse

    body = urllib.parse.urlencode({"data": query}).encode()
    last_err: Exception | None = None
    for url in OVERPASS_ENDPOINTS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    url,
                    data=body,
                    headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=40) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                last_err = exc
                time.sleep(2 + attempt * 2)
    raise RuntimeError(f"Map download failed after retries: {last_err}")


def _clean_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return (raw or "").strip()


def _from_osm(el: dict[str, Any], niche: str, location: str) -> dict[str, Any] | None:
    tags = el.get("tags") or {}
    name = (tags.get("name") or tags.get("operator") or "").strip()
    if name.lower() in GENERIC_NAMES:
        return None
    exclude = (NICHES.get(niche) or {}).get("exclude_name") or ""
    if exclude and re.search(exclude, name, re.I):
        return None

    phone = _clean_phone(tags.get("phone") or tags.get("contact:phone") or tags.get("telephone") or "")
    street = " ".join(
        p for p in [tags.get("addr:housenumber", ""), tags.get("addr:street", "")] if p
    ).strip()
    city = tags.get("addr:city") or tags.get("addr:suburb") or ""
    postcode = (tags.get("addr:postcode") or "").split("-")[0]
    website = tags.get("website") or tags.get("contact:website") or tags.get("url") or ""
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")

    if website:
        has_website = 1
        presence = f"Listed on the map: {website}"
    else:
        has_website = 2
        presence = "No website on the map listing"

    borough = ""
    loc = location.lower()
    if any(x in loc for x in ("new york", "nyc", "brooklyn", "queens", "bronx", "staten", "manhattan")):
        zip3 = postcode[:3] if postcode else ""
        borough = {
            "100": "Manhattan",
            "101": "Manhattan",
            "102": "Manhattan",
            "103": "Staten Island",
            "104": "Bronx",
            "111": "Queens",
            "112": "Brooklyn",
            "113": "Queens",
            "114": "Queens",
            "116": "Queens",
        }.get(zip3, city or "")
        if not borough:
            city_l = city.lower()
            if "brooklyn" in city_l:
                borough = "Brooklyn"
            elif "queens" in city_l or city_l in {"astoria", "flushing", "jamaica", "ridgewood"}:
                borough = "Queens"
            elif "bronx" in city_l:
                borough = "Bronx"
            elif "staten" in city_l:
                borough = "Staten Island"
            elif "new york" in city_l:
                borough = "Manhattan"

    return {
        "name": name,
        "phone": phone,
        "address": street,
        "city": city or location.split(",")[0].strip(),
        "state": tags.get("addr:state") or guess_state(location),
        "zip": postcode,
        "borough": borough,
        "neighborhood": tags.get("addr:suburb") or "",
        "niche": niche,
        "website": website,
        "has_website": has_website,
        "online_presence": presence,
        "source": "OpenStreetMap",
        "osm_id": f"{el.get('type')}/{el.get('id')}",
        "lat": lat,
        "lon": lon,
    }


def discover(niche: str, location: str, log: LogFn | None = None) -> list[dict[str, Any]]:
    if niche not in NICHES:
        raise ValueError(f"Unknown niche: {niche}")
    if log:
        log(f"Looking up map area for {location}", 5, "Finding the area…")
    south, west, north, east = geocode(location)
    filters = NICHES[niche]["filters"]
    union = "".join(f"nwr{f}({south},{west},{north},{east});" for f in filters)
    query = f"[out:json][timeout:90];({union});out center tags;"
    if log:
        log("Downloading businesses from OpenStreetMap…", 12, "Downloading listings…")
    data = _fetch_overpass(query)
    elements = data.get("elements") or []
    seen = set()
    out = []
    for el in elements:
        rec = _from_osm(el, niche, location)
        if not rec:
            continue
        key = (rec["name"].lower(), rec["phone"], rec["address"].lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(rec)
    if log:
        log(f"Found {len(out)} named businesses on the map", 20, f"Found {len(out)} businesses")
    return out


def verify_leads(
    leads: list[dict[str, Any]],
    no_website_only: bool,
    max_results: int,
    log: LogFn | None = None,
) -> list[dict[str, Any]]:
    pending = [x for x in leads if x.get("has_website") != 1]
    already_yes = [x for x in leads if x.get("has_website") == 1]

    # Prefer named offices that already have a phone or address
    pending.sort(key=lambda r: (1 if r.get("phone") else 0) + (1 if r.get("address") else 0), reverse=True)
    to_check = pending[: max(20, max_results)]

    verified = []
    blocked = 0
    for i, rec in enumerate(to_check, 1):
        pct = 20 + int(70 * i / max(1, len(to_check)))
        if log:
            log(f"Checking website for {rec['name']}", pct, f"Checking {i}/{len(to_check)}")
        result = check_website(rec["name"], rec.get("city") or "", rec.get("address") or rec.get("phone") or "")
        rec["has_website"] = result["has_website"]
        rec["website"] = result["website"] or rec.get("website") or ""
        rec["online_presence"] = result["online_presence"]
        if result["has_website"] == 2:
            blocked += 1
        if result["has_website"] == 2 and blocked >= 4:
            rec["online_presence"] += " — search engine started blocking; remaining offices left as unchecked"
            verified.append(rec)
            if log:
                log("Search engine rate-limited further checks. Saving what we have.", pct, "Rate limited")
            # leave the rest unchecked
            for rest in to_check[i:]:
                rest["has_website"] = 2
                rest["online_presence"] = "Not checked — search engine rate limit"
                verified.append(rest)
            break
        verified.append(rec)
        polite_pause(1.3)

    combined = verified if no_website_only else already_yes + verified
    if no_website_only:
        combined = [x for x in verified if x.get("has_website") == 0]
    # cap
    return combined[:max_results]


def run_search(
    niche: str,
    location: str,
    no_website_only: bool,
    max_results: int,
    log: LogFn | None = None,
) -> list[dict[str, Any]]:
    found = discover(niche, location, log=log)
    return verify_leads(found, no_website_only, max_results, log=log)
