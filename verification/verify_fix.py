
import asyncio
from playwright.async_api import async_playwright, expect
import json
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Setup LocalStorage
        # We need to simulate the state where "Dune" (known) and "Oppenheimer" (unknown/API-only) are in the list.
        # Dune ID: 693134 (Movie)
        # Oppenheimer ID: 872585 (Movie)
        # Wicked 2 (Example unknown): 1241982

        # We also set platform filters to something Dune is NOT on (e.g., Canal+)

        watchlist = [
            {"id": 693134, "added_at": "2024-01-01T00:00:00.000Z"}, # Dune (Known in data.js)
            {"id": 872585, "added_at": "2024-01-02T00:00:00.000Z"}  # Oppenheimer (Not in data.js, no type initially)
        ]

        selected_platforms = ["canal"] # Dune is not on Canal+

        await page.goto('http://localhost:8080/watchlist.html')

        await page.evaluate(f"""() => {{
            localStorage.setItem('watchlist', '{json.dumps(watchlist)}');
            localStorage.setItem('selectedPlatforms', '{json.dumps(selected_platforms)}');
            localStorage.setItem('userRegion', 'FR');
        }}""")

        # 2. Reload to apply changes
        await page.reload()

        # 3. Wait for content to load
        # We expect both to be visible
        try:
            # Wait for list to populate
            await page.wait_for_selector('#media-list .relative', timeout=10000)

            # Additional wait to ensure dynamic fetch for Oppenheimer completes
            # In a real test we'd wait for specific text
            await page.wait_for_selector('text=Oppenheimer', timeout=15000)
            await page.wait_for_selector('text=Dune', timeout=15000)

            print("✅ Both movies are present in DOM.")

            # Take screenshot
            screenshot_path = os.path.abspath('verification/watchlist_verification.png')
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"📸 Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"❌ Verification failed: {e}")
            await page.screenshot(path='verification/failed_verification.png')

        await browser.close()

asyncio.run(main())
