import asyncio
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto("https://www.jobsearch.az/vacancies", wait_until="networkidle")
    
    html = await page.content()
    # It might be in window.__NUXT__ or something similar
    import re
    import json
    match = re.search(r'window\.__NUXT__\s*=\s*([^;]+);', html)
    if match:
        print("FOUND NUXT")
        # Just write it to a file
        with open("/tmp/nuxt.js", "w") as f:
            f.write(match.group(1))
    else:
        print("NO NUXT")
    await context.close()

if __name__ == "__main__":
    asyncio.run(main())
