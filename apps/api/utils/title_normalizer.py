"""
Normalize a list of raw job titles into clean, canonical English forms using AI.
Similar roles (e.g. "PHP developer", "PHP Web Developer - Hybrid", "Full Stack Developer II (PHP)")
are collapsed under the same canonical name so analytics aren't fragmented.

Falls back to the original titles if the API call fails.
"""
import json
import os

import httpx

_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4o-mini")

_SYSTEM = """\
You are a job-title normalizer.

Given a JSON array of raw job titles (which may be in any language, contain work-mode
suffixes, seniority levels, or technology qualifiers), return a JSON object that maps
each original title to a single canonical English job title following these rules:

1. Translate non-English titles to English (or extract the English part from parentheses).
2. Remove work-mode suffixes: Remote, Hybrid, On-site, Contract, Part-time.
3. Remove seniority/level markers: Senior, Junior, Mid-Level, I, II, III, Lead, Staff.
4. Remove parenthetical technology qualifiers that appear after the core title
   e.g. "Full Stack Developer (PHP)" → "Full Stack Developer".
5. Collapse titles that describe the same role into ONE canonical name
   e.g. "PHP developer", "PHP Web Developer", "PHP Developer (Remote)" → "PHP Developer".
6. Keep genuinely different roles distinct (e.g. "Backend Developer" ≠ "Frontend Developer").
7. Use title-case for every canonical name.

Return ONLY the JSON object — no explanation, no markdown fences.\
"""


def normalize_titles(raw_counts: list[tuple[str, int]], api_key: str = "") -> list[tuple[str, int]]:
    """
    Accept [(title, count), ...] and return a merged list with canonical titles.
    Uses the caller's OpenAI key; if none is provided or normalization fails,
    the original list is returned unchanged.
    """
    if not raw_counts or not api_key:
        return raw_counts

    original_titles = [t for t, _ in raw_counts]
    # Nothing to normalise if there's only one unique title
    if len(original_titles) == 1:
        return raw_counts

    try:
        resp = httpx.post(
            f"{_OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _MODEL,
                "temperature": 0,
                "max_completion_tokens": 512,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": json.dumps(original_titles)},
                ],
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        raw_json = resp.json()["choices"][0]["message"]["content"].strip()
        mapping: dict[str, str] = json.loads(raw_json)
    except Exception:
        return raw_counts

    # Merge counts under canonical names
    merged: dict[str, int] = {}
    for title, count in raw_counts:
        canonical = mapping.get(title, title)
        merged[canonical] = merged.get(canonical, 0) + count

    return sorted(merged.items(), key=lambda x: x[1], reverse=True)
