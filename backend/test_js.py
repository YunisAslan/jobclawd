import asyncio
import sys
# Add parent dir to path so we can import scraper
import os
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
    print("Navigating...")
    await page.goto("https://www.jobsearch.az/vacancies?search=developer")
    
    try:
        data = await asyncio.wait_for(fut, timeout=10)
        print("Keys:", data.keys())
        if "meta" in data:
            print("Meta:", data["meta"])
        elif "links" in data:
            print("Links:", data["links"])
    except Exception as e:
        print("Error:", e)
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
