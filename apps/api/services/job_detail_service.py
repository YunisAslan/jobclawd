"""Enhanced Job Detail Service — wraps scraper with AI-powered structured understanding.

Adds: requirements, nice_to_haves, required_skills, required_experience, job_summary.
"""
import asyncio
import json
import os
import re
from typing import Optional

import httpx

from models.schemas import JobDetailResponse
from scraper.detail import scrape_job_detail

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-5.4-nano").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 30.0

_SYSTEM_PROMPT = """\
You extract structured requirements from a job posting. Read the job description and return JSON with:

1. **requirements**: list of must-have qualifications/requirements (strings)
2. **nice_to_haves**: list of nice-to-have/preferred qualifications (strings)
3. **required_skills**: list of specific skill/technology names required (strings)
4. **required_experience**: years/level of experience required (string, e.g. "3-5 years" or "Senior level"), null if unclear
5. **job_summary**: 2-3 sentence summary of what the role involves and what makes a strong candidate

Return JSON only:
{
  "requirements": ["3+ years Python experience", "CS degree or equivalent"],
  "nice_to_haves": ["Experience with Kubernetes", "Open source contributions"],
  "required_skills": ["Python", "PostgreSQL", "Docker"],
  "required_experience": "3-5 years",
  "job_summary": "..."
}"""


async def get_enhanced_job_detail(url: str) -> JobDetailResponse:
    """Fetch job detail via scraper, then enhance with AI-extracted structure."""
    detail = await scrape_job_detail(url)

    # Only attempt AI enhancement if we have meaningful description text
    if detail.description and len(detail.description) > 100 and _OPENAI_API_KEY:
        try:
            structured = await _extract_structured_requirements(
                detail.title, detail.company, detail.description
            )
            if structured:
                detail = JobDetailResponse(
                    **{
                        **detail.model_dump(),
                        **structured,
                    }
                )
        except Exception as e:
            print(f"[JobDetail] AI enhancement failed: {e}")

    return detail


async def _extract_structured_requirements(
    title: str, company: str, description: str
) -> Optional[dict]:
    """Call AI to extract structured requirements from job description."""
    user_message = json.dumps({
        "title": title,
        "company": company,
        "description": description[:3000],
    }, ensure_ascii=False)

    headers = {
        "Authorization": f"Bearer {_OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _OPENAI_MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
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
            wait = float(retry_match.group(1)) + 0.5 if retry_match else (2 ** attempt) * 2
            await asyncio.sleep(wait)

        if resp is None or resp.status_code >= 400:
            return None

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)

    return {
        "requirements": parsed.get("requirements", []),
        "nice_to_haves": parsed.get("nice_to_haves", []),
        "required_skills": parsed.get("required_skills", []),
        "required_experience": parsed.get("required_experience"),
        "job_summary": parsed.get("job_summary"),
    }
