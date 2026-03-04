import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto("https://www.jobsearch.az/vacancies", wait_until="networkidle")
    
    html = await page.content()
    import re
    match = re.search(r'window\.__NUXT__\s*=\s*(.+?);?<\/script>', html, re.DOTALL)
    if match:
        print("FOUND NUXT")
        with open("/tmp/nuxt.js", "w") as f:
            f.write(match.group(1))
    else:
        print("NO NUXT")
    await context.close()

if __name__ == "__main__":
    asyncio.run(main())
