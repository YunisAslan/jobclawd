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
        data = await asyncio.wait_for(fut, timeout=12)
        items = data.get("items", [])
        if items:
            import json
            print("KEYS:", items[0].keys())
            item = items[0]
            print("CITY:", item.get("city"))
            print("WORK MODE:", item.get("work_mode") or item.get("work_type"))
            print("EXPERIENCE:", item.get("experience") or item.get("category"))
            print("JOB TYPE:", item.get("job_type"))
            print("FULL:", json.dumps(item, indent=2))
    except Exception as e:
        print("ERROR:", e)
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
