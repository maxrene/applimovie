
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the Slow Horses series page
        await page.goto('http://localhost:8080/serie.html?id=95480')

        # Wait for season cards to be loaded
        await page.wait_for_selector('.season-card', timeout=10000)
        print("✅ Season cards loaded.")

        # Click on the first season card to expand it
        await page.click('.season-card:first-child .cursor-pointer')
        print("✅ Clicked on the first season.")

        # Wait for the episodes container to be populated and visible
        await page.wait_for_selector('.season-card:first-child .episodes-container .flex.items-center.gap-4', timeout=5000)
        print("✅ Episodes loaded and visible.")

        # Take a screenshot
        await page.screenshot(path='seasons_verification.png')
        print("📸 Screenshot saved as seasons_verification.png")

        await browser.close()

asyncio.run(main())
