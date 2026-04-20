"""Structured CV parser — LLM-based extraction into CVData schema.

Extracts text from PDF/DOCX using pdfplumber/python-docx, then sends the
raw text to an LLM (OpenAI-compatible) with structured output to produce
a clean CVData JSON representation.

This replaces the old heuristic/regex-based parser with high-accuracy
LLM extraction that handles any layout, language, or formatting.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import httpx

from models.cv_schema import (
    AdditionalEntry,
    CVData,
    CertificationEntry,
    EducationEntry,
    ExperienceEntry,
    LanguageEntry,
    PersonalInfo,
    SkillGroup,
)

# ── LLM config (reuses the same env vars as other AI services) ──────────────

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-5.4-nano").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 60.0

_SYSTEM_PROMPT = """\
You are a CV/resume parser. Given the raw text extracted from a CV document, \
produce a structured JSON representation.

Extract ALL information accurately. Do not infer or fabricate data — only \
include what is explicitly stated in the text.

The text may contain inline hyperlinks written as `[visible text](url)` and a \
trailing `[LINKS]` block listing every clickable URL found in the source PDF. \
Treat those URLs as first-class data: attach the URL that belongs to each \
field or entry into its `*_link` / `link` slot. Do NOT put the raw URL into \
the visible text field — keep the visible text clean and put the URL in its \
own link field.

Return JSON matching this exact schema:
{
  "personal_info": {
    "full_name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string (URL or profile path as displayed on CV)",
    "portfolio": "string (URL or domain as displayed on CV)",
    "summary": "string (professional summary/objective if present)",
    "email_link": "string (mailto:... from the PDF, or empty)",
    "phone_link": "string (tel:... from the PDF, or empty)",
    "linkedin_link": "string (full https URL from the PDF, or empty)",
    "portfolio_link": "string (full https URL from the PDF, or empty)"
  },
  "experience": [
    {
      "company": "string",
      "title": "string (job title/role)",
      "location": "string",
      "start_date": "string (as written in CV)",
      "end_date": "string (as written, or 'Present')",
      "bullets": ["string (responsibility/achievement)"],
      "link": "string (URL attached to this entry, or empty)"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "start_date": "string",
      "end_date": "string",
      "details": ["string (honors, GPA, relevant coursework, etc.)"],
      "link": "string (URL attached to this entry, or empty)"
    }
  ],
  "skills": [
    {
      "category": "string (e.g. 'Programming Languages', 'Frameworks', 'Tools')",
      "items": ["string"]
    }
  ],
  "languages": [
    {
      "language": "string",
      "level": "string (e.g. 'Native', 'Fluent', 'B2', or the full phrase the CV uses)"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string",
      "link": "string (URL attached to this cert, or empty)"
    }
  ],
  "additional_sections": {
    "Section Name": [
      {
        "title": "string (the bold/primary label of the entry, e.g. 'Dean\\u2019s List', 'Habitat for Humanity'). Empty string if the section is a flat list with no titled entries.",
        "subtitle": "string (secondary label on the same header row — e.g. 'ABC College', 'Los Angeles, CA', or a kind-of descriptor like 'Non-Profit Organization'). Join multiple secondary parts with ' · '.",
        "date": "string (date or date range sitting on the header row)",
        "bullets": ["string (description bullets underneath the header row)"],
        "link": "string (URL attached to this entry, or empty)"
      }
    ]
  },
  "section_order": ["string — all section keys in the exact order they appear in the source document. Use these fixed keys for built-in sections: personal_info, experience, education, skills, languages, certifications. For additional_sections use the exact heading key string."]
}

Rules:
- If a section is not present in the CV, use an empty array [] or empty string "".
- For skills, group them by category when the CV provides categories. If skills \
are listed flat, use a single group with category "General".
- Preserve the original wording of bullet points — do not rephrase.
- For dates, keep the exact format used in the CV (e.g. "Jan 2020", "2020-01", "01/2020").
- `additional_sections` captures sections that don't fit the main categories: \
Volunteer Experience, Awards and Honors, Publications, Professional Memberships, \
Projects, Interests, etc.
- **Preserve the original hierarchy inside `additional_sections`**: lines in \
the extracted text are normalised so that **sub-bullet lines start with '• '** \
and **title / header lines have NO leading '• '**. Use that signal as ground \
truth:
    - A line with no '• ' prefix is a header row (title + optional subtitle + \
optional date). Typical patterns: "Dean\u2019s List - ABC College 12/2018 and 05/2019", \
"Habitat for Humanity - Los Angeles, CA 05/2019 \u2013 PRESENT", or a \
continuation line right under it giving a descriptor like "Non-Profit Organization".
    - A line that starts with '• ' is a description bullet belonging to the \
