import asyncio
import json
import os
import re
from typing import Optional

import httpx

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

_AI_METADATA_DEBUG = os.getenv("AI_METADATA_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
_TIMEOUT = 30.0
_BATCH_SIZE = 20

_SYSTEM_PROMPT = """\
You are a job listing analyzer. You read job postings in ANY language and extract 4 fields. Return JSON only.

For each job, extract:

1. **salary**: The actual compensation amount offered to the employee. MUST be a monetary value with currency symbol or name.
   - Valid: "$80k-$120k", "1500-2000 AZN", "от 50000 руб", "€3000/month"
   - NOT salary: percentages ("up to 200%", "10% bonus"), headcounts ("200 employees"), years ("founded in 2005"), KPIs, discounts, or any non-compensation number
   - null if no actual salary/wage amount is mentioned

2. **job_type**: One of: Full-time, Part-time, Contract, Freelance, Temporary, Internship. Read the actual text — translate from any language to the English equivalent. null if not stated.

3. **experience**: What experience level or years are required?
   - If title says Senior/Lead/Junior/Intern/Mid etc → use that word
   - If text says "3+ years", "minimum 2 years" (in any language) → write "3+ years", "2+ years"
   - Company age ("founded 20 years ago") is NOT experience requirement
   - null if nothing about candidate experience is mentioned

4. **work_mode**: One of: Remote, Hybrid, On-site. ONLY extract this if the posting explicitly describes WHERE the employee will work.
   - "work from home", "remote position", "fully remote" → Remote
   - "hybrid model", "hybrid work" → Hybrid
   - "on-site", "office-based", "in-office" → On-site
   - A job category label, a city name, or "remote" used in other contexts (remote support, remote access) is NOT a work mode
   - null if the posting doesn't clearly state the work arrangement

Return: {"results": [{"id": "...", "salary": ..., "job_type": ..., "experience": ..., "work_mode": ...}]}
Use null for any field you cannot confidently extract."""


_WORK_MODE_MAP = {
    "remote": "Remote", "work from home": "Remote", "wfh": "Remote",
    "hybrid": "Hybrid",
    "on-site": "On-site", "onsite": "On-site", "on site": "On-site",
    "in-person": "On-site", "in person": "On-site", "office-based": "On-site",
}

_JOB_TYPE_MAP = {
    "full-time": "Full-time", "full time": "Full-time", "fulltime": "Full-time",
    "part-time": "Part-time", "part time": "Part-time", "parttime": "Part-time",
    "contract": "Contract", "contractor": "Contract",
    "freelance": "Freelance",
    "temporary": "Temporary", "temp": "Temporary",
    "internship": "Internship", "intern": "Internship",
    "seasonal": "Seasonal", "commission": "Commission",
}


def _clean(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split()).strip()
    return cleaned or None


def _normalize_work_mode(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    return _WORK_MODE_MAP.get(cleaned.lower(), cleaned if cleaned in ("Remote", "Hybrid", "On-site") else None)


def _normalize_job_type(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    return _JOB_TYPE_MAP.get(cleaned.lower(), cleaned if cleaned in _JOB_TYPE_MAP.values() else None)


def _normalize_result(item: dict) -> dict:
    return {
        "salary_str": _clean(item.get("salary")),
        "job_type_str": _normalize_job_type(item.get("job_type")),
        "experience_str": _clean(item.get("experience")),
        "work_mode_str": _normalize_work_mode(item.get("work_mode")),
    }


def _chunk(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def ai_metadata_enabled() -> bool:
    return bool(_OPENAI_API_KEY)


def _build_user_message(batch: list[dict]) -> str:
    """Build a clean, minimal message with only the data AI needs."""
    jobs = []
    for item in batch:
        entry: dict = {"id": item["id"]}

        # Title is always important
        if item.get("title"):
            entry["title"] = item["title"]

        # Combine all text content
        text_parts = []
        for key in ("snippet", "detail_text"):
            if item.get(key):
                text_parts.append(item[key])
        text = " ".join(text_parts).strip()

        if text:
            # Keep more text for better accuracy — 3500 chars
            if len(text) > 3500:
                text = text[:2500] + " ... " + text[-800:]
            entry["text"] = text

        jobs.append(entry)

    return json.dumps({"jobs": jobs}, ensure_ascii=False)


async def extract_metadata_ai_batch(
    items: list[dict], *, source: str, context: str,
    progress_cb: Optional[object] = None,
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

                # Retry loop for rate limits (429)
                resp = None
                for attempt in range(4):
                    resp = await client.post(
                        f"{_OPENAI_BASE_URL}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    if resp.status_code != 429:
                        break
                    # Parse retry delay from response or use exponential backoff
                    retry_match = re.search(r"try again in (\d+(?:\.\d+)?)s", resp.text)
                    wait = float(retry_match.group(1)) + 0.5 if retry_match else (2 ** attempt) * 2
                    print(f"[AIMetadata] Batch {batch_num} rate limited, retrying in {wait:.1f}s...")
                    await asyncio.sleep(wait)

                if resp is None or resp.status_code >= 400:
                    print(
                        f"[AIMetadata] Batch {batch_num} ERROR "
                        f"{resp.status_code if resp else 'no response'}: "
                        f"{resp.text[:500] if resp else ''}"
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
                filled = {"salary_str": 0, "job_type_str": 0, "experience_str": 0, "work_mode_str": 0}
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

                # Report progress
                if progress_cb:
                    processed = min(batch_num * _BATCH_SIZE, len(items))
                    await progress_cb(processed, len(items))

            except Exception as exc:
                print(
                    f"[AIMetadata] Batch {batch_num} FAILED — "
                    f"{type(exc).__name__}: {exc}"
                )
                continue
            finally:
                # Pause between batches to stay under TPM rate limits
                if batch_num < len(items) // _BATCH_SIZE + 1:
                    await asyncio.sleep(1)

    total_with_data = sum(
        1
        for m in results.values()
        if any(m.get(f) for f in ("salary_str", "job_type_str", "experience_str", "work_mode_str"))
    )
    print(
        f"[AIMetadata] Done — source={source} context={context} "
        f"total={len(results)}/{len(items)} with_data={total_with_data}"
    )
    return results
