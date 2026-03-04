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
        if r.url.startswith("https://www.jobsearch.az/api-az"):
                print("FOUND API URL:", r.url)
                
    page.on("response", handle_response)
    
    print("Navigating...")
    await page.goto("https://www.jobsearch.az/", wait_until="networkidle")
    
    await asyncio.sleep(2)
    await context.close()

if __name__ == "__main__":
    asyncio.run(main())