most-recent header above it. Put its text (without the '• ') into that \
entry's `bullets` array.
    - Split the header row into `title` (bold primary label), `subtitle` \
(secondary label — location, institution, category; join multiple with ' \u00B7 '), \
and `date` (trailing date or date range). Never leave the full header line in \
`title` verbatim — always split out the date and secondary label.
    - Never duplicate a header line as its own bullet.
- If a section is a flat bulleted list where each line is a standalone item \
with no sub-bullets beneath (e.g. "Professional Memberships": \
"Professional Customer Service Association (08/2019 \u2013 PRESENT)" on its \
own), emit one entry per line with `title` set to the item text (without its \
parenthetical date) and `date` set to the trailing parenthetical content \
(without the parentheses); `subtitle` and `bullets` stay empty. This signals \
the renderer to display it as a plain bullet: "• Title (Date)" — no bold, no \
separate date column.
- **Section name capitalisation**: copy the heading text **exactly** as it \
appears in the source document. If the document says "AWARDS AND HONORS" write \
that; if it says "Awards and Honors" write that. Do not normalise case.
- `section_order`: list every section key that has content in the order it \
appears in the document. Always start with "personal_info". Include a built-in \
key only when that section has data (skip empty sections). The order in this \
array is the final render order.
- Languages: produce one entry per language, even if the CV lists them inline \
as a comma-separated paragraph.
- Links: for each piece of text that came through with a `[text](url)` marker, \
OR whose URL appears in the `[LINKS]` block and semantically belongs to it, set \
the URL on the matching `*_link` / `link` field. Never invent a URL.
- Return ONLY valid JSON, no markdown fences or extra text."""


# ── Public API ───────────────────────────────────────────────────────────────

async def parse_cv(filepath: Path) -> Optional[CVData]:
    """Parse a PDF or DOCX file into structured CVData using LLM extraction."""
    text = _extract_text(filepath)
    if not text or len(text.strip()) < 30:
        return None

    raw_json = await _llm_extract(text)
    if not raw_json:
        return None

    return _json_to_cv_data(raw_json)


def parse_cv_sync(filepath: Path) -> Optional[CVData]:
    """Synchronous wrapper — extracts text and calls LLM.

    For use in contexts where async isn't available.
    Falls back to basic regex extraction if LLM is unavailable.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in async context — can't use run_until_complete
            # Fall back to basic extraction
            return _fallback_parse(filepath)
        return loop.run_until_complete(parse_cv(filepath))
    except RuntimeError:
        return asyncio.run(parse_cv(filepath))


# ── Text extraction (reuses pdfplumber / python-docx) ────────────────────────

def _extract_text(filepath: Path) -> Optional[str]:
    """Extract raw text from PDF or DOCX."""
    ext = filepath.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf_text(filepath)
    elif ext == ".docx":
        return _extract_docx_text(filepath)
    elif ext == ".doc":
        return _extract_doc_text(filepath)
    return None


_BULLET_GLYPHS = "\u25A0\u25A1\u25AA\u25AB\u25CB\u25CF\u25E6\u2022\u2023\u2043\u2219\u2610\u2611\u2612\u25B2\u25B6\u25BA\u25C6\u25C7\uF0B7\uF0A7\uF0FC\u0007"
_LEADING_BULLET_RE = re.compile(
    rf"^([\s\u00A0]*)(?:[{_BULLET_GLYPHS}]+|[\*\u2013\u2014]|\-(?=\s))[\s\u00A0]*",
)


