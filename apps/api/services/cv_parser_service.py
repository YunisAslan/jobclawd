"""Structured CV parser — extracts PDF content into CVData schema.

Uses pdfplumber character-level data + heuristics to detect sections,
then maps content into typed fields (personal_info, experience, education, etc.).
"""

import re
from pathlib import Path
from typing import Optional

from models.cv_schema import (
    CVData,
    CertificationEntry,
    EducationEntry,
    ExperienceEntry,
    LanguageEntry,
    PersonalInfo,
    SkillGroup,
)


# ── Regexes ──────────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,4}[\s\-.]?)?"
    r"(?:\(?\d{1,5}\)?[\s\-.]?)?"
    r"\d[\d\s\-.]{5,14}\d"
)
_URL_RE = re.compile(r"https?://[^\s,]+|www\.[^\s,]+")
_LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[^\s,]+", re.I)
_DATE_RANGE_RE = re.compile(
    r"(\d{1,2}/\d{4}|\w+\.?\s+\d{4}|\d{4})"
    r"\s*[-–—]\s*"
    r"(\d{1,2}/\d{4}|\w+\.?\s+\d{4}|\d{4}|[Pp]resent|[Cc]urrent|[Oo]ngoing|[Nn]ow)",
)
_SINGLE_DATE_RE = re.compile(r"\b(\d{1,2}/\d{4}|\w+\.?\s+\d{4}|\d{4})\b")
_BULLET_RE = re.compile(
    r"^(?:[•◦◆▪▸►●○■\-–—~\uf0b7\uf0a7\uf076\uf0d8\uf0fc]|\*|\d+[.)]\s|[a-zA-Z][.)]\s)\s*"
)

# Section heading keywords (lowercase)
_SECTION_MAP: dict[str, str] = {}
for _key, _words in {
    "experience": [
        "work experience", "experience", "professional experience",
        "employment", "employment history", "career history",
    ],
    "education": [
        "education", "academic background", "qualifications",
        "education and training",
    ],
    "skills": [
        "skills", "technical skills", "core skills", "technologies",
        "tech stack", "key skills", "competencies", "core competencies",
        "digital skills",
    ],
    "languages": [
        "languages", "language skills", "mother tongue", "other languages",
    ],
    "certifications": [
        "certifications", "certificates", "courses", "licenses",
        "training",
    ],
    "summary": [
        "summary", "profile", "professional summary", "objective",
        "about me",
    ],
    "personal": [
        "personal information", "personal details", "contact",
        "contact information", "contact details",
    ],
}.items():
    for w in _words:
        _SECTION_MAP[w] = _key

_ALL_HEADING_KEYWORDS = set(_SECTION_MAP.keys()) | {
    "projects", "personal projects", "side projects",
    "achievements", "awards", "honors",
    "references", "publications", "interests", "hobbies",
    "volunteer", "volunteering", "additional information",
}


# ── Public API ───────────────────────────────────────────────────────────────

def parse_cv(filepath: Path) -> Optional[CVData]:
    """Parse a PDF file into structured CVData."""
    lines = _extract_lines(filepath)
    if not lines:
        return None

    sections = _split_into_sections(lines)
    return _build_cv_data(sections, lines)


# ── Line extraction (reuses pdfplumber logic) ────────────────────────────────

def _extract_lines(filepath: Path) -> list[dict]:
    try:
        import pdfplumber
    except ImportError:
        return []

    all_lines: list[dict] = []
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                chars = page.chars
                if not chars:
                    text = page.extract_text()
                    if text:
                        for line in text.splitlines():
                            if line.strip():
                                all_lines.append({"text": line.strip(), "size": 11.0, "bold": False})
                    continue

                line_groups: dict[float, list] = {}
                for c in chars:
                    y = round(c["top"], 1)
                    matched = None
                    for ey in line_groups:
                        if abs(ey - y) < 3:
                            matched = ey
                            break
                    key = matched if matched is not None else y
                    if key not in line_groups:
                        line_groups[key] = []
                    line_groups[key].append(c)

                for y in sorted(line_groups.keys()):
                    group = sorted(line_groups[y], key=lambda c: c["x0"])
                    text = "".join(c.get("text", "") for c in group).strip()
                    if not text:
                        continue
                    sizes = [c.get("size", 11) for c in group if c.get("text", "").strip()]
                    fonts = [c.get("fontname", "") for c in group if c.get("text", "").strip()]
                    avg_size = sum(sizes) / len(sizes) if sizes else 11.0
                    bold = any("bold" in f.lower() for f in fonts) if fonts else False
                    all_lines.append({"text": text, "size": round(avg_size, 1), "bold": bold})
    except Exception:
        return []

    return _merge_continuations(all_lines)


