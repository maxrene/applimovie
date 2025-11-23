
import asyncio
from playwright.async_api import async_playwright
import json

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Setup LocalStorage with an item NOT in data.js and NO type
        # ID 1241982 is "Moana 2" (likely not in data.js, checks below) or some random ID.
        # Let's use an ID that definitely exists on TMDB but likely not in local data.js.
        # "Wicked Part Two" ID: 1241982 (example, might be wrong, let's use a known movie ID not in data.js)
        # "Oppenheimer": 872585

        await page.goto('http://localhost:8080/watchlist.html')

        # Check if Oppenheimer is in data.js (it shouldn't be based on previous file read)
        # We add it with NO type.
        watchlist = [{"id": 872585, "added_at": "2024-01-01T00:00:00.000Z"}]

        await page.evaluate(f"""() => {{
            localStorage.setItem('watchlist', '{json.dumps(watchlist)}');
            localStorage.setItem('userRegion', 'FR');
        }}""")

        # 2. Reload to apply changes
        await page.reload()

        # 3. Wait for content
        # It should try to fetch. If it fails to fetch because type is missing, it won't show.
        try:
            # wait a bit for fetch
            await asyncio.sleep(2)

            content = await page.content()
            if "Oppenheimer" in content:
                print("✅ Oppenheimer is visible.")
            else:
                print("❌ Oppenheimer is NOT visible (Missing type caused it to be filtered).")

        except Exception as e:
            print(f"Error: {e}")

        await browser.close()

asyncio.run(main())