def _normalize_bullet_markers(text: str) -> str:
    """Normalise leading list markers on each line to a single '• '.

    PDF fonts with no ToUnicode map hand back bullets as squares ('\u25A0'),
    Symbol-font PUAs ('\uF0B7'), etc. These are not decoration — they
    carry structural meaning (this line is a sub-bullet of the previous
    titled row), so we normalise them to '• ' instead of stripping, so the
    LLM can tell titles from bullets reliably. Lines with no marker are
    left alone so a title row stays a title row.
    """
    out: list[str] = []
    for raw in text.splitlines():
        # Apply repeatedly for nested cases like "• ■ item".
        prev = None
        cleaned = raw
        replaced = False
        while cleaned != prev:
            prev = cleaned
            m = _LEADING_BULLET_RE.match(cleaned)
            if m:
                cleaned = cleaned[m.end():]
                replaced = True
        if replaced:
            out.append(f"• {cleaned}".rstrip())
        else:
            out.append(raw)
    return "\n".join(out)


def _extract_pdf_text(filepath: Path) -> Optional[str]:
    try:
        import pdfplumber

        parts: list[str] = []
        link_lines: list[str] = []
        url_pattern = re.compile(r"https?://[^\s\"'<>)\]]+", re.IGNORECASE)

        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text)

                # Collect clickable URI annotations on this page. pdfplumber
                # exposes them via `.hyperlinks` (and sometimes `.annots`).
                found: list[tuple[str, str]] = []

                for link in getattr(page, "hyperlinks", []) or []:
                    uri = (link.get("uri") or link.get("URI") or "").strip()
                    if not uri:
                        continue
                    visible = _text_in_bbox(page, link).strip()
                    found.append((visible, uri))

                for annot in getattr(page, "annots", []) or []:
                    data = annot.get("data") or {}
                    action = data.get("A") or {}
                    uri = (action.get("URI") or "").strip()
                    if not uri:
                        continue
                    visible = _text_in_bbox(page, annot).strip()
                    found.append((visible, uri))

                # Add plain-text URLs that aren't already annotated.
                if page_text:
                    for match in url_pattern.finditer(page_text):
                        url = match.group(0).rstrip(".,;:)")
                        found.append((url, url))

                for visible, uri in found:
                    # Keep each visible→uri pair on its own line so the LLM
                    # can tie it back to the section it came from.
                    label = visible or uri
                    link_lines.append(f"[{label}]({uri})")

        body = _normalize_bullet_markers("\n".join(parts))
        if link_lines:
            dedup = sorted(set(link_lines))
            body = f"{body}\n\n[LINKS]\n" + "\n".join(dedup)
        return body if body.strip() else None
    except Exception:
        return None


def _text_in_bbox(page, link_like) -> str:
    """Best-effort text extraction for a PDF annotation's bounding box."""
    try:
        x0 = link_like.get("x0")
        top = link_like.get("top")
        x1 = link_like.get("x1")
        bottom = link_like.get("bottom")
        if None in (x0, top, x1, bottom):
            return ""
        cropped = page.within_bbox((x0, top, x1, bottom))
        return (cropped.extract_text() or "").replace("\n", " ").strip()
    except Exception:
        return ""


def _extract_docx_text(filepath: Path) -> Optional[str]:
    try:
        import docx
        from docx.oxml.ns import qn

        doc = docx.Document(str(filepath))
        parts: list[str] = []

        # Build id→target map for hyperlink relationships once.
        rel_targets: dict[str, str] = {}
        try:
            for rel_id, rel in doc.part.rels.items():
                if "hyperlink" in (rel.reltype or "").lower():
                    rel_targets[rel_id] = rel.target_ref
        except Exception:
            pass

        def _para_with_links(paragraph) -> str:
            if not rel_targets:
                return paragraph.text.strip()
            chunks: list[str] = []
            for child in paragraph._p.iter():
                tag = child.tag
                if tag == qn("w:hyperlink"):
                    rid = child.get(qn("r:id"))
                    target = rel_targets.get(rid, "") if rid else ""
                    visible = "".join(t.text or "" for t in child.iter(qn("w:t")))
                    if visible:
                        chunks.append(f"[{visible}]({target})" if target else visible)
                elif tag == qn("w:t"):
                    # Skip text nodes already inside a hyperlink (handled above).
                    parent = child.getparent()
                    if parent is not None and parent.tag == qn("w:hyperlink"):
                        continue
                    if child.text:
                        chunks.append(child.text)
            joined = "".join(chunks).strip()
            return joined or paragraph.text.strip()

        for para in doc.paragraphs:
            text = _para_with_links(para)
            if text:
                parts.append(text)
        for table in doc.tables:
            for row in table.rows:
                cells: list[str] = []
                for cell in row.cells:
                    cell_lines = [_para_with_links(p) for p in cell.paragraphs]
                    cell_text = " ".join(x for x in cell_lines if x).strip()
                    if cell_text:
                        cells.append(cell_text)
                if cells:
                    parts.append(" | ".join(cells))
        return _normalize_bullet_markers("\n".join(parts)) if parts else None
    except Exception:
        return None


