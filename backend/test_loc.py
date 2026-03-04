import asyncio
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
            print("KEYS:", items[0].keys())
            print("ITEM:", items[0])
    except Exception as e:
        pass
    finally:
        await context.close()

if __name__ == "__main__":
    asyncio.run(main())
