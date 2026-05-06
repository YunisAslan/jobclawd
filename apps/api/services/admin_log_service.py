"""
Admin log service — call log() from anywhere (sync or async) to record
system health events that appear in the /admin/dash panel.

Usage:
    from services.admin_log_service import log, alog

    # Sync context
    log("ERROR", "linkedin", "captcha_detected", "Captcha appeared during job search for 'python developer'")

    # Async context
    await alog("WARNING", "glassdoor", "bot_blocked", "Cloudflare challenge blocked the search page")
"""

import asyncio
from typing import Optional


def log(
    level: str,
    source: str,
    event: str,
    message: str,
    details: Optional[dict] = None,
) -> None:
    """Fire-and-forget log write (sync). Never raises."""
    try:
        from repositories.admin_logs_repo import insert_log
        insert_log(level, source, event, message, details)
    except Exception as e:
        print(f"[AdminLog] Failed to write log: {e}")


async def alog(
    level: str,
    source: str,
    event: str,
    message: str,
    details: Optional[dict] = None,
) -> None:
    """Async fire-and-forget log write. Never raises."""
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: log(level, source, event, message, details))
    except Exception:
        pass


# ── Convenience helpers ──────────────────────────────────────────────────────

def log_scraper_start(source: str, query: str, location: Optional[str] = None) -> None:
    loc_part = f" in '{location}'" if location else ""
    log("INFO", source, "scraper_start", f"Starting scrape for '{query}'{loc_part}")


def log_scraper_done(source: str, query: str, count: int) -> None:
    log(
        "SUCCESS" if count > 0 else "WARNING",
        source,
        "scraper_done",
        f"Scrape complete — {count} job{'s' if count != 1 else ''} found for '{query}'",
        {"count": count},
    )


def log_captcha(source: str, query: str, url: str = "") -> None:
    log(
        "CRITICAL",
        source,
        "captcha_detected",
        f"Captcha challenge detected while searching '{query}'. Scraper returned empty.",
        {"url": url},
    )


def log_bot_blocked(source: str, query: str, detail: str = "") -> None:
    log(
        "ERROR",
        source,
        "bot_blocked",
        f"Bot/firewall block encountered for '{query}'. {detail}".strip(),
    )


def log_login_wall(source: str, query: str) -> None:
    log(
        "WARNING",
        source,
        "login_wall",
        f"Login wall encountered for '{query}' — only public results visible.",
    )


def log_cloudflare(source: str, query: str) -> None:
    log(
        "ERROR",
        source,
        "cloudflare_challenge",
        f"Cloudflare challenge blocked the search page for '{query}'.",
    )


def log_timeout(source: str, query: str, elapsed_s: float = 0) -> None:
    elapsed = f" after {elapsed_s:.1f}s" if elapsed_s else ""
    log(
        "ERROR",
        source,
        "timeout",
        f"Request timed out{elapsed} for '{query}'. Scraper returned empty.",
        {"elapsed_s": elapsed_s},
    )


def log_scraper_error(source: str, query: str, error: str) -> None:
    log(
        "ERROR",
        source,
        "scraper_error",
        f"Unexpected error while scraping '{query}': {error[:300]}",
    )


def log_cache_hit(query: str) -> None:
    log("INFO", "cache", "cache_hit", f"Cache hit — returning cached results for '{query}'")


def log_cache_miss(query: str) -> None:
    log("INFO", "cache", "cache_miss", f"Cache miss — running full scrape for '{query}'")


def log_ai_filter(query: str, before: int, after: int, elapsed_s: float = 0) -> None:
    elapsed = f" in {elapsed_s:.1f}s" if elapsed_s else ""
    log(
        "INFO",
        "ai_filter",
        "ai_filter_done",
        f"AI filter reduced {before} → {after} jobs for '{query}'{elapsed}",
        {"before": before, "after": after},
    )