def _extract_doc_text(filepath: Path) -> Optional[str]:
    extractors = (
        ["antiword", str(filepath)],
        ["catdoc", str(filepath)],
        ["textutil", "-convert", "txt", "-stdout", str(filepath)],
    )

    for cmd in extractors:
        if not shutil.which(cmd[0]):
            continue
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
            if result.returncode == 0 and result.stdout.strip():
                return _normalize_bullet_markers(result.stdout.strip())
        except Exception:
            continue

    office_cmd = shutil.which("soffice") or shutil.which("lowriter")
    if office_cmd:
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                result = subprocess.run(
                    [
                        office_cmd,
                        "--headless",
                        "--convert-to",
                        "txt:Text",
                        "--outdir",
                        temp_dir,
                        str(filepath),
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=False,
                )
                if result.returncode == 0:
                    txt_path = Path(temp_dir) / f"{filepath.stem}.txt"
                    if txt_path.exists():
                        text = txt_path.read_text(errors="ignore").strip()
                        if text:
                            return _normalize_bullet_markers(text)
        except Exception:
            pass

    return None


# ── LLM extraction ───────────────────────────────────────────────────────────

async def _llm_extract(cv_text: str) -> Optional[dict]:
    """Send CV text to LLM and get structured JSON back."""
    if not _OPENAI_API_KEY:
        return None

    # Truncate very long CVs to stay within token limits
    truncated = cv_text[:8000]

    headers = {
        "Authorization": f"Bearer {_OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _OPENAI_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": truncated},
        ],
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = None
        for attempt in range(3):
            resp = await client.post(
                f"{_OPENAI_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 429:
                break
            retry_match = re.search(r"try again in (\d+(?:\.\d+)?)s", resp.text)
            if retry_match:
                import asyncio
                await asyncio.sleep(float(retry_match.group(1)) + 0.5)
            else:
                import asyncio
                await asyncio.sleep(2 * (attempt + 1))

        if not resp or resp.status_code != 200:
            return None

        try:
            body = resp.json()
            content = body["choices"][0]["message"]["content"]
            return json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError):
            return None


# ── JSON → CVData mapping ────────────────────────────────────────────────────

