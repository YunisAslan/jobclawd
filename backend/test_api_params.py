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
        if "/api-az/vacancies-az" in r.url:
            try:
                data = await r.json()
                if not fut.done():
                    fut.set_result((r.url, data))
            except Exception as e:
                pass
                
    page.on("response", handle_response)
    
    # Let's try to query explicitly Baku (1), Remote (2), Junior (2)
    # or just visit the URL directly with playwright
    print("Navigating...")
    await page.goto("https://www.jobsearch.az/vacancies?search=developer&city=1&work_modes=2&experience=2", wait_until="networkidle")
    
    try:
        url, data = await asyncio.wait_for(fut, timeout=10)
        print("Scraped URL details:", url)
        items = data.get("items", [])
        print("Total returned items:", data.get("total", len(items)))
        for i in items:
            print(f"- {i['title']} ({i['slug']})")
    except Exception as e:
        print("Error:", e)
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
