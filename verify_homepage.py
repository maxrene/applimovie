
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto('http://localhost:8080/index.html')

        # Wait for the popular container to have at least one media card
        await page.wait_for_selector('#popular-container .snap-start', timeout=10000)
        print("✅ Popular content loaded.")

        # Wait for the Netflix container to have at least one media card
        await page.wait_for_selector('#netflix-container .snap-start', timeout=10000)
        print("✅ Netflix content loaded.")

        await page.screenshot(path='homepage_verification.png')
        print("📸 Screenshot saved as homepage_verification.png")

        await browser.close()

asyncio.run(main())
