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
                    fut.set_result(data)
            except:
                pass
                
    page.on("response", handle_response)
    await page.goto("https://www.jobsearch.az/vacancies?search=developer")
    
    try:
        data = await asyncio.wait_for(fut, timeout=10)
        items = data.get("items", [])
        if items:
            import json
            print(json.dumps(items[0], indent=2))
    except Exception as e:
        print("Error:", e)
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
