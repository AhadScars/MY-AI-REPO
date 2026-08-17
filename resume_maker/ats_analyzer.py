"""
ATS Resume Analyzer — rule-based score + optional SpaceXAI (xAI) deep analysis.

Rule engine always works offline (stdlib only).
Set XAI_API_KEY for AI-powered insights via https://api.x.ai/v1
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Resume text extraction
# ---------------------------------------------------------------------------

def resume_plain_text(data: Dict[str, Any]) -> str:
    parts: List[str] = []
    h = data.get("header") or {}
    for k in ("full_name", "title", "email", "phone", "location", "website", "linkedin", "github", "extra"):
        if h.get(k):
            parts.append(str(h[k]))
    if data.get("summary"):
        parts.append(str(data["summary"]))
    for exp in data.get("experience") or []:
        for k in ("role", "company", "location"):
            if exp.get(k):
                parts.append(str(exp[k]))
        for b in exp.get("bullets") or []:
            parts.append(str(b))
    for edu in data.get("education") or []:
        for k in ("degree", "school", "location", "details"):
            if edu.get(k):
                parts.append(str(edu[k]))
    for sk in data.get("skills") or []:
        if sk.get("category"):
            parts.append(str(sk["category"]))
        if sk.get("items"):
            parts.append(str(sk["items"]))
    for p in data.get("projects") or []:
        for k in ("name", "link", "description"):
            if p.get(k):
                parts.append(str(p[k]))
    for c in data.get("certifications") or []:
        for k in ("name", "issuer"):
            if c.get(k):
                parts.append(str(c[k]))
    for lang in data.get("languages") or []:
        if lang.get("name"):
            parts.append(str(lang["name"]))
        if lang.get("level"):
            parts.append(str(lang["level"]))
    custom = data.get("custom") or {}
    if custom.get("title"):
        parts.append(str(custom["title"]))
    for it in custom.get("items") or []:
        for k in ("title", "subtitle", "detail"):
            if it.get(k):
                parts.append(str(it[k]))
    return "\n".join(parts)


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9+.#/-]*", text or ""))


def tokenize(text: str) -> Set[str]:
    tokens = set()
    for t in re.findall(r"[A-Za-z][A-Za-z0-9+.#/-]{1,}", text or ""):
        t = t.lower().strip(".-/")
        if t:
            tokens.add(t)
    return tokens


# ---------------------------------------------------------------------------
# Keyword / action-verb dictionaries
# ---------------------------------------------------------------------------

ACTION_VERBS = {
    "achieved", "administered", "analyzed", "architected", "automated", "built",
    "collaborated", "configured", "created", "delivered", "designed", "developed",
    "drove", "engineered", "enhanced", "established", "executed", "expanded",
    "facilitated", "generated", "improved", "implemented", "increased", "initiated",
    "introduced", "launched", "led", "managed", "mentored", "migrated", "optimized",
    "orchestrated", "owned", "performed", "planned", "produced", "reduced",
    "refactored", "resolved", "scaled", "shipped", "spearheaded", "streamlined",
    "strengthened", "supported", "transformed", "upgraded",
}

WEAK_PHRASES = [
    r"\bresponsible for\b",
    r"\bduties included\b",
    r"\bworked on\b",
    r"\bhelped with\b",
    r"\bassisted in\b",
    r"\btasked with\b",
    r"\binvolved in\b",
]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"(\+?\d[\d\s().-]{7,}\d)")
METRIC_RE = re.compile(
    r"(\d+\s*%|\$\s?\d|\d+\s*x\b|\d{1,3}(,\d{3})+|\b\d+\+?\s*(users|customers|requests|"
    r"ms|seconds|minutes|hours|days|weeks|months|years|team|engineers|people|clients|"
    r"projects|features|tickets|bugs|prs|pull)\b)",
    re.I,
)

# Common tech/soft skill tokens for general ATS density (when no JD provided)
COMMON_SKILL_HINTS = {
    "python", "java", "javascript", "typescript", "react", "node", "sql", "aws",
    "docker", "kubernetes", "git", "linux", "api", "rest", "graphql", "agile",
    "scrum", "ci", "cd", "cloud", "azure", "gcp", "html", "css", "django",
    "flask", "fastapi", "postgresql", "mysql", "mongodb", "redis", "excel",
    "communication", "leadership", "problem-solving", "collaboration",
}


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _issue(severity: str, category: str, title: str, detail: str, fix: str = "") -> Dict[str, str]:
    return {
        "severity": severity,  # critical | warning | info | good
        "category": category,
        "title": title,
        "detail": detail,
        "fix": fix,
    }


def analyze_contact(header: Dict[str, Any]) -> Tuple[float, List[Dict]]:
    """Max 15 points."""
    score = 0.0
    issues: List[Dict] = []
    name = (header.get("full_name") or "").strip()
    email = (header.get("email") or "").strip()
    phone = (header.get("phone") or "").strip()
    title = (header.get("title") or "").strip()

    if name and len(name.split()) >= 2:
        score += 4
        issues.append(_issue("good", "Contact", "Full name present", f"Found: {name}"))
    elif name:
        score += 2
        issues.append(_issue("warning", "Contact", "Name looks incomplete",
                             "Use first + last name for ATS identity matching.",
                             "Enter your full legal/professional name."))
    else:
        issues.append(_issue("critical", "Contact", "Missing full name",
                             "ATS systems require a clear candidate name.",
                             "Add your full name in Header."))

    if email and EMAIL_RE.match(email):
        score += 5
        issues.append(_issue("good", "Contact", "Valid email", email))
        if any(x in email.lower() for x in ("hotmail", "yahoo", "aol")):
            issues.append(_issue("info", "Contact", "Consider a modern email domain",
                                 "Gmail or custom domain often looks more professional."))
    elif email:
        score += 1
        issues.append(_issue("critical", "Contact", "Email format invalid",
                             f"“{email}” may not parse cleanly.",
                             "Use format: name@domain.com"))
    else:
        issues.append(_issue("critical", "Contact", "Missing email",
                             "Almost every ATS requires an email field.",
                             "Add email under Header."))

    if phone and PHONE_RE.search(phone):
        score += 4
        issues.append(_issue("good", "Contact", "Phone number present", phone))
    elif phone:
        score += 1
        issues.append(_issue("warning", "Contact", "Phone may be incomplete",
                             "Include country/area code when possible."))
    else:
        issues.append(_issue("warning", "Contact", "Missing phone",
                             "Many ATS and recruiters filter by phone presence.",
                             "Add a phone number."))

    if title:
        score += 2
        issues.append(_issue("good", "Contact", "Professional title set", title))
    else:
        issues.append(_issue("warning", "Contact", "No professional title",
                             "A target title helps keyword matching.",
                             "Add a title like “Software Engineer”."))

    return min(score, 15.0), issues


def analyze_structure(data: Dict[str, Any]) -> Tuple[float, List[Dict]]:
    """Max 20 points — expected ATS sections."""
    score = 0.0
    issues: List[Dict] = []
    style = data.get("style") or {}
    visible = ((style.get("sections") or {}).get("visible") or {})

    def shown(key: str, default: bool = True) -> bool:
        return visible.get(key, default) is not False

    summary = (data.get("summary") or "").strip()
    exp = data.get("experience") or []
    edu = data.get("education") or []
    skills = data.get("skills") or []

    if shown("summary") and summary:
        words = word_count(summary)
        if 40 <= words <= 120:
            score += 5
            issues.append(_issue("good", "Structure", "Summary length is solid",
                                 f"~{words} words — good for ATS + humans."))
        elif words < 40:
            score += 3
            issues.append(_issue("warning", "Structure", "Summary is short",
                                 f"Only ~{words} words. Add impact + keywords.",
                                 "Expand summary to ~50–90 words with role keywords."))
        else:
            score += 3
            issues.append(_issue("warning", "Structure", "Summary is long for 1 page",
                                 f"~{words} words may push layout over one page.",
                                 "Trim to 2–4 concise sentences."))
    else:
        issues.append(_issue("warning", "Structure", "No professional summary",
                             "A keyword-rich summary improves early ATS ranking.",
                             "Add a summary with target role keywords."))

    if shown("experience") and exp:
        score += 6
        issues.append(_issue("good", "Structure", "Experience section present",
                             f"{len(exp)} role(s)."))
        incomplete = 0
        for e in exp:
            if not (e.get("role") and e.get("company")):
                incomplete += 1
            if not (e.get("bullets") or []):
                incomplete += 1
        if incomplete:
            score -= 2
            issues.append(_issue("warning", "Structure", "Incomplete experience entries",
                                 "Some roles missing title, company, or bullets.",
                                 "Fill role, company, dates, and 2–4 bullets each."))
    else:
        issues.append(_issue("critical", "Structure", "No work experience",
                             "Experience is the highest-weight ATS section for most jobs.",
                             "Add at least one role with bullets."))

    if shown("education") and edu:
        score += 4
        issues.append(_issue("good", "Structure", "Education present", f"{len(edu)} entry(ies)."))
    else:
        issues.append(_issue("warning", "Structure", "No education section",
                             "Many ATS templates expect Education.",
                             "Add school + degree (even bootcamps help)."))

    if shown("skills") and skills:
        score += 5
        flat = " ".join(f"{s.get('category','')} {s.get('items','')}" for s in skills)
        n = len([x for x in re.split(r"[,;/|]", flat) if x.strip()])
        if n >= 8:
            issues.append(_issue("good", "Structure", "Skills list is rich", f"~{n} skill items."))
        else:
            score -= 1
            issues.append(_issue("warning", "Structure", "Few skills listed",
                                 f"Only ~{n} skill items detected.",
                                 "Add tools, languages, and soft skills from the JD."))
    else:
        issues.append(_issue("critical", "Structure", "No skills section",
                             "Skills are primary keyword sources for ATS filters.",
                             "Add categorized skills matching the job."))

    return max(0.0, min(score, 20.0)), issues


def analyze_experience_quality(data: Dict[str, Any]) -> Tuple[float, List[Dict]]:
    """Max 25 points — bullets, verbs, metrics."""
    score = 0.0
    issues: List[Dict] = []
    bullets: List[str] = []
    for exp in data.get("experience") or []:
        for b in exp.get("bullets") or []:
            b = str(b).strip()
            if b:
                bullets.append(b)
    for p in data.get("projects") or []:
        d = (p.get("description") or "").strip()
        if d:
            bullets.append(d)

    if not bullets:
        issues.append(_issue("critical", "Content", "No achievement bullets",
                             "ATS and recruiters need scannable accomplishment lines.",
                             "Add 2–4 bullets per role starting with action verbs."))
        return 0.0, issues

    # Count
    if len(bullets) >= 6:
        score += 6
        issues.append(_issue("good", "Content", "Solid bullet count", f"{len(bullets)} bullets/lines."))
    elif len(bullets) >= 3:
        score += 4
        issues.append(_issue("warning", "Content", "Add more achievement bullets",
                             f"Only {len(bullets)} found.",
                             "Aim for 3–5 bullets on recent roles."))
    else:
        score += 2
        issues.append(_issue("warning", "Content", "Very few bullets",
                             f"Only {len(bullets)} found.",
                             "Expand experience with measurable outcomes."))

    # Action verbs
    verb_hits = 0
    weak_hits = 0
    for b in bullets:
        first = re.split(r"\s+", b.strip(), maxsplit=1)[0].lower().strip(".,;:")
        if first in ACTION_VERBS:
            verb_hits += 1
        for pat in WEAK_PHRASES:
            if re.search(pat, b, re.I):
                weak_hits += 1
                break

    verb_ratio = verb_hits / max(len(bullets), 1)
    if verb_ratio >= 0.7:
        score += 8
        issues.append(_issue("good", "Content", "Strong action verbs",
                             f"{verb_hits}/{len(bullets)} bullets start with power verbs."))
    elif verb_ratio >= 0.4:
        score += 5
        issues.append(_issue("warning", "Content", "Some bullets lack action verbs",
                             f"{verb_hits}/{len(bullets)} start with strong verbs.",
                             "Start bullets with Led, Built, Improved, Reduced…"))
    else:
        score += 2
        issues.append(_issue("critical", "Content", "Weak bullet openings",
                             "Most lines don’t start with action verbs.",
                             "Rewrite: “Led redesign…” not “Responsible for redesign…”"))

    if weak_hits:
        score -= min(3, weak_hits)
        issues.append(_issue("warning", "Content", "Passive / weak phrases detected",
                             f"{weak_hits} bullet(s) use phrases like “responsible for”.",
                             "Replace with quantified action-verb statements."))

    # Metrics
    metric_hits = sum(1 for b in bullets if METRIC_RE.search(b))
    metric_ratio = metric_hits / max(len(bullets), 1)
    if metric_ratio >= 0.4:
        score += 8
        issues.append(_issue("good", "Content", "Quantified achievements",
                             f"{metric_hits}/{len(bullets)} bullets include numbers/metrics."))
    elif metric_hits >= 1:
        score += 5
        issues.append(_issue("warning", "Content", "Add more metrics",
                             f"Only {metric_hits} bullet(s) show numbers.",
                             "Add %, $, time saved, users, revenue, latency…"))
    else:
        score += 1
        issues.append(_issue("critical", "Content", "No measurable results",
                             "ATS humans and keyword models both favor quantified impact.",
                             "Add at least 2–3 bullets with concrete numbers."))

    # Length sanity
    long_bullets = [b for b in bullets if word_count(b) > 35]
    if long_bullets:
        score -= 1
        issues.append(_issue("info", "Content", "Some bullets are very long",
                             f"{len(long_bullets)} bullet(s) exceed ~35 words.",
                             "Split long lines for ATS parsing and readability."))

    return max(0.0, min(score, 25.0)), issues


def analyze_keywords(data: Dict[str, Any], job_description: str = "") -> Tuple[float, List[Dict], Dict[str, Any]]:
    """Max 25 points — JD match or general skill density."""
    score = 0.0
    issues: List[Dict] = []
    text = resume_plain_text(data)
    resume_tokens = tokenize(text)
    detail: Dict[str, Any] = {
        "mode": "general",
        "matched": [],
        "missing": [],
        "match_rate": 0.0,
        "resume_word_count": word_count(text),
    }

    jd = (job_description or "").strip()
    if jd:
        detail["mode"] = "job_description"
        # Extract candidate keywords from JD: longer tech-like tokens + frequent nouns
        jd_tokens = tokenize(jd)
        # Prefer multi-char tokens, drop stopwords
        stop = {
            "the", "and", "for", "with", "you", "your", "our", "are", "will", "this",
            "that", "from", "have", "has", "was", "were", "been", "being", "their",
            "they", "who", "what", "when", "where", "which", "while", "about", "into",
            "over", "such", "than", "then", "also", "can", "may", "must", "should",
            "able", "work", "role", "team", "job", "position", "including", "using",
            "experience", "years", "year", "required", "requirements", "preferred",
            "responsibilities", "opportunity", "company", "we", "us", "as", "or",
            "an", "a", "to", "of", "in", "on", "by", "at", "is", "be", "all", "any",
            "need", "needs", "looking", "candidate", "candidates", "please", "etc",
            "well", "plus", "strong", "good", "great", "new", "other", "more",
            "based", "related", "across", "within", "through", "per", "via",
        }
        # Score JD keywords by specificity
        candidates: List[str] = []
        for t in jd_tokens:
            t = t.strip(".-/")
            if t in stop or len(t) < 3:
                continue
            if t.isdigit() or re.fullmatch(r"\d+\+", t):
                continue
            candidates.append(t)
        # Prefer tokens that look technical or capitalized multi-use
        # Deduplicate preserving order by frequency in JD lower text
        jd_lower = jd.lower()
        freq: Dict[str, int] = {}
        for t in candidates:
            freq[t] = jd_lower.count(t)
        ranked = sorted(freq.keys(), key=lambda x: (-freq[x], -len(x), x))
        # Cap keyword list
        keywords = ranked[:40]
        # Always include explicit skill-like tokens from COMMON that appear in JD
        for sk in COMMON_SKILL_HINTS:
            if sk in jd_tokens and sk not in keywords:
                keywords.append(sk)

        matched = [k for k in keywords if k in resume_tokens]
        missing = [k for k in keywords if k not in resume_tokens]
        rate = len(matched) / max(len(keywords), 1)
        detail["matched"] = matched[:30]
        detail["missing"] = missing[:25]
        detail["match_rate"] = round(rate, 3)
        detail["keywords_considered"] = len(keywords)

        score = round(rate * 25, 1)
        if rate >= 0.65:
            issues.append(_issue("good", "Keywords", "Strong JD keyword match",
                                 f"Matched {len(matched)}/{len(keywords)} keywords ({rate:.0%})."))
        elif rate >= 0.4:
            issues.append(_issue("warning", "Keywords", "Moderate JD keyword match",
                                 f"Matched {len(matched)}/{len(keywords)} ({rate:.0%}).",
                                 f"Add missing terms where true: {', '.join(missing[:8])}"))
        else:
            issues.append(_issue("critical", "Keywords", "Low JD keyword match",
                                 f"Only {len(matched)}/{len(keywords)} keywords found ({rate:.0%}).",
                                 f"Mirror wording from the job post: {', '.join(missing[:10])}"))
        if missing[:5]:
            issues.append(_issue("info", "Keywords", "Top missing keywords",
                                 ", ".join(missing[:12]),
                                 "Only add skills you actually have — never fabricate."))
    else:
        # General skill density
        hits = sorted(COMMON_SKILL_HINTS & resume_tokens)
        detail["matched"] = hits
        detail["missing"] = sorted(COMMON_SKILL_HINTS - resume_tokens)[:15]
        detail["match_rate"] = round(len(hits) / max(len(COMMON_SKILL_HINTS), 1), 3)
        if len(hits) >= 10:
            score = 18
            issues.append(_issue("good", "Keywords", "Good general skill density",
                                 f"Found {len(hits)} common ATS skill tokens.",
                                 "Paste a job description for a targeted match score."))
        elif len(hits) >= 5:
            score = 12
            issues.append(_issue("warning", "Keywords", "Average skill density",
                                 f"Found {len(hits)} common skill tokens.",
                                 "Paste a target job description for precise ATS matching."))
        else:
            score = 6
            issues.append(_issue("warning", "Keywords", "Low skill keyword density",
                                 f"Only {len(hits)} common skill tokens detected.",
                                 "Add a Skills section and paste a job description."))
        issues.append(_issue("info", "Keywords", "No job description provided",
                             "Keyword score is general. For best ATS results, paste the JD.",
                             "Open ATS tab → paste job description → Analyze."))

    # Word count band (ATS + 1-page)
    wc = detail["resume_word_count"]
    if 250 <= wc <= 700:
        score = min(25.0, score + 2)
        issues.append(_issue("good", "Keywords", "Word count in healthy band", f"{wc} words."))
    elif wc < 200:
        issues.append(_issue("warning", "Keywords", "Resume is thin",
                             f"Only {wc} words — may lack keyword coverage.",
                             "Add quantified bullets and skills."))
    elif wc > 900:
        score = max(0, score - 2)
        issues.append(_issue("warning", "Keywords", "Very long for 1 page / ATS skim",
                             f"{wc} words may hurt both ATS parse time and human skim.",
                             "Cut older roles and trim bullets."))

    return max(0.0, min(float(score), 25.0)), issues, detail


def analyze_ats_format(data: Dict[str, Any]) -> Tuple[float, List[Dict]]:
    """Max 15 points — parse-friendly formatting."""
    score = 15.0
    issues: List[Dict] = []
    style = data.get("style") or {}
    fonts = style.get("fonts") or {}
    layout = style.get("layout") or {}
    family = (fonts.get("family") or "Helvetica").lower()

    # Standard fonts are ATS-safe
    if family.startswith("helvetica") or family.startswith("times") or family.startswith("courier") or family.startswith("arial"):
        issues.append(_issue("good", "Format", "ATS-safe font family",
                             f"{fonts.get('family', 'Helvetica')} is widely parseable."))
    else:
        score -= 2
        issues.append(_issue("warning", "Format", "Uncommon font",
                             "Stick to Helvetica, Arial, Times, Calibri, Georgia for ATS.",
                             "Switch font family under Type tab."))

    # Single column implied by our generator — good
    issues.append(_issue("good", "Format", "Single-column layout",
                         "This builder exports a linear, single-column PDF — ideal for ATS."))

    # Special characters / bullets
    bullet = layout.get("bullet") or "•"
    if bullet in ("•", "-", "*", "·", "○", "▪"):
        issues.append(_issue("good", "Format", "Simple bullet character", f"Using “{bullet}”."))
    else:
        score -= 1
        issues.append(_issue("warning", "Format", "Exotic bullet may garble in ATS",
                             f"Bullet “{bullet}” might not parse cleanly.",
                             "Use • or - under Style."))

    text = resume_plain_text(data)
    # Tables/columns markers
    if "\t" in text:
        score -= 2
        issues.append(_issue("warning", "Format", "Tab characters found",
                             "Tabs can confuse older ATS parsers.",
                             "Avoid tabs; use plain spaces/lines."))

    # Email/linkedin as plain text (we already do)
    h = data.get("header") or {}
    if h.get("linkedin") and "linkedin.com" in str(h.get("linkedin")).lower():
        issues.append(_issue("good", "Format", "LinkedIn as plain text",
                             "Good — ATS can read the URL/path as text."))

    # Dates present on experience
    exp = data.get("experience") or []
    dated = 0
    for e in exp:
        start = e.get("start") or {}
        end = e.get("end") or {}
        if start.get("year") or end.get("year") or end.get("present"):
            dated += 1
    if exp and dated == len(exp):
        issues.append(_issue("good", "Format", "Dates on all roles",
                             "Chronology helps ATS employment history parsing."))
    elif exp:
        score -= 3
        issues.append(_issue("warning", "Format", "Missing dates on some roles",
                             f"{dated}/{len(exp)} roles have dates.",
                             "Add start/end month + year (or Present)."))

    # Header bar is fine for humans but note pure text is better for oldest ATS
    colors = style.get("colors") or {}
    if (colors.get("header_bg") or "").strip():
        score -= 1
        issues.append(_issue("info", "Format", "Colored header bar",
                             "Modern ATS usually OK; oldest systems prefer plain text.",
                             "If applying through a strict legacy portal, clear header background."))

    # Contact separator
    issues.append(_issue("info", "Format", "Standard sections & labels",
                         "Custom section titles are fine if standard ones stay visible.",
                         "Keep Experience / Education / Skills labels recognizable."))

    return max(0.0, min(score, 15.0)), issues


def grade_from_score(score: float) -> str:
    if score >= 90:
        return "A+"
    if score >= 85:
        return "A"
    if score >= 80:
        return "A-"
    if score >= 75:
        return "B+"
    if score >= 70:
        return "B"
    if score >= 65:
        return "B-"
    if score >= 60:
        return "C+"
    if score >= 55:
        return "C"
    if score >= 50:
        return "C-"
    if score >= 40:
        return "D"
    return "F"


def level_label(score: float) -> str:
    if score >= 85:
        return "Excellent — strong ATS readiness"
    if score >= 70:
        return "Good — minor improvements recommended"
    if score >= 55:
        return "Fair — address key gaps before applying"
    if score >= 40:
        return "Weak — significant ATS risks"
    return "Poor — rewrite for structure, keywords, and metrics"


# ---------------------------------------------------------------------------
# Main rule-based analysis
# ---------------------------------------------------------------------------

def analyze_ats(
    data: Dict[str, Any],
    job_description: str = "",
    use_ai: bool = False,
) -> Dict[str, Any]:
    """
    Returns full ATS report:
      score (0-100), grade, categories, issues, keywords, ai (optional)
    """
    categories: Dict[str, Dict[str, Any]] = {}
    all_issues: List[Dict] = []

    c_score, c_iss = analyze_contact(data.get("header") or {})
    categories["contact"] = {"score": round(c_score, 1), "max": 15, "label": "Contact info"}
    all_issues.extend(c_iss)

    s_score, s_iss = analyze_structure(data)
    categories["structure"] = {"score": round(s_score, 1), "max": 20, "label": "Sections & structure"}
    all_issues.extend(s_iss)

    e_score, e_iss = analyze_experience_quality(data)
    categories["content"] = {"score": round(e_score, 1), "max": 25, "label": "Bullets & impact"}
    all_issues.extend(e_iss)

    k_score, k_iss, k_detail = analyze_keywords(data, job_description)
    categories["keywords"] = {"score": round(k_score, 1), "max": 25, "label": "Keywords / JD match"}
    all_issues.extend(k_iss)

    f_score, f_iss = analyze_ats_format(data)
    categories["format"] = {"score": round(f_score, 1), "max": 15, "label": "ATS-friendly format"}
    all_issues.extend(f_iss)

    total = c_score + s_score + e_score + k_score + f_score
    total = round(min(100.0, max(0.0, total)), 1)

    # Priority fixes: critical then warning
    sev_order = {"critical": 0, "warning": 1, "info": 2, "good": 3}
    sorted_issues = sorted(all_issues, key=lambda x: (sev_order.get(x["severity"], 9), x["category"]))
    priority = [i for i in sorted_issues if i["severity"] in ("critical", "warning")][:8]

    report: Dict[str, Any] = {
        "score": total,
        "grade": grade_from_score(total),
        "level": level_label(total),
        "categories": categories,
        "issues": sorted_issues,
        "priority_fixes": priority,
        "keywords": k_detail,
        "stats": {
            "word_count": k_detail.get("resume_word_count", 0),
            "experience_count": len(data.get("experience") or []),
            "education_count": len(data.get("education") or []),
            "skill_groups": len(data.get("skills") or []),
            "bullet_count": sum(
                len([b for b in (e.get("bullets") or []) if str(b).strip()])
                for e in (data.get("experience") or [])
            ),
        },
        "ai": None,
        "ai_available": bool(os.environ.get("XAI_API_KEY")),
        "engine": "rule-based",
    }

    if use_ai:
        ai_result = run_ai_analysis(data, job_description, report)
        report["ai"] = ai_result
        if ai_result and ai_result.get("ok"):
            report["engine"] = "rule-based + SpaceXAI"
            # Optional: blend AI score lightly if provided
            ai_score = ai_result.get("ats_score")
            if isinstance(ai_score, (int, float)) and 0 <= ai_score <= 100:
                blended = round(total * 0.65 + float(ai_score) * 0.35, 1)
                report["score_rule"] = total
                report["score_ai"] = round(float(ai_score), 1)
                report["score"] = blended
                report["grade"] = grade_from_score(blended)
                report["level"] = level_label(blended)

    return report


# ---------------------------------------------------------------------------
# SpaceXAI (xAI) integration — stdlib urllib, OpenAI-compatible chat
# ---------------------------------------------------------------------------

XAI_BASE = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-4.5")


def ai_status() -> Dict[str, Any]:
    key = os.environ.get("XAI_API_KEY") or ""
    return {
        "available": bool(key),
        "model": XAI_MODEL if key else None,
        "base_url": XAI_BASE if key else None,
        "hint": None if key else "Set environment variable XAI_API_KEY to enable AI analysis (SpaceXAI / xAI).",
    }


def run_ai_analysis(
    data: Dict[str, Any],
    job_description: str,
    rule_report: Dict[str, Any],
) -> Dict[str, Any]:
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return {
            "ok": False,
            "error": "XAI_API_KEY not set",
            "hint": "export XAI_API_KEY=your_key  then restart the server. Get a key at https://console.x.ai",
        }

    resume_text = resume_plain_text(data)
    system = (
        "You are an expert ATS (Applicant Tracking System) and technical recruiter. "
        "Analyze resumes for ATS parseability, keyword alignment, impact writing, and hireability. "
        "Be specific and actionable. Never invent credentials the candidate does not claim. "
        "Respond with ONLY valid JSON matching the schema requested."
    )
    user_payload = {
        "task": "ATS deep analysis",
        "rule_based_score": rule_report.get("score"),
        "rule_priority_fixes": rule_report.get("priority_fixes"),
        "keyword_stats": rule_report.get("keywords"),
        "job_description": (job_description or "")[:6000],
        "resume_text": resume_text[:8000],
        "response_schema": {
            "ats_score": "number 0-100",
            "summary": "2-3 sentence overall assessment",
            "strengths": ["string"],
            "weaknesses": ["string"],
            "keyword_gaps": ["string"],
            "rewrite_examples": [
                {"original": "weak bullet", "improved": "strong quantified bullet"}
            ],
            "section_tips": ["string"],
            "one_page_tips": ["string"],
        },
    }
    body = {
        "model": XAI_MODEL,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": (
                    "Analyze this resume for ATS. Return JSON only.\n\n"
                    + json.dumps(user_payload, ensure_ascii=False)
                ),
            },
        ],
    }

    req = urllib.request.Request(
        f"{XAI_BASE.rstrip('/')}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8")
        payload = json.loads(raw)
        content = payload["choices"][0]["message"]["content"]
        parsed = _extract_json(content)
        if not parsed:
            return {
                "ok": True,
                "raw": content,
                "ats_score": None,
                "summary": content[:500],
                "model": XAI_MODEL,
            }
        parsed["ok"] = True
        parsed["model"] = XAI_MODEL
        return parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        return {"ok": False, "error": f"HTTP {e.code}", "detail": err_body, "model": XAI_MODEL}
    except Exception as e:
        return {"ok": False, "error": str(e), "model": XAI_MODEL}


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    text = (text or "").strip()
    if not text:
        return None
    # strip markdown fences
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        # find first { ... }
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                obj = json.loads(text[start : end + 1])
                return obj if isinstance(obj, dict) else None
            except json.JSONDecodeError:
                return None
    return None


if __name__ == "__main__":
    from pdf_generator import DEFAULT_RESUME

    r = analyze_ats(DEFAULT_RESUME, job_description="Senior Python Software Engineer React AWS Docker")
    print(json.dumps({
        "score": r["score"],
        "grade": r["grade"],
        "categories": r["categories"],
        "priority": r["priority_fixes"],
        "keywords": r["keywords"],
    }, indent=2))