def _merge_continuations(lines: list[dict]) -> list[dict]:
    """Merge lines that are continuations (wrapping) of the previous line."""
    if not lines:
        return lines

    body_size = _body_size(lines)
    merged: list[dict] = [lines[0]]

    for i in range(1, len(lines)):
        cur = lines[i]
        prev = merged[-1]
        text = cur["text"]
        if not text.strip():
            continue

        is_bullet = bool(_BULLET_RE.match(text))
        starts_lower = text[0].islower()
        prev_text = prev["text"].rstrip()
        prev_incomplete = prev_text and not prev_text.endswith((".", ":", ";", "!", "?"))
        same_size = abs(cur["size"] - prev["size"]) < 1.5

        if (
            not is_bullet
            and same_size
            and not _is_heading(text, cur["size"], cur["bold"], body_size)
            and (starts_lower or (prev_incomplete and not text[0].isupper()))
        ):
            prev["text"] = prev["text"].rstrip() + " " + text.lstrip()
        else:
            merged.append(cur)

    return merged


# ── Section splitting ────────────────────────────────────────────────────────

def _split_into_sections(lines: list[dict]) -> list[tuple[str, list[dict]]]:
    """Split lines into named sections based on heading detection."""
    body_size = _body_size(lines)
    sections: list[tuple[str, list[dict]]] = []
    current_name = "_header"
    current_lines: list[dict] = []

    for line in lines:
        if _is_heading(line["text"], line["size"], line["bold"], body_size):
            if current_lines or current_name != "_header":
                sections.append((current_name, current_lines))
            heading_lower = line["text"].strip().rstrip(":").lower()
            current_name = _SECTION_MAP.get(heading_lower, heading_lower)
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_name, current_lines))

    return sections


# ── CVData construction ──────────────────────────────────────────────────────

def _build_cv_data(sections: list[tuple[str, list[dict]]], all_lines: list[dict]) -> CVData:
    data = CVData()

    # Extract personal info from the header section
    header_lines = []
    for name, lines in sections:
        if name in ("_header", "personal"):
            header_lines.extend(lines)

    data.personal_info = _parse_personal_info(header_lines, all_lines)

    for name, lines in sections:
        if name == "_header" or name == "personal":
            continue
        elif name == "experience":
            data.experience = _parse_experience(lines)
        elif name == "education":
            data.education = _parse_education(lines)
        elif name == "skills":
            data.skills = _parse_skills(lines)
        elif name == "languages":
            data.languages = _parse_languages(lines)
        elif name == "certifications":
            data.certifications = _parse_certifications(lines)
        elif name == "summary":
            data.personal_info.summary = _join_texts(lines)
        else:
            # Catch-all for unrecognized sections
            items = [_strip_bullet(l["text"]) for l in lines if l["text"].strip()]
            if items:
                data.additional_sections[name] = items

    return data


def _parse_personal_info(header_lines: list[dict], all_lines: list[dict]) -> PersonalInfo:
    info = PersonalInfo()

    # Name is typically the first large/bold line
    if all_lines:
        first = all_lines[0]
        body = _body_size(all_lines)
        if first["size"] > body + 1 or first["bold"]:
            info.full_name = first["text"].strip()

    all_text = " ".join(l["text"] for l in header_lines)

    # Email
    m = _EMAIL_RE.search(all_text)
    if m:
        info.email = m.group()

    # Phone
    m = _PHONE_RE.search(all_text)
    if m:
        info.phone = m.group().strip()

    # LinkedIn
    m = _LINKEDIN_RE.search(all_text)
    if m:
        info.linkedin = m.group()

    # Portfolio / other URLs
    for url_m in _URL_RE.finditer(all_text):
        url = url_m.group()
        if "linkedin" not in url.lower() and not info.portfolio:
            info.portfolio = url

    # Location heuristic: lines that aren't name/email/phone/url
    for line in header_lines:
        text = line["text"].strip()
        if not text:
            continue
        # Skip if it's mostly emails/phones/urls
        cleaned = _EMAIL_RE.sub("", text)
        cleaned = _PHONE_RE.sub("", cleaned)
        cleaned = _URL_RE.sub("", cleaned)
        cleaned = cleaned.strip(" |,·•\t")
        if cleaned and not info.location and info.full_name.lower() not in cleaned.lower():
            # Likely location or contact line
            if any(kw in cleaned.lower() for kw in ["city", "state", "country", ","]) or len(cleaned.split(",")) >= 2:
                info.location = cleaned
            elif not info.location and len(cleaned) < 80:
                info.location = cleaned

    return info


