import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context(viewport={"width": 1280, "height": 720})
    page = await context.new_page()
    fut = asyncio.Future()
    
    async def handle_response(r):
        if "/api-az/vacancies-az" in r.url:
            try:
                data = await r.json()
                if not fut.done():
                    fut.set_result(data)
            except Exception as e:
                pass
                
    page.on("response", handle_response)
    print("GOING TO URL")
    await page.goto("https://www.jobsearch.az/vacancies?search=developer", wait_until="networkidle")
    
    try:
        data = await asyncio.wait_for(fut, timeout=15)
        items = data.get("items", [])
        if items:
            import json
            print(json.dumps(items[0], indent=2))
        else:
            print("NO ITEMS IN DATA", data.keys())
    except Exception as e:
        print("Error in timeout:", e)
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
