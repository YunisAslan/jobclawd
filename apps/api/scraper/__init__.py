import os
from typing import Optional
from patchright.async_api import async_playwright, Browser, Playwright

_playwright: Optional[Playwright] = None
_browser: Optional[Browser] = None


async def get_browser() -> Browser:
    global _playwright, _browser
    if _browser is None or not _browser.is_connected():
        _playwright = await async_playwright().start()
        launch_kwargs = {
            "headless": True,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ],
        }
        # Prefer a real, system-installed browser over patchright's headless-shell.
        # Google Chrome (amd64) > system chromium (arm64) > bundled chromium-headless-shell.
        if os.path.exists("/usr/bin/google-chrome") or os.path.exists("/usr/bin/google-chrome-stable"):
            launch_kwargs["channel"] = "chrome"
        elif os.path.exists("/usr/bin/chromium"):
            launch_kwargs["executable_path"] = "/usr/bin/chromium"
        elif os.path.exists("/usr/bin/chromium-browser"):
            launch_kwargs["executable_path"] = "/usr/bin/chromium-browser"
        _browser = await _playwright.chromium.launch(**launch_kwargs)
    return _browser


async def shutdown_browser():
    global _playwright, _browser
    if _browser:
        await _browser.close()
        _browser = None
    if _playwright:
        await _playwright.stop()
        _playwright = None