def _parse_experience(lines: list[dict]) -> list[ExperienceEntry]:
    """Parse experience section into structured entries."""
    entries: list[ExperienceEntry] = []
    current: Optional[ExperienceEntry] = None

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue

        # Date range detection — often marks a new entry
        date_match = _DATE_RANGE_RE.search(text)
        is_bullet = bool(_BULLET_RE.match(text))

        if is_bullet:
            clean = _strip_bullet(text)
            if current:
                current.bullets.append(clean)
            continue

        # Bold/uppercase lines or lines with date ranges often signal new entries
        if line["bold"] or date_match:
            if date_match:
                # Line with dates — could be "Company - Location DATE - DATE"
                # or "DATE - DATE - Location"
                date_text = text[:date_match.start()].strip().rstrip("–-—|,")
                after_date = text[date_match.end():].strip().lstrip("–-—|,").strip()

                start = date_match.group(1).strip()
                end = date_match.group(2).strip()

                if current and not current.title and not current.company:
                    # This date line belongs to a new entry
                    pass

                if line["bold"] and date_text:
                    # "Company Name  01/2020 - Present"
                    if current:
                        entries.append(current)
                    current = ExperienceEntry(
                        company=date_text,
                        start_date=start,
                        end_date=end,
                        location=after_date,
                    )
                elif current and not current.start_date:
                    # Date line for existing entry
                    current.start_date = start
                    current.end_date = end
                    remaining = date_text + " " + after_date
                    remaining = remaining.strip()
                    if remaining and not current.location:
                        current.location = remaining
                else:
                    # New entry starting with date
                    if current:
                        entries.append(current)
                    current = ExperienceEntry(
                        start_date=start,
                        end_date=end,
                    )
                    remaining = date_text + " " + after_date
                    remaining = remaining.strip().strip("–-—|,").strip()
                    if remaining:
                        current.location = remaining
            elif line["bold"]:
                # Bold line without date — could be company or title
                if current and not current.title:
                    current.title = text
                elif current and current.title and not current.company:
                    current.company = text
                else:
                    if current:
                        entries.append(current)
                    current = ExperienceEntry()
                    # Guess: if it contains " – " or " - ", split company and title
                    parts = re.split(r"\s*[–—]\s*", text, maxsplit=1)
                    if len(parts) == 2:
                        current.title = parts[0].strip()
                        current.company = parts[1].strip()
                    else:
                        current.title = text
        else:
            # Regular text line — could be description or company/location
            if current:
                if not current.company and not current.bullets:
                    current.company = text
                elif not current.location and len(text) < 60:
                    current.location = text
                else:
                    current.bullets.append(text)
            else:
                # No current entry, create one
                current = ExperienceEntry()
                current.title = text

    if current:
        entries.append(current)

    return entries


def _parse_education(lines: list[dict]) -> list[EducationEntry]:
    """Parse education section."""
    entries: list[EducationEntry] = []
    current: Optional[EducationEntry] = None

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue

        is_bullet = bool(_BULLET_RE.match(text))
        date_match = _DATE_RANGE_RE.search(text)

        if is_bullet:
            if current:
                current.details.append(_strip_bullet(text))
            continue

        if line["bold"] or date_match:
            if current:
                entries.append(current)
            current = EducationEntry()

            if date_match:
                current.start_date = date_match.group(1).strip()
                current.end_date = date_match.group(2).strip()
                remaining = text[:date_match.start()].strip().rstrip("–-—|,")
                if remaining:
                    current.institution = remaining

            if line["bold"]:
                cleaned = text
                if date_match:
                    cleaned = text[:date_match.start()].strip().rstrip("–-—|,")
                if not current.institution:
                    current.institution = cleaned
                else:
                    current.degree = cleaned
        else:
            if current:
                if not current.degree:
                    current.degree = text
                elif not current.field_of_study:
                    current.field_of_study = text
                else:
                    current.details.append(text)
            else:
                current = EducationEntry(institution=text)

    if current:
        entries.append(current)

    return entries


