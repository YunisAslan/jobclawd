import asyncio
import json
import os
import re
from typing import Optional

import httpx

from utils.job_meta_extractor import (
    normalize_experience_years,
    normalize_job_type,
    normalize_seniority,
    normalize_work_mode,
    primary_experience_value,
)

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
_OPENAI_MODEL = os.getenv("OPENAI_METADATA_MODEL", "gpt-4.1-mini").strip()
_OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

_AI_METADATA_DEBUG = os.getenv("AI_METADATA_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
_TIMEOUT = 30.0
_BATCH_SIZE = 20

# ── Token usage tracking ─────────────────────────────────────────────────────
# Per-million-token pricing for known models
_MODEL_PRICING: dict[str, tuple[float, float]] = {
    # (input_per_1M, output_per_1M)
    "gpt-4.1-mini":  (0.40, 1.60),
    "gpt-4.1-nano":  (0.10, 0.40),
    "gpt-4.1":       (2.00, 8.00),
    "gpt-4o-mini":   (0.15, 0.60),
    "gpt-4o":        (2.50, 10.00),
}

_token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "requests": 0}


def reset_token_usage() -> None:
    _token_usage["prompt_tokens"] = 0
    _token_usage["completion_tokens"] = 0
    _token_usage["requests"] = 0


def get_token_usage() -> dict:
    """Return accumulated token usage and estimated cost."""
    prompt = _token_usage["prompt_tokens"]
    completion = _token_usage["completion_tokens"]
    requests = _token_usage["requests"]

    pricing = _MODEL_PRICING.get(_OPENAI_MODEL)
    cost = None
    if pricing:
        input_rate, output_rate = pricing
        cost = (prompt / 1_000_000) * input_rate + (completion / 1_000_000) * output_rate

    return {
        "model": _OPENAI_MODEL,
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": prompt + completion,
        "requests": requests,
        "cost_usd": cost,
    }

_SYSTEM_PROMPT = """\
You are a job listing analyzer. You read job postings in ANY language and extract structured job metadata. Return JSON only.

For each job, extract:

1. **salary**: The actual compensation amount offered to the employee. MUST be a monetary value with currency symbol or name.
   - Valid: "$80k-$120k", "1500-2000 AZN", "от 50000 руб", "€3000/month"
   - NOT salary: percentages ("up to 200%", "10% bonus"), headcounts ("200 employees"), years ("founded in 2005"), KPIs, discounts, or any non-compensation number
   - null if no actual salary/wage amount is mentioned

2. **job_type**: One of: Full-time, Part-time, Contract, Freelance, Temporary, Internship, Seasonal, Commission, Fixed-term.
   - Use structured hints or card chips first if provided.
   - Read the actual text and translate from any language to the English equivalent.
   - null if not stated.

3. **seniority**: Candidate seniority level only.
   - Examples: Intern, New Grad, Early Career, Junior, Mid-level, Senior, Lead, Manager
   - Use explicit role level labels, title qualifiers, or structured chips.
   - Do NOT infer Lead/Manager from verbs in responsibilities like "Lead the process", "Manage timelines", "Support project execution".
   - null if no seniority level is stated.

4. **experience_years**: Candidate years of experience only.
   - Examples: "3+ years", "2-4 years", "minimum 5 years"
   - Company age ("founded 20 years ago") is NOT candidate experience.
   - null if years are not stated.

5. **work_mode**: One of: Remote, Hybrid, On-site. ONLY extract this if the posting explicitly describes WHERE the employee will work.
   - "work from home", "remote position", "fully remote" → Remote
   - "hybrid model", "hybrid work" → Hybrid
   - "on-site", "office-based", "in-office" → On-site
   - A job category label, a city name, or "remote" used in other contexts (remote support, remote access) is NOT a work mode
   - If structured hints/card chips say Remote/Hybrid/On-site, prefer them unless the text explicitly contradicts them.
   - "Office available if you want to come in" + "apply to work remotely" should be Remote, not Hybrid.
   - null if the posting doesn't clearly state the work arrangement

6. **apply_method**: How should a candidate apply? One of: email, easy_apply, external, direct.
   - "email" = posting says to send CV/resume via email, or provides an email address for applications
   - "easy_apply" = platform's built-in one-click apply (LinkedIn Easy Apply, Indeed Apply)
   - "external" = redirects to company website, ATS portal, or external form (Greenhouse, Lever, Workday, etc.)
   - "direct" = apply directly on the job board page itself
   - null if unclear

Use this precedence:
1. Structured hints / card badges / platform metadata
2. Explicit requirements and qualifications
3. Title and summary labels
4. General narrative text

Return: {"results": [{"id": "...", "salary": ..., "job_type": ..., "seniority": ..., "experience_years": ..., "work_mode": ..., "apply_method": ...}]}
Use null for any field you cannot confidently extract."""

