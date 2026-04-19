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
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-5.4-nano").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_TIMEOUT = 45.0

_SYSTEM_PROMPT = """\
You are a professional CV writer. Given a job listing and a candidate's CV, generate specific, ready-to-paste improvements the candidate can apply directly to their CV.

## TRUTHFULNESS (most important)
- Work ONLY with experience, skills, projects, tools, metrics, and achievements that ALREADY appear in the candidate's CV. Never invent.
- Do NOT claim the candidate has used a framework, language, tool, or methodology that is not in their CV. If the job requires React and the CV shows only customer-service work, do NOT write "Built a React application" — that is fabrication.
- When a must-have requirement is genuinely missing, produce an honest transferable-skill bullet that reframes what the candidate HAS done in terms relevant to the role, or suggest learning via `description` only. Never write fictional experience into `suggested_text`.
- Numbers (percentages, counts, dollar amounts) must come from the CV. If the CV does not give a number, do not invent one.

## SUGGESTION CATEGORIES (use exactly these values)
- add_keywords: Add missing keywords/tools/technologies to the Skills section — ONLY keywords, never bullets or prose.
- rewrite_bullets: Rewrite a weak bullet already in the CV — must reference an existing bullet via `specific_text`.
- elevate_experience: Reframe existing experience the CV already has so it reads as more relevant — never fabricate new roles.
- reduce_irrelevant: Remove or shorten content — `specific_text` required.
- improve_headline: Rewrite the professional summary — ONLY summary prose.
- address_requirements: Transferable-skill bullet built from what the candidate HAS already done — never invented experience.

Each suggestion lives in exactly one category. Do not mix sections: keywords never appear as bullets; bullets never appear as summary text; summary text never appears as skills. Do not repeat the same keyword, bullet, or idea across multiple suggestions.

## FORMATTING RULES for `suggested_text` (strict)
1. It is FINAL CV TEXT — no instructions, meta-language, or phrases like "Add X", "Include X", "Consider adding X", "Mention X", "Highlight X".
2. For bullet categories (`rewrite_bullets`, `address_requirements`, `elevate_experience`): write ONE single, clear, complete sentence starting with an action verb. NEVER pack multiple bullets into one string. NEVER join sentences with bullet glyphs (■ ▪ ◆ ● ◼ • · – — > » |) or newlines. If you have two ideas, return two separate suggestions.
3. NEVER prefix bullets with ALL-CAPS labels like "FRONT-END PROJECTS", "RELEVANT EXPERIENCE", "KEY ACHIEVEMENTS". Bullets start with a verb, not a header.
4. For `add_keywords`: write ONLY short skill tokens, comma-separated. Each token ≤ 5 words. No full sentences. Example: "Kubernetes, Docker, Helm".
5. For `improve_headline`: ONE concise summary paragraph (2–3 sentences max). No bullets, no labels.
6. For `reduce_irrelevant`: set `specific_text` to the exact text to remove; `suggested_text` may be "" to remove entirely, or a shorter replacement.
7. Plain, concrete language. Avoid jargon pile-ups. A recruiter must understand it in one read.

## FIELDS
- category: one of the categories above
- priority: high/medium/low — high only when the gap is material to hire/no-hire
- title: concise action title
- description: 1–2 sentences explaining why this change helps for THIS job (never fabricate in description either)
- specific_text: exact verbatim text from the CV to replace (null only when the category genuinely adds new content — `add_keywords` or `address_requirements`)
- suggested_text: final ready-to-paste CV text (see formatting rules)

Return 8–12 distinct, non-overlapping suggestions, sorted by priority (high first). Fewer high-quality suggestions beat many repetitive ones. If the CV is fundamentally mismatched to the role (e.g. customer service CV for a senior frontend role), prefer `improve_headline` + honest transferable-skill bullets over fake experience.

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
        "temperature": 0,
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
