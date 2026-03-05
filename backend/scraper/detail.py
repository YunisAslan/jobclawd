from scraper import get_browser
from models.schemas import JobDetailResponse
from utils.email_extractor import extract_emails


async def scrape_job_detail(url: str) -> JobDetailResponse:
    browser = await get_browser()
    context = await browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 720},
    )
    page = await context.new_page()

    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Extract title
        title = await page.evaluate("""
            () => {
                const t = document.querySelector('.vacancy__title');
                if (t) return t.textContent.trim();
                const h1 = document.querySelector('h1');
                return h1 ? h1.textContent.trim() : '';
            }
        """)

        # Extract company
        company = await page.evaluate("""
            () => {
                const c = document.querySelector('.company__title');
                if (c) return c.textContent.trim();
                const el = document.querySelector('.vacancy__start');
                return el ? el.textContent.trim() : '';
            }
        """)

        # Extract description from the content block
        description = await page.evaluate("""
            () => {
                const content = document.querySelector('#content_block .content-text');
                if (content) return content.innerText.trim();
                const body = document.querySelector('.vacancy');
                return body ? body.innerText.substring(0, 2000) : '';
            }
        """)

        # Click the apply button inside #apply-button to reveal the email
        email = None
        try:
            apply_link = page.locator("#apply-button a.apply")
            if await apply_link.count() > 0:
                await apply_link.click()
                # Wait for the email to appear
                try:
                    await page.wait_for_selector(
                        ".apply__send-mail",
                        timeout=5000,
                    )
                except Exception:
                    pass
                await page.wait_for_timeout(500)

                # Extract email from the revealed section
                email = await page.evaluate("""
                    () => {
                        const mailto = document.querySelector('#apply-button a[href^="mailto:"]');
                        if (mailto) return mailto.href.replace('mailto:', '').split('?')[0];

                        const sendMails = document.querySelectorAll('.apply__send-mail');
                        for (const el of sendMails) {
                            const text = el.textContent.trim();
                            if (text.includes('@')) return text;
                        }
                        return null;
                    }
                """)
        except Exception:
            pass

        # Fallback: check mailto links and body text
        if not email:
            mailto_emails = await page.evaluate("""
                () => {
                    const links = document.querySelectorAll('a[href^="mailto:"]');
                    return Array.from(links).map(
                        a => a.href.replace('mailto:', '').split('?')[0]
                    );
                }
            """)

            body_text = await page.inner_text("body")
            regex_emails = extract_emails(body_text)
            all_emails = list(dict.fromkeys(mailto_emails + regex_emails))
            email = all_emails[0] if all_emails else None

        return JobDetailResponse(
            title=title or "N/A",
            company=company or "N/A",
            description=description[:2000] if description else "",
            email=email,
            email_found=email is not None,
            apply_url=url,
            error_message=(
                None
                if email
                else "No email found in this listing. Please apply directly on the site."
            ),
        )

    finally:
        await context.close()