def _clean(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split()).strip()
    return cleaned or None


def _normalize_work_mode(value: object) -> Optional[str]:
    return normalize_work_mode(value)


def _normalize_job_type(value: object) -> Optional[str]:
    return normalize_job_type(value)


_APPLY_METHOD_MAP = {
    "email": "email",
    "easy_apply": "easy_apply", "easy apply": "easy_apply", "easyapply": "easy_apply",
    "external": "external", "ats": "external", "company website": "external", "company site": "external",
    "direct": "direct", "on-site": "direct", "on site": "direct",
}


def _normalize_apply_method(value: object) -> Optional[str]:
    cleaned = _clean(value)
    if not cleaned:
        return None
    return _APPLY_METHOD_MAP.get(cleaned.lower(), cleaned if cleaned in _APPLY_METHOD_MAP.values() else None)


def _normalize_result(item: dict) -> dict:
    seniority = normalize_seniority(item.get("seniority"))
    experience_years = normalize_experience_years(item.get("experience_years"))
    experience = primary_experience_value(seniority, experience_years)
    return {
        "salary_str": _clean(item.get("salary")),
        "job_type_str": _normalize_job_type(item.get("job_type")),
        "seniority_str": seniority,
        "experience_years_str": experience_years,
        "experience_str": experience,
        "work_mode_str": _normalize_work_mode(item.get("work_mode")),
        "apply_method_str": _normalize_apply_method(item.get("apply_method")),
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

        structured_hints = item.get("structured_hints") or {}
        if structured_hints:
            entry["structured_hints"] = {
                key: value for key, value in structured_hints.items() if value
            }

        if item.get("card_badges"):
            entry["card_badges"] = item["card_badges"]

        if item.get("topline_labels"):
            entry["topline_labels"] = item["topline_labels"]

        if item.get("extract_fields"):
            entry["extract_fields"] = item["extract_fields"]

        jobs.append(entry)

    return json.dumps({"jobs": jobs}, ensure_ascii=False)


async def extract_metadata_ai_batch(
    items: list[dict], *, source: str, context: str,
    progress_cb: Optional[object] = None,
) -> dict[str, dict]:
    """
    Extract metadata via OpenAI for a batch of jobs.
    Each item: {"id", "title", "company", "location_str", "snippet", "detail_text"}
    Returns: {"id": {"salary_str", "job_type_str", "seniority_str", "experience_years_str", "work_mode_str"}}
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

                # Accumulate tokens for cost tracking
                if usage:
                    _token_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                    _token_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                    _token_usage["requests"] += 1

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
                    "seniority_str": 0,
                    "experience_years_str": 0,
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
                    f"sen={filled['seniority_str']} yrs={filled['experience_years_str']} "
                    f"mode={filled['work_mode_str']}"
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
        if any(
            m.get(f)
            for f in (
                "salary_str",
                "job_type_str",
                "seniority_str",
                "experience_years_str",
                "work_mode_str",
            )
        )
    )
    print(
        f"[AIMetadata] Done — source={source} context={context} "
        f"total={len(results)}/{len(items)} with_data={total_with_data}"
    )
    return results
