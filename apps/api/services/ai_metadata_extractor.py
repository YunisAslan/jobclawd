import json
import os
from typing import Optional

import httpx

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

_AI_METADATA_DEBUG = os.getenv("AI_METADATA_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
_TIMEOUT = 30.0
_BATCH_SIZE = 25

_ALLOWED_WORK_MODES = ["Remote", "Hybrid", "On-site"]
_ALLOWED_JOB_TYPES = [
    "Full-time", "Part-time", "Contract", "Freelance",
    "Temporary", "Internship", "Seasonal", "Commission",
]

_SYSTEM_PROMPT = """\
Extract job metadata from each job's text. Return JSON only.

CRITICAL RULE: If a field is NOT explicitly mentioned, return null. Do NOT guess or infer.

LANGUAGE: Job texts can be in ANY language. Understand the meaning regardless of language. Always return values normalized to English.

EXTRACTION RULES:

1. experience_str — extract ONLY if explicitly stated:
   - Title keywords like Senior/Lead/Mid-level/Junior/Intern (in any language) → use the English equivalent
   - Explicit years requirement like "3+ years experience", "Minimum 1 year", "2-3 years" (in any language) → normalize to English: "1+ years", "2-3 years", "5 years"
   - Examples: "Minimum 1 il iş təcrübəsi" → "1+ years", "от 3 лет опыта" → "3+ years", "en az 2 yıl" → "2+ years"
   - If NONE of the above appear → null

2. work_mode_str — THIS IS THE STRICTEST FIELD. Extract ONLY if there is a clear, unambiguous statement about WHERE the person works:
   - The text explicitly says the employee works remotely: "remote position", "work from home", "WFH", "fully remote", "remote work" → "Remote"
   - The text explicitly says hybrid: "hybrid work", "hybrid model" → "Hybrid"
   - The text explicitly says on-site: "on-site", "in-office", "office-based" → "On-site"
   - DO NOT extract "Remote" from:
     * The word "distant" used as a tag/category label
     * Job board metadata or category badges
     * Mentions of "remote access", "remote team", "remote support", "remote tools"
     * A city name or office address
   - When in doubt, return null. It is MUCH better to return null than to guess wrong.
   - If no clear work arrangement is stated → null

3. job_type_str — extract ONLY if the text explicitly states employment type:
   - Full-time, Part-time, Contract, Freelance, Internship, Temporary (in any language) → use the English equivalent
   - If the word appears inside a meaningful phrase (e.g. "full-time work experience", "full-time position") it still counts
   - If no employment type is mentioned → null. Do NOT default to Full-time.

4. salary_str — extract ONLY if explicit numbers with currency appear:
   - "$80k-$120k", "1500-2000 AZN", "от 50000 руб" → use as-is, keep short
   - If no salary numbers → null

5. IGNORE company history ("founded in 1999", "50 years in business") — these are NOT candidate experience requirements.

Return: {"results": [{"id": "...", "salary_str": "..."|null, "job_type_str": "..."|null, "experience_str": "..."|null, "work_mode_str": "..."|null}]}"""


def _normalize_optional_text(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split()).strip()
    return cleaned or None


def _normalize_work_mode(value: object) -> Optional[str]:
    cleaned = _normalize_optional_text(value)
    if not cleaned:
        return None
    lowered = cleaned.lower().replace("_", "-")
    if lowered in {"remote", "work from home", "wfh"}:
        return "Remote"
    if lowered in {"hybrid"}:
        return "Hybrid"
    if lowered in {"on-site", "onsite", "on site", "in-person", "in person"}:
        return "On-site"
    return cleaned if cleaned in _ALLOWED_WORK_MODES else None


def _normalize_job_type(value: object) -> Optional[str]:
    cleaned = _normalize_optional_text(value)
    if not cleaned:
        return None
    lowered = cleaned.lower().replace("_", "-")
    aliases = {
        "full-time": "Full-time", "full time": "Full-time",
        "part-time": "Part-time", "part time": "Part-time",
        "contract": "Contract", "contractor": "Contract",
        "freelance": "Freelance",
        "temporary": "Temporary", "temp": "Temporary",
        "internship": "Internship", "intern": "Internship",
        "seasonal": "Seasonal", "commission": "Commission",
    }
    normalized = aliases.get(lowered)
    if normalized:
        return normalized
    return cleaned if cleaned in _ALLOWED_JOB_TYPES else None


def _normalize_result(item: dict) -> dict:
    return {
        "salary_str": _normalize_optional_text(item.get("salary_str")),
        "job_type_str": _normalize_job_type(item.get("job_type_str")),
        "experience_str": _normalize_optional_text(item.get("experience_str")),
        "work_mode_str": _normalize_work_mode(item.get("work_mode_str")),
    }


def _chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def ai_metadata_enabled() -> bool:
    return bool(_OPENAI_API_KEY)


def _build_user_message(batch: list[dict]) -> str:
    """Compact user message — send structured fields so AI can read title/location separately."""
    jobs = []
    for item in batch:
        entry: dict = {"id": item["id"]}
        if item.get("title"):
            entry["title"] = item["title"]
        if item.get("company"):
            entry["company"] = item["company"]
        if item.get("location_str"):
            entry["location"] = item["location_str"]
        # Combine snippet + detail_text into one text field, trimmed
        text_parts = [item.get("snippet", ""), item.get("detail_text", "")]
        text = " ".join(p for p in text_parts if p).strip()
        if text:
            if len(text) > 2500:
                text = text[:1500] + " ... " + text[-800:]
            entry["text"] = text
        jobs.append(entry)
    return json.dumps({"jobs": jobs}, ensure_ascii=False)


async def extract_metadata_ai_batch(
    items: list[dict], *, source: str, context: str
) -> dict[str, dict]:
    """
    Extract metadata via OpenAI for a batch of jobs.
    Each item: {"id", "title", "company", "location_str", "snippet", "detail_text"}
    Returns: {"id": {"salary_str", "job_type_str", "experience_str", "work_mode_str"}}
    """
    if not ai_metadata_enabled():
        print(
            f"[AIMetadata] Skipped — no API key "
            f"(source={source} context={context} jobs={len(items)})"
        )
        return {}
    if not items:
        return {}

    print(
        f"[AIMetadata] Start — model={_OPENAI_MODEL} source={source} "
        f"context={context} jobs={len(items)}"
    )

    results: dict[str, dict] = {}
    headers = {
        "Authorization": f"Bearer {_OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    batch_num = 0
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for batch in _chunk(items, _BATCH_SIZE):
            batch_num += 1
            user_msg = _build_user_message(batch)
            payload = {
                "model": _OPENAI_MODEL,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            }

            if _AI_METADATA_DEBUG:
                print(
                    f"[AIMetadataDebug] batch={batch_num} "
                    f"user_msg_len={len(user_msg)} user_msg={user_msg[:3000]}"
                )

            try:
                print(f"[AIMetadata] Batch {batch_num} sending {len(batch)} jobs...")
                resp = await client.post(
                    f"{_OPENAI_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if resp.status_code >= 400:
                    print(
                        f"[AIMetadata] Batch {batch_num} ERROR "
                        f"{resp.status_code}: {resp.text[:500]}"
                    )
                    continue

                data = resp.json()
                usage = data.get("usage", {})
                content = data["choices"][0]["message"]["content"]

                if _AI_METADATA_DEBUG:
                    print(f"[AIMetadataDebug] batch={batch_num} response={content[:3000]}")

                parsed = json.loads(content)
                batch_results = {
                    item_id: _normalize_result(raw)
                    for raw in parsed.get("results", [])
                    if (item_id := str(raw.get("id", "")).strip())
                }
                results.update(batch_results)

                # Summary
                filled = {
                    "salary_str": 0,
                    "job_type_str": 0,
                    "experience_str": 0,
                    "work_mode_str": 0,
                }
                for meta in batch_results.values():
                    for f in filled:
                        if meta.get(f):
                            filled[f] += 1

                tokens = ""
                if usage:
                    tokens = (
                        f" tokens={usage.get('prompt_tokens', '?')}"
                        f"+{usage.get('completion_tokens', '?')}"
                    )

                print(
                    f"[AIMetadata] Batch {batch_num} OK — "
                    f"matched={len(batch_results)}/{len(batch)} "
                    f"sal={filled['salary_str']} type={filled['job_type_str']} "
                    f"exp={filled['experience_str']} mode={filled['work_mode_str']}"
                    f"{tokens}"
                )
            except Exception as exc:
                print(
                    f"[AIMetadata] Batch {batch_num} FAILED — "
                    f"{type(exc).__name__}: {exc}"
                )
                continue

    total_with_data = sum(
        1
        for m in results.values()
        if any(
            m.get(f)
            for f in ("salary_str", "job_type_str", "experience_str", "work_mode_str")
        )
    )
    print(
        f"[AIMetadata] Done — source={source} context={context} "
        f"total={len(results)}/{len(items)} with_data={total_with_data}"
    )
    return results
