"""CV Match Service — detailed CV-to-job match analysis using AI.

Orchestrates: fetch job metadata + description → extract CV text → run AI comparison.
"""
import asyncio
import json
import os
import re
from typing import Optional

import httpx

from models.schemas import MatchLevel
from services.cv_analysis_shared import prepare_cv_analysis_inputs

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 120.0

_SYSTEM_PROMPT = """\
You are a CV-to-job match analyzer. You compare a candidate's CV against a job listing and produce a detailed match analysis.

Analyze across these 4 categories:
1. **skills** — Compare technical/professional skills mentioned in the CV vs those required/mentioned in the job.
2. **experience** — Compare years of experience, seniority level, and domain relevance.
3. **education** — Compare educational qualifications, degrees, and certifications.
4. **keywords** — Check for important keywords, tools, technologies, and industry terms from the job that appear (or are missing) in the CV.

For each category, provide:
- score (0-100)
- matched: list of items that match between CV and job
- missing: list of items required by the job but absent from the CV
- reasoning: brief explanation

Also provide:
- overall_score (0-100): weighted average reflecting how well this CV fits the job
- summary: 2-3 sentence overall assessment

Return JSON only:
{
  "overall_score": 72,
  "categories": [
    {"category": "skills", "score": 80, "matched": ["Python", "SQL"], "missing": ["Kubernetes"], "reasoning": "..."},
    {"category": "experience", "score": 70, "matched": ["3+ years backend"], "missing": ["team lead experience"], "reasoning": "..."},
    {"category": "education", "score": 60, "matched": ["CS degree"], "missing": [], "reasoning": "..."},
    {"category": "keywords", "score": 75, "matched": ["REST API", "CI/CD"], "missing": ["Terraform"], "reasoning": "..."}
  ],
  "summary": "..."
}"""


async def compute_cv_match(job_url: str, cv_url: str) -> dict:
    """
    Analyze how well a CV matches a specific job.
    Returns a dict matching CVMatchResponse shape.
    """
    cv_text, job_context, error = await prepare_cv_analysis_inputs(job_url, cv_url)
    if error or not cv_text or not job_context:
        return _empty_result(error or "Could not prepare analysis inputs.")

    return await compute_cv_match_from_data(job_context, cv_text, deterministic=True)


async def compute_cv_match_from_data(job_context: dict, cv_text: str, deterministic: bool = False) -> dict:
    """Analyze CV match using already prepared job context and CV text."""

    if not _OPENAI_API_KEY:
        return _empty_result("AI analysis unavailable — no API key configured.")

    user_message = json.dumps({
        "job": job_context,
        "cv_text": cv_text[:4000],
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
    if deterministic:
        payload["temperature"] = 0

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
            print(f"[CVMatch] AI error: {resp.status_code if resp else 'no response'}")
            return _empty_result("AI analysis failed.")

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)

    overall = parsed.get("overall_score", 0)
    if overall >= 75:
        level = MatchLevel.high
    elif overall >= 45:
        level = MatchLevel.review
    else:
        level = MatchLevel.trash

    categories = []
    for cat in parsed.get("categories", []):
        categories.append({
            "category": cat.get("category", ""),
            "score": cat.get("score", 0),
            "matched": cat.get("matched", []),
            "missing": cat.get("missing", []),
            "reasoning": cat.get("reasoning", ""),
        })

    return {
        "overall_score": overall,
        "match_level": level.value,
        "categories": categories,
        "summary": parsed.get("summary", ""),
    }


def _empty_result(reason: str) -> dict:
    return {
        "overall_score": 0,
        "match_level": MatchLevel.trash.value,
        "categories": [],
        "summary": reason,
    }