def _json_to_cv_data(raw: dict) -> CVData:
    """Map the LLM's JSON output to our CVData Pydantic model."""
    data = CVData()

    # Personal info
    pi = raw.get("personal_info", {})
    if isinstance(pi, dict):
        email    = (pi.get("email", "") or "").strip()
        phone    = (pi.get("phone", "") or "").strip()
        linkedin = (pi.get("linkedin", "") or "").strip()
        portfolio = (pi.get("portfolio", "") or "").strip()

        # Use the LLM-extracted link if present, otherwise auto-resolve from text.
        email_link = (pi.get("email_link") or "").strip() or (
            f"mailto:{email}" if email else ""
        )
        phone_link = (pi.get("phone_link") or "").strip() or (
            f"tel:{phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')}"
            if phone else ""
        )
        linkedin_link = (pi.get("linkedin_link") or "").strip() or _resolve_url_linkedin(linkedin)
        portfolio_link = (pi.get("portfolio_link") or "").strip() or _resolve_url_portfolio(portfolio)

        data.personal_info = PersonalInfo(
            full_name=pi.get("full_name", ""),
            email=email,
            phone=phone,
            location=pi.get("location", ""),
            linkedin=linkedin,
            portfolio=portfolio,
            summary=pi.get("summary", ""),
            email_link=email_link,
            phone_link=phone_link,
            linkedin_link=linkedin_link,
            portfolio_link=portfolio_link,
        )

    # Experience
    for entry in raw.get("experience", []):
        if not isinstance(entry, dict):
            continue
        data.experience.append(ExperienceEntry(
            company=entry.get("company", ""),
            title=entry.get("title", ""),
            location=entry.get("location", ""),
            start_date=entry.get("start_date", ""),
            end_date=entry.get("end_date", ""),
            bullets=entry.get("bullets", []),
            link=entry.get("link", "") or "",
        ))

    # Education
    for entry in raw.get("education", []):
        if not isinstance(entry, dict):
            continue
        data.education.append(EducationEntry(
            institution=entry.get("institution", ""),
            degree=entry.get("degree", ""),
            field_of_study=entry.get("field_of_study", ""),
            start_date=entry.get("start_date", ""),
            end_date=entry.get("end_date", ""),
            details=entry.get("details", []),
            link=entry.get("link", "") or "",
        ))

    # Skills
    for group in raw.get("skills", []):
        if not isinstance(group, dict):
            continue
        data.skills.append(SkillGroup(
            category=group.get("category", ""),
            items=group.get("items", []),
        ))

    # Languages
    for entry in raw.get("languages", []):
        if not isinstance(entry, dict):
            continue
        data.languages.append(LanguageEntry(
            language=entry.get("language", ""),
            level=entry.get("level", ""),
        ))

    # Certifications
    for entry in raw.get("certifications", []):
        if not isinstance(entry, dict):
            continue
        data.certifications.append(CertificationEntry(
            name=entry.get("name", ""),
            issuer=entry.get("issuer", ""),
            date=entry.get("date", ""),
            link=entry.get("link", "") or "",
        ))

    # Additional sections (structured entries; tolerate legacy list[str])
    additional = raw.get("additional_sections", {})
    if isinstance(additional, dict):
        for section_name, items in additional.items():
            if not isinstance(items, list):
                continue
            entries: list[AdditionalEntry] = []
            for item in items:
                if isinstance(item, str):
                    text = item.strip()
                    if text:
                        entries.append(AdditionalEntry(bullets=[text]))
                elif isinstance(item, dict):
                    entries.append(AdditionalEntry(
                        title=item.get("title", "") or "",
                        subtitle=item.get("subtitle", "") or "",
                        date=item.get("date", "") or "",
                        bullets=[b for b in item.get("bullets", []) if b],
                        link=item.get("link", "") or "",
                    ))
            if entries:
                data.additional_sections[str(section_name)] = entries

    # Section order
    raw_order = raw.get("section_order", [])
    if isinstance(raw_order, list):
        data.section_order = [str(s) for s in raw_order if s]

    return data


# ── URL helpers for personal-info link resolution ────────────────────────────

def _resolve_url_linkedin(value: str) -> str:
    v = value.strip()
    if not v:
        return ""
    if v.startswith("http://") or v.startswith("https://"):
        return v
    if v.startswith("www."):
        return f"https://{v}"
    if v.startswith("linkedin.com"):
        return f"https://{v}"
    # bare handle like "in/sallysmith" or "sallysmith"
    return f"https://linkedin.com/in/{v.removeprefix('in/')}"


def _resolve_url_portfolio(value: str) -> str:
    v = value.strip()
    if not v:
        return ""
    if v.startswith("http://") or v.startswith("https://"):
        return v
    if "." in v:
        return f"https://{v}"
    return ""


# ── Fallback parser (basic regex, no LLM) ───────────────────────────────────

def _fallback_parse(filepath: Path) -> Optional[CVData]:
    """Minimal regex-based fallback when LLM is unavailable.

    Extracts only personal info (name, email, phone, LinkedIn) from
    the raw text. All other sections will be empty — the user can
    fill them in via the structured editor.
    """
    text = _extract_text(filepath)
    if not text:
        return None

    data = CVData()
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Name: assume first non-empty line
    if lines:
        data.personal_info.full_name = lines[0]

    # Email
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    if email_match:
        data.personal_info.email = email_match.group()

    # Phone
    phone_match = re.search(
        r"(?:\+?\d{1,4}[\s\-.]?)?"
        r"(?:\(?\d{1,5}\)?[\s\-.]?)?"
        r"\d[\d\s\-.]{5,14}\d",
        text,
    )
    if phone_match:
        data.personal_info.phone = phone_match.group().strip()

    # LinkedIn
    linkedin_match = re.search(
        r"(?:https?://)?(?:www\.)?linkedin\.com/in/[^\s,]+", text, re.I
    )
    if linkedin_match:
        data.personal_info.linkedin = linkedin_match.group()

    return data
