import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context()
    page = await context.new_page()
    fut = asyncio.Future()
    
    async def handle_response(r):
        if r.url.endswith("polaris-production-web-social-media-developer-freelance-133794"):
            try:
                data = await r.json()
                if not fut.done():
                    fut.set_result(data)
            except Exception as e:
                pass
                
    page.on("response", handle_response)
    await page.goto("https://www.jobsearch.az/vacancies/polaris-production-web-social-media-developer-freelance-133794", wait_until="networkidle")
    
    try:
        data = await asyncio.wait_for(fut, timeout=10)
        import json
        print(json.dumps(data, indent=2)[:2000])
    except Exception as e:
        print("Error fetching JSON:", e)
        
    await context.close()
    
if __name__ == "__main__":
    asyncio.run(main())
