import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import get_browser

async def main():
    browser = await get_browser()
    context = await browser.new_context()
    page = await context.new_page()
    
    await page.goto("https://www.jobsearch.az/vacancies", wait_until="networkidle")
    
    print("--- CITIES ---")
    cities = await page.query_selector_all("select[name='city'] option")
    for c in cities:
        val = await c.get_attribute("value")
        text = await c.inner_text()
        print(f"City {val} = {text.strip()}")
        
    print("--- EXPERIENCE ---")
    exp = await page.query_selector_all("select[name='experience'] option, select[name*='experience'] option")
    for c in exp:
        val = await c.get_attribute("value")
        text = await c.inner_text()
        print(f"Exp {val} = {text.strip()}")

    print("--- ALL FORM NAMES ---")
    html = await page.content()
    import re
    names = set(re.findall(r'name="([^"]+)"', html))
    print("Names:", names)

    await context.close()

if __name__ == "__main__":
    asyncio.run(main())
