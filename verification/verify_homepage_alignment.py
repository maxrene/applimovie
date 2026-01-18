
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Use mobile viewport
        page = await browser.new_page(viewport={'width': 375, 'height': 800})

        try:
            # Navigate to the app (running on localhost:3001)
            await page.goto("http://localhost:3001/index.html")

            # Wait for content to load
            # Wait for at least one media card to appear in the popular section
            await page.wait_for_selector("#popular-container a", timeout=10000)

            # Wait a bit more for images to load/layout to settle
            await page.wait_for_timeout(2000)

            # Take screenshot of the popular section
            # We can't easily scroll to everything in one screenshot, so full page
            await page.screenshot(path="verification/homepage_alignment.png", full_page=True)
            print("Screenshot saved to verification/homepage_alignment.png")

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="verification/error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
