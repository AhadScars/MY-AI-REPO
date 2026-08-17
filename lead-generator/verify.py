"""Decide whether a business has its own website."""

from __future__ import annotations

import re
import time
import urllib.parse
import urllib.request

DIR_HINTS = (
    "yellowpages", "superpages", "webmd", "vitals", "healthgrades", "zocdoc",
    "findatopdoc", "medicarelist", "facebook", "instagram", "linkedin", "youtube",
    "npidb", "npino", "hipaaspace", "mapquest", "yelp.", "bbb.org", "manta.",
    "chamberofcommerce", "bizapedia", "corporationwiki", "zoominfo",
    "opencorporates", "nysed", "health.ny", "wikipedia", "wikidata",
    "openstreetmap", "archive.org", "usnews", "castleconnolly", "sharecare",
    "everydayhealth", "healthline", "doximity", "ratemds", "wellness.com",
    "localsearch.com", "edan.io", "365dds", "rankmydentist", "1stdentist",
    "1800dentist", "whitepages", "spokeo", "hotfrog", "cylex", "ezlocal",
    "elocal", "citysquares", "merchantcircle", "citysearch", "dexknows",
    "yellowbook", "crunchbase", "nppes", "cms.hhs", "medicare.gov",
    "carecredit", "groupon", "realself", "whatclinic", "opencare",
    "md.com", "doctor.com", "medifind", "healow", "demandforce",
    "solutionreach", "birdeye", "nextdoor", "patch.com", "foursquare",
    "tripadvisor", "angi.com", "thumbtack", "indeed.com", "glassdoor",
    "timeout", "apple.com", "waze.com", "bing.com", "yahoo.com",
    "duckduckgo", "tiktok", "pinterest", "twitter.com", "google.com",
    "g.page", "business.site", "topnpi", "npiprofile", "ada.org",
    "nysdental", "dentalplans", "deltadental", "beenverified", "intelius",
    "truepeoplesearch", "411.com", "local.com", "lp-dentistry",
    "doctoralia", "bookimed", "infobel", "yellowbot", "insiderpages",
    "newyorkdentists", "nycdentists", "dentistdirectory", "dentists.com",
    "maps.app.goo.gl", "nominatim", "openstreetmap.org",
    "dr-leonardo.com", "dental.me", "denteldoc.com", "edpdental.com",
    "npiprofile.com", "health.usnews", "sharecare.com", "vitadox.com",
    "ourhealthnetwork.com", "radaris.com", "spokeo.com", "dnb.com",
    "hoovers.com", "apollo.io", "rocketreach", "signalhire",
)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def host_of(url: str) -> str:
    try:
        host = urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def is_directory(url: str) -> bool:
    host = host_of(url)
    if not host:
        return True
    return any(hint in host for hint in DIR_HINTS)


def _extract_ddg(html: str) -> list[str]:
    urls = []
    for raw in re.findall(r"uddg=([^&\"']+)", html):
        url = urllib.parse.unquote(raw)
        if url.startswith("http"):
            urls.append(url)
    return urls


def search_web(query: str) -> list[str]:
    encoded = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        html = resp.read().decode("utf-8", "replace")
    return _extract_ddg(html)


def check_website(name: str, city: str, extra: str = "") -> dict:
    """
    Returns:
      has_website: 0 no, 1 yes, 2 unknown
      website: first official URL if any
      online_presence: short note
    """
    q = " ".join(p for p in [name, extra, city, "official website"] if p).strip()
    try:
        urls = search_web(q)
    except Exception as exc:
        return {
            "has_website": 2,
            "website": "",
            "online_presence": f"Search blocked or failed ({exc})",
        }

    official = []
    dirs = []
    seen = set()
    for url in urls:
        host = host_of(url)
        if not host or host in seen:
            continue
        seen.add(host)
        if is_directory(url):
            dirs.append(url)
        else:
            official.append(url)

    if official:
        return {
            "has_website": 1,
            "website": official[0],
            "online_presence": "Official site: " + official[0],
        }
    if dirs:
        hosts = ", ".join(host_of(u) for u in dirs[:4] if host_of(u))
        return {
            "has_website": 0,
            "website": "",
            "online_presence": f"Directories only: {hosts}",
        }
    return {
        "has_website": 0,
        "website": "",
        "online_presence": "No official site found in search results",
    }


def polite_pause(seconds: float = 1.4) -> None:
    time.sleep(seconds)
