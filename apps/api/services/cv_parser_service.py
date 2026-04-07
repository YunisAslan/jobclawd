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
from pathlib import Path
from typing import Optional

import httpx

from models.cv_schema import (
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
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 60.0

_SYSTEM_PROMPT = """\
You are a CV/resume parser. Given the raw text extracted from a CV document, \
produce a structured JSON representation.

Extract ALL information accurately. Do not infer or fabricate data — only \
include what is explicitly stated in the text.

Return JSON matching this exact schema:
{
  "personal_info": {
    "full_name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string (URL or profile path)",
    "portfolio": "string (URL)",
    "summary": "string (professional summary/objective if present)"
  },
  "experience": [
    {
      "company": "string",
      "title": "string (job title/role)",
      "location": "string",
      "start_date": "string (as written in CV)",
      "end_date": "string (as written, or 'Present')",
      "bullets": ["string (responsibility/achievement)"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "start_date": "string",
      "end_date": "string",
      "details": ["string (honors, GPA, relevant coursework, etc.)"]
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
      "level": "string (e.g. 'Native', 'Fluent', 'B2')"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string"
    }
  ],
  "additional_sections": {
    "section_name": ["string items"]
  }
}

Rules:
- If a section is not present in the CV, use an empty array [] or empty string "".
- For skills, group them by category when the CV provides categories. If skills \
are listed flat, use a single group with category "General".
- Preserve the original wording of bullet points — do not rephrase.
- For dates, keep the exact format used in the CV (e.g. "Jan 2020", "2020-01", "01/2020").
- additional_sections should capture sections like Projects, Volunteer Work, \
Publications, Awards, Interests, etc. that don't fit the main categories.
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
    return None


def _extract_pdf_text(filepath: Path) -> Optional[str]:
    try:
        import pdfplumber

        parts: list[str] = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text)
        return "\n".join(parts) if parts else None
    except Exception:
        return None


def _extract_docx_text(filepath: Path) -> Optional[str]:
    try:
        import docx

        doc = docx.Document(str(filepath))
        parts: list[str] = []
        for para in doc.paragraphs:
            if para.text.strip():
                parts.append(para.text.strip())
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))
        return "\n".join(parts) if parts else None
    except Exception:
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
        data.personal_info = PersonalInfo(
            full_name=pi.get("full_name", ""),
            email=pi.get("email", ""),
            phone=pi.get("phone", ""),
            location=pi.get("location", ""),
            linkedin=pi.get("linkedin", ""),
            portfolio=pi.get("portfolio", ""),
            summary=pi.get("summary", ""),
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
        ))

    # Additional sections
    additional = raw.get("additional_sections", {})
    if isinstance(additional, dict):
        for section_name, items in additional.items():
            if isinstance(items, list):
                data.additional_sections[section_name] = [
                    str(item) for item in items if item
                ]

    return data


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
