"""CV Suggestions Service — AI-powered CV optimization recommendations.

Analyzes job requirements vs CV content and generates prioritized, actionable suggestions.
"""
import asyncio
import json
import os
import re
from typing import Optional

import httpx

from services.cv_analysis_shared import prepare_cv_analysis_inputs

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 45.0

_SYSTEM_PROMPT = """\
You are a professional CV writer. Given a job listing and a candidate's CV, generate specific, ready-to-paste improvements the candidate can apply directly to their CV.

Suggestion categories (use exactly these values):
- add_keywords: Add missing keywords, tools, or technologies from the job description
- rewrite_bullets: Rewrite weak bullet points to better match job requirements
- elevate_experience: Move or highlight more relevant experience sections
- reduce_irrelevant: Remove or minimize irrelevant content that dilutes the CV
- improve_headline: Improve the CV headline/summary to align with the role
- address_requirements: Address specific must-have requirements the CV doesn't currently cover

Priority levels: high, medium, low

CRITICAL RULES for `suggested_text`:
1. It must be FINAL CV TEXT — ready to paste into the CV as-is. No instructions, no advice, no meta-language.
2. NEVER write phrases like "Add X to skills", "Include X", "Consider adding X", "Mention X", "Highlight X", "State willingness to...". These are instructions — forbidden.
3. For `add_keywords`: write ONLY the keyword(s) to add, comma-separated. Example: "Kubernetes, Docker, Helm"
4. For `rewrite_bullets`: write the complete rewritten bullet sentence. Example: "Reduced API response time by 40% through query optimisation and Redis caching."
5. For `improve_headline`: write the complete new summary paragraph. Example: "Frontend Developer with 3+ years building scalable React applications, experienced in Agile teams and CI/CD pipelines."
6. For `address_requirements` / `elevate_experience`: write a concrete bullet point or sentence ready to add to the CV. Example: "Familiar with Salesforce CRM and Dojo framework; completed internal training in legacy system migration."
7. For `reduce_irrelevant`: set `specific_text` to the exact text to remove; `suggested_text` can be empty string "" if removing entirely, or the shorter replacement.

For each suggestion provide:
- category: one of the categories above
- priority: high/medium/low
- title: concise action title (e.g. "Add Kubernetes to Skills")
- description: 1-2 sentences explaining why this change helps for this specific job
- specific_text: exact verbatim text from the CV to replace (null if adding new content)
- suggested_text: the final ready-to-paste CV text (NEVER instructions — see rules above)

Return 10-15 suggestions, sorted by priority (high first). Be thorough — cover keywords, bullet rewrites, headline, and experience gaps.

Return JSON only:
{
  "suggestions": [
    {
      "category": "add_keywords",
      "priority": "high",
      "title": "Add Kubernetes to Skills",
      "description": "The role requires container orchestration. Adding Kubernetes directly signals this capability.",
      "specific_text": null,
      "suggested_text": "Kubernetes, Helm, Container Orchestration"
    },
    {
      "category": "rewrite_bullets",
      "priority": "high",
      "title": "Quantify performance improvement bullet",
      "description": "Quantified results stand out to recruiters and ATS systems for this engineering role.",
      "specific_text": "Improved application performance",
      "suggested_text": "Reduced API response time by 40% through query optimisation and Redis caching, improving user retention by 15%."
    }
  ]
}"""


async def generate_cv_suggestions(job_url: str, cv_url: str) -> dict:
    """
    Generate prioritized CV optimization suggestions for a specific job.
    Returns a dict matching CVSuggestionsResponse shape.
    """
    cv_text, job_context, error = await prepare_cv_analysis_inputs(job_url, cv_url)
    if error or not cv_text or not job_context:
        return _empty_result(error or "Could not prepare suggestion inputs.")

    return await generate_cv_suggestions_from_data(job_context, cv_text)


async def generate_cv_suggestions_from_data(job_context: dict, cv_text: str) -> dict:
    """Generate suggestions using already prepared job context and CV text."""

    if not _OPENAI_API_KEY:
        return _empty_result("AI suggestions unavailable — no API key configured.")

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
            print(f"[CVSuggestions] AI error: {resp.status_code if resp else 'no response'}")
            return _empty_result("AI suggestion generation failed.")

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)

    valid_categories = {"add_keywords", "rewrite_bullets", "elevate_experience",
                        "reduce_irrelevant", "improve_headline", "address_requirements"}
    valid_priorities = {"high", "medium", "low"}

    suggestions = []
    for s in parsed.get("suggestions", []):
        cat = s.get("category", "")
        pri = s.get("priority", "medium")
        if cat not in valid_categories:
            cat = "add_keywords"
        if pri not in valid_priorities:
            pri = "medium"
        suggestions.append({
            "category": cat,
            "priority": pri,
            "title": s.get("title", ""),
            "description": s.get("description", ""),
            "specific_text": s.get("specific_text"),
            "suggested_text": s.get("suggested_text"),
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: priority_order.get(x["priority"], 1))

    return {
        "suggestions": suggestions,
        "total": len(suggestions),
        "job_title": job_context.get("title", ""),
        "job_company": job_context.get("company", ""),
    }


def _empty_result(reason: str) -> dict:
    return {
        "suggestions": [],
        "total": 0,
        "job_title": "",
        "job_company": "",
    }
