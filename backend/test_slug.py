import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context()
    page = await context.new_page()
    
    await page.goto("https://www.jobsearch.az/vacancies/polaris-production-web-social-media-developer-freelance-133794", wait_until="networkidle")
    
    print("Tags:")
    tags = await page.query_selector_all(".job-meta span, .job-details-item, [class*='meta']")
    for t in tags[:15]:
        text = await t.inner_text()
        print("-", text.strip())
        
    await context.close()
    
if __name__ == "__main__":
    asyncio.run(main())
