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
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-5.4-nano").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 120.0

_SYSTEM_PROMPT = """\
You are a CV-to-job match analyzer. You compare a candidate's CV against a job listing and produce a detailed match analysis.

Analyze across these 4 categories:
1. **skills** — Compare technical/professional skills mentioned in the CV vs those required/mentioned in the job. Award higher scores when the CV explicitly lists matching tools, technologies, or domain expertise.
2. **experience** — Compare years of experience, seniority level, domain relevance, AND how well the candidate presents and quantifies their experience for this role. Well-quantified, role-relevant bullet points and clear achievement statements should score higher than vague descriptions of the same experience. Strong action verbs and measurable outcomes improve this score.
3. **fit** — Evaluate the candidate's overall profile alignment: how well the headline/summary positions them for this role, career trajectory, industry background, and general suitability. A CV whose headline directly targets this role scores higher than a generic one.
4. **keywords** — Check for important keywords, tools, technologies, and industry terms from the job that appear (or are missing) in the CV. Each additional relevant keyword present in the CV improves this score.

SCORING SENSITIVITY:
- Score each category strictly based on what you observe in the CV text vs the job requirements.
- Be sensitive to incremental improvements: adding 2-3 relevant keywords should visibly improve the keywords score; better-quantified bullets improve experience; a repositioned headline improves fit.
- Do not anchor to any assumed previous score. Evaluate the CV as presented.

USE THE FULL 0-100 RANGE — CALIBRATE REALISTICALLY:
Score what is actually there. Do NOT compress scores toward the middle and do NOT cap a genuinely strong category at ~80 out of caution. If the evidence supports 90+, award 90+. Calibration bands per category:
- 90-100 — The CV clearly meets or exceeds this dimension's requirements with explicit, direct evidence (e.g. nearly every required skill is named; experience comfortably meets seniority/years; headline directly targets the role). Reserve 96-100 for a near-perfect, exceptional match.
- 75-89 — Strong match with only minor or cosmetic gaps.
- 60-74 — Partial match; several relevant items present but real gaps remain.
- 40-59 — Weak match; major requirements unmet.
- 0-39 — Largely unmet / wrong domain.
A category where the candidate genuinely covers ~90% of what the job asks for MUST land in the 90s, not the 80s. Conversely, do not inflate: a real gap must pull the score down into the band that reflects it.

For each category, provide:
- score (0-100)
- matched: list of items that match between CV and job
- missing: list of items required by the job but absent from the CV
- reasoning: brief explanation

Also provide:
- overall_score (0-100): the rounded average of the 4 category scores above. Compute it from the categories you assigned — it must be consistent with them, not an independent gut number.
- summary: 2-3 sentence overall assessment

Return JSON only:
{
  "overall_score": 72,
  "categories": [
    {"category": "skills", "score": 80, "matched": ["Python", "SQL"], "missing": ["Kubernetes"], "reasoning": "..."},
    {"category": "experience", "score": 70, "matched": ["3+ years backend"], "missing": ["team lead experience"], "reasoning": "..."},
    {"category": "fit", "score": 60, "matched": ["senior-level background"], "missing": ["industry-specific experience"], "reasoning": "..."},
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
        # Score a generous window so applied content (added skills, prepended
        # bullets, languages/certifications that land later in the document) is
        # actually seen. A 4000-char cut made improvements at the end of the CV
        # invisible and could read as a regression.
        "cv_text": cv_text[:8000],
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