def _parse_skills(lines: list[dict]) -> list[SkillGroup]:
    """Parse skills section into grouped categories."""
    groups: list[SkillGroup] = []
    current_category = ""
    current_items: list[str] = []

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue

        is_bullet = bool(_BULLET_RE.match(text))

        # Check for "Category: item1, item2, ..." pattern
        colon_match = re.match(r"^(.+?):\s*(.+)$", text)

        if colon_match and not is_bullet:
            # Save previous group
            if current_items:
                groups.append(SkillGroup(category=current_category, items=current_items))

            category = colon_match.group(1).strip()
            rest = colon_match.group(2).strip()
            current_category = category
            current_items = [s.strip() for s in re.split(r"[,;|]", rest) if s.strip()]
        elif is_bullet:
            item = _strip_bullet(text)
            # Could contain comma-separated items
            sub_items = [s.strip() for s in re.split(r"[,;|]", item) if s.strip()]
            if len(sub_items) > 2:
                current_items.extend(sub_items)
            else:
                current_items.append(item)
        else:
            # Plain text — might be comma-separated skills
            sub_items = [s.strip() for s in re.split(r"[,;|]", text) if s.strip()]
            if len(sub_items) > 2:
                current_items.extend(sub_items)
            elif line["bold"]:
                # Bold text = new sub-category
                if current_items:
                    groups.append(SkillGroup(category=current_category, items=current_items))
                current_category = text.rstrip(":")
                current_items = []
            else:
                current_items.extend(sub_items)

    if current_items:
        groups.append(SkillGroup(category=current_category, items=current_items))

    return groups


def _parse_languages(lines: list[dict]) -> list[LanguageEntry]:
    """Parse languages section."""
    entries: list[LanguageEntry] = []

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue
        text = _strip_bullet(text)

        # "English - Fluent" or "English: Native" or "English (C2)"
        m = re.match(r"^(.+?)\s*[-–—:|]\s*(.+)$", text)
        if m:
            entries.append(LanguageEntry(language=m.group(1).strip(), level=m.group(2).strip()))
        else:
            level_m = re.search(r"\(([^)]+)\)", text)
            if level_m:
                lang = text[:level_m.start()].strip()
                entries.append(LanguageEntry(language=lang, level=level_m.group(1)))
            else:
                entries.append(LanguageEntry(language=text))

    return entries


def _parse_certifications(lines: list[dict]) -> list[CertificationEntry]:
    """Parse certifications section."""
    entries: list[CertificationEntry] = []

    for line in lines:
        text = line["text"].strip()
        if not text:
            continue
        text = _strip_bullet(text)

        date_m = _SINGLE_DATE_RE.search(text)
        date_str = date_m.group(1) if date_m else ""
        name = text
        if date_m:
            name = text[:date_m.start()].strip().rstrip("–-—|,")

        # "Cert Name - Issuer" pattern
        parts = re.split(r"\s*[-–—]\s*", name, maxsplit=1)
        if len(parts) == 2:
            entries.append(CertificationEntry(name=parts[0].strip(), issuer=parts[1].strip(), date=date_str))
        else:
            entries.append(CertificationEntry(name=name, date=date_str))

    return entries


# ── Helpers ──────────────────────────────────────────────────────────────────

def _body_size(lines: list[dict]) -> float:
    counts: dict[float, int] = {}
    for l in lines:
        s = l["size"]
        counts[s] = counts.get(s, 0) + len(l["text"])
    return max(counts, key=counts.get) if counts else 11.0


def _is_heading(text: str, size: float, bold: bool, body_size: float) -> bool:
    stripped = text.strip().rstrip(":")
    if len(stripped) > 60 or not stripped or not any(c.isalpha() for c in stripped):
        return False
    lower = stripped.lower()
    if lower in _ALL_HEADING_KEYWORDS:
        return True
    if size > body_size + 3 and len(stripped.split()) <= 6:
        return True
    if bold and stripped.isupper() and lower in _ALL_HEADING_KEYWORDS:
        return True
    return False


def _strip_bullet(text: str) -> str:
    return _BULLET_RE.sub("", text).strip()


def _join_texts(lines: list[dict]) -> str:
    return " ".join(l["text"].strip() for l in lines if l["text"].strip())
